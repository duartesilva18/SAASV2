-- =====================================================
-- CORREÇÃO: Adicionar colunas de afiliado faltantes
-- Data: 2025-01-27
-- Descrição: Adiciona colunas de afiliado que estão faltando na tabela users
-- =====================================================

-- Verificar e adicionar colunas de afiliado se não existirem
DO $$
BEGIN
    -- Adicionar is_affiliate se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_affiliate'
    ) THEN
        ALTER TABLE users
        ADD COLUMN is_affiliate BOOLEAN NOT NULL DEFAULT FALSE;
        RAISE NOTICE 'Coluna is_affiliate adicionada';
    ELSE
        RAISE NOTICE 'Coluna is_affiliate já existe';
    END IF;

    -- Adicionar affiliate_code se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'affiliate_code'
    ) THEN
        ALTER TABLE users
        ADD COLUMN affiliate_code VARCHAR(20) UNIQUE;
        RAISE NOTICE 'Coluna affiliate_code adicionada';
    ELSE
        RAISE NOTICE 'Coluna affiliate_code já existe';
    END IF;

    -- Adicionar referrer_id se não existir (ESTA É A COLUNA QUE ESTÁ FALTANDO)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'referrer_id'
    ) THEN
        ALTER TABLE users
        ADD COLUMN referrer_id UUID;
        RAISE NOTICE 'Coluna referrer_id adicionada';
    ELSE
        RAISE NOTICE 'Coluna referrer_id já existe';
    END IF;

    -- Adicionar affiliate_requested_at se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'affiliate_requested_at'
    ) THEN
        ALTER TABLE users
        ADD COLUMN affiliate_requested_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Coluna affiliate_requested_at adicionada';
    ELSE
        RAISE NOTICE 'Coluna affiliate_requested_at já existe';
    END IF;
END $$;

-- Adicionar foreign key constraint para referrer_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_referrer_id_fkey'
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_referrer_id_fkey 
        FOREIGN KEY (referrer_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL;
        RAISE NOTICE 'Foreign key constraint para referrer_id adicionada';
    ELSE
        RAISE NOTICE 'Foreign key constraint para referrer_id já existe';
    END IF;
END $$;

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_users_affiliate_code ON users(affiliate_code) WHERE affiliate_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id) WHERE referrer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_affiliate ON users(is_affiliate);

-- Verificar se tudo foi criado corretamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'referrer_id'
    ) THEN
        RAISE NOTICE '✓ Migração concluída com sucesso! Todas as colunas de afiliado estão presentes.';
    ELSE
        RAISE EXCEPTION '✗ Erro: Coluna referrer_id não foi criada';
    END IF;
END $$;


