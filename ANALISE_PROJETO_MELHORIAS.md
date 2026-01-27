# Análise Completa do Projeto Finly — O Que Melhorar

**Data:** 2025-01-27  
**Âmbito:** Backend (FastAPI), Frontend (Next.js 16), arquitetura, segurança, performance, i18n e qualidade de código.

---

## 1. Resumo Executivo

O Finly é uma aplicação SaaS de gestão financeira pessoal com integração Telegram/WhatsApp, Stripe e painel de afiliados. A base está sólida (auth, CORS, rate limiting, JWT, i18n PT/EN), mas há **duplicação de lógica financeira**, **poucos testes**, **strings hardcoded**, **bugs no modelo de dados** e **oportunidades de performance** já documentadas no ROADMAP e em IDEIAS_OTIMIZACAO.

---

## 2. Stack e Estrutura

| Camada   | Stack |
|----------|--------|
| Backend  | FastAPI, SQLAlchemy, PostgreSQL, JWT (jose), bcrypt, Stripe, FastAPI-Mail, SlowAPI (rate limit) |
| Frontend | Next.js 16, React 19, Tailwind 4, Framer Motion, Recharts, SWR, Axios |
| Infra    | Render (referência em docs), Supabase (migrations) |

**Pontos fortes:** Separação backend/frontend clara, uso de SWR em dashboard/hooks, ErrorBoundary e CookieBanner no root layout, traduções centralizadas em `translations.ts`.

---

## 3. Backend — O Que Melhorar

### 3.1 Bug no modelo `Transaction`

O modelo `Transaction` define `__table_args__` **duas vezes** (linhas 120 e 128 em `database.py`). A segunda definição substitui a primeira. Deve existir uma única tupla com todos os constraints.

```python
# Atual (incorreto):
__table_args__ = (CheckConstraint('amount_cents <> 0'),)
# ... relationships ...
__table_args__ = (CheckConstraint('amount_cents <> 0'), ...)  # sobrescreve a primeira
```

**Ação:** Unir num único `__table_args__` e remover a duplicação.

---

### 3.2 Config — mistura de Pydantic e `os.getenv`

Em `config.py`, `SECRET_KEY` é tratado com `os.getenv()` e lógica condicional ao nível da classe. O Pydantic Settings está a ser usado em parte; o ideal é definir tudo via `BaseSettings` com `Field(env=...)` e validação em métodos `validator`, para ficar consistente e testável.

---

### 3.3 Migrações inline no `main.py`

A função `migrate_category_mapping_cache()` corre ao arranque da app e altera a BD com `ALTER TABLE`. Isto é frágil: falhas podem impedir o arranque e não fica histórico versionado.

**Ação:** Mover esta lógica para uma migração Alembic (ou script de migração explícito) e chamá-la fora do ciclo de vida normal da API.

---

### 3.4 Handler de validação (422) — possível fuga de dados

Em `main.py`:

```python
return JSONResponse(
    status_code=422,
    content={"detail": exc.errors(), "body": str(exc.body) if hasattr(exc, 'body') else None}
)
```

Incluir `body` na resposta pode expor dados sensíveis (passwords, tokens) em erros de validação.

**Ação:** Remover `"body"` da resposta em produção ou nunca incluir o body cru; manter só `detail` com os erros de campo.

---

### 3.5 Origens CORS hardcoded

As origens de produção estão em lista fixa no código (`finanzen-frontend.onrender.com`, `finanzen.pt`, etc.). Qualquer novo domínio exige deploy.

**Ação:** Manter apenas `ALLOWED_ORIGINS` (env) como fonte de verdade; em produção, não fazer merge automático com uma lista interna, para evitar surpresas e facilitar novos ambientes.

---

### 3.6 Testes quase inexistentes

Existe apenas `test_stripe_connect.py`. Não há testes unitários para auth, transações, categorias, insights ou Financial Engine.

**Ação:** Seguir o ROADMAP_MELHORIAS (Prioridade 5): pytest, fixtures, 10 testes essenciais (vault, net worth, saving rate, daily allowance, etc.) e integrar no CI.

---

### 3.7 Lógica financeira espalhada

Cálculos de income, expenses, vault, net worth e saving rate estão no frontend (dashboard, analytics, fire) e no backend (insights, transactions). O ROADMAP já propõe um **Financial Engine** centralizado e um endpoint `/financial/snapshot` (ou equivalente). Reduz bugs e inconsistências.

---

## 4. Frontend — O Que Melhorar

### 4.1 Strings hardcoded em português

Alguns textos não passam por `t.*`:

- `transactions/page.tsx`: "Insira o nome", "Nenhuma transação encontrada", "Tenta ajustar os teus filtros...", "Sem dados", "Mostrando X a Y de Z", "Fechar Detalhes", labels de optgroup "Investimentos e Poupança" e uso de `"Receitas"` em `document.querySelector`.

**Ação:** Criar chaves em `translations.ts` (pt/en) e usar só `t.dashboard.transactions.*` (ou secção apropriada) nestes pontos.

---

### 4.2 Uso de `document.querySelector` para lógica de UI

Em `transactions/page.tsx`, a escolha de “está em Receitas ou em Despesas” é feita com `document.querySelector('optgroup[label="Receitas"]')...`. Isto é frágil (muda com o idioma, com o DOM) e difícil de testar.

