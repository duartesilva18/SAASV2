# Pagamentos em modo Live (Stripe)

O erro **"No such price: ... a similar object exists in test mode, but a live mode key was used"** significa que estás a usar a **chave Live** do Stripe mas os **Price IDs** no código/env são do **modo Test**. No Stripe, Test e Live têm dados separados.

## O que fazer

### 1. Stripe Dashboard (modo Live)

1. Abre [dashboard.stripe.com](https://dashboard.stripe.com).
2. **Ativa o modo Live** (interruptor no canto superior direito: "Test mode" → "Live").
3. Vai a **Produtos** e cria (ou confirma) os 3 planos com os preços em **Live**:
   - **Basic** – preço mensal (ex.: 9,99€/mês)
   - **Plus** – preço 6 meses (ex.: 49,99€)
   - **Pro** – preço anual (ex.: 89,99€/ano)
4. Para cada preço, copia o **Price ID** (começa por `price_`). Em Live os IDs são **diferentes** dos do Test.

### 2. Backend (Render – serviço finanzen-backend)

Em **Environment** do serviço do backend, define:

- `STRIPE_API_KEY` = tua chave **Live** (começa por `sk_live_...`)
- `STRIPE_PRICE_BASIC_MONTHLY` = Price ID Live do plano Basic mensal
- `STRIPE_PRICE_PLUS` = Price ID Live do plano Plus (6 meses)
- `STRIPE_PRICE_YEARLY` = Price ID Live do plano Pro (anual)

### 3. Frontend (Render – serviço finanzen-frontend)

Em **Environment** do serviço do frontend, define:

- `NEXT_PUBLIC_STRIPE_PRICE_BASIC_MONTHLY` = **o mesmo** Price ID Live do Basic
- `NEXT_PUBLIC_STRIPE_PRICE_PLUS` = **o mesmo** Price ID Live do Plus
- `NEXT_PUBLIC_STRIPE_PRICE_YEARLY` = **o mesmo** Price ID Live do Pro

(O frontend usa estas env vars para enviar o `price_id` correto no checkout.)

### 4. Webhook (opcional mas recomendado)

Se usas webhooks do Stripe para subscrições, em Live precisas de um **endpoint** e **signing secret** de Live. Cria um webhook em Live no Stripe (Events → Add endpoint) e define `STRIPE_WEBHOOK_SECRET` no backend com o secret desse endpoint.

---

**Resumo:** Usa sempre **Price IDs do modo Live** e a **chave API Live** (`sk_live_...`) em produção. Os IDs que começam por `price_1Su...` no código são fallback para **Test**; em produção devem vir das variáveis de ambiente com os IDs criados em Live.
