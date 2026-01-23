-- SQL para adicionar opening_balance à tabela workspaces
-- Execute este SQL diretamente na base de dados PostgreSQL

-- Adicionar coluna opening_balance_cents (saldo inicial em cêntimos)
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS opening_balance_cents INTEGER NOT NULL DEFAULT 0;

-- Adicionar coluna opening_balance_date (data do saldo inicial)
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS opening_balance_date DATE NULL;

-- Verificar se as colunas foram adicionadas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'workspaces' 
  AND column_name IN ('opening_balance_cents', 'opening_balance_date');

