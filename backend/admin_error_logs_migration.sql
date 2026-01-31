-- =====================================================
-- ADMIN ERROR LOGS MIGRATION
-- Tabela para erros críticos (dashboard de saúde)
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    exc_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_error_logs_created_at ON admin_error_logs(created_at DESC);

COMMENT ON TABLE admin_error_logs IS 'Erros críticos registados pelo handler global para o dashboard de saúde';
