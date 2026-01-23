-- Migration: Add opening_balance to workspaces table
-- Date: 2025-01-27

-- Add opening_balance_cents column (default 0)
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS opening_balance_cents INTEGER NOT NULL DEFAULT 0;

-- Add opening_balance_date column (nullable)
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS opening_balance_date DATE NULL;

-- Add comment to columns
COMMENT ON COLUMN workspaces.opening_balance_cents IS 'Saldo inicial em cêntimos';
COMMENT ON COLUMN workspaces.opening_balance_date IS 'Data do saldo inicial';

