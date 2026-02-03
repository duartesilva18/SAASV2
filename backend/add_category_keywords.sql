-- Keywords por categoria (workspace): mapear palavras -> categoria (ex.: "uber" -> Transportes).
-- Idempotente: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS category_keywords (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    keyword VARCHAR(100) NOT NULL,
    PRIMARY KEY (workspace_id, category_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_category_keywords_workspace_keyword
ON category_keywords(workspace_id, keyword);
