# Motor de Categorização (Telegram + API)

Sistema de categorização profissional: regras determinísticas, token-scoring, caches e Gemini como fallback.

---

## Fluxo geral (Motor)

1. **Categoria explícita** → usa diretamente (sem IA)
2. **Merchant registry** → aliases de merchants (`merchant_registry`)
3. **Regras determinísticas** → IBAN, salário, merchants locais
4. **Cache privada** → `description_canonical` em `category_mapping_cache`
5. **Token scoring** → n-grams (1..3) com decay temporal
6. **Similaridade histórico** → transações similares nos últimos 180 dias
7. **Cache global** → categorias comuns partilhadas
8. **Gemini fallback** → apenas se score < threshold, com circuit-breaker (50 chamadas/hora)
9. **Fallback final** → primeira categoria do tipo

---

## Fluxo anterior (legado)

O Telegram usa o motor novo; em caso de falha, usa o fluxo legado (find_similar_transaction, get_cached_category, categorize_with_ai).

## Transparência (decision_reason)

Cada inferência devolve `decision_reason` e `explain_tokens` (top-3 tokens), por ex.:

- `merchant:continente`
- `token:pizzaria,almoc`
- `cache_private:almoc pizzar`

---

## Quando o Gemini é chamado

Só quando **todas** estas falham:
- O utilizador não indicou categoria (ex: "Almoço - Alimentação 15€").
- Não existe transação semelhante no histórico (últimos 180 dias).
- Não existe mapeamento em cache para aquela descrição.

---

## Função `categorize_with_ai()`

1. **Entrada**: descrição (`"Almoço Pizzaria"`), categorias do workspace, tipo (expense/income).
2. **Prompt** enviado ao Gemini:
   ```
   Categoriza: "Almoço Pizzaria"
   Categorias: Alimentação, Transportes, Habitação, Saúde, Entretenimento, ...
   Responde APENAS com o nome exato da categoria:
   ```
3. **Modelo**: `gemini-flash-latest` (rápido, temperatura 0.1, max 20 tokens).
4. **Resposta**: nome da categoria (ex: `Alimentação`).
5. **Matching**: exato → parcial → primeira palavra para associar à categoria do workspace.
6. **Cache**: resultado guardado em `CategoryMappingCache` (privado e, se comum, global).

---

## Cache

- **Privado**: por workspace (`description_normalized` + `workspace_id`).
- **Global**: categorias comuns (Alimentação, Transportes, etc.) partilhadas entre utilizadores.
- **Transações**: histórico de 500 transações dos últimos 180 dias usado como contexto.

---

## Notas

- **GEMINI_API_KEY** tem de estar definida.
- Se quota/limite for excedido (429), lança `GeminiUnavailableError`.
- Fallback final: primeira categoria do tipo (ex: primeira despesa).
