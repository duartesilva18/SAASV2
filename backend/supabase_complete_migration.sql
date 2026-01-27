-- =====================================================
-- MIGRAÇÃO COMPLETA PARA SUPABASE
-- Data: 2025-01-27
-- Descrição: Cria/atualiza todas as tabelas e colunas necessárias
-- Este script é idempotente - pode ser executado múltiplas vezes
-- =====================================================

-- Habilitar extensão UUID se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. TABELA: users
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR NOT NULL,
    full_name VARCHAR(100),
    password_hash VARCHAR,
    google_id VARCHAR UNIQUE,
    phone_number VARCHAR UNIQUE,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    language VARCHAR(5) NOT NULL DEFAULT 'pt',
    gender VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
    marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
    terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    login_count INTEGER NOT NULL DEFAULT 0,
    last_login TIMESTAMP WITH TIME ZONE,
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'none',
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    telegram_auto_confirm BOOLEAN NOT NULL DEFAULT FALSE,
    -- Campos de afiliado
    is_affiliate BOOLEAN NOT NULL DEFAULT FALSE,
    affiliate_code VARCHAR(20) UNIQUE,
    referrer_id UUID,
    affiliate_requested_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Adicionar colunas que podem estar faltando (idempotente)
DO $$
BEGIN
    -- Adicionar colunas de afiliado se não existirem
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
END $$;

-- Índices para users
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_affiliate_code ON users(affiliate_code) WHERE affiliate_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id) WHERE referrer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_affiliate ON users(is_affiliate);

-- Foreign key para referrer_id (self-reference)
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

-- =====================================================
-- 2. TABELA: email_verifications
-- =====================================================
CREATE TABLE IF NOT EXISTS email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR NOT NULL,
    token VARCHAR(100) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    password_hash VARCHAR
);

CREATE INDEX IF NOT EXISTS ix_email_verifications_email ON email_verifications(email);

-- =====================================================
-- 3. TABELA: workspaces
-- =====================================================
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL DEFAULT 'Meu Workspace',
    opening_balance_cents INTEGER NOT NULL DEFAULT 0,
    opening_balance_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Foreign key para owner_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'workspaces_owner_id_fkey' AND table_name = 'workspaces'
    ) THEN
        ALTER TABLE workspaces
        ADD CONSTRAINT workspaces_owner_id_fkey 
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 4. TABELA: categories
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL,
    vault_type VARCHAR(20) NOT NULL DEFAULT 'none',
    monthly_limit_cents INTEGER NOT NULL DEFAULT 0,
    color_hex VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    icon VARCHAR(50) NOT NULL DEFAULT 'Tag',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT categories_type_check CHECK (type IN ('income', 'expense')),
    CONSTRAINT categories_monthly_limit_check CHECK (monthly_limit_cents >= 0),
    CONSTRAINT categories_unique_name UNIQUE (workspace_id, name)
);

-- Foreign key para workspace_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'categories_workspace_id_fkey' AND table_name = 'categories'
    ) THEN
        ALTER TABLE categories
        ADD CONSTRAINT categories_workspace_id_fkey 
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 5. TABELA: installment_groups
-- =====================================================
CREATE TABLE IF NOT EXISTS installment_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    total_amount_cents INTEGER NOT NULL,
    installment_count INTEGER NOT NULL,
    start_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT installment_groups_total_amount_check CHECK (total_amount_cents > 0),
    CONSTRAINT installment_groups_installment_count_check CHECK (installment_count > 1)
);

-- Foreign key para workspace_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'installment_groups_workspace_id_fkey' AND table_name = 'installment_groups'
    ) THEN
        ALTER TABLE installment_groups
        ADD CONSTRAINT installment_groups_workspace_id_fkey 
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 6. TABELA: transactions
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    category_id UUID,
    installment_group_id UUID,
    amount_cents INTEGER NOT NULL,
    description VARCHAR(255),
    transaction_date DATE NOT NULL,
    is_installment BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT transactions_amount_check CHECK (amount_cents <> 0)
);

