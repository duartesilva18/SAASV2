-- Categoria por defeito para as próximas mensagens Telegram (/categoria ou /definir).
-- Idempotente: IF NOT EXISTS (PostgreSQL 9.5+).

ALTER TABLE users
ADD COLUMN IF NOT EXISTS telegram_default_category_id UUID NULL REFERENCES categories(id) ON DELETE SET NULL;