**Ação:** Derivar “é receita ou resgate” dos dados (`categories`, `formData.category_id`) e do tipo da categoria, sem depender do DOM.

---

### 4.3 Muitos `console.log` / `console.error`

Há dezenas de chamadas a `console.*` em 34+ ficheiros. Em produção poluem a consola e podem expor detalhes internos.

**Ação:** Usar um logger (ex.: pequeno helper que em dev faz `console.*` e em prod não, ou lib tipo `loglevel`) e substituir progressivamente; remover ou condicionar logs com dados sensíveis.

---

### 4.4 Tipos `any` nas traduções

Uso repetido de `const t = tRaw as any` e `const guide = t.dashboard.guide as any` para aceder a chaves profundas. Perde-se type-safety.

**Ação:** Introduzir tipos para as árvores de tradução (ex.: `DashboardTranslations`, `GuideTranslations`) ou gerar tipos a partir do objeto de traduções, e usar esses tipos em vez de `any`.

---

### 4.5 Tamanho do ficheiro de traduções

`translations.ts` tem mais de 2200 linhas e concentra PT e EN no mesmo ficheiro. Fica pesado para manter e para carregar.

**Ação:** A médio prazo, dividir por domínio (auth, dashboard, pricing, etc.) ou por idioma (`pt.ts`, `en.ts`) e importar sob demanda ou por namespace.

---

### 4.6 Polling e atualização de dados

Na página de transações há `setInterval(..., 60000)` a chamar `fetchData()` mesmo quando o separador não está visível.

**Ação:** Condicionar ao `document.visibilityState` / evento `visibilitychange`, como sugerido em IDEIAS_OTIMIZACAO, para não fazer requests quando o utilizador não está na página.

---

### 4.7 Cache e chamadas à API

O dashboard já usa `useDashboardSnapshot` (SWR) e SWR noutros sítios. Algumas páginas (ex.: transactions, analytics) continuam a usar apenas `useState` + `useEffect` e várias chamadas em paralelo. O IDEAS_OTIMIZACAO recomenda um endpoint tipo `/dashboard/snapshot` (ou equivalente) e SWR em mais fluxos.

**Ação:** Alargar o uso do snapshot/SWR a mais páginas e evitar múltiplas chamadas redundantes onde já existir um endpoint agregado.

---

## 5. Segurança

- **Auth:** JWT com access/refresh, bcrypt para passwords, validação de email e regras de password no registo — positivo.
- **CORS:** Configurado, mas com origens de produção hardcoded — melhorar como em 3.5.
- **Rate limiting:** SlowAPI já usado — manter e rever limites por rota se necessário.
- **422 com body:** Risco de fuga de dados — corrigir como em 3.4.
- **Tokens:** Guardados em `localStorage` e `sessionStorage`. Para sessões muito sensíveis, considerar `httpOnly` cookies (exige ajustes no backend e CORS).

---

## 6. Performance (resumo)

Já há boa base (SWR, memoização no dashboard, LazyCharts). O documento IDEIAS_OTIMIZACAO descreve passos concretos:

- Menos chamadas (snapshot único).
- Remover atrasos artificiais de loading se ainda existirem.
- Debounce em pesquisas e filtros.
- Lazy load de modais e gráficos onde ainda não existir.
- Virtualização da lista de transações para muitos registos.
- Prefetch em hover em links críticos.

Priorizar conforme impacto vs esforço (ex.: snapshot + debounce + visibility no polling).

---

## 7. Priorização das Melhorias

### Curto prazo (1–2 semanas)

1. **Corrigir `__table_args__` duplicado** no modelo `Transaction`.
2. **Remover `body`** da resposta do handler de validação 422.
3. **Substituir strings hardcoded** em `transactions/page.tsx` por chaves de tradução.
4. **Deixar de usar `document.querySelector`** para “Receitas vs Despesas”; usar apenas dados (categorias + categoria selecionada).
5. **Condicionar o polling** na página de transações a `document.visibilityState`.

### Médio prazo (1–2 meses)

6. **Financial Engine** no backend + endpoint de snapshot, conforme ROADMAP.
7. **Testes automáticos** (pytest) para auth, transações e Financial Engine.
8. **Migrar a migração** de `category_mapping_cache` para Alembic (ou script dedicado) e tirá-la do `main.py`.
9. **Tipagem forte** das traduções e redução de `as any`.
10. **Consolidar CORS** às variáveis de ambiente, sem listas fixas no código.

### Longo prazo (roadmap existente)

11. Sistema de **Accounts** e **Daily Allowance** correto (ROADMAP).
12. **Health Score** explícito e **FIRE** com cenários e validações (ROADMAP).
13. **Virtualização** da lista de transações e **bundle analysis** (IDEAS_OTIMIZACAO).
14. **Split** do ficheiro de traduções e, se útil, logger frontend para substituir `console.*`.

---

## 8. Conclusão

O projeto está funcional e bem estruturado em várias áreas (auth, layout, i18n, integrações). As melhorias com maior impacto imediato são: correção do modelo `Transaction`, endurecer a resposta a erros de validação, eliminar strings hardcoded e lógica dependente do DOM na página de transações, e reduzir chamadas e loading desnecessário. A médio prazo, centralizar a lógica financeira e introduzir testes dará mais segurança para evoluir o produto, em linha com o ROADMAP_MELHORIAS e as IDEAS_OTIMIZACAO já definidos.
