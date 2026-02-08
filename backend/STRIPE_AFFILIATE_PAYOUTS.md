# 💳 Pagamento Automático de Comissões via Stripe Connect

## 📋 Visão Geral

Implementação de pagamento automático de comissões de afiliados usando **Stripe Connect**. Cada afiliado conecta sua própria conta Stripe, e quando um admin marca uma comissão como paga, o sistema automaticamente transfere o valor para a conta Stripe conectada do afiliado.

## 🏗️ Arquitetura

### Stripe Connect (Express Accounts)
- **Vantagens**: 
  - Cada afiliado tem sua própria conta Stripe
  - Onboarding simplificado via Stripe Express
  - Compliance e KYC gerenciados pelo Stripe
  - Pagamentos instantâneos para contas conectadas
  - Dashboard próprio para cada afiliado
- **Desvantagens**: Requer integração mais complexa
- **Uso**: Marketplace onde cada afiliado é um vendedor independente

**Decisão: Usar Stripe Connect Express** - Solução profissional e escalável.

## 📊 Estrutura de Dados

### 1. Adicionar campos na tabela `users`

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_connect_account_status VARCHAR(50), -- 'pending', 'active', 'restricted', 'disabled'
ADD COLUMN IF NOT EXISTS affiliate_payout_enabled BOOLEAN NOT NULL DEFAULT FALSE; -- Cache lógico (pode ser inferido)
```

### 2. Atualizar modelo `AffiliateCommission`

Adicionar campos para armazenar informações do transfer do Stripe Connect:
```sql
ALTER TABLE affiliate_commissions
ADD COLUMN IF NOT EXISTS stripe_transfer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS transfer_status VARCHAR(50), -- 'created', 'reversed', 'failed'
ADD COLUMN IF NOT EXISTS payout_error_message TEXT;
```

**Nota**: Não controlamos o payout - isso é responsabilidade do Stripe. O transfer é criado e o Stripe faz o payout automaticamente para contas Express.

### 3. Campo `affiliate_payout_enabled` (Opcional - Cache Lógico)

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS affiliate_payout_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

**⚠️ NOTA**: Este campo é tecnicamente redundante, pois pode ser inferido por:
- `stripe_connect_account_id IS NOT NULL`
- `stripe_connect_account_status = 'active'`

**Decisão**: 
- **Opção A**: Manter como cache lógico (mais rápido em queries)
- **Opção B**: Remover e inferir dinamicamente (evita inconsistências)

**Recomendação**: Manter por agora, mas documentar que é cache. Pode ser removido mais tarde se necessário.

## 🔄 Fluxo de Pagamento

### ✅ Opção Ideal: Divisão Automática no Pagamento (Recomendada)

### 1. Afiliado conecta conta Stripe (Onboarding)
```
Afiliado → GET /affiliate/stripe-connect/onboard
  ↓
Sistema cria Express Account no Stripe Connect:
  - type: 'express'
  - country: 'PT' (ou do usuário)
  - email: user.email
  ↓
Gera link de onboarding do Stripe
  ↓
Armazena: stripe_connect_account_id
  ↓
Redireciona afiliado para onboarding do Stripe
```

### 2. Webhook: account.updated (Onboarding completo)
```
Stripe → Webhook: account.updated
  ↓
Sistema verifica se onboarding foi completado
  ↓
Atualiza:
  - stripe_connect_onboarding_completed = TRUE
  - stripe_connect_account_status = account.details_submitted ? 'active' : 'pending'
  - affiliate_payout_enabled = TRUE (se ativo)
```

### Comissões por plano (editável pelo admin)
- **Plano Plus**: 20% (default). `SystemSetting`: `affiliate_commission_percentage_plus`
- **Plano Pro**: 25% (default). `SystemSetting`: `affiliate_commission_percentage_pro`
- **Plano Basic**: 0% (sem comissão)
Os afiliados ganham esta comissão **em cada cobrança** (mensal ou anual) enquanto o utilizador referido continuar subscrito — não é só no primeiro mês.

### 3. Cliente paga Pack Pro (Divisão Automática)
```
Cliente → POST /stripe/create-checkout-session
  ↓
