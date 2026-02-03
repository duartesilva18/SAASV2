# Lógica do Bot Telegram (FinanZen)

Este documento descreve o fluxo completo do bot Telegram: mensagens de texto, fotos (recibos) e listas de transações, confirmação única ou em lote, e **otimização para usar o mínimo de IA e aprender ao longo do tempo**.

---

## 0. Otimização: menos IA, aprendizagem progressiva

**Objetivo:** Minimizar chamadas à OpenAI criando um sistema que aprende com cada confirmação do utilizador.

### 0.1 Regra: IA em último recurso (texto) e para imagens

- **Texto (mensagem escrita):** categorização usa **primeiro** cache, histórico e motor **sem** IA. A IA (OpenAI) é chamada **só em último caso** quando não houver cache, histórico nem motor que acerte.
- **Imagens (foto de recibo):** usa OpenAI Vision para extrair valor/descrição/categoria; a categoria pode depois ser refinada por cache/similaridade.

Assim, ao longo do tempo, o texto depende cada vez mais de histórico e cache; a IA entra só quando não há outra hipótese.

### 0.2 Sistema de cache e histórico para TEXTO (waterfall)

Para **mensagens de texto**, a categorização segue esta ordem (IA só em último caso):

| Nível | Nome | Quando | Custo |
|-------|------|--------|-------|
| 1 | **Categoria explícita** | O utilizador escreveu "Descrição - Categoria valor€" | 0 ms |
| 2 | **Cache (Telegram)** | Chave canonical já no cache privado/global (get_cached_category) | 0 ms |
| 3 | **Histórico (similaridade)** | Transação passada com descrição similar (find_similar_transaction) | ~10 ms |
| 4 | **Motor sem IA** | infer_category(..., use_gemini=False): regras, merchant, cache motor, token scoring, similaridade motor, cache global | 0 ms |
| 5 | **IA (último recurso)** | categorize_with_ai só se 1–4 falharem; resultado é guardado no cache | ~500 ms |
| 6 | **Fallback** | Primeira categoria do tipo (ex.: primeira despesa) | 0 ms |

A OpenAI é chamada **apenas** quando não há cache, histórico nem motor que acerte; o resultado é sempre guardado no cache para futuras mensagens.

### 0.3 Motor de categorização (quando chamado com use_gemini=True, ex. web/app)

Para referência, a ordem completa no motor (usada noutros contextos, ex. web) inclui ainda:

| Nível | Nome | Custo |
|-------|------|-------|
| 1–2 | Explícita, merchant, regras | 0 ms |
| 3 | Cache privado (canonical) | 0 ms |
| 4 | Token scoring | ~5 ms |
| 5 | Histórico (similaridade) | ~10 ms |
| 6 | Cache global | 0 ms |
| 7 | **OpenAI** (só se use_gemini=True) | ~500 ms |
| 8 | Fallback primeira categoria | 0 ms |

No **Telegram para texto**, o motor é chamado com `use_gemini=False`, portanto o passo 7 não é executado.

### 0.4 Aprendizagem ao confirmar

- **Ao confirmar uma transação** (única ou lista): antes de apagar o pendente, guarda-se no cache a associação `(description_canonical, category_id)` para o workspace.
- Assim, a próxima vez que o utilizador enviar uma descrição equivalente, o **Nível 2 (cache)** acerta e não se chama a IA.
- O bot "aprende" com cada confirmação: quanto mais o utilizador confirmar, menos chamadas à OpenAI.

### 0.5 Onde está implementado

- **Motor de categorização** (`categorization_engine.py`): ordem 1→8 acima; guarda no cache quando a fonte é `openai`.
- **Telegram – parse_transaction (texto):** 1) get_cached_category; 2) find_similar_transaction (histórico); 3) infer_category(..., use_gemini=False) (motor sem IA); 4) **categorize_with_ai** (último recurso, só se 1–3 falharem); 5) fallback primeira categoria.
- **Telegram – confirmação (única e batch):** ao confirmar, chama `save_cached_category(cache_key, ...)` para a descrição do pendente (aprendizagem).

### 0.6 Chave de cache alinhada