-- Foreign keys para transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'transactions_workspace_id_fkey' AND table_name = 'transactions'
    ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_workspace_id_fkey 
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'transactions_category_id_fkey' AND table_name = 'transactions'
    ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_category_id_fkey 
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'transactions_installment_group_id_fkey' AND table_name = 'transactions'
    ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_installment_group_id_fkey 
        FOREIGN KEY (installment_group_id) REFERENCES installment_groups(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Índices para transactions
CREATE INDEX IF NOT EXISTS ix_transactions_workspace_id ON transactions(workspace_id);
CREATE INDEX IF NOT EXISTS ix_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS ix_transactions_transaction_date ON transactions(transaction_date);

-- =====================================================
-- 7. TABELA: system_settings
-- =====================================================
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    value VARCHAR,
    description VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Garantir que a coluna id tenha DEFAULT se a tabela já existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
        -- Se a tabela já existe, garantir que id tenha DEFAULT
        ALTER TABLE system_settings 
        ALTER COLUMN id SET DEFAULT gen_random_uuid();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_system_settings_key ON system_settings(key);

-- =====================================================
-- 8. TABELA: recurring_transactions
-- =====================================================
CREATE TABLE IF NOT EXISTS recurring_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    category_id UUID,
    description VARCHAR(255) NOT NULL,
    amount_cents INTEGER NOT NULL,
    day_of_month INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    process_automatically BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Foreign keys para recurring_transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'recurring_transactions_workspace_id_fkey' AND table_name = 'recurring_transactions'
    ) THEN
        ALTER TABLE recurring_transactions
        ADD CONSTRAINT recurring_transactions_workspace_id_fkey 
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'recurring_transactions_category_id_fkey' AND table_name = 'recurring_transactions'
    ) THEN
        ALTER TABLE recurring_transactions
        ADD CONSTRAINT recurring_transactions_category_id_fkey 
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =====================================================
-- 9. TABELA: password_resets
-- =====================================================
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_password_resets_email ON password_resets(email);

-- =====================================================
-- 10. TABELA: audit_logs
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    details VARCHAR,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Foreign key para user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'audit_logs_user_id_fkey' AND table_name = 'audit_logs'
    ) THEN
        ALTER TABLE audit_logs
        ADD CONSTRAINT audit_logs_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 11. TABELA: savings_goals
-- =====================================================
CREATE TABLE IF NOT EXISTS savings_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    goal_type VARCHAR(20) NOT NULL DEFAULT 'expense',
    target_amount_cents INTEGER NOT NULL,
    current_amount_cents INTEGER NOT NULL DEFAULT 0,
    target_date DATE NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'Target',
    color_hex VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Adicionar coluna goal_type se não existir (migração para tabelas existentes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'savings_goals' 
        AND column_name = 'goal_type'
    ) THEN
        ALTER TABLE savings_goals 
        ADD COLUMN goal_type VARCHAR(20) NOT NULL DEFAULT 'expense';
        
        -- Add check constraint se não existir
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'chk_goal_type' AND table_name = 'savings_goals'
        ) THEN
            ALTER TABLE savings_goals
            ADD CONSTRAINT chk_goal_type CHECK (goal_type IN ('expense', 'income'));
        END IF;
    END IF;
END $$;

-- Foreign key para workspace_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'savings_goals_workspace_id_fkey' AND table_name = 'savings_goals'
    ) THEN
        ALTER TABLE savings_goals
        ADD CONSTRAINT savings_goals_workspace_id_fkey 
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 12. TABELA: telegram_pending_transactions
-- =====================================================
CREATE TABLE IF NOT EXISTS telegram_pending_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id VARCHAR NOT NULL,
    workspace_id UUID NOT NULL,
    category_id UUID,
    amount_cents INTEGER NOT NULL,
    description VARCHAR(255) NOT NULL,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Foreign keys para telegram_pending_transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'telegram_pending_transactions_workspace_id_fkey' AND table_name = 'telegram_pending_transactions'
    ) THEN
        ALTER TABLE telegram_pending_transactions
        ADD CONSTRAINT telegram_pending_transactions_workspace_id_fkey 
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'telegram_pending_transactions_category_id_fkey' AND table_name = 'telegram_pending_transactions'
    ) THEN
        ALTER TABLE telegram_pending_transactions
        ADD CONSTRAINT telegram_pending_transactions_category_id_fkey 
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_telegram_pending_transactions_chat_id ON telegram_pending_transactions(chat_id);

-- =====================================================
-- 13. TABELA: category_mapping_cache
-- =====================================================
CREATE TABLE IF NOT EXISTS category_mapping_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID,
    description_normalized VARCHAR(255) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    category_id UUID,
    transaction_type VARCHAR(10) NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 1,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT category_mapping_cache_unique_workspace_mapping UNIQUE (workspace_id, description_normalized, transaction_type)
);

-- Foreign keys para category_mapping_cache
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'category_mapping_cache_workspace_id_fkey' AND table_name = 'category_mapping_cache'
    ) THEN
        ALTER TABLE category_mapping_cache
        ADD CONSTRAINT category_mapping_cache_workspace_id_fkey 
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'category_mapping_cache_category_id_fkey' AND table_name = 'category_mapping_cache'
    ) THEN
        ALTER TABLE category_mapping_cache
        ADD CONSTRAINT category_mapping_cache_category_id_fkey 
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_category_mapping_cache_workspace_id ON category_mapping_cache(workspace_id);
CREATE INDEX IF NOT EXISTS ix_category_mapping_cache_description_normalized ON category_mapping_cache(description_normalized);

