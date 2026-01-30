from fastapi import APIRouter, Request, HTTPException, Depends, Header
from sqlalchemy.orm import Session
import requests
import json
import logging
import re
import hmac
import hashlib
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, date, timezone
from typing import Optional, Dict, List, Tuple
import unicodedata
from difflib import SequenceMatcher

from ..core.config import settings
from ..core.dependencies import get_db
from ..models import database as models
from ..core.limiter import limiter
from ..core.telegram_translations import get_telegram_t

logger = logging.getLogger("telegram_webhook")


def _telegram_lang(from_user: Optional[dict]) -> str:
    """Infer bot language from Telegram user (when app user has no language set)."""
    code = (from_user or {}).get("language_code") or "pt"
    c = (code or "").lower()
    if c.startswith("en"):
        return "en"
    if c.startswith("fr"):
        return "fr"
    return "pt"
# Não adicionar handlers aqui - usar os do logging root para evitar duplicação

router = APIRouter(prefix='/telegram', tags=['webhooks'])

# Rate Limiting
_rate_limit_store = defaultdict(list)  # chat_id -> [timestamps]
_rate_limit_window = timedelta(minutes=1)
_rate_limit_max_messages = 10  # Máximo 10 mensagens por minuto

# Media limits
_max_media_per_day = 2
_max_media_size_bytes = 10 * 1024 * 1024  # 10MB
_supported_media_mime_types = {
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

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

def check_and_increment_media_limit(chat_id: str, db: Session) -> bool:
    """Limite diário de media por chat_id (para controlar custos)."""
    today = date.today()
    usage = db.query(models.TelegramMediaUsage).filter(
        models.TelegramMediaUsage.chat_id == chat_id,
        models.TelegramMediaUsage.day == today
    ).first()
    if not usage:
        usage = models.TelegramMediaUsage(chat_id=chat_id, day=today, count=0)
        db.add(usage)
        db.flush()
    if usage.count >= _max_media_per_day:
        return False
    usage.count += 1
    db.commit()
    return True

def _get_telegram_file_bytes(file_id: str) -> Tuple[bytes, Optional[str]]:
    """Busca um ficheiro do Telegram e devolve (bytes, file_path)."""
    file_info = requests.get(
        f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getFile",
        params={'file_id': file_id},
        timeout=10
    ).json()
    file_path = file_info.get('result', {}).get('file_path')
    if not file_path:
        return b'', None
    file_url = f"https://api.telegram.org/file/bot{settings.TELEGRAM_BOT_TOKEN}/{file_path}"
    file_bytes = requests.get(file_url, timeout=20).content
    return file_bytes, file_path

def _extract_json_list(text: str) -> Optional[List[Dict]]:
    """Extrai e parseia um JSON list ou object da resposta da IA."""
    if not text:
        return None
    list_match = re.search(r'\[[\s\S]*\]', text)
    obj_match = re.search(r'\{[\s\S]*\}', text)
    raw = list_match.group(0) if list_match else (obj_match.group(0) if obj_match else None)
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return [data]
        if isinstance(data, list):
            return data
        return None
    except Exception:
        return None

def _parse_statement_with_gemini(
    content: bytes,
    mime_type: str,
    text_payload: Optional[str] = None,
    existing_categories: Optional[List[Tuple[str, str]]] = None,
) -> Tuple[Optional[List[Dict]], Optional[str]]:
    """Analisa extrato/recibo com Gemini e devolve (lista de itens, None) ou (None, 'insufficient_quality').
    existing_categories: lista de (nome, type) com categorias do workspace para o Gemini preferir.
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY não configurada. Não é possível analisar extratos.")
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)

        today_iso = datetime.now().strftime('%Y-%m-%d')

        categories_instruction = ""
        if existing_categories:
            by_type: Dict[str, List[str]] = defaultdict(list)
            for name, cat_type in existing_categories:
                by_type[cat_type].append(name)
            parts = []
            if by_type.get("expense"):
                parts.append("Despesas (type=expense): " + ", ".join(sorted(by_type["expense"])))
            if by_type.get("income"):
                parts.append("Receitas (type=income): " + ", ".join(sorted(by_type["income"])))
            if parts:
                categories_instruction = (
                    "\n\n=== CATEGORIAS EXISTENTES (usa SEMPRE uma destas — nome exato) ===\n"
                    + "\n".join(parts)
                    + """

REGRAS DE CATEGORIAS (obrigatório):
1. Escolhe SEMPRE uma categoria da lista acima pelo nome EXATO se a transação encaixar (mesmo que seja aproximado: supermercado→Alimentação, Uber→Transportes, restaurante→Alimentação ou Lazer).
2. Transportes = APENAS: combustível, portagens, bilhetes comboio/autocarro/avião, Uber/Bolt/taxi, reparações do carro. NUNCA: hotel, Booking.com, Airbnb, alojamento (isso é Viagens/Lazer/Alojamento).
3. Só sugira uma categoria NOVA (fora da lista) se não existir NENHUMA que faça sentido — em dúvida, escolhe a existente mais próxima.
"""
                )

        prompt = f"""Tu és um extrator de transações financeiras. A tua ÚNICA tarefa é analisar o extrato/recibo/imagem e devolver uma lista JSON de transações. Nada mais.

DATA DE HOJE (usa se faltar data): {today_iso}

=== FORMATO DE SAÍDA (obrigatório) ===
Responde APENAS com um array JSON. Cada objeto tem exatamente estes 5 campos (nomes em inglês):
- "description": string curta e clara (ex: "Supermercado Continente", "Hotel Booking.com")
- "amount": número positivo, valor absoluto (ex: 25.90). O campo "type" indica se é despesa ou receita
- "date": string YYYY-MM-DD (ex: "2025-01-15"). Se não houver data, usa {today_iso}
- "type": "expense" ou "income" (não mais nada)
- "category_suggestion": string com o nome EXATO de uma categoria da lista abaixo, ou uma nova só se for inevitável

Exemplo de resposta válida (sem texto antes ou depois):
[
  {{"description": "Supermercado", "amount": 45.20, "date": "2025-01-14", "type": "expense", "category_suggestion": "Alimentação"}},
  {{"description": "Salário", "amount": 1500, "date": "2025-01-01", "type": "income", "category_suggestion": "Salário"}}
]

=== QUALIDADE DA IMAGEM/DOCUMENTO ===
Se a imagem ou o documento tiver qualidade INSUFICIENTE para ler transações (ex.: imagem desfocada, muito escura, resolução muito baixa, texto ilegível, foto de ecrã pixelada), NÃO inventes dados. Responde com exatamente:
{{"insufficient_quality": true}}

=== REGRAS GERAIS ===
1. Extrai APENAS transações que apareçam claramente no documento. Não inventes linhas.
2. amount: sempre número (inteiro ou decimal). Remove símbolos de moeda e vírgulas (ex: "1.234,56€" → 1234.56).
3. Se o documento estiver vazio ou ilegível (mas com qualidade ok), responde: []
4. Se a qualidade for má (desfocado, ilegível), responde: {{"insufficient_quality": true}}
5. description: máximo ~80 caracteres, sem quebras de linha.
6. type: "expense" para saídas/pagamentos, "income" para entradas/salário/reembolsos.
{categories_instruction}

=== FIM DAS INSTRUÇÕES ===
Responde APENAS com o array JSON ou com {{"insufficient_quality": true}}. Sem explicações, sem markdown, sem \\`\\`\\`json.
"""
        content_parts: List = []
        if text_payload is not None:
            content_parts = [prompt + "\n\nDADOS:\n" + text_payload]
        else:
            content_parts = [prompt, {"mime_type": mime_type, "data": content}]
        
        models_to_try = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest']
        text_response = ""
        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(content_parts)
                if response and response.text:
                    text_response = response.text.strip()
                    break
            except Exception as e:
                logger.warning(f"Falha com {model_name}: {str(e)}")
                continue
        
        parsed = _extract_json_list(text_response)
        if parsed and len(parsed) == 1 and isinstance(parsed[0], dict) and parsed[0].get("insufficient_quality") is True:
            return (None, "insufficient_quality")
        return (parsed, None)
    except Exception as e:
        logger.error(f"Erro ao analisar extrato com Gemini: {str(e)}")
        return (None, None)

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
        
        # Se categoria foi especificada, usar diretamente (SEM ir ao cache ou Gemini)
        if specified_category:
            category_id = specified_category.id
            logger.info(f"✓ Usando categoria especificada pelo utilizador: '{specified_category_name}' (id: {category_id}) - PULANDO cache e Gemini")
        else:
            # Tentar encontrar categoria via cache (transações similares)
            category_id = find_similar_transaction(description, workspace.id, db, tipo)
            
            # Se não encontrou no cache de transações, verificar cache de categorizações do Gemini
            if not category_id:
                description_normalized = normalize_text(description)
                category_id = get_cached_category(description_normalized, workspace.id, tipo, categories, db)
                
                if category_id:
                    logger.info(f"Categoria encontrada no cache do Gemini para '{description}': category_id={category_id}")
                else:
                    # Se não está no cache, usar Gemini AI para categorizar
                    logger.info(f"Nenhuma transação similar encontrada no cache para '{description}'. Usando Gemini AI para categorizar.")
                    category_id = categorize_with_ai(description, categories, tipo, text, workspace.id, db)
                    if category_id:
                        # Encontrar nome da categoria
                        category_obj = next((cat for cat in categories if cat.id == category_id), None)
                        category_name = category_obj.name if category_obj else "Outros"
                        
                        logger.info(f"Gemini categorizou '{description}' com sucesso: category_id={category_id}")
                        # Guardar no cache para futuras utilizações (privado e global se for comum)
                        save_cached_category(description_normalized, workspace.id, category_id, category_name, tipo, db, is_common=True)
                    else:
                        logger.warning(f"Gemini não conseguiu categorizar '{description}'. Usando categoria padrão.")
            else:
                logger.info(f"Transação similar encontrada no cache para '{description}'. Usando categoria do cache: category_id={category_id}")
        
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
        else:
            # Criar novo
            cache_entry = models.CategoryMappingCache(
                workspace_id=workspace_id,
                description_normalized=description_normalized,
                category_id=category_id,
                category_name=category_name,
                transaction_type=tipo,
                is_global=False
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
                    is_global=True
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
    Usa Gemini AI para categorizar a transação quando não encontra no cache.
    Retorna category_id ou None.
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY não configurada. Não é possível usar IA para categorizar.")
        return None
    
    # Filtrar apenas categorias do tipo correto (já vem filtrado, mas garantir)
    filtered_categories = [cat for cat in categories if cat.type == tipo]
    if not filtered_categories:
        logger.warning(f"Nenhuma categoria do tipo '{tipo}' disponível")
        return None
    
    try:
        import google.generativeai as genai
        
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        # Preparar lista de categorias (apenas do tipo correto, formato compacto)
        categories_list = [cat.name for cat in filtered_categories]
        categories_text = ", ".join(categories_list)
        
        # Prompt otimizado e mais direto (menos tokens = mais rápido)
        prompt = f"""Categoriza: "{original_text}"

Categorias: {categories_text}

Responde APENAS com o nome exato da categoria:"""
        
        logger.info(f"Consultando Gemini: '{original_text}' -> {categories_list}")
        
        # Usar apenas gemini-flash-latest (mais rápido)
        try:
            model = genai.GenerativeModel('gemini-flash-latest')
            # Configurar para resposta rápida
            response = model.generate_content(
                prompt,
                generation_config={
                    'temperature': 0.1,  # Mais determinístico
                    'max_output_tokens': 20,  # Resposta curta
                }
            )
            ai_category_name = response.text.strip()
            logger.info(f"Resposta Gemini: '{ai_category_name}'")
            
            category_id_found = None
            
            # Procurar categoria correspondente (match exato primeiro)
            for cat in filtered_categories:
                if cat.name.lower() == ai_category_name.lower():
                    logger.info(f"Match exato: '{cat.name}' (id: {cat.id})")
                    category_id_found = cat.id
                    break
            
            # Match parcial (contém)
            if not category_id_found:
                for cat in filtered_categories:
                    if cat.name.lower() in ai_category_name.lower() or ai_category_name.lower() in cat.name.lower():
                        logger.info(f"Match parcial: '{cat.name}' (id: {cat.id})")
                        category_id_found = cat.id
                        break
            
            # Match por primeira palavra
            if not category_id_found:
                first_word = ai_category_name.split()[0] if ai_category_name.split() else ""
                if first_word:
                    for cat in filtered_categories:
                        if first_word.lower() in cat.name.lower():
                            logger.info(f"Match por palavra: '{cat.name}' (id: {cat.id})")
                            category_id_found = cat.id
                            break
            
            if category_id_found:
                # Guardar no cache para futuras utilizações (já é guardado na função chamadora, mas garantir)
                return category_id_found
            else:
                logger.warning(f"Nenhuma categoria encontrada para: '{ai_category_name}'")
                return None
                        
        except Exception as e:
            logger.error(f"Erro ao usar Gemini: {str(e)}")
            return None
        
    except ImportError:
        logger.warning("google-generativeai não instalado. Instale com: pip install google-generativeai")
        return None
    except Exception as e:
        logger.error(f"Erro na categorização IA: {str(e)}")
        return None

def _parse_amount(value: object) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace('€', '').replace('eur', '').replace(' ', '').replace(',', '.')
        try:
            return float(cleaned)
        except Exception:
            return None
    return None

def _parse_date(value: object) -> str:
    """Converte para YYYY-MM-DD. Se inválido, usa data atual."""
    if isinstance(value, str):
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(value.strip(), fmt).date().isoformat()
            except Exception:
                continue
    return date.today().isoformat()

def _get_default_category(categories: List[models.Category], tipo: str) -> Optional[models.Category]:
    for cat in categories:
        if cat.type == tipo and cat.name.lower() == 'outros':
            return cat
    for cat in categories:
        if cat.type == tipo:
            return cat
    return None

def _get_or_create_category(name: str, tipo: str, workspace: models.Workspace, db: Session) -> models.Category:
    existing = db.query(models.Category).filter(
        models.Category.workspace_id == workspace.id,
        models.Category.type == tipo,
        models.Category.name.ilike(name)
    ).first()
    if existing:
        return existing
    new_category = models.Category(
        workspace_id=workspace.id,
        name=name.strip()[:100],
        type=tipo,
        vault_type='none',
        color_hex='#3B82F6',
        icon='Tag'
    )
    db.add(new_category)
    db.commit()
    db.refresh(new_category)
    return new_category

def _build_items_from_gemini(raw_items: List[Dict], workspace: models.Workspace, db: Session) -> List[Dict]:
    categories = db.query(models.Category).filter(
        models.Category.workspace_id == workspace.id
    ).all()
    items: List[Dict] = []
    for item in raw_items:
        description = str(item.get('description') or '').strip()
        amount = _parse_amount(item.get('amount'))
        if not description or amount is None:
            continue
        tipo = str(item.get('type') or 'expense').lower()
        if tipo not in ('expense', 'income'):
            tipo = 'expense'
        date_str = _parse_date(item.get('date'))
        suggestion = str(item.get('category_suggestion') or '').strip()
        matched_category = None
        if suggestion:
            matched_category = find_best_category_match(suggestion, categories)
        if matched_category and matched_category.type == tipo:
            category_id = str(matched_category.id)
        else:
            category_id = None
        items.append({
            'description': description,
            'amount': amount,
            'date': date_str,
            'type': tipo,
            'category_suggestion': suggestion,
            'category_id': category_id
        })
    return items

def _find_pending_batch_by_hex(chat_id: str, batch_id_hex: str, db: Session) -> Optional[models.TelegramPendingBatchImport]:
    batches = db.query(models.TelegramPendingBatchImport).filter(
        models.TelegramPendingBatchImport.chat_id == chat_id
    ).all()
    for b in batches:
        if b.id.hex.startswith(batch_id_hex):
            return b
    return None

def _next_unresolved_index(items: List[Dict]) -> Optional[int]:
    for idx, item in enumerate(items):
        if not item.get('category_id'):
            return idx
    return None

def _build_batch_summary(items: List[Dict], categories_by_id: Dict[str, str], t) -> str:
    lines = []
    totals: Dict[str, float] = {}
    for item in items:
        category_name = categories_by_id.get(item.get('category_id') or '', 'Outros')
        amount = float(item['amount'])
        sign = '-' if item.get('type') == 'expense' else '+'
        lines.append(f"• {item.get('date')} — {item.get('description')} — {sign}{abs(amount):.2f}€ ({category_name})")
        totals[category_name] = totals.get(category_name, 0.0) + (amount if item.get('type') == 'income' else -abs(amount))
    totals_lines = [f"{name}: {total:.2f}€" for name, total in totals.items()]
    summary = t('media_summary_header') + "\n" + "\n".join(lines)
    if totals_lines:
        summary += "\n\n" + t('media_summary_totals') + "\n" + "\n".join(totals_lines)
    if len(summary) > 3500:
        summary = summary[:3400] + "\n\n" + t('media_summary_truncated')
    return summary

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
            "command": "categorias",
            "description": "🏷️ Ver as minhas categorias (despesas/receitas)"
        },
        {
            "command": "resumo",
            "description": "📊 Totais do mês + últimas 5 transações"
        },
        {
            "command": "clear",
            "description": "🧹 Limpar transações pendentes"
        },
        {
            "command": "desfazer",
            "description": "↩️ Apagar a última transação"
        },
        {
            "command": "unlink",
            "description": "🔓 Desassociar esta conta do Telegram"
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


@router.get('/health')
async def telegram_health():
    """
    Verifica se o Telegram está configurado e o bot responde.
    Útil para confirmar TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET e que o bot está ativo.
    """
    token_configured = bool(settings.TELEGRAM_BOT_TOKEN)
    secret_configured = bool(settings.TELEGRAM_WEBHOOK_SECRET)
    bot_ok = False
    if token_configured:
        try:
            r = requests.get(
                f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getMe",
                timeout=5
            )
            if r.status_code == 200 and r.json().get("ok"):
                bot_ok = True
        except Exception as e:
            logger.warning(f"Telegram getMe falhou: {e}")
    return {
        "ok": token_configured and secret_configured and bot_ok,
        "token_configured": token_configured,
        "secret_configured": secret_configured,
        "bot_ok": bot_ok,
    }


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
            if callback_data.startswith("cat_yes_") or callback_data.startswith("cat_no_"):
                parts = callback_data.split("_")
                if len(parts) < 4:
                    send_telegram_msg(chat_id, t('batch_not_found'))
                    return {'status': 'invalid_callback'}
                action = parts[1]
                batch_id_hex = parts[2]
                try:
                    item_index = int(parts[3])
                except Exception:
                    send_telegram_msg(chat_id, t('batch_not_found'))
                    return {'status': 'invalid_callback'}
                
                workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
                if not workspace:
                    send_telegram_msg(chat_id, t('workspace_not_found'))
                    return {'status': 'error'}
                
                batch = _find_pending_batch_by_hex(str(chat_id), batch_id_hex, db)
                if not batch:
                    send_telegram_msg(chat_id, t('batch_not_found'))
                    return {'status': 'not_found'}
                
                items = json.loads(batch.items_json)
                if item_index >= len(items):
                    send_telegram_msg(chat_id, t('batch_not_found'))
                    return {'status': 'not_found'}
                
                item = items[item_index]
                category_name = item.get('category_suggestion') or 'Outros'
                tipo = item.get('type') or 'expense'
                
                if action == 'yes':
                    category = _get_or_create_category(category_name, tipo, workspace, db)
                    item['category_id'] = str(category.id)
                    send_telegram_msg(chat_id, t('category_created').format(category=category.name))
                else:
                    categories = db.query(models.Category).filter(models.Category.workspace_id == workspace.id).all()
                    fallback = _get_default_category(categories, tipo)
                    item['category_id'] = str(fallback.id) if fallback else None
                    send_telegram_msg(chat_id, t('category_skipped').format(category=fallback.name if fallback else 'Outros'))
                
                items[item_index] = item
                batch.items_json = json.dumps(items, ensure_ascii=False)
                db.commit()
                
                next_idx = _next_unresolved_index(items)
                if next_idx is not None:
                    next_item = items[next_idx]
                    next_category = next_item.get('category_suggestion') or 'Outros'
                    reply_markup = {
                        "inline_keyboard": [[
                            {"text": t('button_create_category'), "callback_data": f"cat_yes_{batch.id.hex[:12]}_{next_idx}"},
                            {"text": t('button_skip_category'), "callback_data": f"cat_no_{batch.id.hex[:12]}_{next_idx}"}
                        ]]
                    }
                    send_telegram_msg(
                        chat_id,
                        t('category_create_prompt').format(category=next_category, description=next_item.get('description')),
                        reply_markup=reply_markup
                    )
                else:
                    categories = db.query(models.Category).filter(models.Category.workspace_id == workspace.id).all()
                    categories_by_id = {str(c.id): c.name for c in categories}
                    summary = _build_batch_summary(items, categories_by_id, t)
                    reply_markup = {
                        "inline_keyboard": [[
                            {"text": t('button_confirm_import'), "callback_data": f"batch_confirm_{batch.id.hex[:12]}"},
                            {"text": t('button_cancel_import'), "callback_data": f"batch_cancel_{batch.id.hex[:12]}"}
                        ]]
                    }
                    send_telegram_msg(chat_id, summary, reply_markup=reply_markup)
                
                return {'status': 'category_processed'}
            
            if callback_data.startswith("batch_confirm_") or callback_data.startswith("batch_cancel_"):
                is_confirm = callback_data.startswith("batch_confirm_")
                batch_id_hex = callback_data.replace("batch_confirm_", "").replace("batch_cancel_", "")
                
                workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
                if not workspace:
                    send_telegram_msg(chat_id, t('workspace_not_found'))
                    return {'status': 'error'}
                
                batch = _find_pending_batch_by_hex(str(chat_id), batch_id_hex, db)
                if not batch:
                    send_telegram_msg(chat_id, t('batch_not_found'))
                    return {'status': 'not_found'}
                
                items = json.loads(batch.items_json)
                if is_confirm:
                    for item in items:
                        amount = float(item.get('amount', 0))
                        amount_cents = int(abs(amount) * 100)
                        if item.get('type') == 'expense':
                            amount_cents = -amount_cents
                        category_id = item.get('category_id')
                        category_uuid = None
                        if category_id:
                            try:
                                category_uuid = uuid.UUID(category_id)
                            except Exception:
                                category_uuid = None
                        try:
                            transaction_date = datetime.fromisoformat(item.get('date')).date()
                        except Exception:
                            transaction_date = date.today()
                        transaction = models.Transaction(
                            workspace_id=workspace.id,
                            category_id=category_uuid,
                            amount_cents=amount_cents,
                            description=item.get('description'),
                            transaction_date=transaction_date
                        )
                        db.add(transaction)
                    db.delete(batch)
                    db.commit()
                    send_telegram_msg(chat_id, t('batch_import_confirmed').format(count=len(items)))
                else:
                    db.delete(batch)
                    db.commit()
                    send_telegram_msg(chat_id, t('batch_import_cancelled'))
                
                return {'status': 'batch_processed'}
            
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
                tipo_emoji = "💸" if pending.amount_cents < 0 else "💰"
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

        # Comando /unlink - Desassociar conta
        if text.startswith('/unlink'):
            user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
            if not user:
                send_telegram_msg(chat_id, t('unlink_not_linked'))
                return {'status': 'ok'}
            language = user.language if user.language else 'pt'
            t_unlink = get_telegram_t(language)
            user.phone_number = None
            db.commit()
            send_telegram_msg(chat_id, t_unlink('unlink_success'))
            return {'status': 'ok'}

        # Comando /categorias - Listar categorias do utilizador
        if text.startswith('/categorias') or text.startswith('/categories'):
            user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
            if not user:
                send_telegram_msg(chat_id, t('session_expired'))
                return {'status': 'unauthorized'}
            language = user.language if user.language else 'pt'
            t_cat = get_telegram_t(language)
            workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
            if not workspace:
                send_telegram_msg(chat_id, t_cat('workspace_not_found'))
                return {'status': 'error'}
            categories = db.query(models.Category).filter(models.Category.workspace_id == workspace.id).all()
            if not categories:
                send_telegram_msg(chat_id, t_cat('categories_empty'))
                return {'status': 'ok'}
            expenses = [c.name for c in categories if c.type == 'expense']
            incomes = [c.name for c in categories if c.type == 'income']
            expenses_str = ", ".join(sorted(expenses)) if expenses else "—"
            incomes_str = ", ".join(sorted(incomes)) if incomes else "—"
            send_telegram_msg(chat_id, t_cat('categories_list').format(expenses=expenses_str, incomes=incomes_str))
            return {'status': 'ok'}

        # Comando /resumo ou /saldo - Totais do mês + últimas N transações
        if text.startswith('/resumo') or text.startswith('/saldo') or text.startswith('/summary'):
            user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
            if not user:
                send_telegram_msg(chat_id, t('session_expired'))
                return {'status': 'unauthorized'}
            language = user.language if user.language else 'pt'
            t_res = get_telegram_t(language)
            workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
            if not workspace:
                send_telegram_msg(chat_id, t_res('workspace_not_found'))
                return {'status': 'error'}
            first_day = date.today().replace(day=1)
            end = date.today()
            month_year = first_day.strftime("%m/%Y")
            trans_month = db.query(models.Transaction).filter(
                models.Transaction.workspace_id == workspace.id,
                models.Transaction.transaction_date >= first_day,
                models.Transaction.transaction_date <= end,
            ).all()
            if not trans_month:
                send_telegram_msg(chat_id, t_res('resumo_header').format(month_year=month_year) + "\n\n" + t_res('resumo_empty'))
                return {'status': 'ok'}
            expenses_cents = sum(t.amount_cents for t in trans_month if t.amount_cents < 0)
            income_cents = sum(t.amount_cents for t in trans_month if t.amount_cents > 0)
            balance_cents = expenses_cents + income_cents
            expenses_abs = abs(expenses_cents) / 100.0
            receitas_val = income_cents / 100.0
            balance_val = balance_cents / 100.0
            msg = t_res('resumo_header').format(month_year=month_year) + "\n\n" + t_res('resumo_totals').format(
                expenses=f"-{expenses_abs:.2f}", receitas=f"+{receitas_val:.2f}", balance=f"{balance_val:+.2f}"
            )
            last_n = 5
            last_trans = db.query(models.Transaction).filter(
                models.Transaction.workspace_id == workspace.id
            ).order_by(models.Transaction.created_at.desc()).limit(last_n).all()
            if last_trans:
                msg += t_res('resumo_last').format(n=len(last_trans))
                for t in last_trans:
                    amt = t.amount_cents / 100.0
                    amt_str = f"-{abs(amt):.2f}" if t.amount_cents < 0 else f"+{amt:.2f}"
                    msg += "\n" + t_res('resumo_line').format(
                        date=t.transaction_date.strftime("%d/%m"),
                        description=(t.description or "—")[:40],
                        amount=amt_str
                    )
            send_telegram_msg(chat_id, msg)
            return {'status': 'ok'}

        # Comando /desfazer ou /undo - Apagar a última transação
        if text.startswith('/desfazer') or text.startswith('/undo') or text.startswith('/apagar_ultima'):
            user = db.query(models.User).filter(models.User.phone_number == str(chat_id)).first()
            if not user:
                send_telegram_msg(chat_id, t('session_expired'))
                return {'status': 'unauthorized'}
            language = user.language if user.language else 'pt'
            t_undo = get_telegram_t(language)
            workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
            if not workspace:
                send_telegram_msg(chat_id, t_undo('workspace_not_found'))
                return {'status': 'error'}
            last_t = (
                db.query(models.Transaction)
                .filter(models.Transaction.workspace_id == workspace.id)
                .order_by(models.Transaction.created_at.desc())
                .limit(1)
                .first()
            )
            if not last_t:
                send_telegram_msg(chat_id, t_undo('desfazer_none'))
                return {'status': 'ok'}
            desc = (last_t.description or "—")[:50]
            amt = last_t.amount_cents / 100.0
            amt_str = f"-{abs(amt):.2f}" if last_t.amount_cents < 0 else f"+{amt:.2f}"
            db.delete(last_t)
            db.commit()
            send_telegram_msg(chat_id, t_undo('desfazer_success').format(description=desc, amount=amt_str))
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
            
            # Procurar utilizador
            user = db.query(models.User).filter(models.User.email == email_limpo).first()
            
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
            
            if existing_user and existing_user.email != email_limpo:
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
        
        # Processar media (foto/documento)
        if 'photo' in message or 'document' in message:
            file_id = None
            mime_type = None
            file_size = None
            text_payload = None
            
            if 'photo' in message:
                photo = message['photo'][-1]
                file_id = photo.get('file_id')
                file_size = photo.get('file_size')
                mime_type = 'image/jpeg'  # Telegram envia fotos como JPEG
            else:
                doc = message['document']
                file_id = doc.get('file_id')
                mime_type = doc.get('mime_type')
                file_size = doc.get('file_size')
                if mime_type not in _supported_media_mime_types:
                    send_telegram_msg(chat_id, t('media_not_supported'))
                    return {'status': 'unsupported_media'}
            
            if file_size and file_size > _max_media_size_bytes:
                send_telegram_msg(chat_id, t('media_too_large'))
                return {'status': 'too_large'}
            
            if not check_and_increment_media_limit(str(chat_id), db):
                send_telegram_msg(chat_id, t('media_limit_reached'))
                return {'status': 'media_limit'}
            
            send_telegram_msg(chat_id, t('media_processing'))
            
            file_bytes, _ = _get_telegram_file_bytes(file_id)
            if not file_bytes:
                send_telegram_msg(chat_id, t('media_parse_error'))
                return {'status': 'download_error'}
            if len(file_bytes) > _max_media_size_bytes:
                send_telegram_msg(chat_id, t('media_too_large'))
                return {'status': 'too_large'}
            
            if mime_type in ('application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'):
                send_telegram_msg(chat_id, t('media_excel_not_supported'))
                return {'status': 'excel_not_supported'}
            
            if mime_type == 'text/csv':
                try:
                    text_payload = file_bytes.decode('utf-8', errors='ignore')
                except Exception:
                    text_payload = None

            existing_cats = [
                (c.name, c.type)
                for c in db.query(models.Category).filter(models.Category.workspace_id == workspace.id).all()
            ]
            parsed_raw, quality_reason = _parse_statement_with_gemini(
                file_bytes, mime_type, text_payload=text_payload, existing_categories=existing_cats
            )
            if quality_reason == "insufficient_quality":
                send_telegram_msg(chat_id, t('media_insufficient_quality'))
                return {'status': 'insufficient_quality'}
            if not parsed_raw:
                send_telegram_msg(chat_id, t('media_parse_error'))
                return {'status': 'parse_error'}

            items = _build_items_from_gemini(parsed_raw, workspace, db)
            if not items:
                send_telegram_msg(chat_id, t('media_parse_error'))
                return {'status': 'no_items'}
            
            batch = models.TelegramPendingBatchImport(
                chat_id=str(chat_id),
                workspace_id=workspace.id,
                items_json=json.dumps(items, ensure_ascii=False)
            )
            db.add(batch)
            db.commit()
            db.refresh(batch)
            
            unresolved_idx = _next_unresolved_index(items)
            if unresolved_idx is not None:
                item = items[unresolved_idx]
                category_name = item.get('category_suggestion') or 'Outros'
                reply_markup = {
                    "inline_keyboard": [[
                        {"text": t('button_create_category'), "callback_data": f"cat_yes_{batch.id.hex[:12]}_{unresolved_idx}"},
                        {"text": t('button_skip_category'), "callback_data": f"cat_no_{batch.id.hex[:12]}_{unresolved_idx}"}
                    ]]
                }
                send_telegram_msg(
                    chat_id,
                    t('category_create_prompt').format(category=category_name, description=item.get('description')),
                    reply_markup=reply_markup
                )
                return {'status': 'category_prompt'}
            
            categories = db.query(models.Category).filter(models.Category.workspace_id == workspace.id).all()
            categories_by_id = {str(c.id): c.name for c in categories}
            summary = _build_batch_summary(items, categories_by_id, t)
            reply_markup = {
                "inline_keyboard": [[
                    {"text": t('button_confirm_import'), "callback_data": f"batch_confirm_{batch.id.hex[:12]}"},
                    {"text": t('button_cancel_import'), "callback_data": f"batch_cancel_{batch.id.hex[:12]}"}
                ]]
            }
            send_telegram_msg(chat_id, summary, reply_markup=reply_markup)
            return {'status': 'batch_summary'}
        
        # Processar texto
        if text:
            logger.info(f"Processando texto como transação: '{text}'")
            parsed = parse_transaction(text, workspace, db)
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
                            transaction_date=date.today()
                        )
                        db.add(pending)
                        db.flush()
                        
                        # Enviar botões de confirmação
                        category = db.query(models.Category).filter(
                            models.Category.id == trans_data['category_id']
                        ).first()
                        category_name = category.name if category else "Outros"
                        
                        tipo_emoji = "💸" if amount_cents < 0 else "💰"
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
                    transaction_date=date.today()
                )
                db.add(transaction)
                db.flush()
                logger.info(f"Transacao criada com ID: {transaction.id}, workspace_id: {workspace.id}, amount_cents: {amount_cents}")
                db.commit()
                logger.info("Transacao commitada com sucesso (auto_confirm)")
                
                tipo_emoji = "💸" if amount_cents < 0 else "💰"
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
                    transaction_date=date.today()
                )
                db.add(pending)
                db.commit()
                
                # Enviar mensagem com botões de confirmação
                tipo_emoji = "💸" if amount_cents < 0 else "💰"
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
