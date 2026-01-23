# 🏗️ Arquitetura de Endpoints - Finly

**Data:** 2025-01-27

---

## 📐 Princípios de Design

### 1. Separação: Snapshot vs Collections

**Snapshot (Estável):**
- Dados financeiros calculados (fonte de verdade)
- Estrutura NÃO muda para acomodar UI
- Reutilizável por qualquer consumidor (web, mobile, analytics)

**Collections (Descartável):**
- Dados específicos para UI
- Pode mudar conforme necessidades
- Opcional (pode ser omitido)

---

## 🔧 Endpoint `/dashboard/snapshot`

### Estrutura da Resposta

```json
{
  "version": "1.0",
  "snapshot": {
    "income": 5000.0,
    "expenses": 3000.0,
    "vault_total": 10000.0,
    "vault_emergency": 5000.0,
    "vault_investment": 5000.0,
    "available_cash": 2000.0,
    "net_worth": 12000.0,
    "saving_rate": 40.0,
    "cumulative_balance": 2000.0,
    "daily_allowance": 66.67,
    "remaining_money": 2000.0,
    "days_left": 15,
    "period_start": "2025-01-01",
    "period_end": "2025-01-27",
    "transaction_count": 45
  },
  "collections": {
    "recent_transactions": [...],
    "categories": [...],
    "recurring": [...]
  },
  "currency": "EUR"
}
```

### Parâmetros

- `include_collections` (query param, default: `true`)
  - `true`: Retorna snapshot + collections (para dashboard web)
  - `false`: Retorna apenas snapshot (para mobile/analytics)

### Exemplos de Uso

**Dashboard Web (completo):**
```typescript
const res = await api.get('/dashboard/snapshot');
// Retorna snapshot + collections
```

**Mobile App (apenas snapshot):**
```typescript
const res = await api.get('/dashboard/snapshot?include_collections=false');
// Retorna apenas snapshot (mais leve)
```

**Analytics (apenas snapshot):**
```typescript
const res = await api.get('/dashboard/snapshot?include_collections=false');
// Usa snapshot para cálculos, busca transactions separadamente se necessário
```

---

## 🎯 Benefícios da Arquitetura

### 1. Desacoplamento
- Snapshot não depende de UI específica
- Collections podem mudar sem afetar snapshot
- Fácil adicionar novos consumidores

### 2. Performance
- Mobile pode pedir apenas snapshot (menos dados)
- Analytics pode usar snapshot sem collections
- Dashboard web pode pedir tudo

### 3. Versionamento
- Campo `version` permite evoluir API
- Snapshot estável, collections podem mudar
- Backward compatible

### 4. Manutenibilidade
- Snapshot calculado uma vez (FinancialEngine)
- Collections são apenas dados de UI
- Fácil testar e depurar

---

## 📋 Regras de Ouro

### ✅ FAZER

1. **Snapshot sempre estável**
   - Não adicionar campos UI-specific ao snapshot
   - Usar FinancialEngine para cálculos
   - Manter estrutura consistente

2. **Collections são opcionais**
   - Sempre permitir omitir collections
   - Não fazer snapshot depender de collections
   - Collections podem ser vazias

3. **Versionamento claro**
   - Incrementar versão em mudanças breaking
   - Documentar mudanças
   - Manter backward compatibility

### ❌ NÃO FAZER

1. **Não acoplar snapshot à UI**
   - Não adicionar campos como "recent_transactions_count" ao snapshot
   - Não fazer snapshot depender de collections
   - Não misturar lógica de UI com cálculos financeiros

2. **Não fazer snapshot mutável**
   - Snapshot não deve mudar por causa de UI
   - Não adicionar campos temporários
   - Não fazer snapshot específico para uma página

3. **Não ignorar versionamento**
   - Sempre incluir campo `version`
   - Não fazer breaking changes sem avisar
   - Não remover campos sem deprecar primeiro

---

## 🔄 Evolução Futura

### Cenário 1: Nova Página Precisa de Snapshot

**Solução:** Usar endpoint existente
```typescript
// Nova página usa snapshot existente
const { snapshot } = await api.get('/dashboard/snapshot?include_collections=false');
// Busca seus próprios dados separadamente
```

### Cenário 2: Mobile Precisa de Menos Dados

**Solução:** Parâmetro `include_collections=false`
```typescript
// Mobile pede apenas snapshot
const res = await api.get('/dashboard/snapshot?include_collections=false');
// Snapshot é leve, collections não são enviadas
```

### Cenário 3: Analytics Precisa de Mais Histórico

**Solução:** Endpoint separado ou parâmetros
```typescript
// Analytics pode ter endpoint próprio
const res = await api.get('/analytics/snapshot?period=12m');
// Ou usar endpoint existente com parâmetros
```

---

## 📊 Comparação: Antes vs Depois

### Antes (Acoplado)
```typescript
// Endpoint retorna tudo misturado
{
  "income": 5000,
  "transactions": [...],  // Misturado com snapshot
  "categories": [...]     // Misturado com snapshot
}
// Problema: Não pode pedir apenas snapshot
// Problema: Snapshot depende de UI
```

### Depois (Desacoplado)
```typescript
// Endpoint separa snapshot de collections
{
  "version": "1.0",
  "snapshot": { ... },    // Estável, reutilizável
  "collections": { ... }  // Descartável, opcional
}
// Benefício: Pode pedir apenas snapshot
// Benefício: Snapshot independente de UI
```

---

**Documento criado em:** 2025-01-27

