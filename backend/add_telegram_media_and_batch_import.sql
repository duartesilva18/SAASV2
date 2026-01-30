-- =====================================================
-- Tabelas: telegram_media_usage, telegram_pending_batch_imports
-- Controle de limite diário de media e importações em lote
-- =====================================================

CREATE TABLE IF NOT EXISTS telegram_media_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id VARCHAR NOT NULL,
    day DATE NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_telegram_media_usage_day UNIQUE (chat_id, day)
);

CREATE INDEX IF NOT EXISTS ix_telegram_media_usage_chat_id ON telegram_media_usage(chat_id);
CREATE INDEX IF NOT EXISTS ix_telegram_media_usage_day ON telegram_media_usage(day);

CREATE TABLE IF NOT EXISTS telegram_pending_batch_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id VARCHAR NOT NULL,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    items_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_telegram_pending_batch_imports_chat_id ON telegram_pending_batch_imports(chat_id);
