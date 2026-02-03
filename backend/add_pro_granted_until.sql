-- Pro concedido por tempo limitado (admin concede Pro a um utilizador até uma data).
-- Idempotente: IF NOT EXISTS (PostgreSQL 9.5+).

ALTER TABLE users
ADD COLUMN IF NOT EXISTS pro_granted_until TIMESTAMPTZ NULL;

COMMENT ON COLUMN users.pro_granted_until IS 'Se preenchido e > NOW(), o utilizador tem acesso Pro independentemente de subscription_status.';
