"""
Motor de categorização de transações: canonicalização, token-scoring,
regras determinísticas e fallback Gemini com circuit-breaker.
Objetivo: reduzir chamadas Gemini >80% mantendo alta precisão.
"""
import re
import unicodedata
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple, Dict, Any
from uuid import UUID

logger = logging.getLogger(__name__)

# Thresholds (spec)
TH_THRESHOLD = 0.60  # Score mínimo para aplicar categoria sem revisão
GEMINI_THRESHOLD = 0.50  # Abaixo disto: Gemini fallback + needs_review
CIRCUIT_BREAKER_COUNT = 50  # Chamadas Gemini em janela para abrir circuito
CIRCUIT_BREAKER_WINDOW_MINUTES = 60

# Stopwords PT/EN
STOPWORDS = frozenset({
    'e', 'de', 'do', 'da', 'em', 'no', 'na', 'a', 'o', 'um', 'uma', 'os', 'as',
    'para', 'com', 'por', 'que', 'se', 'ou', 'mas', 'ao', 'aos', 'das', 'dos',
    'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
    '€', 'eur', 'euro', 'euros', 'paguei', 'gastei', 'recebi', 'transfer'
})

# Merchants conhecidos -> categoria (nome exato ou parcial)
KNOWN_MERCHANTS: Dict[str, str] = {
    # Alimentação
    'continente': 'Alimentação', 'pingo doce': 'Alimentação', 'lidl': 'Alimentação',
    'auchan': 'Alimentação', 'minipreco': 'Alimentação', 'minipreço': 'Alimentação',
    'intermarche': 'Alimentação', 'intermarché': 'Alimentação', 'mercadona': 'Alimentação',
    'uber eats': 'Alimentação', 'glovo': 'Alimentação', 'bolt food': 'Alimentação',
    'just eat': 'Alimentação', 'mcdonalds': 'Alimentação', "mcdonald's": 'Alimentação',
    'burger king': 'Alimentação', 'kfc': 'Alimentação', 'pizza hut': 'Alimentação',
    'telepizza': 'Alimentação', 'starbucks': 'Alimentação', 'padaria': 'Alimentação',
    'pastelaria': 'Alimentação', 'talho': 'Alimentação', 'peixaria': 'Alimentação',
    # Transportes
    'uber': 'Transportes', 'bolt': 'Transportes', 'cabify': 'Transportes',
    'cp': 'Transportes', 'metro': 'Transportes', 'carris': 'Transportes',
    'galp': 'Transportes', 'repsol': 'Transportes', 'bp': 'Transportes',
    'prio': 'Transportes', 'cepsa': 'Transportes',
    'via verde': 'Transportes', 'brisa': 'Transportes', 'emel': 'Transportes',
    # Habitação
    'edp': 'Habitação', 'meo': 'Habitação', 'nos': 'Habitação', 'vodafone': 'Habitação',
    'nowo': 'Habitação', 'epal': 'Habitação', 'galp gás': 'Habitação',
    'condomínio': 'Habitação', 'condominio': 'Habitação',
    # Entretenimento
    'netflix': 'Entretenimento', 'spotify': 'Entretenimento', 'disney+': 'Entretenimento',
    'disney plus': 'Entretenimento', 'hbo': 'Entretenimento', 'amazon prime': 'Entretenimento',
    'playstation': 'Entretenimento', 'xbox': 'Entretenimento', 'steam': 'Entretenimento',
    'cinema': 'Entretenimento', 'fnac': 'Entretenimento', 'wook': 'Entretenimento',
    # Saúde
    'farmácia': 'Saúde', 'farmacia': 'Saúde', 'wells': 'Saúde',
    'celeiro': 'Saúde', 'dentista': 'Saúde', 'hospital': 'Saúde',
    'clínica': 'Saúde', 'clinica': 'Saúde', 'ginásio': 'Saúde', 'ginasio': 'Saúde',
    'gym': 'Saúde', 'fitness': 'Saúde', 'solinca': 'Saúde', 'holmes place': 'Saúde',
    # Compras / outros merchants
    'amazon': 'Entretenimento', 'worten': 'Entretenimento', 'ikea': 'Habitação',
    'primark': 'Entretenimento', 'zara': 'Entretenimento', 'h&m': 'Entretenimento',
    'decathlon': 'Entretenimento', 'sport zone': 'Entretenimento',
    # Salário
    'salário': 'Salário', 'ordenado': 'Salário', 'vencimento': 'Salário',
}

