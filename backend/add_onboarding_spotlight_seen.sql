-- Guardar na BD se o utilizador já viu o onboarding spotlight (persiste após logout).
ALTER TABLE users
ADD COLUMN IF NOT EXISTS onboarding_spotlight_seen BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.onboarding_spotlight_seen IS 'True se o utilizador já completou o tour dos spotlights (sidebar, bot, etc.).';
