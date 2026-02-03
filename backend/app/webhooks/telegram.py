from fastapi import APIRouter, Request, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import func, case
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


class OpenAIRateLimitError(Exception):
    """Levantada quando a OpenAI devolve 429 Too Many Requests (limite de pedidos excedido)."""
    pass


def _telegram_lang(from_user: Optional[dict]) -> str:
    """Infer bot language from Telegram user (when app user has no language set)."""
    code = (from_user or {}).get("language_code") or "pt"
    return "en" if (code and code.lower().startswith("en")) else "pt"


def _origin_line(inference_source: Optional[str], t) -> str:
    """Returns a short origin label for category (e.g. 'Por cache') or empty string."""
    if not inference_source:
        return ""
    src = (inference_source or "").lower()
    if "cache" in src or src == "cache_telegram":
        key = "source_cache"
    elif "history" in src or "similar" in src:
        key = "source_history"
    elif "openai" in src or "vision" in src:
        key = "source_openai"
    elif "explicit" in src:
        key = "source_explicit"
    else:
        key = "source_fallback"
    return t("origin_suffix", origin=t(key))


def _date_line(transaction_date: date, t) -> str:
    """Returns date line for message if date is not today, else empty."""
    if transaction_date == date.today():
        return ""
    return t("date_line", date=transaction_date.strftime("%d/%m/%Y"))

router = APIRouter(prefix='/telegram', tags=['webhooks'])

# Rate Limiting
_rate_limit_store = defaultdict(list)  # chat_id -> [timestamps]
_rate_limit_window = timedelta(minutes=1)
_rate_limit_max_messages = 10  # Máximo 10 mensagens por minuto

# Idempotência: update_id já processados (TTL ~5 min)
_processed_updates: Dict[int, datetime] = {}
_processed_updates_ttl = timedelta(minutes=5)
PENDING_STALE_HOURS = 24


def _is_duplicate_update(update_id: int) -> bool:
    """True se este update_id já foi processado (evitar duplicados)."""
    if update_id is None:
        return False
    now = datetime.now()
    for uid, ts in list(_processed_updates.items()):
        if now - ts > _processed_updates_ttl:
            del _processed_updates[uid]
    if update_id in _processed_updates:
        return True
    _processed_updates[update_id] = now
    return False

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
    Busca transações similares no histórico (dados históricos).
    Prioridade máxima antes de IA: quanto mais hits, menos chamadas à OpenAI.
    Usa chave canonical (igual ao motor) para consistência.
    NÃO usa transações de seed (1 cêntimo).
    """
    cache_key = _description_cache_key(text)
    if not cache_key:
        return None
    words = set(cache_key.split())
    if not words:
        return None

    cutoff_date = date.today() - timedelta(days=180)
    transactions = db.query(models.Transaction).filter(
        models.Transaction.workspace_id == workspace_id,
        models.Transaction.transaction_date >= cutoff_date,
        models.Transaction.category_id.isnot(None),
    ).order_by(models.Transaction.transaction_date.desc()).limit(500).all()

    if tipo == "expense":
        transactions = [t for t in transactions if t.amount_cents < 0 and abs(t.amount_cents) != 1]
    else:
        transactions = [t for t in transactions if t.amount_cents > 0 and abs(t.amount_cents) != 1]

    best_match = None
    best_score = 0
    best_description = None

    for trans in transactions:
        if not trans.description:
            continue
        desc_can = _description_cache_key(trans.description)
        desc_words = set(desc_can.split())
        common = words.intersection(desc_words)
        if not common:
            continue
        score = len(common) + sum(2 for w in common if len(w) > 4)
        days_ago = (date.today() - trans.transaction_date).days
        score += 3 if days_ago <= 7 else (2 if days_ago <= 30 else (1 if days_ago <= 90 else 0))
        has_important = any(len(w) > 4 for w in common)
        # Relaxado: 1 palavra importante OU 2+ palavras em comum (favorece histórico antes de IA)
        accept = (has_important and len(common) >= 1) or len(common) >= 2
        if accept and score >= 2 and score > best_score:
            best_score = score
            best_match = trans.category_id
            best_description = trans.description

    if best_match:
        logger.info("Histórico similar: '%s' -> category_id (score=%s)", best_description, best_score)
    return best_match

def validate_email(email: str) -> bool:
    """Valida formato de email"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def _parse_date_from_text(text: str) -> Optional[date]:
    """
    Extrai uma data da mensagem para usar como transaction_date.
    Suporta: "28/01", "28/01/25", "28/01/2025", "28-01", "dia 28", "28 jan", "28 janeiro".
    Retorna None se não encontrar data válida.
    """
    if not text or not text.strip():
        return None
    text_clean = text.strip()
    today = date.today()
    # DD/MM ou DD/MM/YY ou DD/MM/YYYY
    m = re.search(r'\b(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b', text_clean)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
        if y is None:
            year = today.year
        else:
            year = int(y)
            if year < 100:
                year += 2000 if year < 50 else 1900
        try:
            return date(year, mo, d)
        except ValueError:
            pass
    # "dia 28" / "day 28" (dia do mês atual)
    m = re.search(r'\b(?:dia|day)\s+(\d{1,2})\b', text_clean, re.IGNORECASE)
    if m:
        try:
            d = int(m.group(1))
            return date(today.year, today.month, d)
        except ValueError:
            pass
    # "28 jan" / "28 janeiro" / "15 dez"
    months_map = [
        (r'janeiro|january|jan', 1), (r'fevereiro|february|fev|feb', 2), (r'mar[cç]o|march|mar', 3),
        (r'abril|april|abr|apr', 4), (r'maio|may|mai', 5), (r'junho|june|jun', 6),
        (r'julho|july|jul', 7), (r'agosto|august|ago|aug', 8), (r'setembro|september|set|sep', 9),
        (r'outubro|october|out|oct', 10), (r'novembro|november|nov', 11), (r'dezembro|december|dez|dec', 12),
    ]
    m = re.search(r'\b(\d{1,2})\s+([a-zàáâãäåèéêëìíîïòóôõöùúûüç]+)\b', text_clean, re.IGNORECASE)
    if m:
        d = int(m.group(1))
        month_name = m.group(2).lower()
        for pattern, mo in months_map:
            if re.match(pattern, month_name, re.IGNORECASE):
                try:
                    return date(today.year, mo, d)
                except ValueError:
                    pass
                break
    return None

def _strip_date_from_description(description: str) -> str:
    """Remove padrões de data da descrição (28/01, dia 28, day 28, 28 jan, etc.) para não guardar na BD."""
    if not description:
        return description
    s = description.strip()
    s = re.sub(r'\b\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?\b', '', s)
    s = re.sub(r'\b(?:dia|day)\s+\d{1,2}\b', '', s, flags=re.IGNORECASE)
    s = re.sub(r'\b\d{1,2}\s+(?:jan|janeiro|fev|fevereiro|mar|março|marco|abr|abril|mai|maio|jun|junho|jul|julho|ago|agosto|set|setembro|out|outubro|nov|novembro|dez|dezembro|january|february|march|april|may|june|july|august|september|october|november|december)\b', '', s, flags=re.IGNORECASE)
    s = re.sub(r'\s+', ' ', s).strip()
    return s or description.strip()


