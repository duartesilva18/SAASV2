# O Caminho Profissional: Migrations com Alembic

Este guia descreve o fluxo de **migrations** no projeto: alterar o modelo no código, gerar a migration, testar localmente e fazer deploy no Render com as migrations a correr automaticamente.

## Visão geral

1. **No teu PC:** Alterar o modelo no código e gerar o ficheiro de migration.
2. **Testar localmente:** Aplicar a migration na base local para garantir que funciona.
3. **Deploy:** Fazer `git push` para o GitHub. O Render detecta a mudança.
4. **Execução no Render:** O **Start Command** do backend já inclui `alembic upgrade head` antes de iniciar o servidor, por isso as migrations são aplicadas em cada deploy.

---

## 1. Alterar o modelo e gerar a migration

### 1.1 Alterar o modelo

Edita os ficheiros em `app/models/database.py` (novas tabelas, novas colunas, etc.).

### 1.2 Gerar o ficheiro de migration

Na pasta **backend** (onde está `alembic.ini`):

```bash
cd SaaS/backend
alembic revision -m "descrição da alteração"
```

Isto cria um ficheiro em `alembic/versions/` com funções `upgrade()` e `downgrade()` vazias. Preenche-as com as operações necessárias (`op.create_table`, `op.add_column`, etc.).

**Alternativa – autogenerate (quando o Alembic estiver configurado com metadata):**  
`alembic revision --autogenerate -m "descrição"` pode gerar o conteúdo a partir dos modelos (requer env.py a importar os modelos e `target_metadata`).

### 1.3 Exemplo de migration manual

Para uma nova tabela `registration_verifications`:

```python
def upgrade() -> None:
    op.create_table(
        'registration_verifications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('email', sa.String(), nullable=False, index=True),
        # ...
    )

def downgrade() -> None:
    op.drop_table('registration_verifications')
```

---

## 2. Testar localmente

Com a base de dados local (PostgreSQL) a correr e `DATABASE_URL` no `.env`:

```bash
cd SaaS/backend
alembic upgrade head
```

Se algo correr mal:

```bash
alembic downgrade -1   # volta uma migration
# ou
alembic current       # vê a revisão atual
alembic history       # vê o histórico
```

Só faz push quando `alembic upgrade head` correr sem erros na tua máquina.

---

## 3. Deploy (git push)

```bash
git add backend/alembic/
git add backend/alembic.ini
git commit -m "feat: add registration_verifications migration"
git push origin main
```

O Render faz um novo deploy quando deteta alterações no repositório.

---

## 4. Execução no Render

O backend está configurado para executar as migrations **antes** de iniciar o servidor.

### 4.1 Start Command (render.yaml)

No `render.yaml`, o serviço do backend usa:

```yaml
startCommand: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Ou, se usares o `start.sh`:

```yaml
startCommand: ./start.sh
```

O `start.sh` já faz:

1. Se existir `alembic.ini` e pasta `alembic`, corre `alembic upgrade head`.
2. Depois inicia o uvicorn.

Por isso não precisas de configurar mais nada no Render para as migrations correrem em cada deploy.

### 4.2 Onde não usar migrations

- **Build Command:** Não corras migrations no `buildCommand`. No build não tens garantia de ter `DATABASE_URL` (da Internal DB) e o build pode correr num ambiente sem rede para a DB.
- **Pre-deploy / Release Command:** No Render, a forma prática é usar o **Start Command** como acima. Não há “Release Command” separado para web services; “migrations + start” no mesmo comando é o padrão.

### 4.3 Se quiseres só migrar à mão no Render

1. Dashboard do Render → serviço **finanzen-backend** → **Shell**.
2. Na shell (já na root do backend):

   ```bash
   alembic upgrade head
   ```

Isto é útil para debug ou para correr migrations uma vez sem reiniciar o serviço.

---

## 5. Ficheiros importantes

| Ficheiro / pasta   | Função |
|--------------------|--------|
| `alembic.ini`      | Config do Alembic (script_location, logging). O URL da BD vem do `.env` via `env.py`. |
| `alembic/env.py`   | Usa `app.core.config.settings.DATABASE_URL` para ligar à base. |
| `alembic/versions/`| Ficheiros de migration (`*_add_foo.py`, etc.). |
| `alembic/script.py.mako` | Template para `alembic revision -m "..."`. |

---

## 6. Resumo do fluxo

```
1. Editas app/models/database.py
2. cd backend && alembic revision -m "add X"
3. Preenches upgrade() e downgrade() no ficheiro em alembic/versions/
4. alembic upgrade head   # testar localmente
5. git add, commit, push
6. Render faz deploy → Start Command corre "alembic upgrade head && uvicorn ..." → migrations aplicadas
```

Assim seguimos o “caminho profissional”: modelo no código, migrations versionadas, teste local e execução automática das migrations no deploy.
