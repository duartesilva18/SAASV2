# 🚀 Otimização de Busca de Dados - Finly

**Data:** 2025-01-27

---

## 📊 Padrões Atuais de Busca

### 1. Frontend - Múltiplas Chamadas Paralelas

**Padrão atual:**
```typescript
// Dashboard
const [transRes, catRes] = await Promise.all([
  api.get('/transactions/'),
  api.get('/categories/')
]);

// Analytics
const [transRes, catRes, recurringRes] = await Promise.all([
  api.get('/analytics/composite'),  // Já inclui tudo
  api.get('/categories/'),
  api.get('/recurring/')
]);
```

**Problemas:**
- ❌ Múltiplas queries à base de dados
- ❌ Dados duplicados (transactions buscadas várias vezes)
- ❌ Sem cache no backend
- ❌ Sem paginação eficiente

---

### 2. Backend - Queries Individuais

**Padrão atual:**
```python
# Cada endpoint faz queries separadas
@router.get('/transactions/')
def get_transactions():
    workspace = db.query(Workspace).filter(...).first()  # Query 1
    transactions = db.query(Transaction).filter(...).all()  # Query 2
    
@router.get('/categories/')
def get_categories():
    workspace = db.query(Workspace).filter(...).first()  # Query 1 (duplicada!)
    categories = db.query(Category).filter(...).all()  # Query 2
```

**Problemas:**
- ❌ Workspace buscado múltiplas vezes
- ❌ Sem joins (N+1 queries)
- ❌ Sem índices otimizados
- ❌ Filtros repetidos (func.abs(amount_cents) != 1)

---

## 🔍 Análise Detalhada

### Dashboard Page

**Chamadas:**
1. `GET /transactions/` → Todas as transações (limit 100)
2. `GET /categories/` → Todas as categorias
3. `GET /insights/` → Insights (busca transactions novamente)

**Dados duplicados:**
- Transactions buscadas 2x (transactions + insights)
- Workspace buscado 3x

**Cálculos:**
- Frontend calcula income/expenses/vault
- Backend também calcula (insights)

---

### Analytics Page

**Chamadas:**
1. `GET /analytics/composite` → Transactions + Categories + Recurring + Insights
2. `GET /categories/` → Categorias (duplicado!)

**Dados duplicados:**
- Categories buscadas 2x
- Transactions já vêm no composite

**Cálculos:**
- Frontend recalcula tudo do zero
- Backend já calculou em insights

---

### Transactions Page

**Chamadas:**
1. `GET /transactions/` → Todas (limit 100, offset)
2. `GET /categories/` → Todas

**Problemas:**
- Sem paginação real (apenas limit/offset)
- Filtros no frontend (pesquisa, categorias)
- Refresh automático a cada 60s

---

## ⚠️ Problemas de Performance

### 1. N+1 Queries

```python
# Problema: Para cada transaction, busca category
transactions = db.query(Transaction).all()
for t in transactions:
    category = db.query(Category).filter(id=t.category_id).first()  # N queries!
```

**Solução:**
```python
# Usar join ou eager loading
transactions = db.query(Transaction).join(Category).all()  # 1 query
```

---

### 2. Workspace Buscado Múltiplas Vezes

**Problema:**
```python
# Em cada endpoint:
workspace = db.query(Workspace).filter(owner_id=user.id).first()
```

**Solução:**
```python
# Cache no request ou middleware
@middleware
def get_workspace(request):
    if not hasattr(request.state, 'workspace'):
        request.state.workspace = db.query(Workspace).filter(...).first()
```

---

### 3. Filtros Repetidos

**Problema:**
```python
# Em todos os endpoints:
func.abs(models.Transaction.amount_cents) != 1  # Repetido
```

**Solução:**
```python
# Criar método helper ou view
def get_valid_transactions(workspace_id):
    return db.query(Transaction).filter(
        Transaction.workspace_id == workspace_id,
        func.abs(Transaction.amount_cents) != 1
    )
```

---

### 4. Cálculos Duplicados

**Problema:**
- Backend calcula em `/insights/`
- Frontend recalcula em `dashboard/page.tsx`
- Frontend recalcula em `analytics/page.tsx`

**Solução:**
- Backend retorna snapshot financeiro
- Frontend apenas consome

---

## ✅ Otimizações Recomendadas

### 1. Endpoint Composto Único