def parse_transaction(text: str, workspace: models.Workspace, db: Session) -> Optional[Dict]:
    """
    Extrai valor, tipo e categoria de uma mensagem de texto.
    Suporta múltiplas transações separadas por espaço.
    Aceita data na mensagem: "Almoço 15€ 28/01", "Almoço 28/01 15€", "dia 28 Almoço 15€".
    """
    # Data opcional na mensagem (aplica-se a todas as transações da mensagem)
    parsed_date = _parse_date_from_text(text)
    default_transaction_date = parsed_date if parsed_date else date.today()

    # Suporta múltiplas transações: "Almoço 15€ Gasolina 10€"
    transactions = []
    
    # Regex para encontrar valores monetários (inclui -15€)
    # Suporta: "15€", "15.50€", "-15€", "1.234,56€", "1 234€"
    valor_pattern = r'(-?\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d+)?)\s*(?:€|eur|euros?|e)?'
    valor_matches = list(re.finditer(valor_pattern, text, re.IGNORECASE))
    if not valor_matches:
        return None
    
    # Identificar tipo (despesa ou receita)
    text_lower = text.lower()
    income_keywords = [
        'recebi', 'salário', 'ordenado', 'ganhei', 'vendi', 'rendimento',
        'bonus', 'vencimento', 'reembolso', 'subsídio', 'prémio', 'premio',
        'venda', 'cashback', 'entrada', 'received', 'salary', 'income', 'refund'
    ]
    expense_keywords = [
        'pago', 'paguei', 'debitado', 'saída', 'gastei', 'paid', 'spent', 'debit'
    ]
    vault_withdrawal_keywords = [
        'retirar', 'resgate', 'retirei', 'sacar', 'levantei', 'withdraw', 'withdrawal'
    ]
    if any(k in text_lower for k in income_keywords):
        tipo = "income"
    elif any(k in text_lower for k in expense_keywords):
        tipo = "expense"
    else:
        tipo = "expense"
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
    
    # Limites de valor (evitar input acidental)
    MAX_AMOUNT = 999_999.99

    # Processar cada valor encontrado
    for i, valor_match in enumerate(valor_matches):
        # Extrair valor (suporta -15€)
        valor_str = valor_match.group(1).replace(' ', '').replace('.', '').replace(',', '.')
        try:
            amount = float(valor_str)
        except ValueError:
            continue
        if abs(amount) > MAX_AMOUNT:
            continue
        # Valor negativo explícito = despesa
        if amount < 0:
            amount = abs(amount)
            tipo = "expense"
        
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
        description = _strip_date_from_description(description)[:255]
        if not description:
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
            # Prioridade: cache (exato) → histórico/similaridade → motor SEM IA → (opcional) IA só se nada acertar
            # Objetivo: IA apenas para imagens; texto usa dados históricos e similaridade ao máximo.
            cache_key = _description_cache_key(description)
            category_id = None
            inference_source = "legacy_fallback"
            decision_reason = "legacy_fallback"

            # 1) Cache privado/global (chave canonical = mesmo que o motor)
            if cache_key:
                category_id = get_cached_category(cache_key, workspace.id, tipo, categories, db)
                if category_id:
                    inference_source = "cache_private"
                    decision_reason = "cache_telegram"

            # 2) Similaridade com histórico (transações passadas do utilizador)
            if not category_id:
                category_id = find_similar_transaction(description, workspace.id, db, tipo)
                if category_id:
                    inference_source = "history_similarity"
                    decision_reason = "history_similarity_telegram"

            # 3) Motor de categorização SEM IA (regras, token-scoring, cache do motor, similaridade do motor)
            if not category_id:
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
                        use_gemini=False,  # IA só para imagens; texto não chama OpenAI
                    )
                    category_id = cat_id
                    inference_source = source
                    decision_reason = reason
                except Exception as e:
                    logger.warning("Motor de categorização falhou: %s", e)

            # 4) Último recurso: IA (só se não houver cache/histórico/motor) e circuit-breaker fechado
            suggested_category_name = None
            if not category_id:
                try:
                    from ..core.categorization_engine import check_gemini_circuit_breaker
                    if check_gemini_circuit_breaker(db, models, workspace.id):
                        logger.warning("Circuit-breaker IA aberto no Telegram; não chamar OpenAI")
                        category_id = categories[0].id if categories else None
                        inference_source = "fallback"
                        decision_reason = "fallback:circuit_breaker"
                    else:
                        cat_id, suggested_name = categorize_with_ai(description, categories, tipo, text, workspace.id, db)
                        if cat_id:
                            category_id = cat_id
                            inference_source = "openai"
                            decision_reason = "openai:last_resort"
                            cache_key_save = _description_cache_key(description)
                            if cache_key_save:
                                cat_obj = next((c for c in categories if c.id == category_id), None)
                                save_cached_category(cache_key_save, workspace.id, category_id, cat_obj.name if cat_obj else "Outros", tipo, db, is_common=True)
                        elif suggested_name:
                            suggested_category_name = suggested_name[:100]
                            inference_source = "openai"
                            decision_reason = "openai:suggest_new"
                except Exception as e:
                    logger.warning("IA (último recurso) falhou: %s", e)

            # 5) Fallback final: primeira categoria do tipo (só se não for "sugerir criar")
            if not category_id and categories and not suggested_category_name:
                logger.info("Sem cache/histórico/motor/IA: usando primeira categoria do tipo '%s'", tipo)
                category_id = categories[0].id
                inference_source = "fallback"
                decision_reason = "fallback:first_category"
        
        # Verificar se a categoria é de vault (investimento/emergência)
        category_obj = db.query(models.Category).filter(models.Category.id == category_id).first() if category_id else None
        if not category_obj and category_id:
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
            "is_vault_withdrawal": is_vault_withdrawal if is_vault_category else False,
            "suggested_category_name": suggested_category_name,
            "transaction_date": default_transaction_date,
        })
    
    # Retornar primeira transação ou lista se múltiplas
    if len(transactions) == 1:
        return transactions[0]
    return {"multiple": True, "transactions": transactions}


def _description_cache_key(description: str) -> str:
    """
    Chave de cache alinhada com o motor de categorização (canonicalize).
    Assim o cache do Telegram e o do motor são o mesmo → menos IA.
    """
    from ..core.categorization_engine import canonicalize
    return canonicalize(description) or ""


