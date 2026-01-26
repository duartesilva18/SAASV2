-- =====================================================
-- MIGRAÇÃO PARA RENDER - ADICIONAR COLUNAS DE AFILIADOS E STRIPE CONNECT
-- Este script é idempotente - pode ser executado múltiplas vezes
-- =====================================================

-- Adicionar colunas de afiliado se não existirem
DO $$
BEGIN
    -- Colunas de afiliado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_affiliate') THEN
        ALTER TABLE users ADD COLUMN is_affiliate BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'affiliate_code') THEN
        ALTER TABLE users ADD COLUMN affiliate_code VARCHAR(20) UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referrer_id') THEN
        ALTER TABLE users ADD COLUMN referrer_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'affiliate_requested_at') THEN
        ALTER TABLE users ADD COLUMN affiliate_requested_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Colunas Stripe Connect
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stripe_connect_account_id') THEN
        ALTER TABLE users ADD COLUMN stripe_connect_account_id VARCHAR(255) UNIQUE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stripe_connect_onboarding_completed') THEN
        ALTER TABLE users ADD COLUMN stripe_connect_onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stripe_connect_account_status') THEN
        ALTER TABLE users ADD COLUMN stripe_connect_account_status VARCHAR(50) DEFAULT 'pending';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'affiliate_payout_enabled') THEN
        ALTER TABLE users ADD COLUMN affiliate_payout_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_users_affiliate_code ON users(affiliate_code) WHERE affiliate_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id) WHERE referrer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_affiliate ON users(is_affiliate);
CREATE INDEX IF NOT EXISTS idx_users_stripe_connect_account_id ON users(stripe_connect_account_id) WHERE stripe_connect_account_id IS NOT NULL;

-- Adicionar foreign key para referrer_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_referrer_id_fkey' AND table_name = 'users'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_referrer_id_fkey 
        FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Criar tabela affiliate_referrals se não existir
CREATE TABLE IF NOT EXISTS affiliate_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL,
    referred_user_id UUID NOT NULL UNIQUE,
    referral_code VARCHAR(20) NOT NULL,
    has_subscribed BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_referrer_not_self CHECK (referrer_id != referred_user_id)
);

-- Adicionar foreign keys para affiliate_referrals se não existirem
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'affiliate_referrals_referrer_id_fkey' AND table_name = 'affiliate_referrals'
    ) THEN
        ALTER TABLE affiliate_referrals
        ADD CONSTRAINT affiliate_referrals_referrer_id_fkey 
        FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'affiliate_referrals_referred_user_id_fkey' AND table_name = 'affiliate_referrals'
    ) THEN
        ALTER TABLE affiliate_referrals
        ADD CONSTRAINT affiliate_referrals_referred_user_id_fkey 
        FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Criar índices para affiliate_referrals
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referrer_id ON affiliate_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred_user_id ON affiliate_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referral_code ON affiliate_referrals(referral_code);

-- Criar tabela affiliate_commissions se não existir
CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL,
    month DATE NOT NULL,
    total_revenue_cents INTEGER NOT NULL DEFAULT 0,
    commission_percentage NUMERIC(5,2) NOT NULL,
    commission_amount_cents INTEGER NOT NULL DEFAULT 0,
    referrals_count INTEGER NOT NULL DEFAULT 0,
    conversions_count INTEGER NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_reference VARCHAR(100),
    stripe_transfer_id VARCHAR(255),
    transfer_status VARCHAR(50),
    payout_error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Adicionar colunas que podem estar faltando (idempotente)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliate_commissions') THEN
        -- Adicionar colunas se não existirem
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliate_commissions' AND column_name = 'month') THEN
            ALTER TABLE affiliate_commissions ADD COLUMN month DATE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliate_commissions' AND column_name = 'total_revenue_cents') THEN
            ALTER TABLE affiliate_commissions ADD COLUMN total_revenue_cents INTEGER NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliate_commissions' AND column_name = 'commission_amount_cents') THEN
            ALTER TABLE affiliate_commissions ADD COLUMN commission_amount_cents INTEGER NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliate_commissions' AND column_name = 'referrals_count') THEN
            ALTER TABLE affiliate_commissions ADD COLUMN referrals_count INTEGER NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliate_commissions' AND column_name = 'conversions_count') THEN
            ALTER TABLE affiliate_commissions ADD COLUMN conversions_count INTEGER NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliate_commissions' AND column_name = 'payment_reference') THEN
            ALTER TABLE affiliate_commissions ADD COLUMN payment_reference VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliate_commissions' AND column_name = 'stripe_transfer_id') THEN
            ALTER TABLE affiliate_commissions ADD COLUMN stripe_transfer_id VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliate_commissions' AND column_name = 'transfer_status') THEN
            ALTER TABLE affiliate_commissions ADD COLUMN transfer_status VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliate_commissions' AND column_name = 'payout_error_message') THEN
            ALTER TABLE affiliate_commissions ADD COLUMN payout_error_message TEXT;
        END IF;
    END IF;
END $$;

-- Adicionar foreign keys para affiliate_commissions se não existirem
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'affiliate_commissions_affiliate_id_fkey' AND table_name = 'affiliate_commissions'
    ) THEN
        ALTER TABLE affiliate_commissions
        ADD CONSTRAINT affiliate_commissions_affiliate_id_fkey 
        FOREIGN KEY (affiliate_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Adicionar constraint unique para affiliate_id + month
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_affiliate_month' AND table_name = 'affiliate_commissions'
    ) THEN
        ALTER TABLE affiliate_commissions
        ADD CONSTRAINT unique_affiliate_month UNIQUE (affiliate_id, month);
    END IF;
END $$;

-- Criar índices para affiliate_commissions
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_is_paid ON affiliate_commissions(is_paid);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_stripe_transfer_id ON affiliate_commissions(stripe_transfer_id) WHERE stripe_transfer_id IS NOT NULL;

-- Criar tabela email_verifications se não existir
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR NOT NULL,
    token VARCHAR NOT NULL UNIQUE,
    password_hash VARCHAR,
    referral_code VARCHAR(20),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Adicionar coluna referral_code se a tabela já existir mas não tiver a coluna
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_verifications') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_verifications' AND column_name = 'referral_code') THEN
            ALTER TABLE email_verifications ADD COLUMN referral_code VARCHAR(20);
        END IF;
    END IF;
END $$;

-- Criar índices para email_verifications
CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);

-- Criar tabela system_settings se não existir
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Inserir configuração de comissão de afiliados se não existir
INSERT INTO system_settings (id, key, value, description)
VALUES (gen_random_uuid(), 'affiliate_commission_percentage', '20.00', 'Percentagem de comissão para afiliados (ex: 20.00 = 20%)')
ON CONFLICT (key) DO NOTHING;

-- Verificar se gen_random_uuid() está disponível, caso contrário usar uuid_generate_v4()
DO $$
BEGIN
    -- Se gen_random_uuid() não estiver disponível, usar uuid-ossp
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    END IF;
END $$;