# Keywords genéricos -> categoria (usados como step 2.5 entre regras determinísticas e token scoring)
CATEGORY_KEYWORDS: Dict[str, str] = {
    # Alimentação
    'supermercado': 'Alimentação', 'restaurante': 'Alimentação', 'almoço': 'Alimentação',
    'almoco': 'Alimentação', 'jantar': 'Alimentação', 'café': 'Alimentação',
    'cafe': 'Alimentação', 'lanche': 'Alimentação', 'pequeno almoço': 'Alimentação',
    'comida': 'Alimentação', 'refeição': 'Alimentação', 'refeicao': 'Alimentação',
    'mercearia': 'Alimentação', 'frutaria': 'Alimentação', 'snack': 'Alimentação',
    'cerveja': 'Alimentação', 'vinho': 'Alimentação', 'sushi': 'Alimentação',
    'pizza': 'Alimentação', 'hamburguer': 'Alimentação', 'hambúrguer': 'Alimentação',
    'groceries': 'Alimentação', 'lunch': 'Alimentação', 'dinner': 'Alimentação',
    'breakfast': 'Alimentação', 'food': 'Alimentação', 'restaurant': 'Alimentação',
    # Transportes
    'gasolina': 'Transportes', 'gasóleo': 'Transportes', 'gasoleo': 'Transportes',
    'combustível': 'Transportes', 'combustivel': 'Transportes', 'portagem': 'Transportes',
    'estacionamento': 'Transportes', 'parking': 'Transportes', 'autocarro': 'Transportes',
    'comboio': 'Transportes', 'táxi': 'Transportes', 'taxi': 'Transportes',
    'bilhete': 'Transportes', 'passe': 'Transportes', 'revisão carro': 'Transportes',
    'seguro carro': 'Transportes', 'oficina': 'Transportes', 'fuel': 'Transportes',
    'gas': 'Transportes', 'petrol': 'Transportes',
    # Habitação
    'renda': 'Habitação', 'aluguel': 'Habitação', 'rent': 'Habitação',
    'água': 'Habitação', 'agua': 'Habitação', 'luz': 'Habitação',
    'eletricidade': 'Habitação', 'electricidade': 'Habitação', 'electricity': 'Habitação',
    'gás': 'Habitação', 'internet': 'Habitação', 'wifi': 'Habitação',
    'hipoteca': 'Habitação', 'mortgage': 'Habitação', 'seguro casa': 'Habitação',
    # Saúde
    'médico': 'Saúde', 'medico': 'Saúde', 'doctor': 'Saúde',
    'consulta': 'Saúde', 'medicamento': 'Saúde', 'remédio': 'Saúde',
    'remedio': 'Saúde', 'medicina': 'Saúde', 'análises': 'Saúde',
    'analises': 'Saúde', 'exame': 'Saúde', 'fisioterapia': 'Saúde',
    'psicólogo': 'Saúde', 'psicologo': 'Saúde', 'oftalmologista': 'Saúde',
    'pharmacy': 'Saúde', 'health': 'Saúde', 'medicine': 'Saúde',
    # Entretenimento
    'cinema': 'Entretenimento', 'filme': 'Entretenimento', 'concerto': 'Entretenimento',
    'teatro': 'Entretenimento', 'museu': 'Entretenimento', 'bar': 'Entretenimento',
    'discoteca': 'Entretenimento', 'festa': 'Entretenimento', 'jogo': 'Entretenimento',
    'livro': 'Entretenimento', 'revista': 'Entretenimento', 'assinatura': 'Entretenimento',
    'subscricao': 'Entretenimento', 'subscrição': 'Entretenimento', 'streaming': 'Entretenimento',
    'movie': 'Entretenimento', 'book': 'Entretenimento', 'game': 'Entretenimento',
    'entertainment': 'Entretenimento', 'subscription': 'Entretenimento',
}

