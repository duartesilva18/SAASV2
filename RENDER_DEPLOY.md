# 🚀 Guia de Deploy no Render - FinanZen

Este guia explica como fazer deploy do projeto FinanZen no Render.

**⚠️ IMPORTANTE**: O repositório Git começa na pasta `SaaS`, então o `render.yaml` deve estar na raiz do repositório (dentro da pasta `SaaS`).

## 📋 Pré-requisitos

1. Conta no [Render](https://render.com)
2. Repositório Git (GitHub, GitLab ou Bitbucket) - **a raiz do repositório deve ser a pasta `SaaS`**
3. Todas as chaves de API necessárias (Stripe, Telegram, Gemini, etc.)

## 🔧 Passo 1: Preparar o Repositório

Certifique-se de que o seu código está num repositório Git e que o `render.yaml` está na **raiz do repositório** (que é a pasta `SaaS`).

## 🔧 Passo 2: Criar os Serviços no Render

### Opção A: Usar render.yaml (Recomendado)

1. Aceda ao [Render Dashboard](https://dashboard.render.com)
2. Clique em **"New +"** → **"Blueprint"**
3. Conecte o seu repositório Git
4. **Importante**: Se o repositório começa na pasta `SaaS`, o Render irá detectar automaticamente o `render.yaml` na raiz
5. Render irá criar todos os serviços automaticamente

### Opção B: Criar Manualmente

#### 2.1. Criar Base de Dados PostgreSQL

1. **New +** → **PostgreSQL**
2. Nome: `finanzen-database`
3. Plano: **Starter** (gratuito) ou superior
4. Região: **Frankfurt** (ou a mais próxima)
5. Clique em **Create Database**

#### 2.2. Criar Backend (Web Service)

1. **New +** → **Web Service**
2. Conecte o seu repositório Git
3. Configurações:
   - **Name**: `finanzen-backend`
   - **Region**: Frankfurt
   - **Branch**: `main` (ou a sua branch principal)
   - **Root Directory**: `backend` (sem o prefixo SaaS/)
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Starter (gratuito) ou superior

#### 2.3. Criar Frontend (Web Service)

1. **New +** → **Web Service**
2. Conecte o mesmo repositório Git
3. Configurações:
   - **Name**: `finanzen-frontend`
   - **Region**: Frankfurt
   - **Branch**: `main`
   - **Root Directory**: `frontend` (sem o prefixo SaaS/)
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Starter (gratuito) ou superior

## 🔐 Passo 3: Configurar Variáveis de Ambiente

### Backend - Variáveis Obrigatórias

Aceda ao serviço `finanzen-backend` → **Environment** e adicione:

#### ⚠️ CRÍTICO - Obrigatórias:

```env
ENVIRONMENT=production
SECRET_KEY=<gere uma chave segura - ver abaixo>
DATABASE_URL=<será preenchido automaticamente se usar Internal Database>
FRONTEND_URL=https://finanzen-frontend.onrender.com
ALLOWED_ORIGINS=https://finanzen-frontend.onrender.com
```

**Como gerar SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

#### APIs e Integrações:

```env
# Stripe
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Telegram
TELEGRAM_BOT_TOKEN=seu_token_do_bot
TELEGRAM_WEBHOOK_SECRET=seu_webhook_secret

# Gemini AI
GEMINI_API_KEY=sua_chave_gemini

# Email (SMTP)
MAIL_USERNAME=seu_email@gmail.com
MAIL_PASSWORD=sua_senha_de_app
MAIL_FROM=noreply@seu-dominio.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587

# Google OAuth
GOOGLE_CLIENT_ID=seu_google_client_id

# WhatsApp (opcional)
WHATSAPP_TOKEN=seu_token
WHATSAPP_PHONE_NUMBER_ID=seu_phone_id
WHATSAPP_VERIFY_TOKEN=seu_verify_token
```

### Frontend - Variáveis de Ambiente

Aceda ao serviço `finanzen-frontend` → **Environment** e adicione:

```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://finanzen-backend.onrender.com
```

**⚠️ IMPORTANTE**: Substitua `finanzen-backend.onrender.com` pela URL real do seu backend após o deploy.

## 🔗 Passo 4: Configurar CORS

Após criar o frontend, atualize a variável `ALLOWED_ORIGINS` no backend com a URL real do frontend:

```env
ALLOWED_ORIGINS=https://finanzen-frontend.onrender.com
```

E atualize `FRONTEND_URL` também:

```env
FRONTEND_URL=https://finanzen-frontend.onrender.com
```

## 🗄️ Passo 5: Configurar Base de Dados

### Se criou a base de dados separadamente:

1. Aceda ao serviço `finanzen-database` → **Info**
2. Copie a **Internal Database URL**
3. No backend, adicione como variável de ambiente:
   ```env
   DATABASE_URL=<Internal Database URL>
   ```

### Se usou Internal Database no render.yaml:

A variável `DATABASE_URL` será preenchida automaticamente.

## 🚀 Passo 6: Fazer Deploy

1. **Backend**: Render irá fazer deploy automaticamente após configurar as variáveis
2. **Frontend**: Render irá fazer deploy automaticamente após configurar as variáveis

### Verificar Logs

- Aceda a cada serviço → **Logs** para verificar se há erros
- O backend deve mostrar: `Application startup complete`
- O frontend deve mostrar: `Ready on port XXXX`

## 🔄 Passo 7: Executar Migrações (se necessário)

Se usar Alembic para migrações:

1. Aceda ao backend → **Shell**
2. Execute:
   ```bash
   alembic upgrade head
   ```

Ou adicione ao **Start Command** do backend:
```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## 🌐 Passo 8: Configurar Domínio Personalizado (Opcional)

1. Aceda ao serviço → **Settings** → **Custom Domains**
2. Adicione o seu domínio
3. Configure os registos DNS conforme instruções do Render

## 🔔 Passo 9: Configurar Webhooks

### Stripe Webhook

1. Aceda ao [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Adicione endpoint: `https://finanzen-backend.onrender.com/api/webhooks/stripe`
3. Copie o **Webhook Signing Secret** e adicione como `STRIPE_WEBHOOK_SECRET` no backend

### Telegram Webhook

O bot Telegram será configurado automaticamente ao iniciar o backend, mas pode precisar de configurar manualmente:

1. Aceda ao backend → **Shell**
2. Execute (substitua com os seus valores):
   ```python
   python -c "from app.webhooks.telegram import setup_webhook; setup_webhook('https://finanzen-backend.onrender.com/api/webhooks/telegram')"
   ```

## ✅ Verificação Final

1. ✅ Backend acessível em: `https://finanzen-backend.onrender.com`
2. ✅ Frontend acessível em: `https://finanzen-frontend.onrender.com`
3. ✅ API responde em: `https://finanzen-backend.onrender.com/`
4. ✅ Base de dados conectada (verificar logs do backend)
5. ✅ CORS configurado corretamente
6. ✅ Variáveis de ambiente todas configuradas

## 🐛 Resolução de Problemas

### Backend não inicia

- Verifique os logs em **Logs**
- Certifique-se de que `SECRET_KEY` está definido
- Verifique se `DATABASE_URL` está correto
- Certifique-se de que todas as dependências estão em `requirements.txt`

### Frontend não conecta ao backend

- Verifique `NEXT_PUBLIC_API_URL` no frontend
- Verifique `ALLOWED_ORIGINS` no backend
- Verifique os logs do backend para erros de CORS

### Erro de migração de base de dados

- Execute manualmente: `alembic upgrade head` no Shell do backend
- Verifique se a `DATABASE_URL` está correta

### Serviço entra em "sleep" (plano gratuito)

- O plano gratuito coloca serviços em sleep após 15 minutos de inatividade
- Considere fazer upgrade para um plano pago ou usar um serviço de "ping" para manter ativo

## 📚 Recursos Adicionais

- [Documentação do Render](https://render.com/docs)
- [Guia de Python no Render](https://render.com/docs/deploy-python)
- [Guia de Node.js no Render](https://render.com/docs/deploy-node)

## 💡 Dicas

1. **Use Internal Database URL** para melhor performance e segurança
2. **Configure alertas** no Render para ser notificado de problemas
3. **Faça backups regulares** da base de dados
4. **Monitore os logs** regularmente
5. **Use variáveis de ambiente** para todas as configurações sensíveis

---

**Boa sorte com o deploy! 🚀**

