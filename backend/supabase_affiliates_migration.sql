-- ============================================
-- MIGRAÇÃO: SISTEMA DE AFILIADOS
-- ============================================
-- Este script cria todas as tabelas e funções necessárias
-- para o sistema de afiliados no Supabase/PostgreSQL
-- ============================================

-- 1. Adicionar colunas à tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS affiliate_code VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_users_affiliate_code ON users(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_id);
CREATE INDEX IF NOT EXISTS idx_users_is_affiliate ON users(is_affiliate);

-- 2. Criar tabela affiliates
CREATE TABLE IF NOT EXISTS affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL UNIQUE,
    commission_percentage NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    total_referrals INTEGER NOT NULL DEFAULT 0,
    total_conversions INTEGER NOT NULL DEFAULT 0,
    total_earnings_cents INTEGER NOT NULL DEFAULT 0,
    total_paid_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_commission_percentage CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    CONSTRAINT chk_total_earnings CHECK (total_earnings_cents >= 0),
    CONSTRAINT chk_total_paid CHECK (total_paid_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_affiliates_affiliate_id ON affiliates(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);
CREATE INDEX IF NOT EXISTS idx_affiliates_is_active ON affiliates(is_active);

-- 3. Criar tabela referrals
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(50),
    user_agent TEXT,
    has_converted BOOLEAN NOT NULL DEFAULT FALSE,
    conversion_date TIMESTAMPTZ,
    conversion_amount_cents INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_referral UNIQUE (affiliate_id, referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_has_converted ON referrals(has_converted);
CREATE INDEX IF NOT EXISTS idx_referrals_conversion_date ON referrals(conversion_date);

-- 4. Criar tabela commissions
CREATE TABLE IF NOT EXISTS commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_referrals INTEGER NOT NULL DEFAULT 0,
    total_conversions INTEGER NOT NULL DEFAULT 0,
    total_revenue_cents INTEGER NOT NULL DEFAULT 0,
    commission_percentage NUMERIC(5, 2) NOT NULL,
    commission_amount_cents INTEGER NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    payment_reference VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_month CHECK (month >= 1 AND month <= 12),
    CONSTRAINT chk_year CHECK (year >= 2020),
    CONSTRAINT chk_total_referrals CHECK (total_referrals >= 0),
    CONSTRAINT chk_total_conversions CHECK (total_conversions >= 0),
    CONSTRAINT chk_total_revenue CHECK (total_revenue_cents >= 0),
    CONSTRAINT chk_commission_amount CHECK (commission_amount_cents >= 0),
    CONSTRAINT unique_monthly_commission UNIQUE (affiliate_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id ON commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_month_year ON commissions(year, month);
CREATE INDEX IF NOT EXISTS idx_commissions_is_paid ON commissions(is_paid);

-- 5. Criar tabela affiliate_settings
CREATE TABLE IF NOT EXISTS affiliate_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    default_commission_percentage NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    admin_email VARCHAR(255),
    is_system_active BOOLEAN NOT NULL DEFAULT TRUE,
    min_payout_cents INTEGER NOT NULL DEFAULT 1000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_default_commission CHECK (default_commission_percentage >= 0 AND default_commission_percentage <= 100),
    CONSTRAINT chk_min_payout CHECK (min_payout_cents >= 0)
);

-- Inserir configurações padrão se não existirem
INSERT INTO affiliate_settings (id, default_commission_percentage, is_system_active, min_payout_cents)
VALUES (gen_random_uuid(), 10.00, TRUE, 1000)
ON CONFLICT DO NOTHING;

-- 6. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON affiliates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commissions_updated_at BEFORE UPDATE ON commissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliate_settings_updated_at BEFORE UPDATE ON affiliate_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Função para prevenir auto-referências (proteção contra fraude)
CREATE OR REPLACE FUNCTION prevent_self_referral()
RETURNS TRIGGER AS $$
DECLARE
    affiliate_user_id UUID;
BEGIN
    -- Obter o ID do utilizador afiliado
    SELECT affiliate_id INTO affiliate_user_id
    FROM affiliates
    WHERE id = NEW.affiliate_id;
    
    -- Verificar se o utilizador está a tentar referir-se a si mesmo
    IF NEW.referred_user_id = affiliate_user_id THEN
        RAISE EXCEPTION 'Não é possível usar o próprio link de afiliado';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER prevent_self_referral_trigger
    BEFORE INSERT ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION prevent_self_referral();

-- 8. Função para atualizar estatísticas do afiliado quando uma referência é criada
CREATE OR REPLACE FUNCTION update_affiliate_stats_on_referral()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE affiliates
    SET total_referrals = total_referrals + 1,
        updated_at = NOW()
    WHERE id = NEW.affiliate_id;
    
    -- Atualizar referred_by_id no utilizador
    UPDATE users
    SET referred_by_id = (SELECT affiliate_id FROM affiliates WHERE id = NEW.affiliate_id)
    WHERE id = NEW.referred_user_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_affiliate_stats_on_referral_trigger
    AFTER INSERT ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_affiliate_stats_on_referral();

-- 9. Função para atualizar estatísticas quando há conversão
CREATE OR REPLACE FUNCTION update_affiliate_stats_on_conversion()
RETURNS TRIGGER AS $$
DECLARE
    commission_amount INTEGER;
    affiliate_record RECORD;
BEGIN
    -- Só processar se foi marcado como convertido e ainda não estava convertido
    IF NEW.has_converted = TRUE AND (OLD.has_converted IS NULL OR OLD.has_converted = FALSE) THEN
        -- Obter informações do afiliado
        SELECT * INTO affiliate_record
        FROM affiliates
        WHERE id = NEW.affiliate_id;
        
        -- Calcular comissão
        commission_amount := (NEW.conversion_amount_cents * affiliate_record.commission_percentage) / 100;
        
        -- Atualizar estatísticas
        UPDATE affiliates
        SET total_conversions = total_conversions + 1,
            total_earnings_cents = total_earnings_cents + commission_amount,
            updated_at = NOW()
        WHERE id = NEW.affiliate_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_affiliate_stats_on_conversion_trigger
    AFTER UPDATE ON referrals
    FOR EACH ROW
    WHEN (NEW.has_converted = TRUE AND (OLD.has_converted IS NULL OR OLD.has_converted = FALSE))
    EXECUTE FUNCTION update_affiliate_stats_on_conversion();

-- 10. Função para calcular comissões mensais (executar no fim do mês)
CREATE OR REPLACE FUNCTION calculate_monthly_commissions(p_month INTEGER, p_year INTEGER)
RETURNS TABLE(
    affiliate_id UUID,
    total_referrals BIGINT,
    total_conversions BIGINT,
    total_revenue_cents BIGINT,
    commission_amount_cents BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH monthly_data AS (
        SELECT 
            r.affiliate_id,
            COUNT(*) as referrals_count,
            COUNT(*) FILTER (WHERE r.has_converted = TRUE) as conversions_count,
            COALESCE(SUM(r.conversion_amount_cents) FILTER (WHERE r.has_converted = TRUE), 0) as revenue
        FROM referrals r
        WHERE EXTRACT(MONTH FROM r.conversion_date) = p_month
          AND EXTRACT(YEAR FROM r.conversion_date) = p_year
          AND r.has_converted = TRUE
        GROUP BY r.affiliate_id
    )
    SELECT 
        md.affiliate_id,
        md.referrals_count,
        md.conversions_count,
        md.revenue,
        (md.revenue * a.commission_percentage / 100)::INTEGER as commission
    FROM monthly_data md
    JOIN affiliates a ON a.id = md.affiliate_id;
END;
$$ language 'plpgsql';

-- 11. View para estatísticas de afiliados (útil para relatórios)
CREATE OR REPLACE VIEW affiliate_stats_view AS
SELECT 
    a.id,
    a.code,
    u.email as affiliate_email,
    u.full_name as affiliate_name,
    a.commission_percentage,
    a.is_active,
    a.total_referrals,
    a.total_conversions,
    CASE 
        WHEN a.total_referrals > 0 
        THEN ROUND((a.total_conversions::NUMERIC / a.total_referrals::NUMERIC) * 100, 2)
        ELSE 0
    END as conversion_rate,
    a.total_earnings_cents,
    a.total_paid_cents,
    (a.total_earnings_cents - a.total_paid_cents) as pending_earnings_cents,
    a.created_at
FROM affiliates a
JOIN users u ON u.id = a.affiliate_id;

-- 12. View para top afiliados
CREATE OR REPLACE VIEW top_affiliates_view AS
SELECT 
    a.id,
    a.code,
    u.email as affiliate_email,
    u.full_name as affiliate_name,
    a.total_conversions,
    a.total_referrals,
    a.total_earnings_cents,
    ROW_NUMBER() OVER (ORDER BY a.total_conversions DESC, a.total_referrals DESC) as rank
FROM affiliates a
JOIN users u ON u.id = a.affiliate_id
WHERE a.is_active = TRUE
ORDER BY a.total_conversions DESC, a.total_referrals DESC;

-- 13. Comentários nas tabelas (documentação)
COMMENT ON TABLE affiliates IS 'Registos de afiliados e suas configurações';
COMMENT ON TABLE referrals IS 'Rastreamento de utilizadores referidos por afiliados';
COMMENT ON TABLE commissions IS 'Comissões mensais calculadas para cada afiliado';
COMMENT ON TABLE affiliate_settings IS 'Configurações globais do sistema de afiliados';

COMMENT ON COLUMN referrals.ip_address IS 'IP do utilizador no momento do registo (para deteção de fraude)';
COMMENT ON COLUMN referrals.user_agent IS 'User agent do utilizador (para deteção de fraude)';
COMMENT ON COLUMN commissions.is_paid IS 'Indica se a comissão já foi paga ao afiliado';
COMMENT ON COLUMN commissions.payment_reference IS 'Referência do pagamento (transferência, etc.)';

-- 14. Função para calcular comissões automaticamente (executa no primeiro dia do mês)
CREATE OR REPLACE FUNCTION auto_calculate_monthly_commissions()
RETURNS void AS $$
DECLARE
    v_month INTEGER;
    v_year INTEGER;
    v_comm RECORD;
    v_affiliate RECORD;
    v_user RECORD;
    v_settings RECORD;
BEGIN
    -- Obter mês anterior
    IF EXTRACT(MONTH FROM NOW()) = 1 THEN
        v_month := 12;
        v_year := EXTRACT(YEAR FROM NOW()) - 1;
    ELSE
        v_month := EXTRACT(MONTH FROM NOW()) - 1;
        v_year := EXTRACT(YEAR FROM NOW());
    END IF;
    
    -- Calcular comissões usando a função existente
    -- Nota: Esta função apenas calcula, não envia emails
    -- Os emails devem ser enviados pelo backend via API
    
    -- Obter configurações
    SELECT * INTO v_settings FROM affiliate_settings LIMIT 1;
    
    IF v_settings IS NULL OR NOT v_settings.is_system_active THEN
        RETURN;
    END IF;
    
    -- Calcular comissões para cada afiliado
    FOR v_affiliate IN 
        SELECT DISTINCT r.affiliate_id
        FROM referrals r
        WHERE EXTRACT(MONTH FROM r.conversion_date) = v_month
          AND EXTRACT(YEAR FROM r.conversion_date) = v_year
          AND r.has_converted = TRUE
    LOOP
        -- Verificar se já existe comissão para este mês
        SELECT * INTO v_comm
        FROM commissions
        WHERE affiliate_id = v_affiliate.affiliate_id
          AND month = v_month
          AND year = v_year;
        
        IF v_comm IS NULL THEN
            -- Criar nova comissão
            INSERT INTO commissions (
                affiliate_id, month, year,
                total_referrals, total_conversions, total_revenue_cents,
                commission_percentage, commission_amount_cents
            )
            SELECT 
                r.affiliate_id,
                v_month,
                v_year,
                COUNT(*) as referrals,
                COUNT(*) FILTER (WHERE r.has_converted = TRUE) as conversions,
                COALESCE(SUM(r.conversion_amount_cents) FILTER (WHERE r.has_converted = TRUE), 0) as revenue,
                a.commission_percentage,
                (COALESCE(SUM(r.conversion_amount_cents) FILTER (WHERE r.has_converted = TRUE), 0) * a.commission_percentage / 100)::INTEGER as commission
            FROM referrals r
            JOIN affiliates a ON a.id = r.affiliate_id
            WHERE r.affiliate_id = v_affiliate.affiliate_id
              AND EXTRACT(MONTH FROM r.conversion_date) = v_month
              AND EXTRACT(YEAR FROM r.conversion_date) = v_year
              AND r.has_converted = TRUE
            GROUP BY r.affiliate_id, a.commission_percentage;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Comissões calculadas automaticamente para %/%', v_month, v_year;
END;
$$ LANGUAGE plpgsql;

-- 15. Criar job agendado no Supabase (usando pg_cron se disponível)
-- Nota: pg_cron precisa de estar habilitado no Supabase
-- Para habilitar: ALTER EXTENSION pg_cron SET SCHEMA extensions;

-- Criar função wrapper que pode ser chamada pelo pg_cron
CREATE OR REPLACE FUNCTION schedule_monthly_commissions()
RETURNS void AS $$
BEGIN
    -- Esta função será chamada pelo pg_cron no primeiro dia de cada mês
    PERFORM auto_calculate_monthly_commissions();
END;
$$ LANGUAGE plpgsql;

-- Agendar job (executa no dia 1 de cada mês às 00:00)
-- Descomentar se pg_cron estiver disponível:
/*
SELECT cron.schedule(
    'calculate-monthly-commissions',
    '0 0 1 * *', -- Primeiro dia de cada mês às 00:00
    $$SELECT schedule_monthly_commissions()$$
);
*/

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================
-- Para executar este script no Supabase:
-- 1. Aceder ao SQL Editor
-- 2. Colar este script completo
-- 3. Executar
--
-- IMPORTANTE: Para emails automáticos, o backend precisa de ter
-- um cron job ou webhook que chame o endpoint:
-- POST /affiliates/admin/calculate-monthly-commissions
-- 
-- Alternativa: Configurar um cron job no servidor ou usar
-- um serviço como GitHub Actions, Vercel Cron, etc.
-- ============================================

