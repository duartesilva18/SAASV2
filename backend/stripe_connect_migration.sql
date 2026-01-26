-- =====================================================
-- STRIPE CONNECT MIGRATION
-- Adiciona campos necessários para pagamento automático
-- de comissões via Stripe Connect
-- =====================================================

-- 1. Adicionar campos na tabela users para Stripe Connect
-- =====================================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_connect_account_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS affiliate_payout_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_users_stripe_connect_account_id ON users(stripe_connect_account_id) WHERE stripe_connect_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_affiliate_payout_enabled ON users(affiliate_payout_enabled) WHERE is_affiliate = TRUE;

-- 2. Adicionar campos na tabela affiliate_commissions
-- =====================================================
ALTER TABLE affiliate_commissions
ADD COLUMN IF NOT EXISTS stripe_transfer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS transfer_status VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payout_error_message TEXT;

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_stripe_transfer_id ON affiliate_commissions(stripe_transfer_id) WHERE stripe_transfer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_transfer_status ON affiliate_commissions(transfer_status) WHERE transfer_status IS NOT NULL;

-- Constraints para transfer_status
ALTER TABLE affiliate_commissions
DROP CONSTRAINT IF EXISTS check_transfer_status;

ALTER TABLE affiliate_commissions
ADD CONSTRAINT check_transfer_status 
CHECK (transfer_status IS NULL OR transfer_status IN ('created', 'reversed', 'failed'));

-- 3. Comentários para documentação
-- =====================================================
COMMENT ON COLUMN users.stripe_connect_account_id IS 'ID da conta Stripe Connect Express do afiliado';
COMMENT ON COLUMN users.stripe_connect_onboarding_completed IS 'Se o onboarding do Stripe Connect foi completado';
COMMENT ON COLUMN users.stripe_connect_account_status IS 'Status da conta: pending, active, restricted, disabled';
COMMENT ON COLUMN users.affiliate_payout_enabled IS 'Cache lógico - pode ser inferido por stripe_connect_account_id + status = active';
COMMENT ON COLUMN affiliate_commissions.stripe_transfer_id IS 'ID do transfer criado no Stripe Connect';
COMMENT ON COLUMN affiliate_commissions.transfer_status IS 'Status do transfer: created, reversed, failed';
COMMENT ON COLUMN affiliate_commissions.payout_error_message IS 'Mensagem de erro se o transfer falhar ou for revertido';

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================


