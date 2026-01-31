-- =====================================================
-- CATEGORIZATION ENGINE MIGRATION
-- Token scoring, Gemini events, atualizações no cache
-- =====================================================

-- 1. TokenScores: scoring por token->categoria (privado por workspace e global)
CREATE TABLE IF NOT EXISTS token_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    token VARCHAR(100) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    count INTEGER NOT NULL DEFAULT 1,
    score NUMERIC(10, 4) NOT NULL DEFAULT 1.0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, token, category_id, transaction_type)
);

CREATE INDEX IF NOT EXISTS idx_token_scores_workspace_token ON token_scores(workspace_id, token, transaction_type);
CREATE INDEX IF NOT EXISTS idx_token_scores_updated ON token_scores(last_updated DESC);

COMMENT ON TABLE token_scores IS 'Aprendizagem por token: token->categoria com count e score (privado e global)';

-- 2. GeminiEvents: log de chamadas Gemini para métricas e circuit-breaker
CREATE TABLE IF NOT EXISTS gemini_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    request_description VARCHAR(500) NOT NULL,
    response_text VARCHAR(200),
    status_code INTEGER,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gemini_events_timestamp ON gemini_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gemini_events_workspace ON gemini_events(workspace_id) WHERE workspace_id IS NOT NULL;

COMMENT ON TABLE gemini_events IS 'Log de chamadas Gemini para métricas e controlo de quota';

-- 2b. Merchant registry: aliases e categoria sugerida
CREATE TABLE IF NOT EXISTS merchant_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alias VARCHAR(120) NOT NULL,
    canonical_name VARCHAR(120) NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    usage_count INTEGER NOT NULL DEFAULT 1,
    confidence NUMERIC(5, 4) NOT NULL DEFAULT 1.0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_registry_alias ON merchant_registry(alias);
CREATE INDEX IF NOT EXISTS idx_merchant_registry_type ON merchant_registry(transaction_type);

COMMENT ON TABLE merchant_registry IS 'Aliases de merchants e categoria sugerida para matching determinístico';

-- 3. Colunas opcionais em category_mapping_cache (se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='category_mapping_cache' AND column_name='confidence') THEN
        ALTER TABLE category_mapping_cache ADD COLUMN confidence NUMERIC(5, 4) DEFAULT 1.0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='category_mapping_cache' AND column_name='promoted_to_global') THEN
        ALTER TABLE category_mapping_cache ADD COLUMN promoted_to_global BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 4. Colunas opcionais em transactions (inference_source, needs_review)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='inference_source') THEN
        ALTER TABLE transactions ADD COLUMN inference_source VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='decision_reason') THEN
        ALTER TABLE transactions ADD COLUMN decision_reason VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='needs_review') THEN
        ALTER TABLE transactions ADD COLUMN needs_review BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 5. Colunas opcionais em telegram_pending_transactions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='telegram_pending_transactions' AND column_name='inference_source') THEN
        ALTER TABLE telegram_pending_transactions ADD COLUMN inference_source VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='telegram_pending_transactions' AND column_name='decision_reason') THEN
        ALTER TABLE telegram_pending_transactions ADD COLUMN decision_reason VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='telegram_pending_transactions' AND column_name='needs_review') THEN
        ALTER TABLE telegram_pending_transactions ADD COLUMN needs_review BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