def get_cached_category(description_normalized: str, workspace_id: uuid.UUID, tipo: str, categories: List[models.Category], db: Session) -> Optional[uuid.UUID]:
    """
    Verifica se existe uma categorização em cache para esta descrição.
    description_normalized deve ser a chave canonical (canonicalize(description)) para alinhar com o motor.
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

def categorize_with_ai(text: str, categories: List[models.Category], tipo: str, original_text: str, workspace_id: uuid.UUID, db: Session) -> tuple:
    """
    Usa OpenAI GPT-4o-mini para categorizar a transação quando não encontra no cache.
    Retorna (category_id, suggested_category_name).
    - Se a IA acertar numa categoria existente: (category_id, None).
    - Se a IA sugerir um nome que não existe: (None, ai_category_name) para o bot perguntar se quer criar.
    """
    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY não configurada. Não é possível usar IA para categorizar.")
        return (None, None)
    
    filtered_categories = [cat for cat in categories if cat.type == tipo]
    if not filtered_categories:
        logger.warning(f"Nenhuma categoria do tipo '{tipo}' disponível")
        return (None, None)
    
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
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
            
            if not ai_category_name:
                return (None, None)
            
            # 1) Match exato
            for cat in filtered_categories:
                if cat.name.lower() == ai_category_name.lower():
                    logger.info(f"Match exato: '{cat.name}' (id: {cat.id})")
                    return (cat.id, None)
            
            # 2) Match fuzzy (find_best_category_match)
            fuzzy_match = find_best_category_match(ai_category_name, filtered_categories, threshold=0.6)
            if fuzzy_match:
                logger.info(f"Match fuzzy: '{fuzzy_match.name}' para IA '{ai_category_name}'")
                return (fuzzy_match.id, None)
            
            # 3) Match parcial (substring)
            for cat in filtered_categories:
                if cat.name.lower() in ai_category_name.lower() or ai_category_name.lower() in cat.name.lower():
                    logger.info(f"Match parcial: '{cat.name}' (id: {cat.id})")
                    return (cat.id, None)
            
            # 4) Primeira palavra
            first_word = ai_category_name.split()[0]
            for cat in filtered_categories:
                if first_word.lower() in cat.name.lower():
                    logger.info(f"Match por palavra: '{cat.name}' (id: {cat.id})")
                    return (cat.id, None)
            
            # Nenhum match: sugerir criar a categoria com o nome da IA
            logger.warning(f"Nenhuma categoria encontrada para: '{ai_category_name}' -> sugerir criar")
            return (None, ai_category_name[:100])
                        
        except Exception as e:
            err_str = (str(e) or "").lower()
            if (
                "429" in err_str or "quota" in err_str or "rate_limit" in err_str
                or "rate limit" in err_str or "exceeded" in err_str
            ):
                logger.warning(f"OpenAI indisponível (quota/limite): {str(e)}")
                raise AIUnavailableError(str(e)) from e
            logger.error(f"Erro ao usar OpenAI: {str(e)}")
            return (None, None)
        
    except ImportError:
        logger.warning("openai não instalado. Instale com: pip install openai")
        return (None, None)
    except AIUnavailableError:
        raise
    except Exception as e:
        logger.error(f"Erro na categorização IA: {str(e)}")
        return (None, None)


def _parsed_from_photo(
    photo_data: Dict, workspace: models.Workspace, db: Session
) -> Optional[Dict]:
    """
    Constrói um dict 'parsed' (mesmo formato que parse_transaction para transação única)
    a partir do resultado de process_photo_with_openai.
    """
    logger.info("[_parsed_from_photo] Entrada: description=%r amount=%s type=%s", photo_data.get("description"), photo_data.get("amount"), photo_data.get("type"))
    description = (photo_data.get("description") or "").strip()[:255]
    try:
        amount = float(photo_data.get("amount", 0))
    except (TypeError, ValueError) as e:
        logger.warning("[_parsed_from_photo] amount inválido: %s", e)
        return None
    tipo = (photo_data.get("type") or "expense").lower()
    if tipo not in ("expense", "income"):
        tipo = "expense"
    if not description or amount <= 0:
        logger.warning("[_parsed_from_photo] Dados inválidos: description vazia ou amount<=0 (description=%r amount=%s)", description or "(vazio)", amount)
        return None
    date_str = photo_data.get("date") or ""
    transaction_date = date.today()
    if date_str:
        try:
            transaction_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass
    categories = db.query(models.Category).filter(
        models.Category.workspace_id == workspace.id,
        models.Category.type == tipo,
    ).all()
    if not categories:
        logger.warning("[_parsed_from_photo] Sem categorias para workspace_id=%s tipo=%s", workspace.id, tipo)
        return None

    # Se a Vision devolveu uma categoria, tentar usar (match exato ou por similaridade)
    category_id = None
    suggested_category_name = None
    inference_source = "legacy_fallback"
    decision_reason = "legacy_fallback"
    needs_review = False
    vision_category_name = (photo_data.get("category") or "").strip()
    if vision_category_name:
        exact = next((c for c in categories if c.name.strip() == vision_category_name), None)
        if exact:
            category_id = exact.id
            inference_source = "openai_vision"
            decision_reason = "openai_vision"
        else:
            match = find_best_category_match(vision_category_name, categories, threshold=0.7)
            if match:
                category_id = match.id
                inference_source = "openai_vision"
                decision_reason = "openai_vision"
            else:
                suggested_category_name = vision_category_name[:100]

    if not category_id:
        try:
            from ..core.categorization_engine import infer_category
            from ..core.config import settings as _settings
            cat_id, source, needs_review, _conf, reason, _explain = infer_category(
                description,
                workspace.id,
                tipo,
                categories,
                db,
                models,
                _settings,
                explicit_category_id=None,
                use_gemini=True,
            )
            category_id = cat_id
            inference_source = source
            decision_reason = reason
        except Exception as e:
            logger.warning("Categorização falhou para foto: %s", e)
            category_id = categories[0].id if categories else None
    if not category_id and categories and not suggested_category_name:
        category_id = categories[0].id
    category_obj = db.query(models.Category).filter(models.Category.id == category_id).first() if category_id else None
    is_vault_category = category_obj and getattr(category_obj, "vault_type", "none") != "none"
    result = {
        "amount": amount,
        "description": description,
        "type": tipo,
        "category_id": category_id,
        "inference_source": inference_source,
        "decision_reason": decision_reason,
        "needs_review": needs_review,
        "is_vault": is_vault_category,
        "is_vault_withdrawal": False,
        "transaction_date": transaction_date,
        "suggested_category_name": suggested_category_name[:100] if suggested_category_name else None,
    }
    logger.info("[_parsed_from_photo] OK: category_id=%s inference_source=%s suggested=%s", category_id, inference_source, suggested_category_name)
    return result


def process_photo_with_openai(file_id: str, categories: List[models.Category]) -> Optional[Dict]:
    """
    Descarrega a foto do Telegram e envia para OpenAI vision (gpt-4o-mini) para extrair
    amount, description, type (expense/income), date e category. Inclui as categorias
    do workspace no prompt para a IA escolher uma da lista.
    """
    logger.info("[OpenAI Vision] Início process_photo_with_openai file_id=%s categories_count=%s", file_id[:20] if file_id else None, len(categories) if categories else 0)
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("[OpenAI Vision] TELEGRAM_BOT_TOKEN não configurado")
        return None
    if not settings.OPENAI_API_KEY:
        logger.warning("[OpenAI Vision] OPENAI_API_KEY não configurado")
        return None
    try:
        # 1. Obter file_path do Telegram
        get_file_url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getFile?file_id={file_id}"
        r = requests.get(get_file_url, timeout=10)
        r.raise_for_status()
        data = r.json()
        if not data.get("ok") or "result" not in data:
            logger.warning("[OpenAI Vision] Telegram getFile falhou: ok=%s result_present=%s body=%s", data.get("ok"), "result" in data, data)
            return None
        file_path = data["result"].get("file_path")
        if not file_path:
            logger.warning("[OpenAI Vision] getFile sem file_path: %s", data.get("result"))
            return None
        logger.info("[OpenAI Vision] file_path obtido: %s", file_path)
        # 2. Descarregar o ficheiro
        download_url = f"https://api.telegram.org/file/bot{settings.TELEGRAM_BOT_TOKEN}/{file_path}"
        img_resp = requests.get(download_url, timeout=15)
        img_resp.raise_for_status()
        content = img_resp.content
        content_len = len(content) if content else 0
        if not content:
            logger.warning("[OpenAI Vision] Download vazio")
            return None
        if content_len > 20 * 1024 * 1024:
            logger.warning("[OpenAI Vision] Imagem demasiado grande: %s bytes (máx 20MB)", content_len)
            return None
        logger.info("[OpenAI Vision] Imagem descarregada: %s bytes", content_len)
        # 3. Enviar para OpenAI vision
        import base64
        from openai import OpenAI
        from datetime import datetime as dt
        b64 = base64.b64encode(content).decode("utf-8")
        mime = "image/jpeg"
        if file_path.lower().endswith(".png"):
            mime = "image/png"
        elif file_path.lower().endswith(".webp"):
            mime = "image/webp"
        data_url = f"data:{mime};base64,{b64}"

        expense_names = [c.name for c in categories if getattr(c, "type", "expense") == "expense"]
        income_names = [c.name for c in categories if getattr(c, "type", "income") == "income"]
        cats_expense = ", ".join(expense_names) if expense_names else "(nenhuma)"
        cats_income = ", ".join(income_names) if income_names else "(nenhuma)"

        prompt = f"""Analisa esta imagem (recibo, fatura ou nota).
