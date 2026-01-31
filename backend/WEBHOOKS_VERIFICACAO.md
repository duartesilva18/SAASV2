# Verificação dos Webhooks Stripe

## Eventos configurados vs. implementados

| Evento | Handler | Função |
|--------|---------|--------|
| `checkout.session.completed` | `handle_checkout_completed` | Liga subscrição ao user, marca conversão afiliado |
| `customer.subscription.created` | `handle_subscription_created` | Atualiza subscrição, marca conversão |
| `customer.subscription.updated` | `handle_subscription_updated` | Atualiza status (cancel_at_period_end) |
| `customer.subscription.deleted` | `handle_subscription_deleted` | Marca como cancelada |
| `invoice.payment_failed` | `handle_invoice_payment_failed` | Atualiza status para past_due/unpaid |
| `invoice.paid` | `handle_invoice_paid` | Cria/atualiza AffiliateCommission, marca conversão |
| `payment_intent.succeeded` | `handle_payment_intent_succeeded` | Marca comissão como paga (divisão automática) |
| `transfer.created` | `handle_transfer_created` | Regista stripe_transfer_id na comissão |
| `transfer.reversed` | `handle_transfer_reversed` | Reverte status da comissão |
| `account.updated` | `handle_account_updated` | Atualiza status Stripe Connect do afiliado |

## Checklist no Stripe Dashboard

1. **URL do webhook**: `https://[seu-dominio]/webhooks/stripe`
2. **Eventos obrigatórios**:
   - `account.updated`
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
   - `transfer.created`
   - `transfer.reversed`
3. **STRIPE_WEBHOOK_SECRET**: Copiar o "Signing secret" (whsec_...) do endpoint no Render/env.

## Fluxo de comissões (afiliados)

1. **invoice.paid** → Cria `AffiliateCommission` com `is_paid=False`
2. **payment_intent.succeeded** → Se tiver `transfer_data`, marca comissão como paga
3. **transfer.created** → Atualiza `stripe_transfer_id` na comissão (backup/auditoria)

**Total Ganho** = soma de todas as `AffiliateCommission.commission_amount_cents` (paid + pending).
**Valor Pago** = soma onde `is_paid=True`.

## Correção aplicada

**Bug corrigido**: `application_fee_percent` estava invertido.
- Antes: 20% → plataforma ficava 20%, afiliado recebia 80%
- Agora: `application_fee_percent = 100 - commission_percentage` → plataforma fica 80%, afiliado recebe 20%

## Teste vs Live

- **Teste**: Usar `STRIPE_WEBHOOK_SECRET` do endpoint de teste (whsec_...)
- **Live**: Usar `STRIPE_WEBHOOK_SECRET` do endpoint de produção
- Cada endpoint no Stripe tem o seu próprio signing secret.
