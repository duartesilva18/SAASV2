-- =====================================================
-- Tabela: user_sessions
-- Controlo de sessões ativas por conta (máx. 2 utilizadores ligados)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_user_sessions_jti ON user_sessions(jti);
CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id ON user_sessions(user_id);
