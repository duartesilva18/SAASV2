-- =====================================================
-- ADMIN PROJECT EXPENSES MIGRATION
-- Tabela para despesas do projeto e manutenção (apenas admins)
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_project_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    amount_cents INTEGER NOT NULL,
    expense_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_project_expenses_created_by_id ON admin_project_expenses(created_by_id) WHERE created_by_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_project_expenses_expense_date ON admin_project_expenses(expense_date DESC);

COMMENT ON TABLE admin_project_expenses IS 'Despesas do projeto e manutenção registadas por admins';
