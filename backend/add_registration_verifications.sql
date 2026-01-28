-- =====================================================
-- Tabela: registration_verifications
-- Códigos de 6 dígitos enviados por email para confirmar
-- o registo (fluxo tipo "esqueci password").
-- =====================================================
-- Campos obrigatórios para o fluxo:
--   id, email, password_hash, language, referral_code?, code, expires_at, is_used
-- created_at é opcional (só auditoria).
-- =====================================================

CREATE TABLE IF NOT EXISTS registration_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR NOT NULL,
    password_hash VARCHAR NOT NULL,
    language VARCHAR(5) NOT NULL DEFAULT 'pt',
    referral_code VARCHAR(20),
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE
    -- created_at opcional: DEFAULT NOW() para auditoria
);

CREATE INDEX IF NOT EXISTS ix_registration_verifications_email ON registration_verifications(email);
