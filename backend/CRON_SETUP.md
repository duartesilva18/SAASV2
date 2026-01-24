# Configuração de Cron Job para Comissões Mensais

Este documento explica como configurar o cálculo automático de comissões mensais.

## ✅ RECOMENDADO: GitHub Actions (Para Render + GitHub)

Se estás a usar **Render** e **GitHub**, a melhor opção é usar **GitHub Actions**.

### Configuração Automática

1. **O ficheiro já está criado**: `.github/workflows/monthly-commissions.yml`

2. **Configurar Secrets no GitHub**:
   - Vai a: `Settings` → `Secrets and variables` → `Actions`
   - Adiciona os seguintes secrets:
     - `DATABASE_URL` - URL da base de dados (Supabase)
     - `FRONTEND_URL` - URL do frontend
     - `SECRET_KEY` - Chave secreta do backend
     - `STRIPE_API_KEY` - Chave da API do Stripe
     - `STRIPE_WEBHOOK_SECRET` - Secret do webhook do Stripe
     - `MAIL_USERNAME` - Email para enviar (ex: Gmail)
     - `MAIL_PASSWORD` - Password do email
     - `MAIL_FROM` - Email remetente
     - `MAIL_PORT` - Porta SMTP (ex: 587)
     - `MAIL_SERVER` - Servidor SMTP (ex: smtp.gmail.com)
     - `MAIL_STARTTLS` - true
     - `MAIL_SSL_TLS` - false
     - `USE_CREDENTIALS` - true
     - `VALIDATE_CERTS` - true

3. **Pronto!** O workflow executa automaticamente no dia 1 de cada mês às 00:00 UTC.

4. **Testar manualmente**:
   - Vai a: `Actions` → `Calculate Monthly Affiliate Commissions` → `Run workflow`

### Vantagens do GitHub Actions:
- ✅ Gratuito
- ✅ Não precisa de configuração no Render
- ✅ Funciona mesmo se o Render estiver offline
- ✅ Logs fáceis de ver
- ✅ Pode executar manualmente quando quiseres

---

## Outras Opções de Configuração

### Opção 1: Cron Job no Servidor

Se o backend estiver num servidor Linux, pode configurar um cron job:

```bash
# Editar crontab
crontab -e

# Adicionar linha (executa no dia 1 de cada mês às 00:00)
0 0 1 * * /usr/bin/python3 /caminho/para/SaaS/backend/cron_monthly_commissions.py >> /var/log/affiliate_commissions.log 2>&1
```

### Opção 2: GitHub Actions (Se usar GitHub)

Criar `.github/workflows/monthly-commissions.yml`:

```yaml
name: Calculate Monthly Commissions

on:
  schedule:
    - cron: '0 0 1 * *'  # Primeiro dia de cada mês às 00:00 UTC
  workflow_dispatch:  # Permite execução manual

jobs:
  calculate-commissions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd SaaS/backend
          pip install -r requirements.txt
      - name: Run commission calculation
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          FRONTEND_URL: ${{ secrets.FRONTEND_URL }}
          # ... outras variáveis de ambiente
        run: |
          cd SaaS/backend
          python cron_monthly_commissions.py
```

### Opção 3: Vercel Cron Jobs (Se usar Vercel)

Criar `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/monthly-commissions",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

E criar endpoint `app/api/cron/monthly-commissions/route.ts`:

```typescript
import { run_monthly_commission_job } from '@/backend/app/core/monthly_commission_job';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await run_monthly_commission_job();
  return Response.json({ success: true });
}
```

### Opção 4: Endpoint Manual (Para testes)

Pode sempre chamar manualmente via API:

```bash
curl -X POST https://seu-backend.com/affiliates/admin/calculate-monthly-commissions \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN"
```

## Verificação

Após configurar, verificar os logs para confirmar que está a funcionar:

```bash
# Se usar cron job no servidor
tail -f /var/log/affiliate_commissions.log

# Verificar emails enviados
# Os emails devem chegar no dia 1 de cada mês
```

## Notas Importantes

1. **Timezone**: O cron job usa UTC por padrão. Ajustar conforme necessário.
2. **Segurança**: Se usar endpoint público, proteger com autenticação.
3. **Backup**: O cálculo também pode ser feito manualmente via endpoint admin.
4. **Logs**: Verificar logs regularmente para garantir que está a funcionar.

