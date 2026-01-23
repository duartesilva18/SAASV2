# 📊 Resumo dos Cálculos - Finly

**Versão:** 2.0 | **Data:** 2025-01-27

---

## 🎯 Regras Fundamentais

### Sinais das Transações (OBRIGATÓRIO)

```
Receita regular    → amount_cents > 0  ✅
Despesa regular    → amount_cents < 0  ✅
Vault depósito     → amount_cents > 0  ✅
Vault resgate      → amount_cents < 0  ✅
```

**Validação:** Backend rejeita transações com sinais incorretos (erro 400).

---

## 💰 Cálculos Principais

### 1. Receitas e Despesas

```typescript
// Filtrar apenas transações regulares (vault_type === 'none')
// Backend garante sinais: income > 0, expense < 0
income = transactions
  .filter(t => cat.type === 'income' && cat.vault_type === 'none')
  .sum(t.amount_cents) / 100  // Já é positivo (backend garante)

expenses = transactions
  .filter(t => cat.type === 'expense' && cat.vault_type === 'none')
  .sum(t.amount_cents) / -100  // Converte negativo para positivo
```

**Regra:** 
- Backend garante sinais corretos
- Frontend confia nos sinais (sem Math.abs() nos cálculos)
- UI decide se mostra valor absoluto ou não
- Vault **NÃO** conta para receitas/despesas (é dinheiro parado).

---

### 2. Vault (Cofre)

```typescript
// Depósitos aumentam, resgates diminuem
vault = transactions
  .filter(t => cat.vault_type !== 'none')
  .reduce((total, t) => {
    if (t.amount_cents > 0) return total + t.amount_cents / 100;  // Depósito
    else return total - Math.abs(t.amount_cents / 100);           // Resgate
  }, 0)
```

**Regra:** Vault é separado de receitas/despesas.

---

### 3. Net Worth (Património)

```typescript
// Cash disponível = saldo inicial + receitas - despesas
availableCash = openingBalance + income - expenses
netWorth = vaultTotal + max(0, availableCash)  // Património total
```

**Regra:** 
- Net Worth = Vault + Cash disponível
- Cash disponível inclui saldo inicial (opening balance)
- Se availableCash < 0, usar 0 (não pode ter património negativo)

---

### 4. Saving Rate

```typescript
const MIN_INCOME_THRESHOLD = 100;  // 1€ mínimo para calcular saving rate

if (income >= MIN_INCOME_THRESHOLD) {
  calculated = ((income - expenses) / income) * 100
  savingRate = clamp(calculated, -100, 100)  // Limita entre -100% e 100%
} else {
  savingRate = 0  // Não representativo se income muito baixo
  // OU mostrar: "Saving rate não representativo este mês"
}
```

**Regra:** 
- Clamp entre -100% e 100% para evitar valores extremos
- Se income < threshold, saving rate = 0 (não representativo)
- Transparência > matemática pura

---

### 5. Daily Allowance

```typescript
// Caminho correto (cash-based, não budget-based)
availableCash = openingBalance + income - expenses
dailyAllowance = max(0, availableCash / daysLeft)
```

**Regra:** 
- Baseado em cash REAL disponível (não em orçamento)
- Inclui saldo inicial (opening balance)
- Vault não afeta o orçamento diário
- Alinha com Net Worth e realidade bancária

**Versão atual (temporária):**
```typescript
// Budget-based (será substituído)
totalBudget = income > 0 ? income : totalLimits
remainingMoney = max(0, totalBudget - expenses)
dailyAllowance = remainingMoney / daysLeft
```

---

### 6. Cumulative Balance (Património Acumulado)

```typescript
// Apenas receitas - despesas (fluxo de caixa)
// Backend garante sinais: income > 0, expense < 0
// Frontend confia nos sinais (sem Math.abs())
if (cat.type === 'income' && cat.vault_type === 'none') {
  cumulativeBalance += amount  // Receitas aumentam (já é positivo)
} else if (cat.type === 'expense' && cat.vault_type === 'none') {
  cumulativeBalance -= -amount  // Despesas diminuem (converte negativo para positivo)
}
// Vault NÃO altera (património não muda, apenas composição)
```

**Regra:** Apenas fluxo de caixa, sem vault. Confia nos sinais do backend.

---

## 🔒 Validações Críticas

### Backend (`transactions.py`)

```python
# Receitas regulares
if category.type == 'income' and category.vault_type == 'none':
    if amount_cents < 0:  # ❌ ERRO
        raise HTTPException(400, "Receitas devem ser positivas")

# Despesas regulares
if category.type == 'expense' and category.vault_type == 'none':
    if amount_cents > 0:  # ❌ ERRO
        raise HTTPException(400, "Despesas devem ser negativas")

# Vault: permite qualquer sinal válido
if category.vault_type != 'none':
    # Depósito > 0, Resgate < 0 (validado na lógica de saldo)
    pass
```

---

## 📋 Checklist de Cálculos

### ✅ O que está correto:

- [x] Vault excluído de receitas/despesas
- [x] Vault excluído do daily allowance
- [x] Vault excluído de limites de categorias
- [x] Saving rate com clamp (-100% a 100%)
- [x] Net worth = vault + cash disponível
- [x] Cumulative balance sem vault
- [x] Validação de sinais no backend
- [x] Health score melhorado

### ⚠️ Limitações conhecidas:

- [x] Opening balance adicionado ao modelo (precisa migração)
- [ ] Daily allowance ainda usa budget-based (será cash-based)
- [ ] Net worth precisa usar opening balance (já no modelo)
- [ ] Health score baseado apenas em saving rate

---

## 🎯 Exemplos Rápidos

### Exemplo 1: Depósito no Vault
```
Transação: amount_cents = 10000 (100€)
Categoria: vault_type = 'emergency'

Resultado:
✅ Vault: +100€
✅ Income: 0€ (não afeta)
✅ Expenses: 0€ (não afeta)
✅ Daily Allowance: Não muda
```

### Exemplo 2: Receita Regular
```
Transação: amount_cents = 200000 (2000€)
Categoria: type = 'income', vault_type = 'none'

Resultado:
✅ Income: +2000€
✅ Expenses: 0€
✅ Vault: 0€ (não afeta)
✅ Daily Allowance: Aumenta
✅ Cumulative Balance: +2000€
```

### Exemplo 3: Despesa Regular
```
Transação: amount_cents = -5000 (-50€)
Categoria: type = 'expense', vault_type = 'none'

Resultado:
✅ Income: 0€
✅ Expenses: +50€
✅ Vault: 0€ (não afeta)
✅ Daily Allowance: Diminui
✅ Cumulative Balance: -50€
```

---

## 🔑 Pontos-Chave

1. **Vault é dinheiro parado** → Não é receita nem despesa
2. **Sinais são obrigatórios** → Backend valida e rejeita erros
3. **Confiar no backend** → Frontend não usa Math.abs() nos cálculos, apenas em UI
4. **Net Worth = Vault + Cash** → Cash = opening balance + income - expenses
5. **Saving Rate com threshold** → Se income < 1€, não é representativo (savingRate = 0)
6. **Daily Allowance cash-based** → Baseado em cash real, não em orçamento

---

**Documento completo:** Ver `CALCULOS_EXPLICACAO.md`  
**Roadmap de melhorias:** Ver `ROADMAP_MELHORIAS.md`