# Keywords receita
INCOME_KEYWORDS = frozenset({
    'recebi', 'salário', 'ordenado', 'ganhei', 'vendi', 'rendimento',
    'bonus', 'vencimento', 'reembolso', 'subsídio', 'prémio', 'premio',
    'transferencia', 'transferência', 'pagamento'
})


def canonicalize(description: str) -> str:
    """
    Canonicalização determinística: lowercase, remover acentos, stopwords,
    valores/datas, extrair tokens alfanuméricos, ordenar.
    """
    if not description or not isinstance(description, str):
        return ""
    text = description.strip().lower()
    # Remover acentos
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    # Remover valores monetários
    text = re.sub(r'\d+[.,\s]*\d*\s*(?:€|eur|euros?|e)?', ' ', text, flags=re.IGNORECASE)
    # Remover datas comuns (DD-MM-YYYY, etc.)
    text = re.sub(r'\d{1,2}[-/]\d{1,2}[-/]\d{2,4}', ' ', text)
    # Remover códigos e referências longas (IBANs, refs, ids)
    text = re.sub(r'\\b[a-z0-9]{10,}\\b', ' ', text, flags=re.IGNORECASE)
    # Extrair tokens alfanuméricos
    tokens = re.findall(r'[a-z0-9]+', text)
    # Remover stopwords e tokens muito curtos
    tokens = [t for t in tokens if t not in STOPWORDS and len(t) >= 2 and not t.isdigit()]
    # Stemming simples (pt/en)
    tokens = [_stem_simple(t) for t in tokens]
    # Ordenar e juntar
    return ' '.join(sorted(set(tokens)))


def _stem_simple(token: str) -> str:
    """Stemming simples para reduzir variantes comuns."""
    if len(token) <= 4:
        return token
    for suf in ('mente', 'ções', 'coes', 'ção', 'cao', 's', 'es', 'os', 'as'):
        if token.endswith(suf) and len(token) - len(suf) >= 3:
            return token[: -len(suf)]
    return token


def extract_tokens(description_canonical: str, n: int = 3) -> List[str]:
    """
    Extrai n-grams (1..n) da descrição canonicalizada.
    Retorna lista de tokens únicos (unigramas, bigramas, trigramas).
    """
    if not description_canonical:
        return []
    words = description_canonical.split()
    tokens = []
    for length in range(1, min(n + 1, len(words) + 1)):
        for i in range(len(words) - length + 1):
            ngram = ' '.join(words[i:i + length])
            if ngram and ngram not in tokens:
                tokens.append(ngram)
    return tokens


def apply_deterministic_rules(description_raw: str, tipo: str) -> Optional[str]:
    """
    Regras determinísticas: IBAN, salário, merchants conhecidos.
    Retorna nome da categoria se houver match, senão None.
    """
    text_lower = description_raw.lower().strip()
    text_canon = canonicalize(description_raw)

    # Salário / receita recorrente
    if tipo == 'income':
        for kw in INCOME_KEYWORDS:
            if kw in text_lower or kw in text_canon:
                return 'Salário'

    # IBAN (transferência bancária - genérico)
    if re.search(r'\b[A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{3}\b', description_raw, re.IGNORECASE):
        if tipo == 'income':
            return 'Salário'
        return 'Transferências'

    # Merchants conhecidos (fallback local)
    for merchant, cat in KNOWN_MERCHANTS.items():
        if merchant in text_lower or merchant.replace(' ', '') in text_lower.replace(' ', ''):
            return cat

    return None