Sistema verifica se cliente tem referrer_id
  ↓
Se tem referrer_id E referrer tem stripe_connect_account_id ativo:
  - Calcula comissão: commission_amount_cents
  - Calcula valor para ti: total - commission
  ↓
Cria Checkout Session com:
  - amount: total (ex: 999 cêntimos)
  - application_fee_amount: commission_amount_cents
  - transfer_data.destination: stripe_connect_account_id
  ↓
Cliente paga
  ↓
Stripe automaticamente:
  - Separa a comissão
  - Envia para conta do afiliado (via transfer)
  - Tu recebes o restante
  - Stripe faz payout automático ao afiliado
  ↓
Sistema marca comissão como paga:
  - is_paid = TRUE
  - paid_at = NOW()
  - stripe_transfer_id = payment_intent.transfer (do webhook)
  - transfer_status = 'created'
```

### 4. Webhook: payment_intent.succeeded (Pagamento confirmado)
```
Stripe → Webhook: payment_intent.succeeded
  ↓
Sistema verifica se tem transfer_data (comissão foi dividida)
  ↓
Se tem transfer:
  - Busca comissão relacionada
  - Marca como pago:
    - is_paid = TRUE
    - paid_at = NOW()
    - transfer_status = 'created'
  ⚠️ NOTA: stripe_transfer_id será capturado no transfer.created
```

### 4b. Webhook: transfer.created (Capturar Transfer ID)
```
Stripe → Webhook: transfer.created
  ↓
Sistema busca comissão relacionada (via metadata ou transfer_group)
  ↓
Atualiza:
  - stripe_transfer_id = transfer.id
  - payment_reference = transfer.id
```

**⚠️ IMPORTANTE**: Usar `transfer.created` para capturar o `stripe_transfer_id` porque:
- `payment_intent.succeeded` nem sempre traz `transfer.id` expandido
- `transfer.created` garante que temos o ID correto
- Evita edge cases e problemas de timing

### 5. Webhook: transfer.reversed (Transfer revertido - raro)
```
Stripe → Webhook: transfer.reversed
  ↓
Sistema atualiza:
  - transfer_status = 'reversed'
  - payout_error_message = 'Transfer was reversed'
  - is_paid = FALSE (reverter)
  - Log erro para admin
```

### ⚠️ Opção Alternativa: Pagamento Manual (Menos Ideal)

Se preferires manter pagamento manual pelo admin:

```
Admin → POST /admin/affiliates/commission/pay/{commission_id}
  ↓
Sistema verifica:
  - Afiliado tem stripe_connect_account_id?
  - stripe_connect_onboarding_completed = TRUE?
  - stripe_connect_account_status = 'active'?
  ↓
Cria Transfer no Stripe Connect:
  - amount: commission_amount_cents
  - currency: 'eur'
  - destination: stripe_connect_account_id
  - transfer_group: commission_id (para rastreamento)
  ↓
Se Transfer.create() retorna sucesso:
  - is_paid = TRUE
  - paid_at = NOW()
  - stripe_transfer_id = transfer.id
  - transfer_status = 'created'
  - payment_reference = transfer.id
  ↓