**Criar:**
```python
@router.get('/dashboard/snapshot')
async def get_dashboard_snapshot():
    # 1 query para tudo
    workspace = get_workspace()
    transactions = get_valid_transactions(workspace.id)
    categories = get_categories(workspace.id)
    
    # Calcular tudo no backend
    snapshot = FinancialEngine.calculate_snapshot(transactions, categories)
    
    return {
        'snapshot': snapshot,
        'transactions': transactions[:10],  # Apenas últimas 10
        'categories': categories
    }
```

**Benefícios:**
- ✅ 1 chamada em vez de 3
- ✅ Cálculos no backend (fonte única)
- ✅ Menos dados transferidos

---

### 2. Índices de Base de Dados

**Criar índices:**
```sql
-- Índice para workspace lookup
CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);

-- Índice para transactions por workspace
CREATE INDEX idx_transactions_workspace_id ON transactions(workspace_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_amount ON transactions(amount_cents);

-- Índice composto para filtros comuns
CREATE INDEX idx_transactions_workspace_amount 
ON transactions(workspace_id, amount_cents) 
WHERE abs(amount_cents) != 1;
```

---

### 3. Eager Loading (Joins)

**Antes:**
```python
transactions = db.query(Transaction).all()  # N+1 queries
```

**Depois:**
```python
from sqlalchemy.orm import joinedload

transactions = db.query(Transaction)\
    .options(joinedload(Transaction.category))\
    .filter(...)\
    .all()  # 1 query com join
```

---

### 4. Cache de Workspace

**Middleware:**
```python
@app.middleware("http")
async def workspace_cache(request: Request, call_next):
    if request.state.user:
        workspace = cache.get(f"workspace_{request.state.user.id}")
        if not workspace:
            workspace = db.query(Workspace).filter(...).first()
            cache.set(f"workspace_{workspace.id}", workspace, 300)
        request.state.workspace = workspace
    return await call_next(request)
```

---

### 5. Paginação Real

**Backend:**
```python
@router.get('/transactions/')
def get_transactions(skip: int = 0, limit: int = 50):
    total = db.query(Transaction).filter(...).count()
    transactions = db.query(Transaction)\
        .filter(...)\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return {
        'data': transactions,
        'total': total,
        'skip': skip,
        'limit': limit
    }
```

**Frontend:**
```typescript
// Buscar apenas página atual
const { data, total } = await api.get('/transactions/', {
  params: { skip: (page - 1) * 50, limit: 50 }
});
```

---

### 6. Cache no Frontend

**Usar React Query ou SWR:**
```typescript
// Cache automático, refetch inteligente
const { data: transactions } = useSWR('/transactions/', api.get, {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 60000  // 1 minuto
});
```

---

## 📈 Impacto Esperado

### Antes (Atual)

**Dashboard:**
- 3 chamadas API
- ~500ms total
- 3 queries workspace
- Cálculos duplicados

**Analytics:**
- 2 chamadas API
- ~800ms total
- Dados duplicados
- Cálculos no frontend

### Depois (Otimizado)

**Dashboard:**
- 1 chamada API
- ~200ms total
- 1 query workspace (cacheado)
- Cálculos no backend

**Analytics:**
- 1 chamada API
- ~300ms total
- Sem duplicação
- Cálculos no backend

**Ganho:** ~60-70% mais rápido

---

## 🎯 Prioridades de Implementação

### Prioridade 1 (Alto Impacto)
1. ✅ Endpoint composto `/dashboard/snapshot`
2. ✅ Índices de base de dados
3. ✅ Eager loading (joins)

### Prioridade 2 (Médio Impacto)
4. ✅ Cache de workspace
5. ✅ Paginação real
6. ✅ Cache no frontend (React Query)

### Prioridade 3 (Baixo Impacto)
7. ✅ Otimizar filtros repetidos
8. ✅ Lazy loading de dados pesados

---

## 📝 Checklist de Otimização

- [ ] Criar endpoint `/dashboard/snapshot`
- [ ] Criar endpoint `/analytics/composite` (já existe, otimizar)
- [ ] Adicionar índices na base de dados
- [ ] Implementar eager loading (joins)
- [ ] Cache de workspace (middleware)
- [ ] Paginação real em transactions
- [ ] React Query ou SWR no frontend
- [ ] Remover cálculos duplicados do frontend
- [ ] Consolidar chamadas API

---

**Documento criado em:** 2025-01-27

