-- Adiciona Salário e Despesas gerais a todos os workspaces que ainda não tenham estas categorias.
-- Nome conforme a língua do dono do workspace (users.language): pt, en, fr.
-- Executar uma vez: psql $DATABASE_URL -f seed_salary_and_general_expense.sql

-- 1) Inserir categoria Salário (receita) onde não existir
INSERT INTO categories (id, workspace_id, name, type, vault_type, monthly_limit_cents, color_hex, icon, is_default, created_at, updated_at)
SELECT gen_random_uuid(), w.id,
  CASE WHEN u.language = 'en' THEN 'Salary' WHEN u.language = 'fr' THEN 'Salaire' ELSE 'Salário' END,
  'income', 'none', 0, '#10B981', 'Landmark', false, now(), now()
FROM workspaces w
JOIN users u ON u.id = w.owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.workspace_id = w.id
    AND c.name = (CASE WHEN u.language = 'en' THEN 'Salary' WHEN u.language = 'fr' THEN 'Salaire' ELSE 'Salário' END)
);

-- 2) Inserir categoria Despesas gerais (despesa) onde não existir
INSERT INTO categories (id, workspace_id, name, type, vault_type, monthly_limit_cents, color_hex, icon, is_default, created_at, updated_at)
SELECT gen_random_uuid(), w.id,
  CASE WHEN u.language = 'en' THEN 'General expenses' WHEN u.language = 'fr' THEN 'Dépenses générales' ELSE 'Despesas gerais' END,
  'expense', 'none', 0, '#64748B', 'Wallet', false, now(), now()
FROM workspaces w
JOIN users u ON u.id = w.owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.workspace_id = w.id
    AND c.name = (CASE WHEN u.language = 'en' THEN 'General expenses' WHEN u.language = 'fr' THEN 'Dépenses générales' ELSE 'Despesas gerais' END)
);