Extrai os dados da transação.

DATA ATUAL: {dt.now().strftime('%Y-%m-%d')}

Categorias disponíveis do utilizador:
- Para despesas (type=expense): {cats_expense}
- Para receitas (type=income): {cats_income}

Escolhe a categoria que melhor se adequa à transação. O valor de "category" deve ser o nome EXATO de uma das categorias listadas acima (conforme o type).

REGRAS:
- 'amount': Valor total (número, ponto decimal). Ex: 15.50
- 'description': Nome do estabelecimento ou descrição curta (máx 40 caracteres)
- 'type': 'expense' se for compra/despesa, 'income' se for receita/reembolso
- 'date': Data no formato YYYY-MM-DD (usa a DATA ATUAL se não encontrares)
- 'category': Nome exato de uma categoria da lista correspondente ao type (despesas ou receitas)

Responde APENAS com um JSON válido, sem markdown: {{"amount": número, "description": "texto", "type": "expense ou income", "date": "YYYY-MM-DD", "category": "NomeExatoDaCategoria"}}
"""
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        logger.info("[OpenAI Vision] A chamar OpenAI chat.completions (gpt-4o-mini)...")
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            max_tokens=300,
            temperature=0.1,
        )
        text_response = ""
        if response.choices and response.choices[0].message.content:
            text_response = response.choices[0].message.content.strip()
        if not text_response:
            logger.warning("[OpenAI Vision] OpenAI respondeu sem content. choices=%s", len(response.choices) if response.choices else 0)
            return None
        logger.info("[OpenAI Vision] Resposta bruta (primeiros 300 chars): %s", (text_response[:300] + "..." if len(text_response) > 300 else text_response))
        # Limpar markdown se existir
        clean = re.search(r"\{[\s\S]*\}", text_response)
        if clean:
            text_response = clean.group(0)
        try:
            parsed = json.loads(text_response)
        except json.JSONDecodeError as je:
            logger.warning("[OpenAI Vision] JSON inválido na resposta: %s. raw=%s", je, text_response[:200])
            return None
        amount = float(parsed.get("amount", 0))
        description = (parsed.get("description") or "").strip()[:255]
        tipo = (parsed.get("type") or "expense").lower()
        if tipo not in ("expense", "income"):
            tipo = "expense"
        date_str = parsed.get("date") or dt.now().strftime("%Y-%m-%d")
        category_name = (parsed.get("category") or "").strip()
        if not description or amount <= 0:
            logger.warning("[OpenAI Vision] Dados inválidos (description vazia ou amount<=0): description=%r amount=%s", description or "(vazio)", amount)
            return None
        logger.info("[OpenAI Vision] Sucesso: description=%s amount=%s type=%s category=%s", description, amount, tipo, category_name or "(nenhuma)")
        return {
            "amount": amount,
            "description": description,
            "type": tipo,
            "date": date_str,
            "category": category_name or None,
        }
    except OpenAIRateLimitError:
        raise
    except Exception as e:
        err_str = str(e).lower()
        is_rate_limit = (
            getattr(e, "status_code", None) == 429
            or "429" in str(e)
            or "rate_limit" in err_str
            or "too many requests" in err_str
            or "quota" in err_str
        )
        if is_rate_limit:
            logger.warning("[OpenAI Vision] Rate limit (429) - demasiados pedidos ou quota excedida: %s", e)
            raise OpenAIRateLimitError(e) from e
        logger.exception("[OpenAI Vision] Erro ao processar foto: %s", e)
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
        
        # Idempotência: ignorar update já processado (reenvios do Telegram)
        update_id = data.get('update_id')
        if _is_duplicate_update(update_id):
            logger.info("Update %s já processado (idempotência), ignorar", update_id)
            return {'status': 'duplicate'}
        
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
            if callback_data.startswith("confirm_batch_"):
                batch_id_hex = callback_data.replace("confirm_batch_", "")
                all_pending = db.query(models.TelegramPendingTransaction).filter(
                    models.TelegramPendingTransaction.chat_id == str(chat_id),
                ).all()
                batch_pendents = [p for p in all_pending if p.batch_id and p.batch_id.hex[:16] == batch_id_hex]
                if not batch_pendents:
                    send_telegram_msg(chat_id, t('transaction_not_found'))
                    try:
                        requests.post(
                            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/answerCallbackQuery",
                            json={'callback_query_id': callback_query['id']},
                            timeout=5,
                        )
                    except Exception:
                        pass
                    return {'status': 'not_found'}
                for pending in batch_pendents:
                    transaction = models.Transaction(
                        workspace_id=pending.workspace_id,
                        category_id=pending.category_id,
                        amount_cents=pending.amount_cents,
                        description=pending.description,
                        inference_source=getattr(pending, 'inference_source', None),
                        decision_reason=getattr(pending, 'decision_reason', None),
                        needs_review=getattr(pending, 'needs_review', False),
                        transaction_date=pending.transaction_date,
                    )
                    db.add(transaction)
                    # Aprendizagem: guardar no cache para futuras mensagens (menos IA)
                    cache_key = _description_cache_key(pending.description)
                    if cache_key and pending.category_id:
                        category = db.query(models.Category).filter(models.Category.id == pending.category_id).first()
                        cat_name = category.name if category else "Outros"
                        tipo = "expense" if pending.amount_cents < 0 else "income"
                        save_cached_category(cache_key, pending.workspace_id, pending.category_id, cat_name, tipo, db, is_common=True)
                    db.delete(pending)
                db.commit()
                try:
                    requests.post(
                        f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/answerCallbackQuery",
                        json={'callback_query_id': callback_query['id']},
                        timeout=5,
                    )
                except Exception:
                    pass
                send_telegram_msg(chat_id, t('list_confirmed'))
                return {'status': 'confirmed'}
            elif callback_data.startswith("create_cat_"):
                # User escolheu "Sim, criar" categoria sugerida pela IA
                pending_id_hex = callback_data.replace("create_cat_", "")
                all_pending = db.query(models.TelegramPendingTransaction).filter(
                    models.TelegramPendingTransaction.chat_id == str(chat_id)
                ).all()
                pending = None
                for p in all_pending:
                    if p.id.hex[:16] == pending_id_hex and getattr(p, 'suggested_category_name', None):
                        pending = p
                        break
                if not pending:
                    send_telegram_msg(chat_id, t('transaction_not_found'))
                    try:
                        requests.post(
                            f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/answerCallbackQuery",
                            json={'callback_query_id': callback_query['id']},
                            timeout=5,
                        )
                    except Exception:
                        pass
                    return {'status': 'not_found'}
                suggested_name = (pending.suggested_category_name or "").strip()[:100]
                if not suggested_name:
                    send_telegram_msg(chat_id, t('transaction_not_found'))
                    return {'status': 'not_found'}
                tipo = "expense" if pending.amount_cents < 0 else "income"
                existing = db.query(models.Category).filter(
                    models.Category.workspace_id == pending.workspace_id,
                    func.lower(models.Category.name) == suggested_name.lower(),
                    models.Category.type == tipo,
                ).first()
                if existing:
                    new_category_id = existing.id
                    new_category_name = existing.name
                else:
                    new_cat = models.Category(
                        workspace_id=pending.workspace_id,
                        name=suggested_name,
                        type=tipo,
                        vault_type='none',
                        monthly_limit_cents=0,
                        color_hex='#3B82F6',
                        icon='Tag',
                        is_default=False,
                    )
                    db.add(new_cat)
                    db.flush()
                    new_category_id = new_cat.id
                    new_category_name = new_cat.name
                    logger.info("Categoria criada pelo user Telegram: %s (id=%s)", new_category_name, new_category_id)
                pending.category_id = new_category_id
                pending.suggested_category_name = None
                db.commit()
                try:
                    requests.post(
                        f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/answerCallbackQuery",
                        json={'callback_query_id': callback_query['id']},
                        timeout=5,
                    )
                except Exception:
                    pass
                msg = t('category_created_confirm').format(name=new_category_name)
                tipo_emoji = "" if pending.amount_cents < 0 else "💰"
                tipo_texto = t('type_expense') if pending.amount_cents < 0 else t('type_income')
                msg += "\n\n" + t('transaction_pending').format(
                    description=pending.description,
                    emoji=tipo_emoji,
                    amount=abs(pending.amount_cents) / 100,
                    category=new_category_name,
                    type=tipo_texto,
                    origin_line=_origin_line("openai", t),
                    date_line=_date_line(pending.transaction_date, t),
                )
                pending_id_hex_new = pending.id.hex[:16]
                reply_markup = {
                    "inline_keyboard": [[
                        {"text": t('button_confirm'), "callback_data": f"confirm_{pending_id_hex_new}"},
                        {"text": t('button_cancel'), "callback_data": f"cancel_{pending_id_hex_new}"}
                    ]]
                }
                send_telegram_msg(chat_id, msg, reply_markup)
                return {'status': 'category_created'}
            elif callback_data.startswith("skip_cat_"):
                # User escolheu "Não, cancelar" - apagar pendente
                pending_id_hex = callback_data.replace("skip_cat_", "")
                all_pending = db.query(models.TelegramPendingTransaction).filter(
                    models.TelegramPendingTransaction.chat_id == str(chat_id)
                ).all()
                pending = None
                for p in all_pending:
                    if p.id.hex[:16] == pending_id_hex and getattr(p, 'suggested_category_name', None):
                        pending = p
                        break
                if pending:
                    db.delete(pending)
                    db.commit()
                try:
                    requests.post(
                        f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/answerCallbackQuery",
                        json={'callback_query_id': callback_query['id']},
                        timeout=5,
                    )
                except Exception:
                    pass
                send_telegram_msg(chat_id, t('transaction_cancelled'))
                return {'status': 'cancelled'}
            elif callback_data.startswith("cancel_batch_"):
                batch_id_hex = callback_data.replace("cancel_batch_", "")
                all_pending = db.query(models.TelegramPendingTransaction).filter(
                    models.TelegramPendingTransaction.chat_id == str(chat_id),
                ).all()
                batch_pendents = [p for p in all_pending if p.batch_id and p.batch_id.hex[:16] == batch_id_hex]
                for pending in batch_pendents:
                    db.delete(pending)
                db.commit()
                try:
                    requests.post(
                        f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/answerCallbackQuery",
                        json={'callback_query_id': callback_query['id']},
                        timeout=5,
                    )
                except Exception:
                    pass
                send_telegram_msg(chat_id, t('list_cancelled'))
                return {'status': 'cancelled'}
            elif callback_data.startswith("confirm_"):
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
                # Copiar para mensagem (save_cached_category faz commit e pode expirar pending)
                desc_for_msg = pending.description
                amount_cents_for_msg = pending.amount_cents
                category_id_for_msg = pending.category_id
                inference_source_for_msg = getattr(pending, 'inference_source', None)
                transaction_date_for_msg = getattr(pending, 'transaction_date', None) or date.today()
                # Aprendizagem: guardar no cache para futuras mensagens (menos IA)
                cache_key = _description_cache_key(pending.description)
                if cache_key and pending.category_id:
                    category = db.query(models.Category).filter(models.Category.id == pending.category_id).first()
                    cat_name = category.name if category else "Outros"
                    tipo = "expense" if pending.amount_cents < 0 else "income"
                    save_cached_category(cache_key, pending.workspace_id, pending.category_id, cat_name, tipo, db, is_common=True)
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
                
                # Mensagem de confirmação
                tipo_emoji = "" if amount_cents_for_msg < 0 else "💰"
                tipo_texto = t('type_expense') if amount_cents_for_msg < 0 else t('type_income')
                category = db.query(models.Category).filter(models.Category.id == category_id_for_msg).first()
                category_name = category.name if category else "Outros"
                origin_line = _origin_line(inference_source_for_msg, t)
                send_telegram_msg(chat_id, t('transaction_confirmed').format(
                    description=desc_for_msg,
                    emoji=tipo_emoji,
                    amount=abs(amount_cents_for_msg)/100,
                    category=category_name,
                    type=tipo_texto,
                    origin_line=origin_line,
                    date_line=_date_line(transaction_date_for_msg, t),
                ))
                # Dica após primeira transação (workspace com apenas 1 transação)
                total_tx = db.query(models.Transaction).filter(
                    models.Transaction.workspace_id == transaction.workspace_id
                ).count()
                if total_tx == 1:
                    send_telegram_msg(chat_id, t('tip_multi'))
                
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
        
        # Comandos /info, /help e /ajuda
        if text.startswith('/info') or text.startswith('/help') or text.startswith('/ajuda'):
            send_telegram_msg(chat_id, t('help_guide'))
            return {'status': 'ok'}
        
        # Comando /resumo ou /hoje - Resumo do dia
        if text.strip().lower() in ('/resumo', '/hoje'):
            user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
            if not user:
                send_telegram_msg(chat_id, t('clear_unauthorized'))
                return {'status': 'unauthorized'}
            workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
            if not workspace:
                send_telegram_msg(chat_id, t('workspace_not_found'))
                return {'status': 'error'}
            today = date.today()
            q = db.query(
                func.sum(case([(models.Transaction.amount_cents < 0, models.Transaction.amount_cents)], else_=0)),
                func.sum(case([(models.Transaction.amount_cents > 0, models.Transaction.amount_cents)], else_=0)),
                func.count(models.Transaction.id),
            ).filter(
                models.Transaction.workspace_id == workspace.id,
                models.Transaction.transaction_date == today,
            ).first()
            expenses_cents = int(q[0] or 0)
            income_cents = int(q[1] or 0)
            count = int(q[2] or 0)
            expenses = abs(expenses_cents) / 100
            income = income_cents / 100
            balance = income - abs(expenses_cents) / 100
            lang = user.language if user.language else 'pt'
            t_sum = get_telegram_t(lang)
            if count == 0:
                send_telegram_msg(chat_id, t_sum('summary_empty'))
            else:
                send_telegram_msg(chat_id, t_sum('summary_today').format(expenses=expenses, income=income, count=count, balance=balance))
            return {'status': 'ok'}
        
        # Comando /mes - Resumo do mês
        if text.strip().lower() == '/mes':
            user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
            if not user:
                send_telegram_msg(chat_id, t('clear_unauthorized'))
                return {'status': 'unauthorized'}
            workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
            if not workspace:
                send_telegram_msg(chat_id, t('workspace_not_found'))
                return {'status': 'error'}
            today = date.today()
            first_day = today.replace(day=1)
            q = db.query(
                func.sum(case([(models.Transaction.amount_cents < 0, models.Transaction.amount_cents)], else_=0)),
                func.sum(case([(models.Transaction.amount_cents > 0, models.Transaction.amount_cents)], else_=0)),
                func.count(models.Transaction.id),
            ).filter(
                models.Transaction.workspace_id == workspace.id,
                models.Transaction.transaction_date >= first_day,
                models.Transaction.transaction_date <= today,
            ).first()
            expenses_cents = int(q[0] or 0)
            income_cents = int(q[1] or 0)
            count = int(q[2] or 0)
            expenses = abs(expenses_cents) / 100
            income = income_cents / 100
            balance = income - abs(expenses_cents) / 100
            lang = user.language if user.language else 'pt'
            t_sum = get_telegram_t(lang)
            if count == 0:
                send_telegram_msg(chat_id, t_sum('summary_empty'))
            else:
                send_telegram_msg(chat_id, t_sum('summary_month').format(expenses=expenses, income=income, count=count, balance=balance))
            return {'status': 'ok'}
        
        # Comando /pendentes - Listar transações pendentes
        if text.strip().lower() == '/pendentes':
            user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
            if not user:
                send_telegram_msg(chat_id, t('clear_unauthorized'))
                return {'status': 'unauthorized'}
            workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
            if not workspace:
                send_telegram_msg(chat_id, t('workspace_not_found'))
                return {'status': 'error'}
            lang = user.language if user.language else 'pt'
            t_pend = get_telegram_t(lang)
            pendents = db.query(models.TelegramPendingTransaction).filter(
                models.TelegramPendingTransaction.chat_id == str(chat_id),
                models.TelegramPendingTransaction.workspace_id == workspace.id,
            ).order_by(models.TelegramPendingTransaction.created_at).all()
            if not pendents:
                send_telegram_msg(chat_id, t_pend('pendentes_empty'))
                return {'status': 'ok'}
            lines = []
            for p in pendents:
                cat = db.query(models.Category).filter(models.Category.id == p.category_id).first()
                cat_name = cat.name if cat else "Outros"
                lines.append(t_pend('list_pending_line').format(description=p.description, amount=abs(p.amount_cents) / 100, category=cat_name))
            send_telegram_msg(chat_id, t_pend('pendentes_list').format(count=len(pendents), lines="".join(lines)))
            return {'status': 'ok'}
        
        # Comando /revoke - Desvincular Telegram da conta
        if text.strip().lower() == '/revoke':
            user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
            if not user:
                send_telegram_msg(chat_id, t('clear_unauthorized'))
                return {'status': 'unauthorized'}
            lang = user.language if user.language else 'pt'
            t_revoke = get_telegram_t(lang)
            logger.info(f"[AÇÃO SENSÍVEL] /revoke: chat_id={chat_id}, user_id={user.id}, email={getattr(user, 'email', '')[:10]}***")
            user.phone_number = None
            db.query(models.TelegramPendingTransaction).filter(
                models.TelegramPendingTransaction.chat_id == str(chat_id),
            ).delete(synchronize_session=False)
            db.commit()
            send_telegram_msg(chat_id, t_revoke('revoke_ok'))
            return {'status': 'ok'}
        
        # Comando /idioma pt|en - Mudar idioma
        if text.strip().lower().startswith('/idioma '):
            user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
            if not user:
                send_telegram_msg(chat_id, t('clear_unauthorized'))
                return {'status': 'unauthorized'}
            part = text.strip().split(maxsplit=1)
            lang_arg = (part[1].strip().lower() if len(part) > 1 else "") or "pt"
            if lang_arg in ("en", "english"):
                user.language = "en"
                db.commit()
                t_lang = get_telegram_t("en")
                send_telegram_msg(chat_id, t_lang('language_set_en'))
            else:
                user.language = "pt"
                db.commit()
                t_lang = get_telegram_t("pt")
                send_telegram_msg(chat_id, t_lang('language_set'))
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
                logger.info(f"[AÇÃO SENSÍVEL] /clear em massa: chat_id={chat_id}, user_id={user.id}, count={count}")
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
        
        parsed = None
        # Processar fotos (OpenAI Vision)
        if 'photo' in message:
            file_id = message['photo'][-1]['file_id']
            # Resposta rápida "A processar..." para o user não achar que o bot não respondeu
            send_telegram_msg(chat_id, t('processing_photo'))
            # Carregar todas as categorias do workspace para enviar no prompt da Vision
            all_categories = db.query(models.Category).filter(
                models.Category.workspace_id == workspace.id
            ).all()
            logger.info("[Telegram] Foto recebida file_id=%s workspace_id=%s categorias=%s", file_id[:20] if file_id else None, workspace.id, len(all_categories))
            try:
                photo_result = process_photo_with_openai(file_id, all_categories)
            except OpenAIRateLimitError as e:
                logger.warning("[Telegram] OpenAI rate limit (429): %s -> enviando photo_rate_limit", e)
                send_telegram_msg(chat_id, t('photo_rate_limit'))
                return {'status': 'error'}
            if not photo_result:
                logger.warning("[Telegram] process_photo_with_openai retornou None -> enviando photo_not_supported")
                send_telegram_msg(chat_id, t('photo_not_supported'))
                return {'status': 'error'}
            logger.info("[Telegram] Vision OK, a construir parsed com _parsed_from_photo")
            try:
                parsed = _parsed_from_photo(photo_result, workspace, db)
            except AIUnavailableError as ae:
                logger.warning("[Telegram] _parsed_from_photo AIUnavailableError: %s", ae)
                send_telegram_msg(chat_id, t('ai_unavailable'))
                return {'status': 'error'}
            if not parsed:
                logger.warning("[Telegram] _parsed_from_photo retornou None -> enviando photo_not_supported")
                send_telegram_msg(chat_id, t('photo_not_supported'))
                return {'status': 'error'}
            logger.info("[Telegram] Foto processada com sucesso: %s", parsed.get("description"))
        # Processar texto
        elif text:
            logger.info(f"Processando texto como transação: '{text}'")
            try:
                parsed = parse_transaction(text, workspace, db)
            except AIUnavailableError as ae:
                err_str = str(ae).lower()
                if "429" in err_str or "rate" in err_str or "limit" in err_str:
                    send_telegram_msg(chat_id, t('ai_busy'))
                else:
                    send_telegram_msg(chat_id, t('ai_unavailable'))
                return {'status': 'error'}
            logger.info(f"Resultado do parsing: {parsed}")
            
            if not parsed:
                logger.warning(f"Não foi possível fazer parse da mensagem: '{text}'")
                send_telegram_msg(chat_id, t('parse_error'))
                return {'status': 'error'}
        
        if not parsed:
            logger.info("Mensagem não processada (sem texto nem foto)")
            return {'status': 'ignored'}
        
        # Limite de pendentes: máx 20; acima disso pedir para confirmar ou /clear
        if not user.telegram_auto_confirm:
            pending_count = db.query(models.TelegramPendingTransaction).filter(
                models.TelegramPendingTransaction.chat_id == str(chat_id),
                models.TelegramPendingTransaction.workspace_id == workspace.id,
            ).count()
            if pending_count >= 20:
                send_telegram_msg(chat_id, t('too_many_pending').format(count=pending_count))
                return {'status': 'too_many_pending'}
            # Aviso de pendentes antigos (>24h)
            stale_cutoff = datetime.now(timezone.utc) - timedelta(hours=PENDING_STALE_HOURS)
            stale_count = db.query(models.TelegramPendingTransaction).filter(
                models.TelegramPendingTransaction.chat_id == str(chat_id),
                models.TelegramPendingTransaction.workspace_id == workspace.id,
                models.TelegramPendingTransaction.created_at < stale_cutoff,
            ).count()
            if stale_count > 0:
                send_telegram_msg(chat_id, t('pending_stale'))
        
        # Processar múltiplas transações (lista): uma mensagem com todas as linhas + total + Confirmar tudo / Cancelar tudo
        if parsed.get('multiple'):
            transactions = parsed['transactions']
            created_count = 0
            batch_id = uuid.uuid4()
            batch_id_hex = batch_id.hex[:16]

            for trans_data in transactions:
                amount_cents = int(trans_data['amount'] * 100)
                if trans_data.get('is_vault', False):
                    if trans_data.get('is_vault_withdrawal', False):
                        amount_cents = -abs(amount_cents)
                    else:
                        amount_cents = abs(amount_cents)
                elif trans_data['type'] == 'expense':
                    amount_cents = -abs(amount_cents)
                else:
                    amount_cents = abs(amount_cents)

                trans_date = trans_data.get('transaction_date') or date.today()
                if user.telegram_auto_confirm:
                    transaction = models.Transaction(
                        workspace_id=workspace.id,
                        category_id=trans_data['category_id'],
                        amount_cents=amount_cents,
                        description=trans_data['description'],
                        inference_source=trans_data.get('inference_source'),
                        decision_reason=trans_data.get('decision_reason'),
                        needs_review=trans_data.get('needs_review', False),
                        transaction_date=trans_date,
                    )
                    db.add(transaction)
                    created_count += 1
                else:
                    pending = models.TelegramPendingTransaction(
                        chat_id=str(chat_id),
                        workspace_id=workspace.id,
                        category_id=trans_data['category_id'],
                        amount_cents=amount_cents,
                        description=trans_data['description'],
                        inference_source=trans_data.get('inference_source'),
                        decision_reason=trans_data.get('decision_reason'),
                        needs_review=trans_data.get('needs_review', False),
                        transaction_date=trans_date,
                        batch_id=batch_id,
                    )
                    db.add(pending)

            if user.telegram_auto_confirm:
                db.commit()
                send_telegram_msg(chat_id, t('multiple_transactions_created').format(count=created_count))
                return {'status': 'success'}

            db.flush()
            # Construir uma única mensagem: lista (descrição — valor — categoria) + total + botões
            total_cents = 0
            lines = []
            pendents_batch = db.query(models.TelegramPendingTransaction).filter(
                models.TelegramPendingTransaction.batch_id == batch_id
            ).order_by(models.TelegramPendingTransaction.created_at).all()
            for p in pendents_batch:
                total_cents += p.amount_cents
                category = db.query(models.Category).filter(models.Category.id == p.category_id).first()
                category_name = category.name if category else "Outros"
                lines.append(t('list_pending_line').format(
                    description=p.description,
                    amount=abs(p.amount_cents) / 100,
                    category=category_name,
                ))
            total_euros = abs(total_cents) / 100
            message_text = (
                t('list_pending_header')
                + "".join(lines)
                + t('list_pending_total').format(total=total_euros)
                + t('list_confirm_question')
            )
            reply_markup = {
                "inline_keyboard": [[
                    {"text": t('button_confirm_all'), "callback_data": f"confirm_batch_{batch_id_hex}"},
                    {"text": t('button_cancel_all'), "callback_data": f"cancel_batch_{batch_id_hex}"},
                ]]
            }
            send_telegram_msg(chat_id, message_text, reply_markup)
            db.commit()
            return {'status': 'success'}
            
        # Processar transação única
        amount_cents = int(parsed['amount'] * 100)
        transaction_date = parsed.get('transaction_date') or date.today()
        suggested_category_name = parsed.get('suggested_category_name')
        if parsed.get('type') == 'expense':
            amount_cents = -abs(amount_cents)
        else:
            amount_cents = abs(amount_cents)

        # Deduplicação: já existe pendente com mesma descrição+valor+tipo?
        if not parsed.get('multiple') and not user.telegram_auto_confirm and parsed.get('category_id') and not suggested_category_name:
            cache_key = _description_cache_key(parsed.get('description') or "")
            existing = db.query(models.TelegramPendingTransaction).filter(
                models.TelegramPendingTransaction.chat_id == str(chat_id),
                models.TelegramPendingTransaction.workspace_id == workspace.id,
                models.TelegramPendingTransaction.amount_cents == amount_cents,
                models.TelegramPendingTransaction.batch_id.is_(None),
            ).all()
            for ex in existing:
                if _description_cache_key(ex.description) == cache_key:
                    send_telegram_msg(chat_id, t('pending_duplicate'))
                    return {'status': 'duplicate_pending'}
        
        # Se a IA sugeriu uma categoria que não existe: perguntar se quer criar
        if suggested_category_name and not parsed.get('category_id'):
            pending = models.TelegramPendingTransaction(
                chat_id=str(chat_id),
                workspace_id=workspace.id,
                category_id=None,
                amount_cents=amount_cents,
                description=(parsed['description'] or "")[:255],
                inference_source=parsed.get('inference_source'),
                decision_reason=parsed.get('decision_reason'),
                needs_review=True,
                transaction_date=transaction_date,
                suggested_category_name=suggested_category_name[:100],
            )
            db.add(pending)
            db.commit()
            message_text = t('create_category_prompt').format(name=suggested_category_name)
            pending_id_hex = pending.id.hex[:16]
            reply_markup = {
                "inline_keyboard": [[
                    {"text": t('button_create_category'), "callback_data": f"create_cat_{pending_id_hex}"},
                    {"text": t('button_skip_category'), "callback_data": f"skip_cat_{pending_id_hex}"}
                ]]
            }
            send_telegram_msg(chat_id, message_text, reply_markup)
            logger.info("Pendente com suggested_category_name criado; aguardando user criar ou cancelar")
            return {'status': 'success'}

        category = db.query(models.Category).filter(
            models.Category.id == parsed['category_id']
        ).first()
        category_name = category.name if category else "Outros"

        # Lógica especial para categorias de vault (investimento/emergência)
        is_vault_category = category and category.vault_type != 'none'
        is_vault_withdrawal = parsed.get('is_vault_withdrawal', False) if is_vault_category else False
        if is_vault_category:
            amount_cents = -abs(amount_cents) if is_vault_withdrawal else abs(amount_cents)

        if user.telegram_auto_confirm:
            logger.info("Modo auto_confirm ativo - criando transacao diretamente")
            transaction = models.Transaction(
                workspace_id=workspace.id,
                category_id=parsed['category_id'],
                amount_cents=amount_cents,
                description=parsed['description'],
                inference_source=parsed.get('inference_source'),
                decision_reason=parsed.get('decision_reason'),
                needs_review=parsed.get('needs_review', False),
                transaction_date=transaction_date,
            )
            db.add(transaction)
            db.flush()
            logger.info("Transacao criada com ID: %s, workspace_id: %s, amount_cents: %s", transaction.id, workspace.id, amount_cents)
            db.commit()
            logger.info("Transacao commitada com sucesso (auto_confirm)")
            tipo_emoji = "" if amount_cents < 0 else "💰"
            tipo_texto = t('type_expense') if amount_cents < 0 else t('type_income')
            origin_line = _origin_line(parsed.get('inference_source'), t)
            send_telegram_msg(chat_id, t('transaction_registered').format(
                description=parsed['description'],
                emoji=tipo_emoji,
                amount=abs(parsed['amount']),
                category=category_name,
                type=tipo_texto,
                origin_line=origin_line,
                date_line=_date_line(transaction_date, t),
            ))
        else:
            pending = models.TelegramPendingTransaction(
                chat_id=str(chat_id),
                workspace_id=workspace.id,
                category_id=parsed['category_id'],
                amount_cents=amount_cents,
                description=parsed['description'],
                inference_source=parsed.get('inference_source'),
                decision_reason=parsed.get('decision_reason'),
                needs_review=parsed.get('needs_review', False),
                transaction_date=transaction_date,
            )
            db.add(pending)
            db.commit()
            tipo_emoji = "" if amount_cents < 0 else "💰"
            tipo_texto = t('type_expense') if amount_cents < 0 else t('type_income')
            origin_line = _origin_line(parsed.get('inference_source'), t)
            message_text = t('transaction_pending').format(
                description=parsed['description'],
                emoji=tipo_emoji,
                amount=abs(parsed['amount']),
                category=category_name,
                type=tipo_texto,
                origin_line=origin_line,
                date_line=_date_line(transaction_date, t),
            )
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
        
    except Exception as e:
        logger.error(f"Erro Telegram: {str(e)}", exc_info=True)
        import traceback
        logger.error(f"Traceback completo: {traceback.format_exc()}")
        try:
            chat_id = (data.get('message') or {}).get('chat', {}).get('id') or (data.get('callback_query') or {}).get('message', {}).get('chat', {}).get('id') if data else None
            if chat_id and db:
                user_temp = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
                lang = (user_temp.language if user_temp and user_temp.language else None) or 'pt'
                t_err = get_telegram_t(lang)
                send_telegram_msg(chat_id, t_err('generic_error'))
        except Exception:
            pass
        return {'status': 'error'}
