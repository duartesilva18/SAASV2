from fastapi import APIRouter, Request, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
import requests
import json
import logging
import re
import hmac
import hashlib
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, date, timezone
from typing import Optional, Dict, List
import unicodedata
from difflib import SequenceMatcher

from ..core.config import settings
from ..core.dependencies import get_db
from ..models import database as models
from ..core.limiter import limiter
from ..core.telegram_translations import get_telegram_t

logger = logging.getLogger("telegram_webhook")


class AIUnavailableError(Exception):
    """Levantada quando a IA (OpenAI) não está disponível (quota/plano esgotado)."""
    pass


def _telegram_lang(from_user: Optional[dict]) -> str:
    """Infer bot language from Telegram user (when app user has no language set)."""
    code = (from_user or {}).get("language_code") or "pt"
    return "en" if (code and code.lower().startswith("en")) else "pt"
# Não adicionar handlers aqui - usar os do logging root para evitar duplicação

router = APIRouter(prefix='/telegram', tags=['webhooks'])

# Rate Limiting
_rate_limit_store = defaultdict(list)  # chat_id -> [timestamps]
_rate_limit_window = timedelta(minutes=1)
_rate_limit_max_messages = 10  # Máximo 10 mensagens por minuto

def check_rate_limit(chat_id: str) -> bool:
    """Verifica se o chat_id está dentro do limite de rate"""
    now = datetime.now()
    # Limpar timestamps antigos
    _rate_limit_store[chat_id] = [
        ts for ts in _rate_limit_store[chat_id]
        if now - ts < _rate_limit_window
    ]
    
    # Verificar limite
    if len(_rate_limit_store[chat_id]) >= _rate_limit_max_messages:
        return False  # Limite excedido
    
    _rate_limit_store[chat_id].append(now)
    return True

def normalize_text(text: str) -> str:
    """Normaliza texto removendo acentos e símbolos"""
    # Remove acentos
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    # Remove símbolos e converte para minúsculas
    text = re.sub(r'[^\w\s]', '', text.lower())
    return text

def similarity_score(str1: str, str2: str) -> float:
    """Calcula similaridade entre duas strings (0.0 a 1.0)"""
    return SequenceMatcher(None, str1, str2).ratio()

def find_best_category_match(user_input: str, categories: List[models.Category], threshold: float = 0.6) -> Optional[models.Category]:
    """
    Encontra a categoria mais similar ao input do utilizador usando similaridade de strings.
    Retorna a categoria se a similaridade for >= threshold, caso contrário None.
    """
    user_input_normalized = normalize_text(user_input)
    best_match = None
    best_score = 0.0
    
    for cat in categories:
        cat_name_normalized = normalize_text(cat.name)
        
        # Calcular similaridade
        score = similarity_score(user_input_normalized, cat_name_normalized)
        
        # Também verificar se uma está contida na outra (match parcial)
        if user_input_normalized in cat_name_normalized or cat_name_normalized in user_input_normalized:
            score = max(score, 0.8)  # Boost para matches parciais
        
        # Verificar palavras individuais (útil para "aliments" vs "alimentacao")
        user_words = set(user_input_normalized.split())
        cat_words = set(cat_name_normalized.split())
        if user_words and cat_words:
            # Se há palavras em comum, aumentar score
            common_words = user_words.intersection(cat_words)
            if common_words:
                word_score = len(common_words) / max(len(user_words), len(cat_words))
                score = max(score, word_score * 0.9)
        
        # Verificar prefixo comum (útil para "aliments" vs "alimentacao")
        min_len = min(len(user_input_normalized), len(cat_name_normalized), 7)
        if min_len >= 4:
            if user_input_normalized[:min_len] == cat_name_normalized[:min_len]:
                score = max(score, 0.75)  # Boost para prefixos comuns
        
        if score > best_score:
            best_score = score
            best_match = cat
    
    # Só retornar se a similaridade for suficientemente alta
    if best_score >= threshold:
        logger.info(f"✓ Categoria encontrada por similaridade: '{best_match.name}' (score: {best_score:.2f}) para '{user_input}'")
        return best_match
    
    return None

def find_similar_transaction(text: str, workspace_id: uuid.UUID, db: Session, tipo: str) -> Optional[uuid.UUID]:
    """
    Busca transações similares no histórico para usar categoria do cache.
    Retorna category_id se encontrar match forte.
    NÃO usa transações de seed (1 cêntimo) para cache.
    """
    # Normalizar texto de entrada
    text_normalized = normalize_text(text)
    words = set(text_normalized.split())
    
    if not words:
        logger.info(f"Texto vazio após normalização: '{text}'")
        return None
    
    # Buscar transações do histórico (últimos 180 dias para melhor aprendizagem)
    # Quanto mais transações, melhor o sistema aprende os padrões do utilizador
    cutoff_date = date.today() - timedelta(days=180)
    
    transactions = db.query(models.Transaction).filter(
        models.Transaction.workspace_id == workspace_id,
        models.Transaction.transaction_date >= cutoff_date,
        models.Transaction.category_id.isnot(None)
    ).order_by(models.Transaction.transaction_date.desc()).limit(500).all()  # Aumentado para 500 para mais dados
    
    # Filtrar por tipo (expense = negativo, income = positivo)
    # E EXCLUIR transações de seed (1 cêntimo) - não devem ser usadas para cache
    if tipo == "expense":
        transactions = [t for t in transactions if t.amount_cents < 0 and abs(t.amount_cents) != 1]
    else:
        transactions = [t for t in transactions if t.amount_cents > 0 and abs(t.amount_cents) != 1]
    
    logger.info(f"Buscando transações similares para '{text}' (tipo: {tipo}). Total de transações a verificar: {len(transactions)}")
    
    best_match = None
    best_score = 0
    best_description = None
    
    for trans in transactions:
        if not trans.description:
            continue
        
        # Normalizar descrição da transação
        desc_normalized = normalize_text(trans.description)
        desc_words = set(desc_normalized.split())
        
        # Calcular score (palavras em comum)
        common_words = words.intersection(desc_words)
        score = len(common_words)
        
        # Bonus para palavras importantes (>4 caracteres)
        important_words = [w for w in common_words if len(w) > 4]
        score += len(important_words) * 2  # Bonus maior para palavras importantes
        
        # Bonus por recência: transações mais recentes têm mais peso (aprendizagem contínua)
        days_ago = (date.today() - trans.transaction_date).days
        if days_ago <= 7:
            score += 3  # Muito recente (última semana)
        elif days_ago <= 30:
            score += 2  # Recente (último mês)
        elif days_ago <= 90:
            score += 1  # Moderado (últimos 3 meses)
        # Transações antigas (90-180 dias) não têm bonus
        
        # Score mínimo mais rigoroso: precisa de pelo menos 2 palavras comuns E pelo menos 1 palavra importante (>4 chars)
        # OU 3+ palavras comuns (mesmo que curtas)
        has_important_word = any(len(w) > 4 for w in common_words)
        min_words_required = 3 if not has_important_word else 2
        
        if score >= min_words_required and (has_important_word or len(common_words) >= 3):
            if score > best_score:
                best_score = score
                best_match = trans.category_id
                best_description = trans.description
                logger.info(f"Match encontrado: '{trans.description}' (score: {score}, palavras comuns: {common_words}, dias atrás: {days_ago})")
    
    if best_match:
        logger.info(f"Melhor match no cache: '{best_description}' (score: {best_score}) -> category_id: {best_match}")
    else:
        logger.info(f"Nenhum match forte encontrado no cache para '{text}' (melhor score: {best_score})")
    
    return best_match

