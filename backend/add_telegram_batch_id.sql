-- Adiciona batch_id a telegram_pending_transactions para agrupar listas de transações.
-- Idempotente: IF NOT EXISTS (PostgreSQL 9.5+).

ALTER TABLE telegram_pending_transactions
ADD COLUMN IF NOT EXISTS batch_id UUID NULL;

CREATE INDEX IF NOT EXISTS ix_telegram_pending_transactions_batch_id
ON telegram_pending_transactions(batch_id);
