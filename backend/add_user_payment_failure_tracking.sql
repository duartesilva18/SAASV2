-- Guarda a última falha de cobrança Stripe por utilizador (para UX e suporte)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_payment_failure_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_payment_failure_message VARCHAR(500),
ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMPTZ;