def validate_email(email: str) -> bool:
    """Valida formato de email"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def parse_transaction(text: str, workspace: models.Workspace, db: Session) -> Optional[Dict]:
    """
    Extrai valor, tipo e categoria de uma mensagem de texto.
    Suporta múltiplas transações separadas por espaço.
    """
    # Suporta múltiplas transações: "Almoço 15€ Gasolina 10€"
    transactions = []
    
    # Regex para encontrar valores monetários
    # Suporta: "15€", "15.50€", "1.234,56€", "1 234€"
    valor_pattern = r'(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d+)?)\s*(?:€|eur|euros|e)?'
    
    # Encontrar todos os valores na mensagem
    valor_matches = list(re.finditer(valor_pattern, text, re.IGNORECASE))
    
    if not valor_matches:
        return None
    
    # Identificar tipo (despesa ou receita)
    text_lower = text.lower()
    income_keywords = [
        'recebi', 'salário', 'ordenado', 'ganhei', 'vendi', 'rendimento', 
        'bonus', 'vencimento', 'reembolso', 'subsídio', 'prémio', 'premio'
    ]
    # Keywords para resgate de vault (investimento/emergência)
    vault_withdrawal_keywords = [
        'retirar', 'resgate', 'retirei', 'sacar', 'levantei', 'withdraw', 'withdrawal'
    ]
    tipo = "income" if any(k in text_lower for k in income_keywords) else "expense"
    is_vault_withdrawal = any(k in text_lower for k in vault_withdrawal_keywords)
    
    # Buscar categorias do workspace
    categories = db.query(models.Category).filter(
        models.Category.workspace_id == workspace.id,
        models.Category.type == tipo
    ).all()
    
    if not categories:
        return None
    
    # Verificar se o utilizador especificou uma categoria na mensagem
    # Formato: "Bolachas - Alimentação 100€" ou "Bolachas - alimentos 100€"
    text_lower_normalized = normalize_text(text)
    specified_category = None
    specified_category_name = None
    
    # Primeiro, verificar se há um hífen separando descrição da categoria
    # Formato: "Descrição - Categoria Valor€"
    if ' - ' in text or ' -' in text or '- ' in text:
        # Dividir por hífen
        parts = re.split(r'\s*-\s*', text, 1)
        if len(parts) == 2:
            # parts[0] = descrição, parts[1] = categoria + valor
            category_part = parts[1]
            # Remover o valor monetário da parte da categoria
            category_part_clean = re.sub(r'\s*\d+[.,\s]*\d*\s*(?:€|eur|euros|e)?', '', category_part, flags=re.IGNORECASE).strip()
            category_part_normalized = normalize_text(category_part_clean)
            
            # Usar similaridade de strings para encontrar a melhor correspondência
            specified_category = find_best_category_match(category_part_clean, categories, threshold=0.6)
            if specified_category:
                specified_category_name = specified_category.name
    
    # Se não encontrou com hífen, verificar match direto no texto completo usando similaridade
    if not specified_category:
        # Primeiro, verificar match exato (mais rápido)
        for cat in categories:
            cat_name_normalized = normalize_text(cat.name)
            if cat_name_normalized in text_lower_normalized:
                specified_category = cat
                specified_category_name = cat.name
                logger.info(f"✓ Categoria especificada na mensagem (match direto): '{cat.name}' (id: {cat.id})")
                break
        
        # Se não encontrou match exato, usar similaridade em palavras do texto
        if not specified_category:
            text_words = text_lower_normalized.split()
            for word in text_words:
                if len(word) >= 4:  # Só verificar palavras com pelo menos 4 caracteres
                    match = find_best_category_match(word, categories, threshold=0.7)
                    if match:
                        specified_category = match
                        specified_category_name = match.name
                        logger.info(f"✓ Categoria encontrada por similaridade na palavra '{word}': '{match.name}'")
                        break
    
    # Processar cada valor encontrado
    for i, valor_match in enumerate(valor_matches):
        # Extrair valor
        valor_str = valor_match.group(1).replace(' ', '').replace('.', '').replace(',', '.')
        try:
            amount = float(valor_str)
        except ValueError:
            continue
        
        # Extrair descrição (texto antes do valor, ou texto entre valores)
        # Se há hífen no texto, a descrição é apenas a parte ANTES do hífen
        if ' - ' in text or ' -' in text or '- ' in text:
            # Dividir o texto completo por hífen
            text_parts = re.split(r'\s*-\s*', text, 1)
            if len(text_parts) == 2:
                # A descrição é a primeira parte (antes do hífen)
                first_part = text_parts[0].strip()
                # Remover qualquer valor monetário que possa estar na primeira parte
                description = re.sub(r'\s*\d+[.,\s]*\d*\s*(?:€|eur|euros|e)?', '', first_part, flags=re.IGNORECASE).strip()
                logger.info(f"Descrição após separar por hífen: '{description}'")
            else:
                # Fallback: usar lógica normal
                start_pos = valor_matches[i-1].end() if i > 0 else 0
                end_pos = valor_match.start()
                description = text[start_pos:end_pos].strip()
        else:
            # Sem hífen: usar lógica normal
            start_pos = valor_matches[i-1].end() if i > 0 else 0
            end_pos = valor_match.start()
            description = text[start_pos:end_pos].strip()
        
        # Limpar descrição (remover categoria se foi especificada sem hífen)
        words_to_remove = ['€', 'euro', 'euros', 'eur', 'gastei', 'paguei', 'recebi', 
                          'em', 'no', 'na', 'de', 'do', 'da', 'com', 'para']
        
        # Se categoria foi especificada (sem hífen), removê-la da descrição (incluindo variações parciais)
        if specified_category and not (' - ' in text or ' -' in text or '- ' in text):
                desc_words = description.split()
                category_name_normalized = normalize_text(specified_category.name)
                # Remover palavras que correspondem à categoria (exato ou parcial)
                filtered_words = []
                for word in desc_words:
                    word_normalized = normalize_text(word)
                    # Verificar se a palavra é parte da categoria ou vice-versa
                    is_category_word = (
                        word_normalized == category_name_normalized or
                        category_name_normalized in word_normalized or
                        word_normalized in category_name_normalized
                    )
                    if not is_category_word:
                        filtered_words.append(word)
                description = " ".join(filtered_words).strip()
                logger.info(f"Descrição após remover categoria '{specified_category.name}': '{description}'")
        
        desc_words = description.split()
        final_desc_words = [w for w in desc_words if w.lower() not in words_to_remove]
        
        if final_desc_words:
            description = " ".join(final_desc_words).strip()
        else:
            description = "Transação Telegram"
        
        inference_source = "fallback"
        needs_review = True
        decision_reason = ""
        # Se categoria foi especificada, usar diretamente (SEM ir ao motor)
        if specified_category:
            category_id = specified_category.id
            inference_source = "explicit"
            needs_review = False
            decision_reason = f"explicit:{specified_category_name}"
            logger.info(f"✓ Usando categoria especificada pelo utilizador: '{specified_category_name}' (id: {category_id})")
        else:
            # Motor de categorização: regras, token-scoring, caches, Gemini fallback
            try:
                from ..core.categorization_engine import infer_category
                from ..core.config import settings
                cat_id, source, needs_review, conf, reason, explain = infer_category(
                    description,
                    workspace.id,
                    tipo,
                    categories,
                    db,
                    models,
                    settings,
                    explicit_category_id=None,
                    use_gemini=True,
                )
                category_id = cat_id
                inference_source = source
                decision_reason = reason
                if category_id:
                    logger.info(f"Categorização: source={source}, confidence={conf:.2f}, needs_review={needs_review}")
                    # Se OpenAI retornou sucesso, guardar no cache (o motor não faz save para openai)
                    if source == 'openai' and category_id:
                        description_normalized = normalize_text(description)
                        category_obj = next((c for c in categories if c.id == category_id), None)
                        cat_name = category_obj.name if category_obj else "Outros"
                        save_cached_category(description_normalized, workspace.id, category_id, cat_name, tipo, db, is_common=True)
            except Exception as e:
                logger.warning(f"Motor de categorização falhou, usando fallback legado: {e}")
                # Fallback legado
                category_id = find_similar_transaction(description, workspace.id, db, tipo)
                if not category_id:
                    category_id = get_cached_category(normalize_text(description), workspace.id, tipo, categories, db)
                if not category_id:
                    category_id = categorize_with_ai(description, categories, tipo, text, workspace.id, db)
                    if category_id:
                        cat_obj = next((c for c in categories if c.id == category_id), None)
                        save_cached_category(normalize_text(description), workspace.id, category_id, cat_obj.name if cat_obj else "Outros", tipo, db, is_common=True)
                inference_source = "legacy_fallback"
                decision_reason = "legacy_fallback"
        
        # Se ainda não encontrou (nem cache nem IA), usar primeira categoria do tipo
        if not category_id and categories:
            logger.info(f"Usando primeira categoria do tipo '{tipo}' como fallback")
            category_id = categories[0].id
        
        # Verificar se a categoria é de vault (investimento/emergência)
        # Buscar categoria diretamente da base de dados para garantir que temos todos os dados
        category_obj = db.query(models.Category).filter(models.Category.id == category_id).first()
        if not category_obj:
            # Fallback: procurar na lista de categorias já carregadas
            category_obj = next((cat for cat in categories if cat.id == category_id), None)
        is_vault_category = category_obj and category_obj.vault_type != 'none' if category_obj else False
        
        transactions.append({
            "amount": amount,
            "description": description[:255],
            "type": tipo,
            "category_id": category_id,
            "inference_source": inference_source,
            "needs_review": needs_review,
            "decision_reason": decision_reason,
            "is_vault": is_vault_category,
            "is_vault_withdrawal": is_vault_withdrawal if is_vault_category else False
        })
    
    # Retornar primeira transação ou lista se múltiplas
    if len(transactions) == 1:
        return transactions[0]
    return {"multiple": True, "transactions": transactions}

def get_cached_category(description_normalized: str, workspace_id: uuid.UUID, tipo: str, categories: List[models.Category], db: Session) -> Optional[uuid.UUID]:
    """
    Verifica se existe uma categorização em cache para esta descrição.
    Primeiro verifica cache do workspace (privado), depois cache global (partilhado).
    Retorna category_id se encontrar.
    """
    # 1. Verificar cache privado do workspace
    cache_entry = db.query(models.CategoryMappingCache).filter(
        models.CategoryMappingCache.workspace_id == workspace_id,
        models.CategoryMappingCache.description_normalized == description_normalized,
        models.CategoryMappingCache.transaction_type == tipo
    ).first()
    
    if cache_entry and cache_entry.category_id:
        # Atualizar contador e última utilização
        cache_entry.usage_count += 1
        cache_entry.last_used_at = datetime.now(timezone.utc)
        db.commit()
        logger.info(f"Cache privado hit: '{description_normalized}' -> '{cache_entry.category_id}' (usado {cache_entry.usage_count}x)")
        return cache_entry.category_id
    
    # 2. Verificar cache global (partilhado entre utilizadores)
    global_cache = db.query(models.CategoryMappingCache).filter(
        models.CategoryMappingCache.is_global == True,
        models.CategoryMappingCache.workspace_id.is_(None),
        models.CategoryMappingCache.description_normalized == description_normalized,
        models.CategoryMappingCache.transaction_type == tipo
    ).first()
    
    if global_cache:
        # Procurar categoria com o mesmo nome no workspace atual
        category_name = global_cache.category_name
        for cat in categories:
            if cat.name == category_name and cat.type == tipo:
                # Atualizar contador do cache global
                global_cache.usage_count += 1
                global_cache.last_used_at = datetime.now(timezone.utc)
                db.commit()
                logger.info(f"Cache global hit: '{description_normalized}' -> '{category_name}' (usado {global_cache.usage_count}x globalmente)")
                return cat.id
    
    return None

def save_cached_category(description_normalized: str, workspace_id: uuid.UUID, category_id: uuid.UUID, category_name: str, tipo: str, db: Session, is_common: bool = False):
    """
    Guarda uma categorização no cache para reutilização futura.
    Se is_common=True, guarda também no cache global (partilhado).
    """
    try:
        # 1. Guardar no cache privado do workspace
        existing = db.query(models.CategoryMappingCache).filter(
            models.CategoryMappingCache.workspace_id == workspace_id,
            models.CategoryMappingCache.description_normalized == description_normalized,
            models.CategoryMappingCache.transaction_type == tipo
        ).first()
        
        if existing:
            # Atualizar existente
            existing.category_id = category_id
            existing.category_name = category_name
            existing.usage_count += 1
            existing.last_used_at = datetime.now(timezone.utc)
            if hasattr(existing, 'confidence') and existing.confidence is not None:
                existing.confidence = min(1.0, float(existing.confidence) + 0.05)
        else:
            # Criar novo
            cache_entry = models.CategoryMappingCache(
                workspace_id=workspace_id,
                description_normalized=description_normalized,
                category_id=category_id,
                category_name=category_name,
                transaction_type=tipo,
                is_global=False,
                confidence=0.9
            )
            db.add(cache_entry)
        
        # 2. Se for uma categoria comum (ex: "Alimentação", "Transportes"), guardar também no cache global
        # Categorias comuns que todos os utilizadores têm
        common_category_names = ['Alimentação', 'Transportes', 'Habitação', 'Saúde', 'Entretenimento', 'Salário']
        
        if is_common or category_name in common_category_names:
            global_existing = db.query(models.CategoryMappingCache).filter(
                models.CategoryMappingCache.is_global == True,
                models.CategoryMappingCache.workspace_id.is_(None),
                models.CategoryMappingCache.description_normalized == description_normalized,
                models.CategoryMappingCache.transaction_type == tipo
            ).first()
            
            if not global_existing:
                # Criar cache global (sem workspace_id, sem category_id específico)
                global_cache = models.CategoryMappingCache(
                    workspace_id=None,
                    description_normalized=description_normalized,
                    category_id=None,  # Não precisa de category_id específico (cada workspace tem o seu)
                    category_name=category_name,
                    transaction_type=tipo,
                    is_global=True,
                    confidence=0.95
                )
                db.add(global_cache)
                logger.info(f"Categoria comum guardada no cache global: '{description_normalized}' -> '{category_name}'")
        
        db.commit()
        logger.info(f"Categoria guardada no cache privado: '{description_normalized}' -> '{category_id}'")
    except Exception as e:
        logger.error(f"Erro ao guardar no cache: {str(e)}")
        db.rollback()

def categorize_with_ai(text: str, categories: List[models.Category], tipo: str, original_text: str, workspace_id: uuid.UUID, db: Session) -> Optional[uuid.UUID]:
    """
    Usa OpenAI GPT-4o-mini para categorizar a transação quando não encontra no cache.
    Retorna category_id ou None.
    """
    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY não configurada. Não é possível usar IA para categorizar.")
        return None
    
    # Filtrar apenas categorias do tipo correto (já vem filtrado, mas garantir)
    filtered_categories = [cat for cat in categories if cat.type == tipo]
    if not filtered_categories:
        logger.warning(f"Nenhuma categoria do tipo '{tipo}' disponível")
        return None
    
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
        # Preparar lista de categorias (apenas do tipo correto, formato compacto)
        categories_list = [cat.name for cat in filtered_categories]
        categories_text = ", ".join(categories_list)
        
        prompt = f"""Categoriza: "{original_text}"