- **`_description_cache_key(description)`** no Telegram devolve `canonicalize(description)` (função do motor).
- Assim, o cache usado no Telegram é o **mesmo** que o motor usa (cache_private, cache_global). Menos duplicação e máximo hit rate.

---

## 1. Entrada do webhook

- **URL:** `POST /telegram/webhook`
- O Telegram envia um JSON com:
  - `message`: texto, foto, comandos (`/start`, `/clear`, etc.)
  - `callback_query`: quando o utilizador carrega num botão inline (Confirmar / Cancelar)

O handler distingue primeiro **callback_query** (botões) de **message** (mensagem normal).

---

## 2. Callback Query (botões inline)

Quando o utilizador carrega num botão, `callback_data` identifica a ação:

| callback_data       | Significado | Ação |
|---------------------|-------------|------|
| `confirm_<uuid16>`  | Confirmar **uma** transação pendente | Cria `Transaction`; **guarda (descrição, categoria) no cache** (aprendizagem); apaga o pendente; envia "Transação Confirmada!" |
| `cancel_<uuid16>`   | Cancelar **uma** transação pendente | Apaga o pendente, envia "Transação Cancelada" |
| `confirm_batch_<batch_hex>` | Confirmar **toda a lista** | Cria uma `Transaction` por cada pendente; **guarda cada (descrição, categoria) no cache** (aprendizagem); apaga pendentes; envia "Transações registadas!" |
| `cancel_batch_<batch_hex>`  | Cancelar **toda a lista** | Apaga todos os pendentes com esse `batch_id`, envia "Lista cancelada" |

- **Transação única:** cada pendente tem `id`; o botão guarda os primeiros 16 caracteres do UUID (`confirm_` / `cancel_`).
- **Lista:** todos os pendentes da mesma mensagem partilham um `batch_id`; o botão guarda os primeiros 16 caracteres do `batch_id` (`confirm_batch_` / `cancel_batch_`).

---

## 3. Mensagem normal (texto ou foto)

### 3.1 Autenticação e workspace

1. Extrair `chat_id` e (se existir) `text` ou `photo`.
2. Associar utilizador: `User.phone_number == str(chat_id)` (conta ligada ao Telegram).
3. Obter workspace: primeiro workspace do utilizador (por `created_at`).
4. Se não houver user ou workspace → mensagem de erro e return.

### 3.2 Comandos

- **`/start`** — Mensagem de boas-vindas e como usar.
- **`/clear`** — Apaga **todas** as transações pendentes deste chat (sem criar transações).
- **`/info`** — Lista formatos aceites (ex.: "Almoço 15€", "Gasolina 50€").

### 3.3 Foto (recibo)

1. Obter `file_id` da foto (maior tamanho).
2. Carregar categorias do workspace.
3. **`process_photo_with_openai(file_id, categories)`**:
   - Download da imagem via API Telegram.
   - Envio para OpenAI Vision (gpt-4o-mini) com prompt que inclui as categorias do utilizador.
   - Resposta: JSON com `amount`, `description`, `type`, `date`, `category`.
4. **`_parsed_from_photo(photo_result, workspace, db)`**:
   - Valida dados e data.
   - Se a Vision devolveu `category`, faz match por nome (exato ou similaridade) nas categorias do workspace.
   - Senão, usa `infer_category` (motor de categorização).
   - Devolve um único objeto "parsed" (como uma transação única).
5. Fluxo igual a **transação única** (ver abaixo): criar `Transaction` (se auto_confirm) ou um `TelegramPendingTransaction` e enviar mensagem com botões "Confirmar" / "Cancelar".

Erros possíveis:
- **429 (rate limit):** mensagem `photo_rate_limit` ("Espera 1–2 minutos...").
- Falha na Vision ou sem categorias: mensagem `photo_not_supported`.

### 3.4 Texto (transação ou lista)

1. **`parse_transaction(text, workspace, db)`**:
   - Regex para valores em € (ex.: "15€", "15.50€").
   - Tipo: "income" se houver palavras como "recebi", "salário"; senão "expense".
   - Para cada valor encontrado: extrai descrição (texto antes do valor), categoria (explícita "Descrição - Categoria valor" ou inferida por motor/cache/IA).
   - Retorno:
     - **Uma transação:** `{ amount, description, type, category_id, ... }`.
     - **Várias transações:** `{ "multiple": true, "transactions": [ ... ] }`.