NOTA: Não esperar por payout - considerar pago no momento do transfer criado
```

## 🔌 Endpoints Necessários

### Backend

1. **GET /affiliate/stripe-connect/onboard**
   - Criar Express Account no Stripe Connect
   - Gerar link de onboarding
   - Redirecionar afiliado para Stripe

2. **GET /affiliate/stripe-connect/status**
   - Verificar status da conta conectada
   - Retornar link do dashboard do Stripe (se disponível)

3. **GET /affiliate/stripe-connect/dashboard**
   - Obter link do dashboard Stripe do afiliado
   - Criar login link temporário

4. **POST /stripe/create-checkout-session** (Modificar existente)
   - Verificar se cliente tem referrer_id
   - Se sim, calcular comissão e usar `application_fee_amount` + `transfer_data.destination`
   - Dividir pagamento automaticamente

5. **POST /admin/affiliates/commission/pay/{commission_id}** (Opcional - apenas se usar pagamento manual)
   - Processar transfer manual via Stripe Connect
   - Atualizar status da comissão

### Webhooks

6. **Webhook: account.updated**
   - Detectar quando onboarding é completado
   - Atualizar status da conta
   - Atualizar `affiliate_payout_enabled` (cache)

7. **Webhook: payment_intent.succeeded**
   - Detectar pagamento bem-sucedido
   - Se tem transfer_data, marcar comissão como paga:
     - `is_paid = TRUE`
     - `paid_at = NOW()`
     - `transfer_status = 'created'`
   - ⚠️ **NÃO** guardar `stripe_transfer_id` aqui (usar `transfer.created`)

8. **Webhook: transfer.created** ⭐ **IMPORTANTE**
   - Capturar `stripe_transfer_id` de forma confiável
   - Buscar comissão relacionada (via metadata ou transfer_group)
   - Atualizar: `stripe_transfer_id = transfer.id`
   - **Por quê**: `payment_intent.succeeded` nem sempre traz transfer.id expandido

9. **Webhook: transfer.reversed** (Opcional - raro)
   - Tratar reversão de transfer
   - Reverter status da comissão
   - Atualizar: `transfer_status = 'reversed'`, `is_paid = FALSE`

## 🎨 Frontend

1. **Página de Configuração Stripe Connect** (`/affiliate/stripe-connect`)
   - Botão "Conectar Conta Stripe"
   - Status da conexão (não conectado, pendente, ativo)
   - Link para dashboard do Stripe (se conectado)
   - Informações sobre o processo

2. **Atualizar Dashboard de Afiliado**
   - Mostrar status da conta Stripe Connect
   - Badge "Conta Conectada" ou "Conectar Conta"
   - Link para configurar/verificar conexão

3. **Admin: Botão "Pagar via Stripe Connect"**
   - Verificar se afiliado tem conta conectada
   - Processar transfer automaticamente
   - Mostrar status do transfer (pending, paid, failed)

## ⚙️ Configuração Stripe

### Variáveis de Ambiente
```env
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_... (opcional, para OAuth)
```

### Configuração no Dashboard Stripe
1. Ativar **Stripe Connect** no dashboard
2. Configurar tipo: **Express Accounts**
3. Configurar países permitidos (ex: PT, ES, etc)
4. Configurar webhooks

### Webhooks Necessários
- `account.updated` - Conta Stripe Connect atualizada (onboarding completo)
- `payment_intent.succeeded` - Pagamento confirmado (marcar comissão como paga)
- `transfer.created` - ⭐ **OBRIGATÓRIO** - Capturar `stripe_transfer_id` de forma confiável
- `transfer.reversed` - Transfer revertido (opcional, raro)

**⚠️ IMPORTANTE**: 
- Não existe `transfer.paid` ou `transfer.failed`
- O payout é automático e gerenciado pelo Stripe para contas Express
- **Sempre usar `transfer.created` para capturar `stripe_transfer_id`** (não confiar em `payment_intent.succeeded`)

## 🔒 Segurança

1. **Autenticação Stripe**: Verificar webhooks com assinatura
2. **Rate Limiting**: Limitar tentativas de criação de conta
3. **Logs**: Registrar todos os transfers para auditoria
4. **Validação**: Verificar status da conta antes de fazer transfer
5. **Idempotência**: Usar idempotency keys para transfers

## 📝 Notas de Implementação

### Divisão Automática (Recomendada)

1. **Checkout Session com Divisão**:
   ```python
   session = stripe.checkout.Session.create(
       payment_method_types=['card'],
       line_items=[{
           'price': price_id,
           'quantity': 1,
       }],
       mode='subscription',
       application_fee_amount=commission_cents,  # Comissão do afiliado
       transfer_data={
           'destination': stripe_connect_account_id,  # Conta do afiliado
       },
       success_url=...,
       cancel_url=...,
   )
   ```

2. **Stripe Connect Express**: Usar `stripe.Account.create(type='express')`
3. **Onboarding Link**: Usar `stripe.Account.create_login_link()` para dashboard
4. **Transfer Automático**: Criado automaticamente pelo Stripe quando usas `application_fee_amount`
5. **Payout Automático**: Stripe faz payout automático para contas Express - não precisas fazer nada

### Pagamento Manual (Alternativa)

6. **Transfers Manuais**: Usar `stripe.Transfer.create()` apenas se optares por pagamento manual
7. **Considerar Pago**: No momento que `Transfer.create()` retorna sucesso, não esperar por payout

### Geral

8. **Testes**: Usar Stripe Test Mode com contas de teste
9. **Limites Stripe**: Verificar limites mínimos de transfer (geralmente €1.00)
10. **Taxas**: Stripe Connect tem taxas diferentes (verificar pricing)
11. **Tempo de Processamento**: Transfers são instantâneos, payouts são automáticos (1-2 dias)
12. **KYC/Compliance**: Gerenciado automaticamente pelo Stripe
13. **Idempotência**: Usar idempotency keys em todas as operações críticas

## Próximos Passos

### Fase 1: Estrutura Base
1. ✅ Criar migration SQL para novos campos (stripe_connect_account_id, transfer_status)
2. ✅ Atualizar modelos Python (User e AffiliateCommission)
3. ✅ Implementar endpoints de onboarding Stripe Connect

### Fase 2: Divisão Automática (Recomendada)
4. ✅ Modificar `/stripe/create-checkout-session` para usar `application_fee_amount` + `transfer_data`
5. ✅ Implementar lógica para calcular comissão no momento do checkout
6. ✅ Adicionar webhook `payment_intent.succeeded` para marcar comissão como paga
7. ✅ Adicionar webhook `transfer.created` ⭐ **OBRIGATÓRIO** para capturar `stripe_transfer_id`
8. ✅ Adicionar webhook `account.updated` para status de onboarding

### Fase 3: Frontend
8. ✅ Criar página `/affiliate/stripe-connect` para onboarding
9. ✅ Atualizar dashboard de afiliado com status do Stripe Connect
10. ✅ Mostrar badge "Conta Conectada" ou "Conectar Conta"

### Fase 4: Opcional - Pagamento Manual
11. ⚠️ Implementar endpoint `/admin/affiliates/commission/pay` (apenas se não usar divisão automática)
    - Marcar como pago quando `Transfer.create()` retorna sucesso
    - **Nunca esperar por payout**
12. ⚠️ Adicionar webhook `transfer.reversed` (opcional, raro)

### Fase 5: Testes e Deploy
13. ✅ Testes em modo de teste do Stripe
14. ✅ Deploy e monitorização

## ⚠️ Decisões Importantes

### 1. Divisão Automática vs Pagamento Manual

**Recomendação**: Usar **Divisão Automática** (Fase 2) em vez de Pagamento Manual (Fase 4).

**Vantagens da Divisão Automática**:
- ✅ Zero risco de saldo insuficiente
- ✅ Zero risco de chargebacks
- ✅ Zero erros humanos
- ✅ Escala automaticamente
- ✅ Mais simples de implementar
- ✅ Alinhado com best practices do Stripe

### 2. Quando Marcar `is_paid = TRUE`

**Regra de Ouro**:
- **Divisão Automática**: Marcar no `payment_intent.succeeded` (quando pagamento é confirmado)
- **Pagamento Manual**: Marcar quando `Transfer.create()` retorna sucesso
- **NUNCA esperar por payout** - isso é responsabilidade do Stripe

### 3. Capturar `stripe_transfer_id`

**Recomendação**: Sempre usar webhook `transfer.created` para capturar o ID.

**Por quê**:
- `payment_intent.succeeded` nem sempre traz `transfer.id` expandido
- `transfer.created` garante que temos o ID correto
- Evita edge cases e problemas de timing

**Alternativa** (se necessário): Fazer fetch adicional com `expand[]=charges.data.transfer`, mas `transfer.created` é mais simples e confiável.

### 4. Campo `affiliate_payout_enabled`

**Status**: Campo redundante, mas útil como cache.

**Pode ser inferido por**:
- `stripe_connect_account_id IS NOT NULL`
- `stripe_connect_account_status = 'active'`

**Decisão**: Manter por agora como cache lógico (mais rápido em queries), mas documentar que é redundante. Pode ser removido mais tarde se necessário.

