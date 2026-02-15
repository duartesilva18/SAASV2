-- Marca utilizadores que alguma vez tiveram reembolso (para exibir no admin)
-- Correr uma vez na base de dados.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS had_refund BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.had_refund IS 'True se o utilizador alguma vez teve um reembolso (charge.refunded no Stripe); usado no admin para gestão de utilizadores.';
