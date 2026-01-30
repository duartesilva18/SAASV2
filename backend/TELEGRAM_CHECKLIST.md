# Checklist – Telegram bot funcional

## 1. Variáveis de ambiente (.env e Render)

- **TELEGRAM_BOT_TOKEN** – Token do bot (BotFather no Telegram).
- **TELEGRAM_WEBHOOK_SECRET** – String secreta (ex.: gerada com `python -c "import secrets; print(secrets.token_urlsafe(32))"`).  
  Deve ser **exatamente** a mesma que usas no `setWebhook` (script abaixo). **Não** uses a URL do webhook aqui.
- **GEMINI_API_KEY** – (Opcional) Para análise de extratos/fotos com IA. Sem isto, envio de fotos/documentos não faz parsing com Gemini.

## 2. Base de dados

As tabelas do Telegram têm de existir. Executa as migrações:

- `add_telegram_media_and_batch_import.sql` – `telegram_media_usage`, `telegram_pending_batch_imports`
- `add_user_sessions.sql` – se ainda não tiveres corrido (sessões da app)

No Supabase/Render: SQL Editor → colar o conteúdo do `.sql` → Run.

## 3. Configurar o webhook no Telegram

O backend tem de estar no ar (ex.: Render). Depois, na pasta `backend/`:

```bash
# Definir a URL do teu backend (onde o Telegram vai chamar o webhook)
# No .env acrescenta, por exemplo:
# BACKEND_URL=https://finanzen-backend.onrender.com
# ou TELEGRAM_WEBHOOK_URL=https://api.finlybot.com

python setup_telegram_webhook.py
```

Isto regista no Telegram a URL `{BACKEND_URL ou TELEGRAM_WEBHOOK_URL}/telegram/webhook` e o `secret_token` (lido de `TELEGRAM_WEBHOOK_SECRET`).  
O valor de **TELEGRAM_WEBHOOK_SECRET** no `.env` (e no Render) tem de ser **igual** ao `secret_token` que o script envia.

## 4. Verificar que está tudo ok

- **Health:**  
  `GET https://<teu-backend>/telegram/health`  
  Resposta esperada (exemplo):  
  `{"ok": true, "token_configured": true, "secret_configured": true, "bot_ok": true}`  
  Se `ok` for `false`, verifica qual dos campos está `false` (token, secret ou bot).

- **No Telegram:**  
  Abre o bot → `/start`.  
  - Utilizador novo: deve pedir email e depois associar à conta (conta tem de ser Pro para associar).  
  - Utilizador já associado: mensagem de boas-vindas.

## 5. Resumo rápido

| Item | Como verificar |
|------|----------------|
| Token e secret | `GET /telegram/health` → `token_configured`, `secret_configured`, `bot_ok` |
| Webhook registado | Correr `python setup_telegram_webhook.py` (com BACKEND_URL/TELEGRAM_WEBHOOK_URL no .env) |
| Tabelas na BD | `telegram_media_usage`, `telegram_pending_batch_imports` (e `user_sessions` se usares limite de sessões) |
| Associação ao user | Na app: definires o mesmo número/chat no perfil não é usado; a associação é feita pelo bot quando o user envia o **email** no Telegram (e a conta é Pro). |

Se algo falhar, verifica os logs do backend (Render ou local) ao enviar `/start` ou uma mensagem; o webhook regista erros e o payload recebido (em modo truncado).
