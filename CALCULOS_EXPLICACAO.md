# 📊 Explicação Completa dos Cálculos do Projeto Finly

**Última atualização:** 2025-01-27 (após correção de bugs críticos)

## ⚠️ AVISO IMPORTANTE

Este documento documenta o estado **ATUAL** dos cálculos após as correções implementadas. Todas as validações e regras descritas estão ativas no código.

## Índice
1. [Sistema de Transações](#sistema-de-transações)
2. [Validações de Dados](#validações-de-dados)
3. [Cálculos de Receitas e Despesas](#cálculos-de-receitas-e-despesas)
4. [Cálculos do Vault (Cofre)](#cálculos-do-vault-cofre)
5. [Cálculos de Património](#cálculos-de-património)
6. [Cálculos de Saving Rate](#cálculos-de-saving-rate)
7. [Cálculos de Daily Allowance](#cálculos-de-daily-allowance)
8. [Cálculos do FIRE](#cálculos-do-fire)
9. [Cálculos de Categorias e Limites](#cálculos-de-categorias-e-limites)
10. [Cálculos de Recurring Transactions](#cálculos-de-recurring-transactions)
11. [Cálculos de Analytics](#cálculos-de-analytics)
12. [Regras Críticas e Validações](#regras-críticas-e-validações)

---

## Sistema de Transações

### Formato de Dados
- **`amount_cents`**: Valor da transação em cêntimos (inteiro)
- **Sinal do `amount_cents`** (REGRA ÚNICA E OBRIGATÓRIA):
  - **Positivo (`> 0`)**: Receita OU Depósito no Vault
  - **Negativo (`< 0`)**: Despesa OU Resgate do Vault

### Tipos de Transações

#### 1. Receitas Regulares
```typescript
// Categoria: type === 'income' && vault_type === 'none'
// amount_cents > 0 (OBRIGATÓRIO - validado no backend)
// Exemplo: Salário de 2000€ = amount_cents: 200000
```

#### 2. Despesas Regulares
```typescript
// Categoria: type === 'expense' && vault_type === 'none'
// amount_cents < 0 (OBRIGATÓRIO - validado no backend)
// Exemplo: Compra de 50€ = amount_cents: -5000
```

#### 3. Depósitos no Vault
```typescript
// Categoria: vault_type === 'emergency' || vault_type === 'investment'
// amount_cents > 0 (positivo)
// Exemplo: Depositar 100€ no fundo de emergência = amount_cents: 10000
```

#### 4. Resgates do Vault
```typescript
// Categoria: vault_type === 'emergency' || vault_type === 'investment'
// amount_cents < 0 (negativo)
// Exemplo: Retirar 50€ do fundo de emergência = amount_cents: -5000
```

---

## Validações de Dados

### Backend (`transactions.py`)

```python
# VALIDAÇÃO CRÍTICA: Regra única de sinais
# income → amount_cents > 0
# expense → amount_cents < 0
# vault deposit → amount_cents > 0
# vault withdraw → amount_cents < 0

if category:
    if category.type == 'income' and category.vault_type == 'none':
        # Receita regular deve ser positiva
        if transaction_in.amount_cents < 0:
            raise HTTPException(
                status_code=400, 
                detail=f'Receitas devem ter amount_cents positivo. Recebido: {transaction_in.amount_cents}'
            )
    elif category.type == 'expense' and category.vault_type == 'none':
        # Despesa regular deve ser negativa
        if transaction_in.amount_cents > 0:
            raise HTTPException(
                status_code=400, 
                detail=f'Despesas devem ter amount_cents negativo. Recebido: {transaction_in.amount_cents}'
            )
```

**Regras:**
- ✅ Receitas com `amount_cents < 0` → **ERRO** (rejeitado)
- ✅ Despesas com `amount_cents > 0` → **ERRO** (rejeitado)
- ✅ Validação acontece **antes** de gravar na base de dados
- ✅ Previne bugs silenciosos nos cálculos

---

## Cálculos de Receitas e Despesas

### Dashboard (`dashboard/page.tsx`)

```typescript
let income = 0;
let expenses = 0;
let vault = 0;

transactions.forEach((t) => {
  const cat = categoryMap[t.category_id];
  if (cat) {
    const amount = Math.abs(Number(t.amount_cents || 0) / 100);
    const isVaultTransaction = cat.vault_type !== 'none';
    
    if (isVaultTransaction) {
      // Vault: positivo = depósito, negativo = resgate
      if (t.amount_cents > 0) vault += amount;
      else vault -= amount;
    } else {
      // Apenas adicionar ao cat.total se NÃO for vault
      cat.total += amount;
      
      if (cat.type === 'income') {
        income += amount;
      } else {
        expenses += amount;
      }
    }
  }
});
```

**Regras:**
- ✅ Receitas: Apenas categorias `type === 'income'` e `vault_type === 'none'`
- ✅ Despesas: Apenas categorias `type === 'expense'` e `vault_type === 'none'`
- ✅ Vault: Excluído dos cálculos de receitas/despesas (dinheiro parado)
- ✅ `cat.total` não inclui transações de vault (não conta para limites)

### Analytics (`analytics/page.tsx`)

```typescript
let periodIncome = 0;
let periodExpenses = 0;

filteredTransactions.forEach((t) => {
  const cat = categories.find(c => c.id === t.category_id);
  
  // Excluir vault dos cálculos de fluxo
  if (cat && cat.vault_type !== 'none') return;
  
  const amount = t.amount_cents / 100;
  
  if (cat?.type === 'income') {
    periodIncome += Math.abs(amount); // Garantir positivo
  } else {
    periodExpenses += Math.abs(amount); // Garantir positivo
  }
});
```

**Regras:**
- ✅ Vault transactions são **excluídas** dos cálculos de receitas/despesas
- ✅ Usa `Math.abs()` para garantir valores positivos (mesmo com validação no backend)

### Transactions Page (`transactions/page.tsx`)

```typescript
const income = transactions
  .filter(t => {
    const cat = categories.find(c => c.id === t.category_id);
    return cat?.type === 'income' && cat?.vault_type === 'none';
  })
  .reduce((acc, curr) => acc + Math.abs(curr.amount_cents), 0);

const expenses = transactions
  .filter(t => {
    const cat = categories.find(c => c.id === t.category_id);
    return cat?.type === 'expense' && cat?.vault_type === 'none';
  })
  .reduce((acc, curr) => acc + Math.abs(curr.amount_cents), 0);
```

**Regras:**
- ✅ Filtra explicitamente por `vault_type === 'none'`
- ✅ Usa `Math.abs()` para garantir valores positivos

---

## Cálculos do Vault (Cofre)

### Lógica Principal

**IMPORTANTE:** O vault é dinheiro parado (poupança/investimento), não é receita nem despesa.

```typescript
// Depósito no Vault
if (t.amount_cents > 0 && cat.vault_type !== 'none') {
  vaultTotal += t.amount_cents / 100; // Aumenta o vault
}

// Resgate do Vault
if (t.amount_cents < 0 && cat.vault_type !== 'none') {
  vaultTotal -= Math.abs(t.amount_cents / 100); // Diminui o vault
}
```

### Vault Page (`vault/page.tsx`)

```typescript
let emergencyTotal = 0;
let investmentTotal = 0;

sortedTransactions.forEach((t) => {
  const cat = categories.find(c => c.id === t.category_id);
  
  if (cat?.vault_type === 'emergency') {
    if (t.amount_cents > 0) {
      emergencyTotal += t.amount_cents / 100; // Depósito
    } else {
      emergencyTotal -= Math.abs(t.amount_cents / 100); // Resgate
    }
  }
  
  if (cat?.vault_type === 'investment') {
    if (t.amount_cents > 0) {
      investmentTotal += t.amount_cents / 100; // Depósito
    } else {
      investmentTotal -= Math.abs(t.amount_cents / 100); // Resgate
    }
  }
});
```

### Backend Insights (`insights.py`)

```python
def calculate_totals(txs):
    vault = 0
    for t in txs:
        cat = cat_map.get(t.category_id)
        if cat and cat.vault_type != 'none':
            if t.amount_cents > 0:
                # Depósito: adicionar valor
                vault += t.amount_cents / 100
            else:
                # Resgate: subtrair valor absoluto
                vault -= abs(t.amount_cents / 100)
    return vault
```

**Regras:**
- ✅ Depósitos (`amount_cents > 0`) **aumentam** o vault
- ✅ Resgates (`amount_cents < 0`) **diminuem** o vault
- ✅ Vault **não é incluído** em receitas/despesas
- ✅ Vault **não é subtraído** do daily allowance
- ✅ Vault **não conta** para limites de categorias

---

## Cálculos de Património

### Cumulative Balance (Analytics)

```typescript
let cumulativeBalance = 0;

sortedAll.forEach((t) => {
  const cat = categories.find(c => c.id === t.category_id);
  const amount = t.amount_cents / 100;
  
  // VALIDAÇÃO EXPLÍCITA: Apenas receitas e despesas regulares
  if (cat?.type === 'income' && cat?.vault_type === 'none') {
    // Receitas aumentam o património
    cumulativeBalance += Math.abs(amount);
  } else if (cat?.type === 'expense' && cat?.vault_type === 'none') {
    // Despesas de consumo diminuem o património
    cumulativeBalance -= Math.abs(amount);
  }
  // Vault transactions NÃO alteram o cumulativeBalance
  // Porque: depósito = dinheiro sai do saldo mas fica no vault (património não muda)
  //         resgate = dinheiro volta ao saldo (património não muda)
  // Categorias desconhecidas ou mal configuradas também não alteram
});
```

**Regras:**
- ✅ Receitas: `+Math.abs(amount)` (apenas se `type === 'income'` e `vault_type === 'none'`)
- ✅ Despesas: `-Math.abs(amount)` (apenas se `type === 'expense'` e `vault_type === 'none'`)
- ✅ Vault: **NÃO incluído** (património não muda, apenas muda a composição)
- ✅ **Validação explícita** previne bugs silenciosos com categorias mal configuradas

### Net Worth (FIRE) - CORRIGIDO

```typescript
let totalVault = 0;

// Calcular vault total (todos os tempos)
transactions.forEach((t) => {
  const cat = catMap[t.category_id];
  if (cat && cat.vault_type !== 'none') {
    if (t.amount_cents > 0) {
      totalVault += t.amount_cents / 100; // Depósito
    } else {
      totalVault -= Math.abs(t.amount_cents / 100); // Resgate
    }
  }
});

// Calcular cash disponível (receitas - despesas deste mês)
const availableCash = Math.max(0, income - expenses);

// Net Worth = Vault + Cash disponível
const netWorth = totalVault + availableCash;
```

**Regras:**
- ✅ Net Worth = Vault Total + Cash Disponível
- ✅ Cash Disponível = `income - expenses` (deste mês)
- ✅ Utilizadores sem vault não ficam com net worth = 0
- ✅ Reflete melhor o património real

---

## Cálculos de Saving Rate

### Fórmula Base (com Clamp)

```typescript
let savingRate = 0;
if (income > 0) {
  const calculated = ((income - expenses) / income) * 100;
  savingRate = Math.max(-100, Math.min(100, calculated)); // Clamp entre -100% e 100%
}
```

### Exemplo
- Receitas: 2000€
- Despesas: 1500€
- Saving Rate = ((2000 - 1500) / 2000) * 100 = **25%**

### Casos Extremos (Protegidos)

```typescript
// Caso 1: Défice
// Receitas: 1000€, Despesas: 1500€
// Calculado: ((1000 - 1500) / 1000) * 100 = -50%
// Clamp: Math.max(-100, Math.min(100, -50)) = -50% ✅

// Caso 2: Défice extremo
// Receitas: 100€, Despesas: 500€
// Calculado: ((100 - 500) / 100) * 100 = -400%
// Clamp: Math.max(-100, Math.min(100, -400)) = -100% ✅ (limitado)

// Caso 3: Sem receitas
// Receitas: 0€
// savingRate = 0 ✅
```

**Regras:**
- ✅ Clamp entre **-100%** e **100%** (previne valores extremos)
- ✅ Usa apenas receitas/despesas do período selecionado
- ✅ Vault **não é incluído** (não é receita nem despesa)
- ✅ Se `income === 0`, retorna `0`

---

## Cálculos de Daily Allowance

### Dashboard (`dashboard/page.tsx`)

```typescript
const now = new Date();
const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const daysPassed = now.getDate();
const daysLeft = Math.max(1, daysInMonth - daysPassed);

// Orçamento total = receitas OU limites de categorias
const totalBudget = income > 0 ? income : totalLimits;

// IMPORTANTE: Vault NÃO é subtraído (é dinheiro parado)
const remainingMoney = Math.max(0, totalBudget - expenses);
const dailyAllowance = remainingMoney / daysLeft;

// NOTA: Daily Allowance atual ignora cash flow real (saldo inicial, meses anteriores)
// Para versão PRO: dailyAllowance = availableCash / daysLeft
// onde availableCash = saldo inicial + (income - expenses acumulado)
```

**Regras:**
- ✅ `totalBudget` = Receitas OU soma de limites de categorias
- ✅ `remainingMoney` = `totalBudget - expenses` (vault **não é subtraído**)
- ✅ `dailyAllowance` = `remainingMoney / daysLeft`
- ⚠️ **Limitação conhecida**: Ignora saldo inicial e meses anteriores
- 💡 **Melhoria futura (PRO)**: `dailyAllowance = availableCash / daysLeft`

### Exemplo
- Receitas: 2000€
- Despesas: 800€
- Vault: 500€ (depositado)
- Dias restantes: 15
- Daily Allowance = (2000 - 800) / 15 = **80€/dia**

---

## Cálculos do FIRE

### FIRE Number (Capital Alvo)

```typescript
const monthlySaving = monthlyIncome - monthlyExpenses;
const annualExpenses = monthlyExpenses * 12;
const fireTarget = annualExpenses / (withdrawalRate / 100);
```

**Fórmula:** `FIRE Number = Despesas Anuais / Taxa de Levantamento`

### Exemplo
- Despesas mensais: 2000€
- Despesas anuais: 24.000€
- Taxa de levantamento (SWR): 4%
- FIRE Number = 24.000 / 0.04 = **600.000€**

### Years to FIRE

```typescript
let currentWealth = currentNetWorth; // Vault + Cash disponível
const fireTarget = annualExpenses / (withdrawalRate / 100);
let years = 0;

while (currentWealth < fireTarget && years < maxYears) {
  // Aplicar retorno do mercado
  currentWealth = currentWealth * (1 + expectedReturn / 100);
  // Adicionar poupança anual
  currentWealth += monthlySaving * 12;
  years++;
}
```

**Fórmula Iterativa:**
1. Aplicar retorno do mercado: `wealth = wealth * (1 + return%)`
2. Adicionar poupança anual: `wealth += monthlySaving * 12`
3. Repetir até `wealth >= fireTarget`

### Monthly Fire Income

```typescript
const monthlyFireIncome = (fireTarget * (withdrawalRate / 100)) / 12;
```

**Fórmula:** `Rendimento Mensal FIRE = (FIRE Number * SWR) / 12`

---

## Cálculos de Categorias e Limites

### Total Gasto por Categoria

```typescript
const categoryMap = categories.reduce((acc, cat) => {
  acc[cat.id] = { ...cat, total: 0 };
  return acc;
}, {});

transactions.forEach((t) => {
  const cat = categoryMap[t.category_id];
  if (cat) {
    const amount = Math.abs(Number(t.amount_cents || 0) / 100);
    
    // IMPORTANTE: Vault transactions NÃO contam para cat.total
    const isVaultTransaction = cat.vault_type !== 'none';
    
    if (!isVaultTransaction) {
      cat.total += amount; // Apenas transações regulares
    }
  }
});
```

**Regras:**
- ✅ `cat.total` = soma de todas as transações da categoria
- ✅ Vault transactions **NÃO são incluídas** (não contam para limites)
- ✅ Usa `Math.abs()` para garantir valores positivos

### Progresso do Limite

```typescript
const limit = cat.monthly_limit_cents / 100;
const currentSpent = categoryMap[cat.id]?.total || 0;
const progress = (currentSpent / limit) * 100;

if (progress >= 100) {
  // Limite excedido
  const overAmount = currentSpent - limit;
}
```

**Regras:**
- ✅ `progress` = `(gasto atual / limite) * 100`
- ✅ Alerta quando `progress >= 100%`
- ✅ `overAmount` = `currentSpent - limit` (quanto excedeu)

---

## Cálculos de Recurring Transactions

### Totais de Receitas/Despesas Fixas (CORRIGIDO)

```typescript
// IMPORTANTE: Filtrar por vault_type === 'none' para excluir vault transactions
const recurringIncomes = recurring.filter(r => {
  const cat = categories.find(c => c.id === r.category_id);
  return cat && cat.type === 'income' && cat.vault_type === 'none';
});

const recurringExpenses = recurring.filter(r => {
  const cat = categories.find(c => c.id === r.category_id);
  // Apenas despesas regulares (não vault)
  return cat && cat.type === 'expense' && cat.vault_type === 'none';
});

const totalIncomes = recurringIncomes.reduce(
  (acc, curr) => acc + Math.abs(curr.amount_cents), 
  0
);

const totalExpenses = recurringExpenses.reduce(
  (acc, curr) => acc + Math.abs(curr.amount_cents), 
  0
);

const netZen = totalIncomes - totalExpenses;
```

**Regras:**
- ✅ Filtra explicitamente por `vault_type === 'none'`
- ✅ Usa `Math.abs()` para garantir valores positivos
- ✅ `netZen` = receitas fixas - despesas fixas (saldo líquido)
- ✅ **Corrigido**: Vault transactions não poluem os cálculos

---

## Cálculos de Analytics

### Health Score (MELHORADO)

```typescript
// Validações melhoradas para evitar scores inválidos
let dynamicScore = 70; // Base neutra

if (periodIncome > 0) {
  if (periodExpenses > periodIncome) {
    // Défice: score baixo (penaliza défices grandes)
    dynamicScore = Math.max(10, 30 - Math.min(20, Math.abs(savingRate) / 5));
  } else if (savingRate > 20) {
    dynamicScore = 90; // Excelente poupança
  } else if (savingRate > 10) {
    dynamicScore = 75; // Boa poupança
  } else if (savingRate > 0) {
    dynamicScore = 60; // Poupança positiva mas baixa
  } else {
    // savingRate <= 0 mas expenses <= income (pode acontecer com clamp)
    dynamicScore = 50;
  }
} else if (periodIncome === 0 && periodExpenses > 0) {
  // Sem receitas mas há despesas
  dynamicScore = 20;
}
```

**Regras:**
- ✅ Base: 70 pontos
- ✅ Défice (`expenses > income`): 10-30 pontos (penaliza défices grandes)
- ✅ Saving Rate > 20%: 90 pontos
- ✅ Saving Rate > 10%: 75 pontos
- ✅ Saving Rate > 0%: 60 pontos
- ✅ Sem receitas mas há despesas: 20 pontos

### Category Distribution

```typescript
const catDistribution = {};

filteredTransactions.forEach((t) => {
  const cat = categories.find(c => c.id === t.category_id);
  
  // Excluir vault
  if (cat && cat.vault_type !== 'none') return;
  
  if (cat) {
    const absAmount = Math.abs(t.amount_cents / 100);
    catDistribution[cat.name] = (catDistribution[cat.name] || 0) + absAmount;
  }
});
```

**Regras:**
- ✅ Agrupa despesas por categoria
- ✅ Vault **excluído**
- ✅ Usa `Math.abs()` para valores positivos

### Weekly Rhythm

```typescript
const weeklyRhythm = {
  [weekDays.mon]: 0,
  [weekDays.tue]: 0,
  // ...
};

filteredTransactions.forEach((t) => {
  const date = new Date(t.transaction_date);
  const dayName = weekMap[date.getDay()];
  const absAmount = Math.abs(t.amount_cents / 100);
  
  // Apenas despesas, excluir vault
  if (cat && cat.vault_type === 'none' && cat.type === 'expense') {
    weeklyRhythm[dayName] += absAmount;
  }
});
```

**Regras:**
- ✅ Agrupa despesas por dia da semana
- ✅ Vault **excluído**
- ✅ Apenas despesas regulares

---

## Regras Críticas e Validações

### ✅ Regra Única de Sinais (OBRIGATÓRIA)

**Definida uma vez, validada no backend:**

```
income          → amount_cents > 0  (OBRIGATÓRIO)
expense         → amount_cents < 0  (OBRIGATÓRIO)
vault deposit   → amount_cents > 0
vault withdraw  → amount_cents < 0
```

**Validação no Backend:**
- ✅ Receitas com `amount_cents < 0` → **ERRO 400** (rejeitado)
- ✅ Despesas com `amount_cents > 0` → **ERRO 400** (rejeitado)
- ✅ Previne bugs silenciosos nos cálculos

### ✅ Vault (Cofre)

1. **Depósitos**: `amount_cents > 0` → Aumenta o vault
2. **Resgates**: `amount_cents < 0` → Diminui o vault
3. **NÃO é incluído** em receitas/despesas
4. **NÃO é subtraído** do daily allowance
5. **NÃO conta** para limites de categorias
6. **NÃO altera** o cumulative balance (património não muda)

### ✅ Receitas e Despesas

1. **Filtrar** por `vault_type === 'none'`
2. **Usar** `Math.abs()` para garantir valores positivos (mesmo com validação)
3. **Receitas**: `type === 'income'` e `amount_cents > 0`
4. **Despesas**: `type === 'expense'` e `amount_cents < 0`

### ✅ Cálculos Financeiros

1. **Saving Rate**: `(income - expenses) / income * 100` (clamp -100% a 100%)
2. **Daily Allowance**: `(totalBudget - expenses) / daysLeft`
3. **FIRE Number**: `annualExpenses / withdrawalRate`
4. **Cumulative Balance**: Apenas receitas - despesas (sem vault, validação explícita)
5. **Net Worth**: Vault Total + Cash Disponível

### ✅ Validações Implementadas

1. **Backend**: Validação de sinais antes de gravar
2. **Cumulative Balance**: Validação explícita de `type === 'expense'`
3. **Saving Rate**: Clamp entre -100% e 100%
4. **Health Score**: Validações para casos extremos
5. **Recurring**: Filtro por `vault_type === 'none'`

---

## Exemplos Práticos

### Exemplo 1: Depósito no Vault
```
Transação: amount_cents = 10000 (100€)
Categoria: vault_type = 'emergency'

Resultado:
- Vault Emergency: +100€
- Income: 0€ (não afeta)
- Expenses: 0€ (não afeta)
- Daily Allowance: Não muda
- Cumulative Balance: Não muda
```

### Exemplo 2: Resgate do Vault
```
Transação: amount_cents = -5000 (-50€)
Categoria: vault_type = 'emergency'

Resultado:
- Vault Emergency: -50€
- Income: 0€ (não afeta)
- Expenses: 0€ (não afeta)
- Daily Allowance: Não muda
- Cumulative Balance: Não muda
```

### Exemplo 3: Receita Regular
```
Transação: amount_cents = 200000 (2000€)
Categoria: type = 'income', vault_type = 'none'

Resultado:
- Income: +2000€
- Expenses: 0€
- Vault: 0€ (não afeta)
- Daily Allowance: Aumenta
- Cumulative Balance: +2000€
```

### Exemplo 4: Despesa Regular
```
Transação: amount_cents = -5000 (-50€)
Categoria: type = 'expense', vault_type = 'none'

Resultado:
- Income: 0€
- Expenses: +50€
- Vault: 0€ (não afeta)
- Daily Allowance: Diminui
- Cumulative Balance: -50€
```

### Exemplo 5: Net Worth Completo
```
Vault Total: 5000€
Income este mês: 2000€
Expenses este mês: 1500€
Cash Disponível: 2000 - 1500 = 500€

Net Worth = 5000 + 500 = 5500€
```

---

## Limitações Conhecidas

### 1. Daily Allowance
- ⚠️ **Atual**: Ignora saldo inicial e meses anteriores
- 💡 **Melhoria futura (PRO)**: `dailyAllowance = availableCash / daysLeft`
  - onde `availableCash = saldo inicial + (income - expenses acumulado)`

### 2. Net Worth Simplificado
- ⚠️ **Atual**: `netWorth = vaultTotal + availableCash` (apenas deste mês)
- 💡 **Melhoria futura**: Incluir saldo inicial e histórico completo

### 3. Health Score
- ⚠️ **Atual**: Baseado apenas em saving rate e défice
- 💡 **Melhoria futura**: Incluir consistência, vault growth, despesas fixas vs variáveis

### 4. Transferências
- ⚠️ **Atual**: Não existe conceito de transferência
- 💡 **Melhoria futura**: Adicionar `transaction_kind: 'transfer'` para:
  - Conta A → Conta B
  - Carteira → Banco
  - Banco → Investimentos

---

## Resumo das Correções Implementadas

### ✅ Correções Aplicadas (2025-01-27)

1. **Validação de Sinais no Backend**
   - Receitas: `amount_cents > 0` (obrigatório)
   - Despesas: `amount_cents < 0` (obrigatório)
   - Erro 400 se sinal incorreto

2. **Cumulative Balance Corrigido**
   - Validação explícita: `type === 'expense' && vault_type === 'none'`
   - Previne bugs silenciosos com categorias mal configuradas

3. **Saving Rate com Clamp**
   - Clamp entre -100% e 100%
   - Previne valores extremos que quebram gráficos

4. **Net Worth Corrigido**
   - `netWorth = vaultTotal + availableCash`
   - Utilizadores sem vault não ficam com net worth = 0

5. **Health Score Melhorado**
   - Validações para casos extremos
   - Penaliza défices grandes
   - Trata casos sem receitas

6. **Recurring Transactions Corrigido**
   - Filtra por `vault_type === 'none'`
   - Exclui transações de vault dos cálculos

7. **Daily Allowance Documentado**
   - Comentário sobre limitação atual
   - Nota para versão PRO

---

**Documento criado em:** 2025-01-27  
**Última atualização:** 2025-01-27 (após correção de bugs críticos)  
**Versão:** 2.0 (com todas as validações e correções)
