# Fluxo de Dados dos Afiliados

## 📊 Visão Geral do Sistema

O sistema de afiliados permite que utilizadores promovam a plataforma e recebam comissões quando os utilizadores referidos subscrevem o plano Pro.

## 🔄 Fluxo Completo de Dados

### 1. **Solicitação de Afiliado**
```
Utilizador → POST /affiliate/request
  ↓
Sistema verifica se já é afiliado
  ↓
Cria registro com affiliate_requested_at = NOW()
  ↓
Admin aprova via POST /admin/affiliate/promote
  ↓
Sistema gera affiliate_code único
  ↓
is_affiliate = TRUE
```

**Tabelas envolvidas:**
- `users.is_affiliate` → `FALSE` → `TRUE`
- `users.affiliate_code` → `NULL` → `'ABC123XY'` (código único)
- `users.affiliate_requested_at` → timestamp da solicitação

---

### 2. **Registo com Código de Referência**

#### 2.1. Registo Normal (POST /auth/register)
```
Utilizador fornece referral_code no registo
  ↓
Sistema valida código:
  - Busca user WHERE affiliate_code = referral_code AND is_affiliate = TRUE
  ↓
Se válido:
  - referrer_id = referrer.id
  - referral_code armazenado no URL de verificação (?ref=CODE)
  ↓
Email de verificação enviado com ref no URL
```

#### 2.2. Verificação de Email (GET /auth/verify-email?token=XXX&ref=CODE)
```
Utilizador clica no link de verificação
  ↓
Sistema processa ref:
  - Busca afiliado pelo código
  - Verifica se não é auto-referência
  ↓
Cria utilizador:
  - users.referrer_id = referrer.id
  ↓
Cria registro em affiliate_referrals:
  - referrer_id = afiliado.id
  - referred_user_id = novo_user.id
  - referral_code = código usado
  - has_subscribed = FALSE
  - ip_address, user_agent (anti-fraude)
```

**Tabelas envolvidas:**
- `users.referrer_id` → ID do afiliado que referiu
- `affiliate_referrals` → Novo registro da referência

---

### 3. **Login Social com Referência**

#### 3.1. Social Login (POST /auth/social-login)
```
Utilizador faz login via Google/Apple
  ↓
Sistema busca user por email
  ↓
Se não existe:
  - Cria novo user
  - ⚠️ ATENÇÃO: Não processa referral_code no social login atual
  - Cria workspace padrão
```

**Nota:** O social login atual não suporta referral_code. Seria necessário adicionar este suporte.

---

### 4. **Subscrição Pro (Webhook Stripe)**

#### 4.1. Webhook: customer.subscription.created
```
Stripe envia webhook
  ↓
Sistema identifica user pelo stripe_customer_id
  ↓
Se user.referrer_id existe:
  - Busca affiliate_referral WHERE referred_user_id = user.id
  - Atualiza: has_subscribed = TRUE
  - Atualiza: subscription_date = NOW()
  ↓
Log: "Conversão de afiliado marcada"
```

#### 4.2. Webhook: customer.subscription.deleted
```
Stripe envia webhook de cancelamento
  ↓
Sistema identifica user
  ↓
Se user.referrer_id existe:
  - Atualiza: has_subscribed = FALSE
  - subscription_date = NULL
```

**Tabelas envolvidas:**
- `affiliate_referrals.has_subscribed` → `FALSE` → `TRUE`
- `affiliate_referrals.subscription_date` → timestamp

---

### 5. **Cálculo de Comissões Mensais**

#### 5.1. Processo de Cálculo (Tarefa agendada)
```
No fim de cada mês:
  ↓
Para cada afiliado (WHERE is_affiliate = TRUE):
  ↓
Busca todas as referências com has_subscribed = TRUE
  no mês anterior
  ↓
Calcula:
  - total_revenue_cents = soma das receitas
  - commission_percentage = 20% (configurável)
  - commission_amount_cents = total_revenue * percentage
  - referrals_count = total de referências
  - conversions_count = referências com subscrição
  ↓
Cria/atualiza registro em affiliate_commissions:
  - month = primeiro dia do mês (YYYY-MM-01)
  - is_paid = FALSE (até ser pago)
```

