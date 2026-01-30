# Checklist: Alterar a BD sem perder nada no Render

Quando **adicionas ou alteras campos/tabelas** na base de dados, segue sempre este fluxo. Assim a BD no Render fica igual à local e não perdes dados nem quebras o deploy.

---

## O que NUNCA fazer

- **Nunca** alterar só a BD local (pgAdmin, SQL direto, etc.) e fazer push do código sem migration.
- **Nunca** criar só um ficheiro `.sql` solto e esperar que o Render o execute (ele não executa).
- **Nunca** editar a BD de produção no Render à mão para “meter” colunas novas.

Se fizeres isto, o código em produção espera colunas que não existem na BD do Render → erros ou perda de contexto.

---

## O que SEMPRE fazer (fluxo correto)

### 1. Alterar o modelo no código

- Edita `app/models/database.py`: nova coluna, nova tabela, etc.

### 2. Criar uma migration Alembic

Na pasta **backend** (onde está `alembic.ini`):

```bash
cd SaaS/backend
alembic revision -m "add_nome_do_campo_ou_tabela"
```

Isto cria um ficheiro em `alembic/versions/`. Abre-o e preenche:

- **`upgrade()`**: e.g. `op.add_column('nome_tabela', sa.Column('nome_coluna', sa.String(255), nullable=True))` ou `op.create_table(...)`.
- **`downgrade()`**: o inverso (e.g. `op.drop_column(...)` ou `op.drop_table(...)`).

### 3. Testar localmente

Com a tua BD local a correr e `DATABASE_URL` no `.env`:

```bash
cd SaaS/backend
alembic upgrade head
```

Se der erro, corrige a migration. Só avança quando `alembic upgrade head` correr sem erros.

### 4. Commit e push

```bash
git add SaaS/backend/app/models/database.py
git add SaaS/backend/alembic/versions/   # o ficheiro novo
git commit -m "feat: add X to database (migration)"
git push
```

### 5. O que acontece no Render

O **Start Command** do backend no Render está configurado assim:

```text
alembic upgrade head && uvicorn app.main:app ...
```

Em cada deploy, o Render corre primeiro `alembic upgrade head` (aplica as migrations na BD do Render) e só depois inicia o servidor. Por isso, desde que tenhas cometido e feito push das migrations, a BD no Render fica atualizada sozinha.

---

## Resumo rápido

| Quero…              | O que fazer |
|---------------------|------------|
| Nova coluna/tabela  | 1) Alterar `database.py` → 2) `alembic revision -m "..."` → 3) Preencher `upgrade()`/`downgrade()` → 4) `alembic upgrade head` local → 5) Commit + push |
| Ver estado das migrations | `alembic current` e `alembic history` |
| Voltar atrás local | `alembic downgrade -1` |

Se **sempre** seguires este fluxo, não voltas a “perder” alterações na BD do Render: elas passam a estar em ficheiros de migration versionados e aplicam-se em cada deploy.