def lookup_merchant_registry(description_raw: str, tipo: str, db, models) -> Optional[Tuple[str, str]]:
    """
    Procura alias em merchant_registry. Retorna (category_name, alias) ou None.
    """
    try:
        canon = canonicalize(description_raw)
        if not canon:
            return None
        aliases = db.query(models.MerchantRegistry).filter(
            models.MerchantRegistry.is_active == True,
            models.MerchantRegistry.transaction_type == tipo,
        ).all()
        for entry in aliases:
            alias_can = canonicalize(entry.alias)
            if alias_can and alias_can in canon:
                return (entry.category_name, entry.alias)
    except Exception as e:
        logger.warning(f"Merchant registry lookup falhou: {e}")
    return None


def compute_category_scores_from_tokens(
    tokens: List[str],
    workspace_id: UUID,
    tipo: str,
    db,
    models,
) -> Tuple[Dict[UUID, float], Dict[UUID, Dict[str, float]]]:
    """
    Soma scores por categoria a partir dos token_scores do workspace.
    score = alpha * freq_recent + beta * freq_total (com decay temporal).
    """
    if not tokens:
        return {}, {}

    alpha = 0.7
    beta = 0.3
    scores: Dict[UUID, float] = {}
    token_contribs: Dict[UUID, Dict[str, float]] = {}

    rows = db.query(
        models.TokenScore.category_id,
        models.TokenScore.token,
        models.TokenScore.count,
        models.TokenScore.score,
        models.TokenScore.last_updated,
    ).filter(
        models.TokenScore.workspace_id == workspace_id,
        models.TokenScore.transaction_type == tipo,
        models.TokenScore.token.in_(tokens),
    ).all()

    for r in rows:
        if not r.category_id:
            continue
        recency = 1.0
        if r.last_updated:
            age_days = (datetime.now(timezone.utc) - r.last_updated.replace(tzinfo=timezone.utc)).days
            recency = max(0.2, 1.0 - (age_days / 60) * 0.8)
        freq_recent = float(r.count or 1) * recency
        freq_total = float(r.count or 1)
        contrib = (alpha * freq_recent + beta * freq_total) * float(r.score or 1.0)
        scores[r.category_id] = scores.get(r.category_id, 0) + contrib
        token_contribs.setdefault(r.category_id, {})[r.token] = token_contribs.get(r.category_id, {}).get(r.token, 0) + contrib

    if scores:
        max_score = max(scores.values())
        for cat_id in scores:
            scores[cat_id] = scores[cat_id] / max_score if max_score else 0

    return scores, token_contribs


def _find_similar_transaction(
    canonical: str,
    workspace_id: UUID,
    tipo: str,
    db,
    models,
) -> Optional[UUID]:
    """Busca transações similares no histórico. Retorna category_id ou None."""
    from datetime import date
    words = set(canonical.split()) if canonical else set()
    if not words:
        return None
    cutoff_date = date.today() - timedelta(days=180)
    txns = db.query(models.Transaction).filter(
        models.Transaction.workspace_id == workspace_id,
        models.Transaction.transaction_date >= cutoff_date,
        models.Transaction.category_id.isnot(None),
    ).order_by(models.Transaction.transaction_date.desc()).limit(500).all()
    if tipo == "expense":
        txns = [t for t in txns if t.amount_cents < 0 and abs(t.amount_cents) != 1]
    else:
        txns = [t for t in txns if t.amount_cents > 0 and abs(t.amount_cents) != 1]
    best_match = None
    best_score = 0
    for t in txns:
        if not t.description:
            continue
        desc_can = canonicalize(t.description)
        desc_words = set(desc_can.split())
        common = words.intersection(desc_words)
        if not common:
            continue
        score = len(common) + sum(2 for w in common if len(w) > 4)
        days_ago = (date.today() - t.transaction_date).days
        score += 3 if days_ago <= 7 else (2 if days_ago <= 30 else (1 if days_ago <= 90 else 0))
        has_important = any(len(w) > 4 for w in common)
        # Relaxado: 1 palavra importante OU 2+ palavras em comum (favorece dados históricos antes de IA)
        accept = (has_important and len(common) >= 1) or len(common) >= 2
        if accept and score >= 2 and score > best_score:
            best_score = score
            best_match = t.category_id
    return best_match