**Tabelas envolvidas:**
- `affiliate_commissions` → Novo registro mensal por afiliado

---

### 6. **Pagamento de Comissões**

#### 6.1. Admin marca como pago
```
Admin → POST /admin/affiliate/commission/pay
  ↓
Sistema atualiza:
  - affiliate_commissions.is_paid = TRUE
  - affiliate_commissions.paid_at = NOW()
  - affiliate_commissions.payment_reference = 'REF123'
```

---

## 📋 Estrutura de Dados

### Tabela: `users` (Campos de Afiliado)
```sql
is_affiliate BOOLEAN          -- Se é afiliado
affiliate_code VARCHAR(20)    -- Código único do afiliado
referrer_id UUID              -- ID do afiliado que referiu este user
affiliate_requested_at TIMESTAMP -- Quando solicitou ser afiliado
```

### Tabela: `affiliate_referrals`
```sql
id UUID                       -- PK
referrer_id UUID              -- FK → users.id (afiliado)
referred_user_id UUID         -- FK → users.id (utilizador referido)
referral_code VARCHAR(20)     -- Código usado no signup
has_subscribed BOOLEAN        -- Se subscreveu Pro
subscription_date TIMESTAMP   -- Data da subscrição
ip_address VARCHAR(50)        -- Anti-fraude
user_agent VARCHAR(500)       -- Anti-fraude
created_at TIMESTAMP          -- Data do registo
```

### Tabela: `affiliate_commissions`
```sql
id UUID                       -- PK
affiliate_id UUID             -- FK → users.id
month DATE                    -- Primeiro dia do mês
total_revenue_cents INTEGER    -- Receita total
commission_percentage NUMERIC -- % de comissão (ex: 20.00)
commission_amount_cents INTEGER -- Valor da comissão
referrals_count INTEGER       -- Total de referências
conversions_count INTEGER     -- Referências convertidas
is_paid BOOLEAN               -- Se foi pago
paid_at TIMESTAMP             -- Data do pagamento
payment_reference VARCHAR(100) -- Referência do pagamento
```

---

## 🔗 Relacionamentos

```
users (afiliado)
  ├── referrer_id → users.id (self-reference, nullable)
  ├── referrals → affiliate_referrals[] (via referrer_id)
  └── commissions → affiliate_commissions[] (via affiliate_id)

affiliate_referrals
  ├── referrer_id → users.id (afiliado)
  └── referred_user_id → users.id (utilizador referido)

affiliate_commissions
  └── affiliate_id → users.id (afiliado)
```

---

## ⚠️ Pontos de Atenção

1. **Auto-referência:** Sistema previne que um utilizador se refira a si mesmo
2. **Código único:** `affiliate_code` deve ser único na tabela
3. **Foreign Key:** `referrer_id` pode ser NULL (utilizadores sem referência)
4. **Cascata:** Se um afiliado for deletado, `referrer_id` fica NULL (SET NULL)
5. **Comissões:** Calculadas mensalmente, não em tempo real

---

## 🐛 Problema Atual

**Erro:** `column users.referrer_id does not exist`

**Causa:** A migração SQL não foi executada no banco de dados.

**Solução:** Executar o arquivo `fix_affiliate_columns.sql` para adicionar as colunas faltantes.

---

## 📝 SQL para Correção

Execute o arquivo: `fix_affiliate_columns.sql`

Este SQL:
- ✅ Verifica se as colunas existem antes de criar
- ✅ Adiciona apenas as colunas faltantes
- ✅ Cria foreign keys e índices necessários
- ✅ É idempotente (pode ser executado múltiplas vezes)