2. Se **uma transação**:
   - Calcular `amount_cents` (respeitando vault: depósito/resgate).
   - Se `telegram_auto_confirm`: criar `Transaction`, commit, enviar "Transação Registada!".
   - Senão: criar um `TelegramPendingTransaction` (sem `batch_id`), commit, enviar mensagem com **uma** linha (descrição, valor, categoria, tipo) e botões "Confirmar" / "Cancelar" com `confirm_<id16>` e `cancel_<id16>`.

3. Se **lista (multiple)**:
   - Gerar um `batch_id` (UUID) para agrupar todas as linhas.
   - Para cada item: calcular `amount_cents` e criar `TelegramPendingTransaction` com o mesmo `batch_id`.
   - Se `telegram_auto_confirm`: criar logo todas as `Transaction`, commit, enviar "X Transação(ões) Criada(s)!".
   - Senão:
     - Construir **uma única mensagem** com:
       - Cabeçalho "Lista de transações"
       - Uma linha por item: `• Descrição — Valor€ — Categoria`
       - Total: `Total: X€`
       - Pergunta: "Confirma todas estas transações?"
     - Botões: "Confirmar tudo" (`confirm_batch_<batch_id_hex>`) e "Cancelar tudo" (`cancel_batch_<batch_id_hex>`).
     - Commit e enviar essa mensagem.

---

## 4. Modelo de dados (pendentes)

**`TelegramPendingTransaction`**

| Campo            | Uso |
|------------------|-----|
| id               | UUID da linha (para confirm/cancel **único**) |
| chat_id          | Identifica o utilizador no Telegram |
| workspace_id     | Workspace onde criar a transação |
| category_id      | Categoria atribuída |
| amount_cents     | Valor em cêntimos (negativo = despesa) |
| description      | Texto da transação |
| transaction_date | Data da transação |
| batch_id         | **NULL** = transação única; **UUID** = pertence a uma lista (mesmo batch = mesma mensagem) |
| inference_source, decision_reason, needs_review | Metadados de categorização |

- **Transação única:** `batch_id` é NULL; callback usa `confirm_` / `cancel_` + `id.hex[:16]`.
- **Lista:** todas as linhas da mesma mensagem têm o mesmo `batch_id`; callback usa `confirm_batch_` / `cancel_batch_` + `batch_id.hex[:16]`.

---

## 5. Resumo do fluxo por tipo de entrada

| Entrada              | Parsing / Visão          | Sem confirmação (auto_confirm) | Com confirmação |
|----------------------|--------------------------|---------------------------------|------------------|
| Texto "Almoço 15€"   | 1 transação              | Cria 1 Transaction, "Registada!" | 1 pendente, 1 msg com Confirmar/Cancelar |
| Texto "A 15€ B 20€"  | Lista (multiple)         | Cria N Transactions, "N criadas!" | N pendentes (batch_id), 1 msg com lista + total + Confirmar tudo / Cancelar tudo |
| Foto recibo          | Vision → 1 parsed        | Cria 1 Transaction, "Registada!" | 1 pendente, 1 msg com Confirmar/Cancelar |

---

## 6. Traduções relevantes (telegram_translations)

- **Lista:** `list_pending_header`, `list_pending_line`, `list_pending_total`, `list_confirm_question`, `button_confirm_all`, `button_cancel_all`, `list_confirmed`, `list_cancelled`.
- **Transação única:** `transaction_pending`, `transaction_confirmed`, `transaction_registered`, `button_confirm`, `button_cancel`, `transaction_cancelled`, `transaction_not_found`.
- **Foto:** `photo_not_supported`, `photo_rate_limit`.
- **Outros:** `parse_error`, `ai_unavailable`, `multiple_transactions_created`.

---

## 7. Migração de base de dados

Para suportar listas com confirmação em lote, foi adicionada a coluna:

- **`telegram_pending_transactions.batch_id`** (UUID, nullable, indexada).

Script: `add_telegram_batch_id.sql`. Executar uma vez no ambiente (ex.: Render, Supabase).
