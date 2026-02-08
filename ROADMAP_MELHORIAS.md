# Roadmap de Melhorias - Finly

**Data:** 2025-01-27  
**Versão atual:** 2.0 (após correções de bugs críticos)

---

## 📋 Índice

1. [Prioridade 1: Arquitetura e Consistência](#prioridade-1-arquitetura-e-consistência)
2. [Prioridade 2: Produto e Realismo Financeiro](#prioridade-2-produto-e-realismo-financeiro)
3. [Prioridade 3: Modelação Financeira](#prioridade-3-modelação-financeira)
4. [Prioridade 4: Analytics e UX](#prioridade-4-analytics-e-ux)
5. [Prioridade 5: Qualidade e Confiança](#prioridade-5-qualidade-e-confiança)

---

## 🔥 PRIORIDADE 1: Arquitetura e Consistência

### 1️⃣ Centralizar TODA a lógica financeira num único sítio

#### Problema Atual

- ✅ Cálculos no frontend (`dashboard/page.tsx`, `analytics/page.tsx`, `fire/page.tsx`)
- ✅ Cálculos no backend (`insights.py`, `transactions.py`)
- ✅ Lógica repetida (income, expenses, vault, net worth, saving rate, etc.)

#### ⚠️ Riscos

- Um bug corrigido num lado pode ficar errado noutro
- Difícil manter quando crescer (PRO, relatórios, exports)
- Inconsistências entre páginas
- Duplicação de código

#### ✅ Solução: Financial Engine no Backend

**Criar um módulo centralizado:**

```python
# backend/app/core/financial_engine.py

from dataclasses import dataclass
from typing import List
from ..models import database as models

@dataclass
class FinancialSnapshot:
    """Snapshot financeiro completo calculado uma vez"""
    income: float
    expenses: float
    vault_total: float
    vault_emergency: float
    vault_investment: float
    available_cash: float
    net_worth: float
    saving_rate: float
    cumulative_balance: float
    
    # Métricas adicionais
    period_start: date
    period_end: date
    transaction_count: int

class FinancialEngine:
    """Motor financeiro único - fonte de verdade"""
    
    @staticmethod
    def calculate_snapshot(
        transactions: List[models.Transaction],
        categories: List[models.Category],
        period_start: date = None,
        period_end: date = None
    ) -> FinancialSnapshot:
        """
        Calcula snapshot financeiro completo.
        ÚNICA fonte de verdade para todos os cálculos.
        """
        # Filtrar por período se fornecido
        if period_start or period_end:
            transactions = [
                t for t in transactions
                if (not period_start or t.transaction_date >= period_start)
                and (not period_end or t.transaction_date <= period_end)
            ]
        
        # Criar mapas de categorias
        cat_map = {c.id: c for c in categories}
        
        # Inicializar totais
        income = 0.0
        expenses = 0.0
        vault_emergency = 0.0
        vault_investment = 0.0
        cumulative_balance = 0.0
        
        # Processar transações
        for t in transactions:
            cat = cat_map.get(t.category_id)
            if not cat:
                continue
            
            amount = t.amount_cents / 100
            
            # Vault transactions
            if cat.vault_type == 'emergency':
                if t.amount_cents > 0:
                    vault_emergency += amount
                else:
                    vault_emergency -= abs(amount)
            elif cat.vault_type == 'investment':
                if t.amount_cents > 0:
                    vault_investment += amount
                else:
                    vault_investment -= abs(amount)
            
            # Receitas e despesas regulares
            elif cat.type == 'income' and cat.vault_type == 'none':
                income += abs(amount)
                cumulative_balance += abs(amount)
            elif cat.type == 'expense' and cat.vault_type == 'none':
                expenses += abs(amount)
                cumulative_balance -= abs(amount)
        
        vault_total = vault_emergency + vault_investment
        available_cash = max(0, income - expenses)
        net_worth = vault_total + available_cash
        
        saving_rate = 0.0
        if income > 0:
            calculated = ((income - expenses) / income) * 100
            saving_rate = max(-100, min(100, calculated))
        
        return FinancialSnapshot(
            income=income,
            expenses=expenses,
            vault_total=vault_total,
            vault_emergency=vault_emergency,
            vault_investment=vault_investment,
            available_cash=available_cash,
            net_worth=net_worth,
            saving_rate=saving_rate,
            cumulative_balance=cumulative_balance,
            period_start=period_start or min(t.transaction_date for t in transactions),
            period_end=period_end or max(t.transaction_date for t in transactions),
            transaction_count=len(transactions)
        )
```

**Frontend apenas consome:**

```typescript
// frontend - apenas consome resultados
const snapshot = await api.get('/financial/snapshot', {
  params: { period_start, period_end }
});

// snapshot.income, snapshot.expenses, snapshot.net_worth, etc.
// Zero lógica financeira crítica no frontend
```

#### 📈 Impacto

- **Escalabilidade:** ALTO
- **Menos bugs:** ALTO
- **Confiança nos números:** ALTO
- **Manutenibilidade:** ALTO

#### 🎯 Implementação

1. Criar `FinancialEngine` no backend
2. Criar endpoint `/financial/snapshot`
3. Migrar cálculos do frontend para usar o endpoint
4. Remover lógica duplicada
5. Adicionar testes unitários

---

### 2️⃣ Parar de usar Math.abs() como muleta

#### Problema Atual

- Validação correta no backend ✅
- Mas frontend ainda usa `Math.abs()` em quase todo o lado
- Esconde bugs se algum dia entra um dado inválido
- Dificulta debug

#### ✅ Solução: Confiar nos Sinais do Backend

**Antes (atual):**
```typescript
// Usa Math.abs() em todo o lado
const amount = Math.abs(Number(t.amount_cents || 0) / 100);
income += amount;
expenses += amount; // Mesmo cálculo para ambos
```

**Depois (melhorado):**
```typescript
// Backend garante sinais corretos
// Receitas: amount_cents > 0
// Despesas: amount_cents < 0

if (cat.type === 'income') {
  income += t.amount_cents / 100; // Já é positivo
} else if (cat.type === 'expense') {
  expenses += -t.amount_cents / 100; // Converte negativo para positivo
}
```

**Ou melhor ainda (com Financial Engine):**
```typescript
// Frontend não calcula nada, apenas consome
const snapshot = await api.get('/financial/snapshot');
// snapshot.income já vem correto
// snapshot.expenses já vem correto
```

#### 📈 Impacto

- **Código mais correto:** MÉDIO-ALTO
- **Debug mais fácil:** MÉDIO
- **Confiança:** MÉDIO

#### 🎯 Implementação

1. Remover `Math.abs()` de cálculos internos
2. Manter apenas em UI (formatação)
3. Assumir sinais corretos do backend
4. Adicionar validação de runtime no frontend (dev mode)

---

## PRIORIDADE 2: Produto e Realismo Financeiro

### 3️⃣ Introduzir conceito de Accounts (Contas)

#### Problema Atual

- Vault existe
- Cash implícito (income - expenses)
- Mas na vida real há múltiplas contas

#### ✅ Solução: Sistema de Contas

**Modelo de Dados:**

```python
# backend/app/models/database.py

class Account(Base):
    __tablename__ = 'accounts'
    
    id = Column(UUID, primary_key=True)
    workspace_id = Column(UUID, ForeignKey('workspaces.id'))
    name = Column(String, nullable=False)  # "Conta Principal", "Revolut", etc.
    account_type = Column(String, nullable=False)  # 'bank', 'wallet', 'investment', 'vault'
    initial_balance_cents = Column(Integer, default=0)
    currency = Column(String, default='EUR')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
```

**Transações ligadas a contas:**

```python
class Transaction(Base):
    # ... campos existentes ...
    account_id = Column(UUID, ForeignKey('accounts.id'), nullable=True)
    # Se null, usa conta padrão (compatibilidade)
```

**Vault passa a ser uma conta especial:**

```python
# Vault é apenas uma conta com account_type='vault'
# Não precisa de lógica especial
```

**Benefícios:**

- ✅ Transferências reais (conta A → conta B)
- ✅ Net worth REAL (soma de todas as contas)
- ✅ Cash flow correto (por conta)
- ✅ Relatórios por conta

#### 📈 Impacto

- **Realismo financeiro:** MUITO ALTO
- **Produto sério:** MUITO ALTO
- **Funcionalidades futuras:** ALTO

#### 🎯 Implementação

1. Criar modelo `Account`
2. Adicionar `account_id` a `Transaction`
3. Migração de dados (criar conta padrão)
4. UI para gerir contas
5. Transferências entre contas

---

### 4️⃣ Resolver definitivamente o Daily Allowance

#### Problema Atual

- Ignora saldo inicial
- Ignora meses anteriores
- Usa income como se fosse dinheiro disponível

**Exemplo do problema:**
```
Income este mês: 100€
Gastos: 0€
Saldo real: 10.000€
→ daily allowance = 3€/dia ❌ (deveria ser muito mais)
```

#### ✅ Solução: Cash Real Disponível

**Criar conceito de Opening Balance:**

```python
class Workspace(Base):
    # ... campos existentes ...
    opening_balance_cents = Column(Integer, default=0)
    opening_balance_date = Column(Date, nullable=True)
```

**Cálculo correto:**

```python
def calculate_daily_allowance(
    workspace: Workspace,
    transactions: List[Transaction],
    categories: List[Category],
    target_date: date = None
) -> float:
    """Calcula daily allowance baseado em cash REAL disponível"""
    
    target_date = target_date or date.today()
    
    # Calcular cash acumulado até hoje
    snapshot = FinancialEngine.calculate_snapshot(
        transactions=transactions,
        categories=categories,
        period_start=workspace.opening_balance_date or date.min,
        period_end=target_date
    )
    
    # Cash disponível = saldo inicial + receitas - despesas
    available_cash = (
        (workspace.opening_balance_cents or 0) / 100 +
        snapshot.income -
        snapshot.expenses
    )
    
    # Calcular dias restantes no mês
    days_in_month = calendar.monthrange(target_date.year, target_date.month)[1]
    days_passed = target_date.day
    days_left = max(1, days_in_month - days_passed)
    
    return max(0, available_cash / days_left)
```

**Versão FREE (simplificada):**
- Opening balance simples (um valor)
- Não precisa de histórico infinito
- Já resolve 90% do problema

**Versão PRO (completa):**
- Histórico completo
- Múltiplas contas
- Projeções futuras

#### 📈 Impacto

- **UX confiável:** ALTO
- **Realismo:** ALTO
- **Satisfação do utilizador:** ALTO

#### 🎯 Implementação

1. Adicionar `opening_balance_cents` ao Workspace
2. Implementar cálculo correto no Financial Engine
3. UI para definir opening balance
4. Atualizar dashboard para usar novo cálculo

---

## 🧠 PRIORIDADE 3: Modelação Financeira

### 5️⃣ Separar claramente 3 conceitos

#### Problema Atual

Conceitos misturados semanticamente:

| Conceito | O que é | Onde está |
|----------|---------|-----------|
| Cash Flow | income - expenses | Analytics, Dashboard |
| Wealth | net worth | FIRE, Analytics |
| Allocation | onde o dinheiro está | Vault, Accounts |

#### ✅ Solução: Separação Clara

**1. Cash Flow → Analytics**
```python
@dataclass
class CashFlow:
    """Fluxo de caixa (entradas - saídas)"""
    income: float
    expenses: float
    net_flow: float  # income - expenses
    saving_rate: float
```

**2. Wealth → Net Worth**
```python
@dataclass
class Wealth:
    """Património total"""
    net_worth: float
    vault_total: float
    available_cash: float
    investments: float
```

**3. Allocation → Vault + Accounts**
```python
@dataclass
class Allocation:
    """Onde o dinheiro está alocado"""
    accounts: Dict[str, float]  # {account_name: balance}
    vault_emergency: float
    vault_investment: float
    total: float
```

**Benefícios:**

- ✅ FIRE usa Wealth
- ✅ Health Score usa Cash Flow
- ✅ Relatórios usam Allocation
- ✅ Código mais claro e manutenível

#### 📈 Impacto

- **Clareza:** MÉDIO-ALTO
- **Manutenibilidade:** MÉDIO-ALTO
- **Extensibilidade:** ALTO

#### 🎯 Implementação

1. Refatorar Financial Engine para retornar 3 objetos separados
2. Atualizar FIRE para usar Wealth
3. Atualizar Health Score para usar Cash Flow
4. Criar visualizações de Allocation

---

### 6️⃣ FIRE: lidar com casos realistas

#### Problema Atual

- Assume saving constante
- Assume return constante
- Assume expenses fixas
- Não lida com casos impossíveis

#### ✅ Melhorias Simples

**1. Detectar FIRE impossível:**

```python
def calculate_fire(
    monthly_income: float,
    monthly_expenses: float,
    current_wealth: float,
    expected_return: float,
    withdrawal_rate: float
) -> FireResult:
    monthly_saving = monthly_income - monthly_expenses
    
    # Se não há poupança, FIRE é impossível
    if monthly_saving <= 0:
        return FireResult(
            is_achievable=False,
            reason="Saving rate negativo ou zero. Aumenta receitas ou reduz despesas.",
            years_to_fire=None,
            fire_target=None
        )
    
    # Resto do cálculo...
```

**2. Permitir crescimento de despesas (inflação):**

```python
def calculate_fire_with_inflation(
    # ... parâmetros ...
    inflation_rate: float = 2.0  # 2% ao ano
) -> FireResult:
    # Ajustar despesas futuras pela inflação
    # fire_target aumenta com o tempo
```

**3. Simular cenários:**

```python
@dataclass
class FireScenarios:
    optimistic: FireResult  # Return 10%, SWR 4%
    base: FireResult        # Return 7%, SWR 4%
    pessimistic: FireResult # Return 5%, SWR 3%
```

#### 📈 Impacto

- **Diferencial de produto:** MÉDIO
- **Realismo:** MÉDIO
- **UX:** MÉDIO

#### 🎯 Implementação

1. Adicionar validação de saving rate
2. Adicionar inflação opcional
3. Criar simulação de cenários
4. UI para comparar cenários

---

## 📊 PRIORIDADE 4: Analytics e UX

### 7️⃣ Health Score menos "mágico"

#### Problema Atual

- Score é um número "mágico"
- Utilizador não sabe porque é 72 ou 45
- Black box

#### ✅ Solução: Breakdown Transparente

**Mostrar componentes do score:**

```python
@dataclass
class HealthScoreBreakdown:
    base_score: int = 50
    saving_rate_bonus: int = 0      # +15 se saving > 20%
    deficit_penalty: int = 0         # -8 se teve défice
    consistency_bonus: int = 0      # +5 se consistente
    vault_growth_bonus: int = 0     # +2 se vault cresceu
    total: int = 0
```

**UI:**

```
Health Score: 72

Breakdown:
+ Base Score: 50
+ Saving Rate (25%): +15
- Défice no mês passado: -8
+ Consistência (3 meses): +5
+ Vault Growth: +10
─────────────────
Total: 72
```

#### 📈 Impacto

- **Transparência:** MÉDIO
- **Confiança:** MÉDIO
- **Educação:** MÉDIO

#### 🎯 Implementação

1. Refatorar cálculo do Health Score
2. Retornar breakdown no backend
3. UI para mostrar breakdown
4. Tooltips explicativos

---

### 8️⃣ Categoria "Transferência"

#### Problema Atual

- Sem transfers, vault parece "dinheiro mágico"
- Contas não fazem sentido sem transfers
- Não há como mover dinheiro entre contas

#### ✅ Solução: Transaction Kind

**Adicionar campo:**

```python
class Transaction(Base):
    # ... campos existentes ...
    transaction_kind = Column(
        String,
        nullable=False,
        default='flow'  # 'flow' | 'transfer'
    )
```

**Lógica:**

```python
# Flow (atual)
if transaction.transaction_kind == 'flow':
    # Afeta income/expenses
    # Afeta cash flow
    # Afeta saving rate

# Transfer
elif transaction.transaction_kind == 'transfer':
    # NÃO afeta income
    # NÃO afeta expenses
    # Só muda allocation (conta A → conta B)
    # Afeta net worth apenas se mudar valor (taxas, etc.)
```

**Exemplos:**

- Transferência entre contas: `kind='transfer'`
- Depósito no vault: `kind='flow'` (é uma despesa que vira poupança)
- Resgate do vault: `kind='flow'` (é uma receita que sai da poupança)

#### 📈 Impacto

- **Base para contas:** ALTO
- **Realismo:** ALTO
- **Funcionalidades futuras:** ALTO

#### 🎯 Implementação

1. Adicionar `transaction_kind` ao modelo
2. Migração de dados (tudo vira 'flow')
3. Lógica para ignorar transfers em cash flow
4. UI para criar transfers

---

## 🧪 PRIORIDADE 5: Qualidade e Confiança

### 9️⃣ Testes automáticos para cálculos

#### Problema Atual

- Zero testes automáticos
- Bugs só aparecem em produção
- Medo de mudar código

#### ✅ Solução: Testes Essenciais

**Criar suite de testes:**

```python
# backend/tests/test_financial_engine.py

import pytest
from app.core.financial_engine import FinancialEngine, FinancialSnapshot

def test_vault_deposit_increases_balance():
    """Depósito no vault aumenta o saldo"""
    transactions = [
        create_transaction(amount_cents=10000, category=vault_category)
    ]
    snapshot = FinancialEngine.calculate_snapshot(transactions, categories)
    assert snapshot.vault_total == 100.0

def test_vault_withdrawal_decreases_balance():
    """Resgate do vault diminui o saldo"""
    # Depósito inicial
    transactions = [
        create_transaction(amount_cents=10000, category=vault_category),
        create_transaction(amount_cents=-5000, category=vault_category)
    ]
    snapshot = FinancialEngine.calculate_snapshot(transactions, categories)
    assert snapshot.vault_total == 50.0

def test_net_worth_includes_vault_and_cash():
    """Net worth = vault + cash disponível"""
    transactions = [
        create_transaction(amount_cents=200000, category=income_category),
        create_transaction(amount_cents=-150000, category=expense_category),
        create_transaction(amount_cents=10000, category=vault_category)
    ]
    snapshot = FinancialEngine.calculate_snapshot(transactions, categories)
    # income: 2000, expenses: 1500, cash: 500
    # vault: 100
    # net worth: 500 + 100 = 600
    assert snapshot.net_worth == 600.0

def test_saving_rate_clamped():
    """Saving rate é limitado entre -100% e 100%"""
    # Défice extremo
    transactions = [
        create_transaction(amount_cents=10000, category=income_category),
        create_transaction(amount_cents=-50000, category=expense_category)
    ]
    snapshot = FinancialEngine.calculate_snapshot(transactions, categories)
    # Calculado: ((100 - 500) / 100) * 100 = -400%
    # Clamp: -100%
    assert snapshot.saving_rate == -100.0

def test_daily_allowance_with_opening_balance():
    """Daily allowance considera saldo inicial"""
    workspace = create_workspace(opening_balance_cents=100000)  # 1000€
    transactions = [
        create_transaction(amount_cents=200000, category=income_category),
        create_transaction(amount_cents=-150000, category=expense_category)
    ]
    # Cash: 1000 (inicial) + 2000 (income) - 1500 (expenses) = 1500€
    # Dias restantes: 15
    # Daily allowance: 1500 / 15 = 100€
    allowance = calculate_daily_allowance(workspace, transactions, categories)
    assert allowance == 100.0
```

**Testes essenciais (mínimo):**

1. ✅ Vault deposit/resgate
2. ✅ Net worth
3. ✅ Saving rate extremos
4. ✅ Daily allowance edge cases
5. ✅ Cumulative balance
6. ✅ Vault excluído de income/expenses
7. ✅ Validação de sinais
8. ✅ Health score breakdown
9. ✅ FIRE impossível
10. ✅ Transfers não afetam cash flow

#### 📈 Impacto

- **Confiança:** ALTO
- **Velocidade de desenvolvimento:** ALTO
- **Prevenção de bugs:** ALTO

#### 🎯 Implementação

1. Configurar pytest
2. Criar fixtures para dados de teste
3. Escrever 10 testes essenciais
4. Integrar no CI/CD
5. Expandir gradualmente

---

### 🔟 Auditoria de dados históricos

#### Problema Atual

- Sem validação de dados históricos
- Bugs podem corromper dados sem detecção
- Difícil detectar inconsistências

#### ✅ Solução: Script de Auditoria

**Criar script de auditoria:**

```python
# backend/scripts/audit_financial_data.py

def audit_workspace(workspace_id: UUID) -> AuditReport:
    """Recalcula tudo do zero e compara com valores guardados"""
    
    # Buscar dados
    transactions = get_all_transactions(workspace_id)
    categories = get_all_categories(workspace_id)
    workspace = get_workspace(workspace_id)
    
    # Recalcular do zero
    snapshot = FinancialEngine.calculate_snapshot(transactions, categories)
    
    # Comparar com valores guardados (se existirem)
    discrepancies = []
    
    # Verificar vault
    stored_vault = get_stored_vault_total(workspace_id)
    if abs(stored_vault - snapshot.vault_total) > 0.01:
        discrepancies.append({
            'field': 'vault_total',
            'stored': stored_vault,
            'calculated': snapshot.vault_total,
            'difference': abs(stored_vault - snapshot.vault_total)
        })
    
    # Verificar net worth
    stored_net_worth = get_stored_net_worth(workspace_id)
    if abs(stored_net_worth - snapshot.net_worth) > 0.01:
        discrepancies.append({
            'field': 'net_worth',
            'stored': stored_net_worth,
            'calculated': snapshot.net_worth,
            'difference': abs(stored_net_worth - snapshot.net_worth)
        })
    
    return AuditReport(
        workspace_id=workspace_id,
        is_clean=len(discrepancies) == 0,
        discrepancies=discrepancies,
        snapshot=snapshot
    )
```

**Executar periodicamente:**

```bash
# Cron job semanal
python scripts/audit_financial_data.py --all-workspaces
```

**Alertas:**

- Se encontrar discrepâncias → email para admin
- Log de todas as auditorias
- Dashboard de saúde dos dados

#### 📈 Impacto

- **Prevenção de desastres:** MÉDIO
- **Confiança:** MÉDIO
- **Debug:** MÉDIO

#### 🎯 Implementação

1. Criar script de auditoria
2. Adicionar ao cron (semanal)
3. Dashboard de saúde
4. Alertas automáticos

---

## 📊 Resumo de Prioridades

### 🔥 Prioridade 1 (Arquitetura)
1. ✅ Financial Engine centralizado
2. ✅ Remover Math.abs() desnecessário

### Prioridade 2 (Produto)
3. ✅ Sistema de Contas
4. ✅ Daily Allowance correto

### 🧠 Prioridade 3 (Modelação)
5. ✅ Separar Cash Flow / Wealth / Allocation
6. ✅ FIRE realista

### 📊 Prioridade 4 (Analytics)
7. ✅ Health Score transparente
8. ✅ Transfers

### 🧪 Prioridade 5 (Qualidade)
9. ✅ Testes automáticos
10. ✅ Auditoria de dados

---

## 🎯 Plano de Implementação Sugerido

### Fase 1: Fundação (2-3 semanas)
- [ ] Financial Engine
- [ ] Testes essenciais
- [ ] Remover Math.abs() desnecessário

### Fase 2: Realismo (3-4 semanas)
- [ ] Sistema de Contas
- [ ] Daily Allowance correto
- [ ] Opening Balance

### Fase 3: Refinamento (2-3 semanas)
- [ ] Separar conceitos (Cash Flow / Wealth / Allocation)
- [ ] Health Score transparente
- [ ] FIRE melhorado

### Fase 4: Qualidade (1-2 semanas)
- [ ] Transfers
- [ ] Auditoria de dados
- [ ] Expandir testes

---

**Documento criado em:** 2025-01-27  
**Próxima revisão:** Após implementação da Fase 1

