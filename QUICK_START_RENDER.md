# ⚡ Quick Start - Deploy no Render

**⚠️ IMPORTANTE**: O repositório Git começa na pasta `SaaS`, então o `render.yaml` deve estar na raiz do repositório (dentro da pasta `SaaS`).

## 🚀 Passos Rápidos

### 1. Preparar o Repositório
```bash
# Certifique-se de que tudo está commitado
# O repositório deve começar na pasta SaaS
cd SaaS
git add .
git commit -m "Preparar para deploy no Render"
git push
```

### 2. Criar Blueprint no Render

1. Aceda a [dashboard.render.com](https://dashboard.render.com)
2. Clique em **"New +"** → **"Blueprint"**
3. Conecte o seu repositório Git (que começa na pasta SaaS)
4. Render irá detectar o `render.yaml` automaticamente na raiz

### 3. Configurar Variáveis de Ambiente

#### Backend (finanzen-backend)
```env
ENVIRONMENT=production
SECRET_KEY=<gere com: python -c "import secrets; print(secrets.token_urlsafe(32))">
FRONTEND_URL=https://finanzen-frontend.onrender.com
ALLOWED_ORIGINS=https://finanzen-frontend.onrender.com
```

**Adicione também:**
- `STRIPE_API_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`
- `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`
- `GOOGLE_CLIENT_ID`

#### Frontend (finanzen-frontend)
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://finanzen-backend.onrender.com
```

### 4. Aguardar Deploy

- Render irá fazer deploy automaticamente
- Verifique os logs para garantir que tudo está correto

### 5. Atualizar URLs

Após o deploy, atualize:
- `FRONTEND_URL` no backend com a URL real do frontend
- `ALLOWED_ORIGINS` no backend com a URL real do frontend
- `NEXT_PUBLIC_API_URL` no frontend com a URL real do backend

## ✅ Checklist

- [ ] Repositório Git conectado (começando na pasta SaaS)
- [ ] Blueprint criado
- [ ] Base de dados criada
- [ ] Variáveis de ambiente configuradas
- [ ] Backend deployado e funcionando
- [ ] Frontend deployado e funcionando
- [ ] URLs atualizadas
- [ ] CORS configurado
- [ ] Webhooks configurados (Stripe, Telegram)

## 📖 Documentação Completa

Consulte `RENDER_DEPLOY.md` para instruções detalhadas.

