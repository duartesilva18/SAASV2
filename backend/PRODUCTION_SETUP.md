# 🚀 Guia de Configuração para Produção - Finly

## ⚠️ IMPORTANTE: Variáveis de Ambiente Obrigatórias

### 1. SECRET_KEY (CRÍTICO)

O `SECRET_KEY` é **OBRIGATÓRIO** em produção e deve ser uma chave segura e aleatória.

**Como gerar uma chave segura:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Ou usando OpenSSL:**
```bash
openssl rand -hex 32
```

**Configurar no .env:**
```env
ENVIRONMENT=production
SECRET_KEY=sua_chave_gerada_aqui
```

### 2. Base de Dados

```env
DATABASE_URL=postgresql://usuario:senha@host:5432/nome_database
```

### 3. Frontend URL

```env
FRONTEND_URL=https://seu-dominio.com
```

### 4. Stripe (Pagamentos)

```env
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 5. Telegram Bot

```env
TELEGRAM_BOT_TOKEN=seu_token_do_bot
TELEGRAM_WEBHOOK_SECRET=seu_webhook_secret
```

### 6. Gemini AI

```env
GEMINI_API_KEY=sua_chave_gemini
```

### 7. Email (SMTP)

```env
MAIL_USERNAME=seu_email@gmail.com
MAIL_PASSWORD=sua_senha_de_app
MAIL_FROM=noreply@seu-dominio.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
```

### 8. Google OAuth

```env
GOOGLE_CLIENT_ID=seu_google_client_id
```

## ✅ Verificação Pré-Deploy

Antes de fazer deploy, verifique:

1. ✅ `ENVIRONMENT=production` está definido
2. ✅ `SECRET_KEY` está definido e é diferente da chave de desenvolvimento
3. ✅ `DATABASE_URL` aponta para a base de dados de produção
4. ✅ `FRONTEND_URL` está correto
5. ✅ Todas as chaves de API estão configuradas
6. ✅ O ficheiro `.env` NÃO está no git (deve estar no `.gitignore`)

## 🔒 Segurança

- **NUNCA** commite o ficheiro `.env` no git
- **NUNCA** use a `SECRET_KEY` de desenvolvimento em produção
- Use variáveis de ambiente do sistema ou serviços de secrets management em produção
- Mantenha backups seguros das chaves

## 🐳 Docker (Opcional)

Se usar Docker, defina as variáveis no `docker-compose.yml` ou passe via `-e`:

```bash
docker run -e SECRET_KEY=sua_chave -e ENVIRONMENT=production ...
```

