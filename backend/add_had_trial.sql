-- Adicionar coluna had_trial à tabela users
-- Impede que utilizadores reutilizem o trial de 7 dias gratuitos
ALTER TABLE users ADD COLUMN IF NOT EXISTS had_trial BOOLEAN NOT NULL DEFAULT FALSE;

-- Marcar utilizadores que já tiveram trial (trialing ou já tiveram subscrição activa)
UPDATE users SET had_trial = TRUE WHERE stripe_subscription_id IS NOT NULL;