Categorias: {categories_text}

Responde APENAS com o nome exato da categoria:"""
        
        logger.info(f"Consultando OpenAI: '{original_text}' -> {categories_list}")
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=20,
                temperature=0.1,
            )
            ai_category_name = ""
            if response.choices and response.choices[0].message.content:
                ai_category_name = response.choices[0].message.content.strip()
            logger.info(f"Resposta OpenAI: '{ai_category_name}'")
            
            category_id_found = None
            
            for cat in filtered_categories:
                if cat.name.lower() == ai_category_name.lower():
                    logger.info(f"Match exato: '{cat.name}' (id: {cat.id})")
                    category_id_found = cat.id
                    break
            
            if not category_id_found:
                for cat in filtered_categories:
                    if cat.name.lower() in ai_category_name.lower() or ai_category_name.lower() in cat.name.lower():
                        logger.info(f"Match parcial: '{cat.name}' (id: {cat.id})")
                        category_id_found = cat.id
                        break
            
            if not category_id_found and ai_category_name:
                first_word = ai_category_name.split()[0]
                for cat in filtered_categories:
                    if first_word.lower() in cat.name.lower():
                        logger.info(f"Match por palavra: '{cat.name}' (id: {cat.id})")
                        category_id_found = cat.id
                        break
            
            if category_id_found:
                return category_id_found
            logger.warning(f"Nenhuma categoria encontrada para: '{ai_category_name}'")
            return None
                        
        except Exception as e:
            err_str = (str(e) or "").lower()
            if (
                "429" in err_str or "quota" in err_str or "rate_limit" in err_str
                or "rate limit" in err_str or "exceeded" in err_str
            ):
                logger.warning(f"OpenAI indisponível (quota/limite): {str(e)}")
                raise AIUnavailableError(str(e)) from e
            logger.error(f"Erro ao usar OpenAI: {str(e)}")
            return None
        
    except ImportError:
        logger.warning("openai não instalado. Instale com: pip install openai")
        return None
    except AIUnavailableError:
        raise
    except Exception as e:
        logger.error(f"Erro na categorização IA: {str(e)}")
        return None

def send_telegram_msg(chat_id: int, text: str, reply_markup: Optional[Dict] = None, pin_message: bool = False):
    """Envia mensagem para o Telegram"""
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN não configurado")
        return None
    
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    
    # Escapar caracteres especiais do Markdown que podem causar erro 400
    # Telegram MarkdownV2 requer escape de: _ * [ ] ( ) ~ ` > # + - = | { } . !
    # Vamos usar HTML que é mais simples e robusto
    payload = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'HTML'  # HTML é mais robusto que Markdown
    }
    if reply_markup:
        payload['reply_markup'] = reply_markup
    
    try:
        response = requests.post(url, json=payload, timeout=5)
        response.raise_for_status()
        result = response.json()
        
        # Fixar mensagem se solicitado
        if pin_message and result.get('ok') and result.get('result', {}).get('message_id'):
            message_id = result['result']['message_id']
            try:
                pin_url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/pinChatMessage"
                pin_payload = {
                    'chat_id': chat_id,
                    'message_id': message_id,
                    'disable_notification': True
                }
                requests.post(pin_url, json=pin_payload, timeout=5)
                logger.info(f"Mensagem fixada: message_id={message_id}")
            except Exception as e:
                logger.warning(f"Erro ao fixar mensagem: {str(e)}")
        
        return result
    except requests.exceptions.HTTPError as e:
        # Tentar sem parse_mode se falhar
        if response.status_code == 400:
            logger.warning(f"Erro 400 ao enviar com HTML, tentando sem parse_mode: {response.text}")
            payload.pop('parse_mode', None)
            try:
                response = requests.post(url, json=payload, timeout=5)
                response.raise_for_status()
                return response.json()
            except Exception as e2:
                logger.error(f"Erro ao enviar mensagem Telegram (sem parse_mode): {str(e2)}")
        else:
            logger.error(f"Erro HTTP ao enviar mensagem Telegram: {response.status_code} - {response.text}")
    except Exception as e:
        logger.error(f"Erro ao enviar mensagem Telegram: {str(e)}")
    
    return None

def setup_bot_commands():
    """Configura os comandos do bot no Telegram"""
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN não configurado - não é possível configurar comandos")
        return
    
    commands = [
        {
            "command": "start",
            "description": "🚀 Iniciar o bot e associar conta"
        },
        {
            "command": "info",
            "description": "📖 Ver guia de utilização e exemplos"
        },
        {
            "command": "help",
            "description": "❓ Ver ajuda e comandos disponíveis"
        },
        {
            "command": "clear",
            "description": "🧹 Limpar transações pendentes"
        }
    ]
    
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/setMyCommands"
    payload = {
        'commands': commands
    }
    
    try:
        response = requests.post(url, json=payload, timeout=5)
        response.raise_for_status()
        logger.info("Comandos do bot configurados com sucesso")
    except Exception as e:
        logger.error(f"Erro ao configurar comandos do bot: {str(e)}")

def setup_bot_info():
    """Configura informações adicionais do bot (descrição, about, etc.)"""
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN não configurado - não é possível configurar informações")
        return
    
    base_url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"
    
    # Configurar descrição curta (aparece no perfil do bot)
    try:
        short_desc = "🧘‍♂️ O teu ecossistema financeiro inteligente. Regista transações em segundos."
        requests.post(
            f"{base_url}/setMyShortDescription",
            json={'short_description': short_desc},
            timeout=5
        )
        logger.info("Descrição curta do bot configurada")
    except Exception as e:
        logger.warning(f"Erro ao configurar descrição curta: {str(e)}")
    
    # Configurar descrição completa (about)
    try:
        full_desc = (
            "✨ Finly Bot ✨\n\n"
            "💎 Regista transações financeiras rapidamente através do Telegram.\n\n"
            "🎯 Funcionalidades:\n"
            "• Categorização automática com IA\n"
            "• Suporte a múltiplas transações\n"
            "• Especifica categoria: Descrição - Categoria Valor€\n"
            "• Confirmação opcional de transações\n\n"
            "🧘‍♂️ Domina o teu dinheiro com simplicidade."
        )
        requests.post(
            f"{base_url}/setMyDescription",
            json={'description': full_desc},
            timeout=5
        )
        logger.info("Descrição completa do bot configurada")
    except Exception as e:
        logger.warning(f"Erro ao configurar descrição completa: {str(e)}")
    
    # Configurar nome do bot (se ainda não estiver configurado)
    try:
        bot_name = "Finly Bot"
        requests.post(
            f"{base_url}/setMyName",
            json={'name': bot_name},
            timeout=5
        )
        logger.info("Nome do bot configurado")
    except Exception as e:
        logger.warning(f"Erro ao configurar nome do bot: {str(e)}")

@router.post('/webhook')
@limiter.limit('30/minute')
async def telegram_webhook(
    request: Request, 
    db: Session = Depends(get_db),
    x_telegram_bot_api_secret_token: str | None = Header(None)
):
    """Webhook Telegram com validação de segurança"""
    logger.info("=" * 50)
    logger.info("Webhook Telegram recebido")
    logger.info(f"Headers: X-Telegram-Bot-Api-Secret-Token presente: {x_telegram_bot_api_secret_token is not None}")
    
    try:
        # Validação do secret token
        if settings.TELEGRAM_WEBHOOK_SECRET:
            logger.info(f"Validando secret token... (configurado: {bool(settings.TELEGRAM_WEBHOOK_SECRET)})")
            if not x_telegram_bot_api_secret_token or x_telegram_bot_api_secret_token != settings.TELEGRAM_WEBHOOK_SECRET:
                logger.warning(f"Tentativa de acesso ao webhook sem token válido. Recebido: {x_telegram_bot_api_secret_token is not None}, Esperado: {settings.TELEGRAM_WEBHOOK_SECRET[:10]}...")
                raise HTTPException(status_code=403, detail="Invalid secret token")
            logger.info("Secret token valido [OK]")
        else:
            logger.warning("TELEGRAM_WEBHOOK_SECRET não configurado - validação desativada")
        
        data = await request.json()
        logger.info(f"Payload recebido: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}...")  # Primeiros 500 chars
        
        # Processar callback_query (botões inline)
        if 'callback_query' in data:
            logger.info("Processando callback_query (botão inline)")
            callback_query = data['callback_query']
            chat_id = callback_query['message']['chat']['id']
            callback_data = callback_query.get('data', '')
            message_id = callback_query['message']['message_id']
            logger.info(f"Callback: chat_id={chat_id}, data={callback_data}")
            
            # Verificar rate limit
            if not check_rate_limit(str(chat_id)):
                user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
                language = (user.language if user and user.language else None) or _telegram_lang(callback_query.get("from"))
                t = get_telegram_t(language)
                send_telegram_msg(chat_id, t('rate_limit'))
                return {'status': 'rate_limited'}
            
            # Buscar utilizador
            user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
            if not user:
                lang_cb = _telegram_lang(callback_query.get("from"))
                t = get_telegram_t(lang_cb)
                send_telegram_msg(chat_id, t('session_expired'))
                return {'status': 'unauthorized'}
            
            # Obter linguagem do utilizador
            language = user.language if user.language else 'pt'
            t = get_telegram_t(language)
            
            # Processar callback
            if callback_data.startswith("confirm_"):
                logger.info(f"Processando confirmacao de transacao: {callback_data}")
                # Confirmar transação
                pending_id_hex = callback_data.replace("confirm_", "")
                logger.info(f"Buscando pending transaction com hex: {pending_id_hex}")
                
                # Buscar por hex curto (primeiros 16 caracteres do UUID)
                # Buscar todas as transações pendentes deste chat e filtrar por UUID
                all_pending = db.query(models.TelegramPendingTransaction).filter(
                    models.TelegramPendingTransaction.chat_id == str(chat_id)
                ).all()
                logger.info(f"Encontradas {len(all_pending)} transacoes pendentes para chat_id={chat_id}")
                
                pending = None
                for p in all_pending:
                    logger.info(f"Comparando: {p.id.hex[:16]} com {pending_id_hex}")
                    if p.id.hex.startswith(pending_id_hex):
                        pending = p
                        logger.info(f"Match encontrado! Pending ID: {p.id}, workspace: {p.workspace_id}, amount: {p.amount_cents}")
                        break
                
                if not pending:
                    logger.warning(f"Pending transaction nao encontrada para hex: {pending_id_hex}")
                    send_telegram_msg(chat_id, t('transaction_not_found'))
                    return {'status': 'not_found'}
                
                # Criar transação real
                logger.info(f"Criando transacao: workspace_id={pending.workspace_id}, category_id={pending.category_id}, amount_cents={pending.amount_cents}, description={pending.description}, transaction_date={pending.transaction_date}")
                transaction = models.Transaction(
                    workspace_id=pending.workspace_id,
                    category_id=pending.category_id,
                    amount_cents=pending.amount_cents,
                    description=pending.description,
                    inference_source=getattr(pending, 'inference_source', None),
                    decision_reason=getattr(pending, 'decision_reason', None),
                    needs_review=getattr(pending, 'needs_review', False),
                    transaction_date=pending.transaction_date
                )
                db.add(transaction)
                db.flush()
                logger.info(f"Transacao criada com ID: {transaction.id}, transaction_date: {transaction.transaction_date}, created_at: {transaction.created_at}")
                
                db.delete(pending)
                db.commit()
                logger.info("Transacao confirmada e commitada com sucesso")
                
                # Responder ao callback
                try:
                    requests.post(
                        f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/answerCallbackQuery",
                        json={'callback_query_id': callback_query['id']},
                        timeout=5
                    )
                except Exception as e:
                    logger.error(f"Erro ao responder callback: {str(e)}")
                
                # Editar mensagem
                tipo_emoji = "" if pending.amount_cents < 0 else "💰"
                tipo_texto = t('type_expense') if pending.amount_cents < 0 else t('type_income')
                category = db.query(models.Category).filter(models.Category.id == pending.category_id).first()
                category_name = category.name if category else "Outros"
                send_telegram_msg(chat_id, t('transaction_confirmed').format(
                    description=pending.description,
                    emoji=tipo_emoji,
                    amount=abs(pending.amount_cents)/100,
                    category=category_name,
                    type=tipo_texto
                ))
                
                logger.info("Callback de confirmacao processado com sucesso")
                return {'status': 'confirmed'}
                
            elif callback_data.startswith("cancel_"):
                # Cancelar transação
                pending_id_hex = callback_data.replace("cancel_", "")
                logger.info(f"Cancelando transação pendente: hex={pending_id_hex}, chat_id={chat_id}")
                
                # Buscar por hex curto (primeiros 16 caracteres do UUID)
                all_pending = db.query(models.TelegramPendingTransaction).filter(
                    models.TelegramPendingTransaction.chat_id == str(chat_id)
                ).all()
                
                logger.info(f"Transações pendentes encontradas para chat_id {chat_id}: {len(all_pending)}")
                
                pending = None
                for p in all_pending:
                    p_hex = p.id.hex[:16]
                    logger.info(f"Comparando: pending_id_hex={pending_id_hex}, p.id.hex[:16]={p_hex}, match={p.id.hex.startswith(pending_id_hex)}")
                    if p.id.hex.startswith(pending_id_hex):
                        pending = p
                        logger.info(f"Transação pendente encontrada: id={p.id}, description={p.description}, amount_cents={p.amount_cents}")
                        break
                
                if pending:
                    db.delete(pending)
                    db.commit()
                    logger.info(f"Transação pendente eliminada com sucesso: id={pending.id}")
                    
                    # Responder ao callback
                    try:
                        requests.post(
                            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/answerCallbackQuery",
                            json={'callback_query_id': callback_query['id']}
                        )
                        logger.info("Callback query respondido com sucesso")
                    except Exception as e:
                        logger.error(f"Erro ao responder callback query: {str(e)}")
                    
                    send_telegram_msg(chat_id, t('transaction_cancelled'))
                    logger.info("Mensagem de cancelamento enviada ao utilizador")
                    return {'status': 'cancelled'}
                else:
                    logger.warning(f"Transação pendente não encontrada: hex={pending_id_hex}, chat_id={chat_id}")
                    send_telegram_msg(chat_id, t('transaction_cancel_not_found'))
                    return {'status': 'not_found'}
            
            return {'status': 'ok'}
        
        # Processar mensagens normais
        if 'message' not in data:
            logger.info("Payload não contém 'message' - ignorando")
            return {'status': 'ignored'}
        
        logger.info("Processando mensagem normal")
        message = data['message']
        chat_id = message['chat']['id']
        text = message.get('text', '').strip()
        logger.info(f"Mensagem recebida: chat_id={chat_id}, text='{text[:100]}'")
        
        # Buscar utilizador para obter linguagem (se existir); senão usar idioma do Telegram
        user_temp = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
        language = (user_temp.language if user_temp and user_temp.language else None) or _telegram_lang(message.get("from"))
        t = get_telegram_t(language)
        
        # Verificar rate limit
        if not check_rate_limit(str(chat_id)):
            send_telegram_msg(chat_id, t('rate_limit'))
            return {'status': 'rate_limited'}
        
        # Comando /start
        if text.startswith('/start'):
            logger.info(f"Comando /start recebido de chat_id={chat_id}")
            user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
            logger.info(f"User encontrado: {user is not None}")
            
            if not user:
                # Primeira vez, pedir email (usar idioma do Telegram)
                lang_start = _telegram_lang(message.get("from"))
                t_start = get_telegram_t(lang_start)
                send_telegram_msg(chat_id, t_start('welcome_new'))
                return {'status': 'email_required'}
            else:
                # Já associado - enviar mensagem de boas-vindas e fixar
                language = user.language if user.language else 'pt'
                t_start = get_telegram_t(language)
                send_telegram_msg(chat_id, t_start('welcome_return'), pin_message=True)
                return {'status': 'ok'}
        
        # Comandos /info e /help
        if text.startswith('/info') or text.startswith('/help'):
            send_telegram_msg(chat_id, t('help_guide'))
            return {'status': 'ok'}
        
        # Comando /clear - Limpar transações pendentes
        if text.startswith('/clear'):
            logger.info(f"Comando /clear recebido de chat_id={chat_id}")
            user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
            if not user:
                send_telegram_msg(chat_id, t('clear_unauthorized'))
                return {'status': 'unauthorized'}
            
            language = user.language if user.language else 'pt'
            t_clear = get_telegram_t(language)
            
            workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
            if not workspace:
                send_telegram_msg(chat_id, t_clear('workspace_not_found'))
                return {'status': 'error'}
            
            # Eliminar todas as transações pendentes do utilizador
            pending_transactions = db.query(models.TelegramPendingTransaction).filter(
                models.TelegramPendingTransaction.chat_id == str(chat_id),
                models.TelegramPendingTransaction.workspace_id == workspace.id
            ).all()
            
            count = len(pending_transactions)
            if count > 0:
                for pending in pending_transactions:
                    db.delete(pending)
                db.commit()
                logger.info(f"Eliminadas {count} transações pendentes para chat_id={chat_id}")
                send_telegram_msg(chat_id, t_clear('clear_success').format(count=count))
            else:
                send_telegram_msg(chat_id, t_clear('clear_empty'))
            
            return {'status': 'ok'}
        
        # Processar email (associação)
        if "@" in text and "." in text:
            logger.info(f"Email detectado na mensagem: {text[:50]}")
            email_limpo = text.lower().replace(" ", "").strip()
            logger.info(f"Email limpo: {email_limpo[:10]}***")
            
            # Validar formato (usar idioma do Telegram antes de encontrar user)
            lang_email = _telegram_lang(message.get("from"))
            t_email = get_telegram_t(lang_email)
            if not validate_email(email_limpo):
                logger.warning(f"Email inválido: {email_limpo}")
                send_telegram_msg(chat_id, t_email('invalid_email'))
                return {'status': 'invalid_email'}
            
            # Procurar utilizador (insensível a maiúsculas: mesma conta que no PC)
            user = db.query(models.User).filter(func.lower(models.User.email) == email_limpo).first()
            
            if not user:
                # Resposta genérica para prevenir email enumeration
                send_telegram_msg(chat_id, t_email('email_not_found'))
                logger.warning(f"Tentativa de associação com email não registado: {email_limpo[:5]}***")
                return {'status': 'not_found'}
            
            # Obter linguagem do utilizador encontrado
            language = user.language if user.language else 'pt'
            t_email = get_telegram_t(language)
            
            # Verificar se é conta Pro
            if user.subscription_status not in ['active', 'trialing', 'cancel_at_period_end']:
                send_telegram_msg(chat_id, t_email('pro_required'))
                return {'status': 'pro_required'}
            
            # Verificar conflitos (um chat_id só pode estar associado a um email)
            existing_user = db.query(models.User).filter(
                models.User.phone_number == str(chat_id)
            ).first()
            
            if existing_user and (existing_user.email or "").lower() != email_limpo:
                # Já está associado a outro email
                send_telegram_msg(chat_id, t_email('already_associated').format(email=f"{existing_user.email[:3]}***"))
                return {'status': 'already_associated'}
            
            # Associar Telegram (armazenar chat_id em phone_number)
            old_phone = user.phone_number
            user.phone_number = str(chat_id)
            db.commit()
            
            # Verificar workspace após associação
            workspace_check = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
            logger.info(f"Conta Telegram associada: email={email_limpo[:10]}***, user_id={user.id}, workspace_id={workspace_check.id if workspace_check else None}, chat_id={chat_id}")
            
            send_telegram_msg(chat_id, t_email('account_linked_success').format(email=f"{user.email[:3]}***"), pin_message=True)
            return {'status': 'ok'}
        
        # Procurar User
        logger.info(f"Buscando user com phone_number={chat_id}")
        user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
        logger.info(f"User encontrado: {user is not None} (id: {user.id if user else None}, email: {user.email[:10] if user else None}***)")
        if user:
            logger.info(f"telegram_auto_confirm: {user.telegram_auto_confirm}")
            # Verificar workspace do user
            workspace_check = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
            logger.info(f"Workspace do user Telegram: {workspace_check.id if workspace_check else None}")
            # Atualizar t com a linguagem do utilizador
            language = user.language if user.language else 'pt'
            t = get_telegram_t(language)
        if not user:
            send_telegram_msg(chat_id, t('unauthorized'))
            return {'status': 'unauthorized'}
        
        logger.info(f"Buscando workspace para user_id={user.id}")
        workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
        logger.info(f"Workspace encontrado: {workspace is not None} (id: {workspace.id if workspace else None})")
        if not workspace:
            send_telegram_msg(chat_id, t('workspace_not_found'))
            return {'status': 'error'}
        
        # Processar fotos (desativado por enquanto)
        if 'photo' in message:
            send_telegram_msg(chat_id, t('photo_not_supported'))
            return {'status': 'error'}
        
        # Processar texto
        if text:
            logger.info(f"Processando texto como transação: '{text}'")
            try:
                parsed = parse_transaction(text, workspace, db)
            except AIUnavailableError:
                send_telegram_msg(chat_id, t('ai_unavailable'))
                return {'status': 'error'}
            logger.info(f"Resultado do parsing: {parsed}")
            
            if not parsed:
                logger.warning(f"Não foi possível fazer parse da mensagem: '{text}'")
                send_telegram_msg(chat_id, t('parse_error'))
                return {'status': 'error'}
            
            # Processar múltiplas transações
            if parsed.get('multiple'):
                transactions = parsed['transactions']
                created_count = 0
                
                for trans_data in transactions:
                    amount_cents = int(trans_data['amount'] * 100)
                    
                    # Lógica especial para categorias de vault (investimento/emergência)
                    if trans_data.get('is_vault', False):
                        # Para vault: depósito = positivo, resgate = negativo
                        if trans_data.get('is_vault_withdrawal', False):
                            # Resgate: negativo
                            amount_cents = -abs(amount_cents)
                        else:
                            # Depósito: positivo (padrão para vault)
                            amount_cents = abs(amount_cents)
                    elif trans_data['type'] == 'expense':
                        # Despesa regular: negativo
                        amount_cents = -abs(amount_cents)
                    else:
                        # Receita regular: positivo
                        amount_cents = abs(amount_cents)
                    
                    if user.telegram_auto_confirm:
                        # Criar diretamente
                        transaction = models.Transaction(
                            workspace_id=workspace.id,
                            category_id=trans_data['category_id'],
                            amount_cents=amount_cents,
                            description=trans_data['description'],
                            inference_source=trans_data.get('inference_source'),
                            decision_reason=trans_data.get('decision_reason'),
                            needs_review=trans_data.get('needs_review', False),
                            transaction_date=date.today()
                        )
                        db.add(transaction)
                        created_count += 1
                    else:
                        # Criar pendente
                        pending = models.TelegramPendingTransaction(
                            chat_id=str(chat_id),
                            workspace_id=workspace.id,
                            category_id=trans_data['category_id'],
                            amount_cents=amount_cents,
                            description=trans_data['description'],
                            inference_source=trans_data.get('inference_source'),
                            decision_reason=trans_data.get('decision_reason'),
                            needs_review=trans_data.get('needs_review', False),
                            transaction_date=date.today()
                        )
                        db.add(pending)
                        db.flush()
                        
                        # Enviar botões de confirmação
                        category = db.query(models.Category).filter(
                            models.Category.id == trans_data['category_id']
                        ).first()
                        category_name = category.name if category else "Outros"
                        
                        tipo_emoji = "" if amount_cents < 0 else "💰"
                        tipo_texto = t('type_expense') if amount_cents < 0 else t('type_income')
                        message_text = t('transaction_pending').format(
                            description=trans_data['description'],
                            emoji=tipo_emoji,
                            amount=abs(amount_cents)/100,
                            category=category_name,
                            type=tipo_texto
                        )
                        
                        # Usar UUID curto no callback_data (limite 64 bytes)
                        pending_id_hex = pending.id.hex[:16]
                        reply_markup = {
                            "inline_keyboard": [[
                                {"text": t('button_confirm'), "callback_data": f"confirm_{pending_id_hex}"},
                                {"text": t('button_cancel'), "callback_data": f"cancel_{pending_id_hex}"}
                            ]]
                        }
                        send_telegram_msg(chat_id, message_text, reply_markup)
                
                if user.telegram_auto_confirm:
                    db.commit()
                    send_telegram_msg(chat_id, t('multiple_transactions_created').format(count=created_count))
                else:
                    db.commit()
                
                return {'status': 'success'}
            
            # Processar transação única
            amount_cents = int(parsed['amount'] * 100)
            
            category = db.query(models.Category).filter(
                models.Category.id == parsed['category_id']
            ).first()
            category_name = category.name if category else "Outros"
            
            # Lógica especial para categorias de vault (investimento/emergência)
            is_vault_category = category and category.vault_type != 'none'
            is_vault_withdrawal = parsed.get('is_vault_withdrawal', False) if is_vault_category else False
            
            if is_vault_category:
                # Para vault: depósito = positivo, resgate = negativo
                if is_vault_withdrawal:
                    # Resgate: negativo
                    amount_cents = -abs(amount_cents)
                else:
                    # Depósito: positivo (padrão para vault)
                    amount_cents = abs(amount_cents)
            elif parsed['type'] == 'expense':
                # Despesa regular: negativo
                amount_cents = -abs(amount_cents)
            else:
                # Receita regular: positivo
                amount_cents = abs(amount_cents)
            
            if user.telegram_auto_confirm:
                logger.info(f"Modo auto_confirm ativo - criando transacao diretamente")
                # Criar transação diretamente
                transaction = models.Transaction(
                    workspace_id=workspace.id,
                    category_id=parsed['category_id'],
                    amount_cents=amount_cents,
                    description=parsed['description'],
                    inference_source=parsed.get('inference_source'),
                    decision_reason=parsed.get('decision_reason'),
                    needs_review=parsed.get('needs_review', False),
                    transaction_date=date.today()
                )
                db.add(transaction)
                db.flush()
                logger.info(f"Transacao criada com ID: {transaction.id}, workspace_id: {workspace.id}, amount_cents: {amount_cents}")
                db.commit()
                logger.info("Transacao commitada com sucesso (auto_confirm)")
                
                tipo_emoji = "" if amount_cents < 0 else "💰"
                tipo_texto = t('type_expense') if amount_cents < 0 else t('type_income')
                send_telegram_msg(chat_id, t('transaction_registered').format(
                    description=parsed['description'],
                    emoji=tipo_emoji,
                    amount=abs(parsed['amount']),
                    category=category_name,
                    type=tipo_texto
                ))
            else:
                # Criar TelegramPendingTransaction
                pending = models.TelegramPendingTransaction(
                    chat_id=str(chat_id),
                    workspace_id=workspace.id,
                    category_id=parsed['category_id'],
                    amount_cents=amount_cents,
                    description=parsed['description'],
                    inference_source=parsed.get('inference_source'),
                    decision_reason=parsed.get('decision_reason'),
                    needs_review=parsed.get('needs_review', False),
                    transaction_date=date.today()
                )
                db.add(pending)
                db.commit()
                
                # Enviar mensagem com botões de confirmação
                tipo_emoji = "" if amount_cents < 0 else "💰"
                tipo_texto = t('type_expense') if amount_cents < 0 else t('type_income')
                message_text = t('transaction_pending').format(
                    description=parsed['description'],
                    emoji=tipo_emoji,
                    amount=abs(parsed['amount']),
                    category=category_name,
                    type=tipo_texto
                )
                
                # Usar UUID curto no callback_data (limite 64 bytes)
                pending_id_hex = pending.id.hex[:16]
                reply_markup = {
                    "inline_keyboard": [[
                        {"text": t('button_confirm'), "callback_data": f"confirm_{pending_id_hex}"},
                        {"text": t('button_cancel'), "callback_data": f"cancel_{pending_id_hex}"}
                    ]]
                }
                send_telegram_msg(chat_id, message_text, reply_markup)
            
            logger.info("Transação processada com sucesso")
            return {'status': 'success'}
        
        logger.info("Mensagem não processada (sem texto)")
        return {'status': 'ignored'}
        
    except Exception as e:
        logger.error(f"Erro Telegram: {str(e)}", exc_info=True)
        import traceback
        logger.error(f"Traceback completo: {traceback.format_exc()}")
        return {'status': 'error'}
