# Como Executar a Migração no Supabase

## 📋 Instruções Passo a Passo

### Opção 1: Via SQL Editor do Supabase (Recomendado)

1. **Acesse o Supabase Dashboard**
   - Vá para [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Faça login na sua conta
   - Selecione o seu projeto

2. **Abra o SQL Editor**
   - No menu lateral, clique em **"SQL Editor"**
   - Clique em **"New query"**

3. **Cole o Script SQL**
   - Abra o arquivo `supabase_complete_migration.sql`
   - Copie TODO o conteúdo (Ctrl+A, Ctrl+C)
   - Cole no editor SQL do Supabase (Ctrl+V)

4. **Execute o Script**
   - Clique no botão **"Run"** ou pressione `Ctrl+Enter`
   - Aguarde a execução (pode levar alguns segundos)

5. **Verifique o Resultado**
   - Você deve ver uma mensagem de sucesso: `✓ Migração concluída com sucesso!`
   - Se houver erros, verifique se já existem algumas tabelas/colunas

---

### Opção 2: Via psql (Linha de Comando)

Se você tem acesso ao banco via linha de comando:

```bash
# Conecte-se ao banco Supabase
psql "postgresql://postgres:[SUA_SENHA]@db.[SEU_PROJETO].supabase.co:5432/postgres"

# Execute o script
\i SaaS/backend/supabase_complete_migration.sql
```

---

### Opção 3: Via Supabase CLI

Se você tem o Supabase CLI instalado:

```bash
# Conecte-se ao projeto
supabase link --project-ref [SEU_PROJECT_REF]

# Execute o script
supabase db execute -f SaaS/backend/supabase_complete_migration.sql
```

---

## ✅ Verificação Pós-Migração

Após executar o script, verifique se tudo está correto:

### 1. Verificar Tabelas

Execute no SQL Editor do Supabase:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Você deve ver estas 15 tabelas:
- `affiliate_commissions`
- `affiliate_referrals`
- `audit_logs`
- `categories`
- `category_mapping_cache`
- `email_verifications`
- `installment_groups`
- `password_resets`
- `recurring_transactions`
- `savings_goals`
- `system_settings`
- `telegram_pending_transactions`
- `transactions`
- `users`
- `workspaces`

### 2. Verificar Colunas de Afiliado na Tabela users

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name IN ('is_affiliate', 'affiliate_code', 'referrer_id', 'affiliate_requested_at')
ORDER BY column_name;
```

Deve retornar 4 colunas:
- `affiliate_code` (VARCHAR)
- `affiliate_requested_at` (TIMESTAMP)
- `is_affiliate` (BOOLEAN)
- `referrer_id` (UUID)

### 3. Verificar Foreign Keys

```sql
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
```

---

## 🔧 Características do Script

✅ **Idempotente**: Pode ser executado múltiplas vezes sem causar erros
✅ **Seguro**: Verifica se tabelas/colunas existem antes de criar
✅ **Completo**: Cria todas as tabelas, colunas, índices, foreign keys e triggers
✅ **Comentado**: Código bem documentado para fácil manutenção

---

## ⚠️ Notas Importantes

1. **Backup**: Embora o script seja seguro, é sempre recomendado fazer backup antes de executar migrações em produção.

2. **Dados Existentes**: O script NÃO apaga dados existentes. Ele apenas adiciona o que está faltando.

3. **Permissões**: Certifique-se de que o usuário do banco tem permissões para criar tabelas, índices e constraints.

4. **Tempo de Execução**: Em bancos grandes, pode levar alguns minutos. Seja paciente.

---

## 🐛 Resolução de Problemas

### Erro: "relation already exists"
- **Causa**: A tabela já existe
- **Solução**: Isso é normal! O script usa `CREATE TABLE IF NOT EXISTS`, então pode ignorar este aviso

### Erro: "column already exists"
- **Causa**: A coluna já existe
- **Solução**: O script verifica antes de adicionar, mas se ainda assim aparecer, pode ignorar

### Erro: "constraint already exists"
- **Causa**: A constraint já existe
- **Solução**: O script verifica antes de criar, mas se aparecer, pode ignorar

### Erro: "permission denied"
- **Causa**: Usuário sem permissões suficientes
- **Solução**: Verifique se está usando o usuário correto (geralmente `postgres`)

---

## 📞 Suporte

Se encontrar problemas, verifique:
1. Logs do Supabase (Dashboard → Logs)
2. Mensagens de erro específicas
3. Se todas as extensões necessárias estão habilitadas (uuid-ossp)

---

## 🎉 Próximos Passos

Após executar a migração com sucesso:

1. ✅ Reinicie sua aplicação backend
2. ✅ Teste o registro de novos utilizadores
3. ✅ Teste o sistema de afiliados
4. ✅ Verifique se não há mais erros de "column does not exist"


