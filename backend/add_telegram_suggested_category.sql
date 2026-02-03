-- Coluna para pedir ao user se quer criar a categoria sugerida pela IA (quando não existe).
-- Idempotente: IF NOT EXISTS (PostgreSQL 9.5+).

ALTER TABLE telegram_pending_transactions
ADD COLUMN IF NOT EXISTS suggested_category_name VARCHAR(100) NULL;