-- =====================================================
-- 14. TABELA: affiliate_referrals
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliate_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL,
    referred_user_id UUID NOT NULL UNIQUE,
    referral_code VARCHAR(20) NOT NULL,
    has_subscribed BOOLEAN NOT NULL DEFAULT FALSE,
    subscription_date TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_referrer_not_self CHECK (referrer_id != referred_user_id)
);

-- Foreign keys para affiliate_referrals
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

-- Índices para affiliate_referrals
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referrer_id ON affiliate_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred_user_id ON affiliate_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referral_code ON affiliate_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_has_subscribed ON affiliate_referrals(has_subscribed);

-- =====================================================
-- 15. TABELA: affiliate_commissions
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL,
    month DATE NOT NULL,
    total_revenue_cents INTEGER NOT NULL DEFAULT 0,
    commission_percentage NUMERIC(5, 2) NOT NULL,
    commission_amount_cents INTEGER NOT NULL DEFAULT 0,
    referrals_count INTEGER NOT NULL DEFAULT 0,
    conversions_count INTEGER NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_reference VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_affiliate_month UNIQUE (affiliate_id, month),
    CONSTRAINT check_commission_percentage CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    CONSTRAINT check_revenue_positive CHECK (total_revenue_cents >= 0),
    CONSTRAINT check_commission_positive CHECK (commission_amount_cents >= 0)
);

-- Foreign key para affiliate_id
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

-- Índices para affiliate_commissions
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_month ON affiliate_commissions(month);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_is_paid ON affiliate_commissions(is_paid);

-- =====================================================
-- 16. FUNÇÕES E TRIGGERS
-- =====================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para users.updated_at
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON users;
CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para workspaces.updated_at
DROP TRIGGER IF EXISTS trigger_update_workspaces_updated_at ON workspaces;
CREATE TRIGGER trigger_update_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para categories.updated_at
DROP TRIGGER IF EXISTS trigger_update_categories_updated_at ON categories;
CREATE TRIGGER trigger_update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para transactions.updated_at
DROP TRIGGER IF EXISTS trigger_update_transactions_updated_at ON transactions;
CREATE TRIGGER trigger_update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para recurring_transactions.updated_at
DROP TRIGGER IF EXISTS trigger_update_recurring_transactions_updated_at ON recurring_transactions;
CREATE TRIGGER trigger_update_recurring_transactions_updated_at
    BEFORE UPDATE ON recurring_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para savings_goals.updated_at
DROP TRIGGER IF EXISTS trigger_update_savings_goals_updated_at ON savings_goals;
CREATE TRIGGER trigger_update_savings_goals_updated_at
    BEFORE UPDATE ON savings_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para affiliate_commissions.updated_at
DROP TRIGGER IF EXISTS trigger_update_affiliate_commissions_updated_at ON affiliate_commissions;
CREATE TRIGGER trigger_update_affiliate_commissions_updated_at
    BEFORE UPDATE ON affiliate_commissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para system_settings.updated_at
DROP TRIGGER IF EXISTS trigger_update_system_settings_updated_at ON system_settings;
CREATE TRIGGER trigger_update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 17. CONFIGURAÇÕES PADRÃO
-- =====================================================

-- Inserir configuração de comissão de afiliados se não existir
INSERT INTO system_settings (id, key, value, description)
VALUES (gen_random_uuid(), 'affiliate_commission_percentage', '20.00', 'Percentagem de comissão para afiliados (ex: 20.00 = 20%)')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 18. VIEWS (OPCIONAL)
-- =====================================================

-- View para estatísticas de afiliados
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

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
DO $$
DECLARE
    table_count INTEGER;
    missing_tables TEXT[] := ARRAY[]::TEXT[];
    required_tables TEXT[] := ARRAY[
        'users', 'email_verifications', 'workspaces', 'categories', 
        'installment_groups', 'transactions', 'system_settings', 
        'recurring_transactions', 'password_resets', 'audit_logs', 
        'savings_goals', 'telegram_pending_transactions', 
        'category_mapping_cache', 'affiliate_referrals', 
        'affiliate_commissions'
    ];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY required_tables
    LOOP
        SELECT COUNT(*) INTO table_count
        FROM information_schema.tables 
        WHERE table_name = tbl;
        
        IF table_count = 0 THEN
            missing_tables := array_append(missing_tables, tbl);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Tabelas faltando: %', array_to_string(missing_tables, ', ');
    ELSE
        RAISE NOTICE '✓ Migração concluída com sucesso! Todas as % tabelas estão presentes.', array_length(required_tables, 1);
    END IF;
END $$;

