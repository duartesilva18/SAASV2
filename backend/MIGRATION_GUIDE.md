# Guia de Migração - Adicionar Campo Language

## O que foi alterado?

Foi adicionado um novo campo `language` à tabela `users` para guardar a preferência de idioma de cada utilizador.

## Como executar a migração?

### Opção 1: Usando Alembic (Recomendado)

1. Navegue para a pasta do backend:
```bash
cd SaaS/backend
```

2. Execute a migração:
```bash
alembic upgrade head
```

### Opção 2: SQL Manual (Alternativa)

Se preferir executar manualmente na base de dados:

```sql
ALTER TABLE users ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'pt';
```

### Opção 3: Verificar estado das migrações

Para ver o estado atual das migrações:
```bash
alembic current
```

Para ver o histórico de migrações:
```bash
alembic history
```

## O que acontece após a migração?

- Todos os utilizadores existentes terão `language = 'pt'` (português) como padrão
- Novos utilizadores terão o idioma guardado conforme a seleção na página principal
- Os emails serão enviados no idioma correto para cada utilizador

## Reverter a migração (se necessário)

Se precisar de reverter a migração:
```bash
alembic downgrade -1
```

Ou manualmente:
```sql
ALTER TABLE users DROP COLUMN language;
```