def check_gemini_circuit_breaker(db, models, workspace_id: Optional[UUID] = None) -> bool:
    """
    True se o circuit-breaker está aberto (não chamar Gemini).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=CIRCUIT_BREAKER_WINDOW_MINUTES)
    q = db.query(models.GeminiEvent).filter(models.GeminiEvent.timestamp >= cutoff)
    if workspace_id:
        q = q.filter(models.GeminiEvent.workspace_id == workspace_id)
    count = q.count()
    return count >= CIRCUIT_BREAKER_COUNT


GENERIC_CATEGORY_NAMES = frozenset({
    'despesas gerais', 'general expenses', 'dépenses générales',
    'outros', 'other', 'autres', 'geral', 'general',
})


def _pick_fallback_category(categories: List[Any]) -> Any:
    """Pick the best fallback category, preferring specific categories over generic ones."""
    if not categories:
        return None
    for c in categories:
        if c.name.lower() not in GENERIC_CATEGORY_NAMES:
            return c
    return categories[0]


def infer_category(
    description_raw: str,
    workspace_id: UUID,
    tipo: str,
    categories: List[Any],
    db,
    models,
    settings,
    explicit_category_id: Optional[UUID] = None,
    use_gemini: bool = True,
) -> Tuple[Optional[UUID], str, bool, Optional[float], str, List[str]]:
    """
    Pipeline de inferência de categoria.
    Retorna: (category_id, inference_source, needs_review, confidence, decision_reason, explain_tokens)
    inference_source: 'explicit'|'merchant_registry'|'deterministic'|'cache_private'|'token_scoring'|
                      'history_similarity'|'cache_global'|'gemini'|'fallback'
    """
    filtered_categories = [c for c in categories if c.type == tipo]
    if not filtered_categories:
        return (filtered_categories[0].id if categories else None, 'fallback', True, 0.0, 'fallback:no_categories', [])

    # 1. Categoria explícita
    if explicit_category_id:
        for c in filtered_categories:
            if c.id == explicit_category_id:
                return (explicit_category_id, 'explicit', False, 1.0)
        return (explicit_category_id, 'explicit', False, 1.0, 'explicit', [])

    canonical = canonicalize(description_raw)
    if not canonical:
        fb = _pick_fallback_category(filtered_categories)
        return (fb.id, 'fallback', True, 0.0, 'fallback:empty', [])

    # 1b. Merchant registry (aliases)
    merchant_match = lookup_merchant_registry(description_raw, tipo, db, models)
    if merchant_match:
        cat_name, alias = merchant_match
        for c in filtered_categories:
            if c.name.lower() == cat_name.lower():
                return (c.id, 'merchant_registry', False, 1.0, f"merchant:{alias}", [alias])

    # 2. Regras determinísticas
    rule_cat = apply_deterministic_rules(description_raw, tipo)
    if rule_cat:
        for c in filtered_categories:
            if c.name.lower() == rule_cat.lower():
                return (c.id, 'deterministic', False, 1.0, f"rule:{rule_cat}", [rule_cat])

    # 2.5 Keyword matching (keywords genéricos -> categoria)
    text_lower = description_raw.lower().strip()
    for keyword, cat_name in CATEGORY_KEYWORDS.items():
        if keyword in text_lower:
            for c in filtered_categories:
                if c.name.lower() == cat_name.lower():
                    return (c.id, 'keyword_match', False, 0.90, f"keyword:{keyword}", [keyword])

    # 3. Cache privada (description_canonical)
    cache_entry = db.query(models.CategoryMappingCache).filter(
        models.CategoryMappingCache.workspace_id == workspace_id,
        models.CategoryMappingCache.description_normalized == canonical,
        models.CategoryMappingCache.transaction_type == tipo,
    ).first()
    if cache_entry and cache_entry.category_id:
        return (cache_entry.category_id, 'cache_private', False, 1.0, f"cache_private:{canonical}", [canonical])

    # 4. Token scoring
    tokens = extract_tokens(canonical, n=3)
    category_scores, token_contribs = compute_category_scores_from_tokens(tokens, workspace_id, tipo, db, models)
    if category_scores:
        best_cat = max(category_scores, key=category_scores.get)
        best_score = category_scores[best_cat]
        if best_score >= TH_THRESHOLD:
            explain = sorted(token_contribs.get(best_cat, {}).items(), key=lambda x: x[1], reverse=True)
            explain_tokens = [t for t, _ in explain[:3]]
            return (best_cat, 'token_scoring', False, best_score, f"token:{','.join(explain_tokens) or 'score'}", explain_tokens)

    # 5. Similaridade com histórico (transações similares)
    history_cat = _find_similar_transaction(canonical, workspace_id, tipo, db, models)
    if history_cat:
        return (history_cat, 'history_similarity', False, 0.85, "history_similarity", [])

    # 6. Cache global
    global_entry = db.query(models.CategoryMappingCache).filter(
        models.CategoryMappingCache.is_global == True,
        models.CategoryMappingCache.workspace_id.is_(None),
        models.CategoryMappingCache.description_normalized == canonical,
        models.CategoryMappingCache.transaction_type == tipo,
    ).first()
    if global_entry:
        for c in filtered_categories:
            if c.name == global_entry.category_name:
                return (c.id, 'cache_global', False, 0.95, f"cache_global:{canonical}", [canonical])

    # 7. OpenAI fallback (se permitido e circuit-breaker fechado)
    if use_gemini and getattr(settings, 'OPENAI_API_KEY', None):
        if check_gemini_circuit_breaker(db, models, workspace_id):
            logger.warning("Circuit-breaker AI aberto. Usando fallback.")
            fb = _pick_fallback_category(filtered_categories)
            return (fb.id, 'fallback', True, 0.0, "fallback:circuit_breaker", [])

        try:
            cat_id, ai_response = _call_openai_fallback(
                description_raw, filtered_categories, tipo, workspace_id, db, models, settings
            )
            if cat_id:
                return (cat_id, 'openai', True, GEMINI_THRESHOLD, f"openai:{ai_response or ''}", [ai_response] if ai_response else [])
        except Exception as e:
            logger.warning(f"OpenAI fallback falhou: {e}")

    # 8. Fallback final (prefer specific categories over generic)
    fb = _pick_fallback_category(filtered_categories)
    return (fb.id, 'fallback', True, 0.0, "fallback:default", [])


def _call_openai_fallback(
    description: str,
    categories: List[Any],
    tipo: str,
    workspace_id: UUID,
    db,
    models,
    settings,
) -> Tuple[Optional[UUID], Optional[str]]:
    """Chama OpenAI GPT-4o-mini e regista em GeminiEvents. Retorna (category_id, response_text)."""
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    categories_list = [c.name for c in categories]
    categories_text = ", ".join(categories_list)

    # Detect generic category names to instruct the AI to avoid them
    generic_names = {'despesas gerais', 'general expenses', 'dépenses générales', 'outros', 'other'}
    generic_in_list = [n for n in categories_list if n.lower() in generic_names]
    avoid_instruction = ""
    if generic_in_list:
        avoid_instruction = f'\nIMPORTANTE: Evita "{generic_in_list[0]}" — usa-a APENAS se nenhuma outra categoria se aplica.'

    prompt = f'''Categoriza esta transacao na categoria mais especifica possivel.
Transacao: "{description}"
Categorias disponiveis: {categories_text}
Dicas: supermercado/restaurante/cafe=Alimentacao, farmacia/medico/ginasio=Saude, gasolina/uber/metro=Transportes, netflix/cinema/jogos=Entretenimento, renda/agua/luz=Habitacao.{avoid_instruction}
Responde APENAS com o nome exato da categoria:'''

    response_text = None
    status_code = 200
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=20,
            temperature=0.1,
        )
        if response.choices and response.choices[0].message.content:
            response_text = response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"OpenAI error: {e}")
        status_code = 500
        if "429" in str(e) or "rate_limit" in str(e).lower() or "quota" in str(e).lower():
            status_code = 429
        raise

    # Registar evento (tabela GeminiEvent reutilizada para chamadas AI)
    try:
        ev = models.GeminiEvent(
            workspace_id=workspace_id,
            request_description=description[:500],
            response_text=response_text[:200] if response_text else None,
            status_code=status_code,
        )
        db.add(ev)
        db.commit()
    except Exception:
        db.rollback()

    if not response_text:
        return (None, None)

    for c in categories:
        if c.name.lower() == response_text.lower():
            return (c.id, response_text)
        if c.name.lower() in response_text.lower() or response_text.lower() in c.name.lower():
            return (c.id, response_text)

    first_word = response_text.split()[0] if response_text.split() else ""
    if first_word:
        for c in categories:
            if first_word.lower() in c.name.lower():
                return (c.id, response_text)
    return (None, response_text)


def learn_from_correction(
    description_raw: str,
    new_category_id: UUID,
    workspace_id: UUID,
    tipo: str,
    category_name: str,
    db,
    models,
) -> None:
    """
    Atualiza token_scores e cache quando o utilizador corrige a categoria.
    """
    canonical = canonicalize(description_raw)
    if not canonical:
        return

    tokens = extract_tokens(canonical, n=3)
    now = datetime.now(timezone.utc)

    for token in tokens:
        existing = db.query(models.TokenScore).filter(
            models.TokenScore.workspace_id == workspace_id,
            models.TokenScore.token == token,
            models.TokenScore.category_id == new_category_id,
            models.TokenScore.transaction_type == tipo,
        ).first()
        if existing:
            existing.count = (existing.count or 0) + 1
            existing.score = min(2.0, float(existing.score or 1) * 1.1)
            existing.last_updated = now
        else:
            db.add(models.TokenScore(
                workspace_id=workspace_id,
                token=token,
                category_id=new_category_id,
                category_name=category_name,
                transaction_type=tipo,
                count=1,
                score=1.0,
            ))

    # Atualizar cache privada
    existing_cache = db.query(models.CategoryMappingCache).filter(
        models.CategoryMappingCache.workspace_id == workspace_id,
        models.CategoryMappingCache.description_normalized == canonical,
        models.CategoryMappingCache.transaction_type == tipo,
    ).first()
    if existing_cache:
        existing_cache.category_id = new_category_id
        existing_cache.category_name = category_name
        existing_cache.usage_count = (existing_cache.usage_count or 0) + 1
        existing_cache.last_used_at = now
    else:
        db.add(models.CategoryMappingCache(
            workspace_id=workspace_id,
            description_normalized=canonical,
            category_id=new_category_id,
            category_name=category_name,
            transaction_type=tipo,
            usage_count=1,
            is_global=False,
        ))
    db.commit()
    logger.info(f"Aprendizagem: '{canonical}' -> {category_name} (tokens: {len(tokens)})")

    # Heurística simples: promover alias de merchant se descrição é curta/consistente
    try:
        if len(tokens) <= 3:
            alias = canonical
            if alias:
                existing = db.query(models.MerchantRegistry).filter(
                    models.MerchantRegistry.alias == alias,
                    models.MerchantRegistry.transaction_type == tipo,
                ).first()
                if existing:
                    existing.usage_count = (existing.usage_count or 0) + 1
                    existing.confidence = min(1.0, float(existing.confidence or 0.5) + 0.05)
                    existing.category_name = category_name
                else:
                    db.add(models.MerchantRegistry(
                        alias=alias,
                        canonical_name=alias,
                        category_name=category_name,
                        transaction_type=tipo,
                        usage_count=1,
                        confidence=0.6,
                        is_active=True,
                    ))
                db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"Merchant registry update falhou: {e}")
