-- Índices para otimização de queries
-- Execute este SQL na base de dados PostgreSQL

-- Índice para workspace lookup (muito usado)
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

-- Índices para transactions por workspace
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_id ON transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);

-- Índice composto para filtros comuns (workspace + amount filter)
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_amount 
ON transactions(workspace_id, amount_cents) 
WHERE abs(amount_cents) != 1;

-- Índice para categories por workspace
CREATE INDEX IF NOT EXISTS idx_categories_workspace_id ON categories(workspace_id);

-- Índice para recurring transactions
CREATE INDEX IF NOT EXISTS idx_recurring_workspace_id ON recurring_transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_transactions(workspace_id, is_active) 
WHERE is_active = true;

-- Índice para savings goals
CREATE INDEX IF NOT EXISTS idx_goals_workspace_id ON savings_goals(workspace_id);

-- Verificar índices criados
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('workspaces', 'transactions', 'categories', 'recurring_transactions', 'savings_goals')
ORDER BY tablename, indexname;

