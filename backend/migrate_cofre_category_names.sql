-- Migração: Renomear categorias de Cofre para nomes mais claros
-- De: Investimento/Investimentos | Fundo de Emergência
-- Para: Cofre Investimentos | Cofre Emergência
--
-- Executar: psql $DATABASE_URL -f migrate_cofre_category_names.sql
-- Ou no Supabase: SQL Editor → colar e executar

BEGIN;

-- Cofre Investimentos (vault_type = investment)
UPDATE categories
SET name = 'Cofre Investimentos',
    updated_at = NOW()
WHERE vault_type = 'investment'
  AND name IN ('Investimento', 'Investimentos');

-- Cofre Emergência (vault_type = emergency)
UPDATE categories
SET name = 'Cofre Emergência',
    updated_at = NOW()
WHERE vault_type = 'emergency'
  AND name IN ('Fundo de Emergência', 'Fundo de Emergencia');

COMMIT;
