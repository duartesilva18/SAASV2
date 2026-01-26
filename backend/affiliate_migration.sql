-- =====================================================
-- MIGRAÇÃO: Sistema de Afiliados
-- Data: 2025-01-27
-- Descrição: Adiciona sistema completo de afiliados
-- =====================================================

-- 1. Adicionar campos de afiliado à tabela users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS affiliate_code VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS affiliate_requested_at TIMESTAMP WITH TIME ZONE;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_users_affiliate_code ON users(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_is_affiliate ON users(is_affiliate);

-- 2. Criar tabela de referências de afiliados
CREATE TABLE IF NOT EXISTS affiliate_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    referral_code VARCHAR(20) NOT NULL,
    has_subscribed BOOLEAN NOT NULL DEFAULT FALSE,
    subscription_date TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para affiliate_referrals
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referrer_id ON affiliate_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred_user_id ON affiliate_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referral_code ON affiliate_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_has_subscribed ON affiliate_referrals(has_subscribed);

-- 3. Criar tabela de comissões mensais
CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month DATE NOT NULL, -- Primeiro dia do mês (YYYY-MM-01)
    total_revenue_cents INTEGER NOT NULL DEFAULT 0,
    commission_percentage NUMERIC(5, 2) NOT NULL, -- Ex: 20.00
    commission_amount_cents INTEGER NOT NULL DEFAULT 0,
    referrals_count INTEGER NOT NULL DEFAULT 0,
    conversions_count INTEGER NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_reference VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_affiliate_month UNIQUE (affiliate_id, month)
);

-- Índices para affiliate_commissions
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_month ON affiliate_commissions(month);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_is_paid ON affiliate_commissions(is_paid);

-- 4. Criar configuração padrão de percentagem de comissão
INSERT INTO system_settings (key, value, description)
VALUES ('affiliate_commission_percentage', '20.00', 'Percentagem de comissão para afiliados (ex: 20.00 = 20%)')
ON CONFLICT (key) DO NOTHING;

-- 5. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_affiliate_commissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_affiliate_commissions_updated_at ON affiliate_commissions;
CREATE TRIGGER trigger_update_affiliate_commissions_updated_at
    BEFORE UPDATE ON affiliate_commissions
    FOR EACH ROW
    EXECUTE FUNCTION update_affiliate_commissions_updated_at();

-- 6. Constraints de validação
ALTER TABLE affiliate_referrals
ADD CONSTRAINT check_referrer_not_self CHECK (referrer_id != referred_user_id);

ALTER TABLE affiliate_commissions
ADD CONSTRAINT check_commission_percentage CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
ADD CONSTRAINT check_revenue_positive CHECK (total_revenue_cents >= 0),
ADD CONSTRAINT check_commission_positive CHECK (commission_amount_cents >= 0);

-- 7. Comentários nas tabelas (documentação)
COMMENT ON TABLE affiliate_referrals IS 'Rastreia referências de afiliados - quando alguém se regista através de um link de afiliado';
COMMENT ON TABLE affiliate_commissions IS 'Comissões mensais dos afiliados - calculadas no fim de cada mês';
COMMENT ON COLUMN users.is_affiliate IS 'Indica se o utilizador é afiliado';
COMMENT ON COLUMN users.affiliate_code IS 'Código único do afiliado usado nos links de referência';
COMMENT ON COLUMN users.referrer_id IS 'ID do afiliado que referiu este utilizador';
COMMENT ON COLUMN affiliate_referrals.has_subscribed IS 'Se o utilizador referido subscreveu Pro';
COMMENT ON COLUMN affiliate_commissions.month IS 'Primeiro dia do mês (YYYY-MM-01)';
COMMENT ON COLUMN affiliate_commissions.commission_percentage IS 'Percentagem de comissão (ex: 20.00 = 20%)';

-- 8. View para estatísticas de afiliados (opcional, útil para relatórios)
CREATE OR REPLACE VIEW affiliate_stats AS
SELECT 
    u.id AS affiliate_id,
    u.email AS affiliate_email,
    u.full_name AS affiliate_name,
    u.affiliate_code,
    COUNT(DISTINCT ar.id) AS total_referrals,
    COUNT(DISTINCT CASE WHEN ar.has_subscribed THEN ar.id END) AS total_conversions,
    COALESCE(SUM(ac.commission_amount_cents), 0) AS total_earnings_cents,
    COALESCE(SUM(CASE WHEN ac.is_paid = FALSE THEN ac.commission_amount_cents ELSE 0 END), 0) AS pending_earnings_cents,
    COALESCE(SUM(CASE WHEN ac.is_paid = TRUE THEN ac.commission_amount_cents ELSE 0 END), 0) AS paid_earnings_cents
FROM users u
LEFT JOIN affiliate_referrals ar ON u.id = ar.referrer_id
LEFT JOIN affiliate_commissions ac ON u.id = ac.affiliate_id
WHERE u.is_affiliate = TRUE
GROUP BY u.id, u.email, u.full_name, u.affiliate_code;

-- 9. Função para gerar código de afiliado único (helper)
CREATE OR REPLACE FUNCTION generate_affiliate_code()
RETURNS VARCHAR(20) AS $$
DECLARE
    code VARCHAR(20);
    exists_check BOOLEAN;
BEGIN
    LOOP
        -- Gera código de 8 caracteres alfanuméricos
        code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));
        -- Garantir que tem pelo menos uma letra e um número
        IF code ~ '[A-Z]' AND code ~ '[0-9]' THEN
            SELECT EXISTS(SELECT 1 FROM users WHERE affiliate_code = code) INTO exists_check;
            IF NOT exists_check THEN
                RETURN code;
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICAÇÕES E VALIDAÇÕES
-- =====================================================

-- Verificar se as colunas foram criadas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_affiliate'
    ) THEN
        RAISE EXCEPTION 'Coluna is_affiliate não foi criada na tabela users';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'affiliate_referrals'
    ) THEN
        RAISE EXCEPTION 'Tabela affiliate_referrals não foi criada';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'affiliate_commissions'
    ) THEN
        RAISE EXCEPTION 'Tabela affiliate_commissions não foi criada';
    END IF;
    
    RAISE NOTICE 'Migração de afiliados concluída com sucesso!';
END $$;

-- =====================================================
-- ROLLBACK (caso precise reverter)
-- =====================================================
/*
-- Descomentar para reverter a migração

DROP VIEW IF EXISTS affiliate_stats;
DROP FUNCTION IF EXISTS generate_affiliate_code();
DROP FUNCTION IF EXISTS update_affiliate_commissions_updated_at();
DROP TRIGGER IF EXISTS trigger_update_affiliate_commissions_updated_at ON affiliate_commissions;
DROP TABLE IF EXISTS affiliate_commissions;
DROP TABLE IF EXISTS affiliate_referrals;
ALTER TABLE users 
    DROP COLUMN IF EXISTS is_affiliate,
    DROP COLUMN IF EXISTS affiliate_code,
    DROP COLUMN IF EXISTS referrer_id,
    DROP COLUMN IF EXISTS affiliate_requested_at;
DROP INDEX IF EXISTS idx_users_affiliate_code;
DROP INDEX IF EXISTS idx_users_referrer_id;
DROP INDEX IF EXISTS idx_users_is_affiliate;
DELETE FROM system_settings WHERE key = 'affiliate_commission_percentage';
*/


 
