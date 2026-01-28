# Top 10 gráficos para a Análise Pro

Sugestão de gráficos para a secção "Análise Pro", usando **todas** as fontes de dados do site: transações, categorias, metas, recorrentes, cofre, afiliados, snapshot do dashboard e insights.

---

## 1. **Evolução do saldo / património líquido (Area ou Line)**
- **Dados:** Transações ao longo do tempo → saldo acumulado (cumulative_balance).
- **Porquê:** Mostra a tendência real: "Para onde estou a ir?" – subida ou descida ao longo dos meses.
- **Já existe:** Sim (evolution no processedData). Vale a pena dar destaque como primeiro gráfico "choque".
- **Cabe em 1/3 do ecrã?** ❌ Não – muitos pontos no eixo do tempo; usar **2/3 ou linha inteira**.

---

## 2. **Comparação período atual vs anterior (Bar)**
- **Dados:** Receitas, despesas e saldo do período atual vs período anterior (dashboard snapshot + filtro por mês).
- **Porquê:** Resposta direta: "Estou melhor ou pior que no mês passado?"
- **Já existe:** Sim (periodComparison).
- **Cabe em 1/3 do ecrã?** ⚠️ Apertado – 3 grupos × 2 barras; melhor em **1/2 ou 2/3**.

---

## 3. **Distribuição de despesas por categoria (Pie ou Donut)**
- **Dados:** Transações + categorias → soma por categoria (apenas despesas, excluindo cofre).
- **Porquê:** "Onde vai o meu dinheiro?" – visão de peso de cada categoria.
- **Já existe:** Sim (distribution).
- **Cabe em 1/3 do ecrã?** ✅ Sim – Pie/donut é compacto; legenda em baixo ou tooltip.

---

## 4. **Volume de atividade (transações por mês) (Bar)**
- **Dados:** Contagem de transações por mês.
- **Porquê:** Ritmo de uso (Telegram + manual) e consistência do registo.
- **Já existe:** Sim (volumeByMonth).
- **Cabe em 1/3 do ecrã?** ❌ Não – vários meses + eixo Y; usar **2/3**.

---

## 5. **Despesas por dia do mês (Bar)**
- **Dados:** Soma de despesas por dia 1–31 (padrão: em que dias gastas mais).
- **Porquê:** Identificar picos (ex.: dia do ordenado, fim de semana) e planeamento.
- **Já existe:** Sim (expensesByDayOfMonth).
- **Cabe em 1/3 do ecrã?** ❌ Não – 31 barras; usar **2/3 ou linha inteira**.

---

## 6. **Ticket médio por categoria (Bar horizontal)**
- **Dados:** Valor médio por transação em cada categoria de despesa.
- **Porquê:** "Onde gasto em grandes golpes vs muitos pequenos?" – eficiência e tipo de gasto.
- **Já existe:** Sim (ticketMedioByCategory).
- **Cabe em 1/3 do ecrã?** ❌ Não – nomes de categorias + barras horizontais; usar **2/3 ou full**.

---

## 7. **Recorrentes vs variáveis (Donut ou barras de progresso)**
- **Dados:** Transações + regras recorrentes → separar despesa recorrente (subscrições) vs variável.
- **Porquê:** Peso das subscrições no orçamento – crucial para cortes e controlo.
- **Já existe:** Sim (recurringVsVariable).
- **Cabe em 1/3 do ecrã?** ✅ Sim – só 2 segmentos (barras de progresso ou donut pequeno).

---

## 8. **Progresso das metas (Bar de progresso por meta)**
- **Dados:** Goals (target_amount_cents, current_amount_cents) + eventual ligação a categorias/cofre.
- **Porquê:** "Quão perto estou de cada objetivo?" – motivação e prioridades.
- **Já existe:** Sim (bloco de metas com goals).
- **Cabe em 1/3 do ecrã?** ✅ Sim – lista vertical de barras de progresso; pouco largo.

---

## 9. **Cofre: Emergência vs Investimento (Bar ou composição)**
- **Dados:** Transações em categorias com vault_type (emergency / investment) → totais e evolução.
- **Porquê:** Ver reserva de emergência e poupança/investimento em conjunto com o resto.
- **Já existe:** Sim (secção Cofres com emergencyTotal, investmentTotal).
- **Cabe em 1/3 do ecrã?** ✅ Sim – dois blocos (valor + barra) ou mini bar; poucos elementos.

---

## 10. **Ritmo semanal (em que dias da semana gastas mais) (Bar)**
- **Dados:** Transações agrupadas por dia da semana (0–6) → total de despesas por dia.
- **Porquê:** Padrão "fim de semana vs semana" – já tens weekly no processedData; pode ser um gráfico dedicado em vez de só texto.
- **Cabe em 1/3 do ecrã?** ✅ Sim – só 7 barras (Seg–Dom); labels curtos (S T Q Q S S D).

---

## Bónus (se tiveres utilizadores Pro com afiliados)

### 11. **Ganhos de afiliado ao longo do tempo (Line ou Area)**
- **Dados:** `/affiliate/stats` ou `/admin/affiliates/revenue-timeline` (para admin).
- **Porquê:** Para afiliados: ver evolução dos ganhos; para admin: visão global da receita por afiliado.
- **Cabe em 1/3 do ecrã?** ❌ Não – série temporal; usar **2/3 ou full**.

### 12. **Categorias em risco (lista ou mini bar)**
- **Dados:** Categorias com limite mensal (monthly_limit_cents) vs gasto atual no período.
- **Porquê:** "Quais categorias estão perto de estourar o limite?" – já existe (categoriesAtRisk).
- **Cabe em 1/3 do ecrã?** ✅ Sim – lista com bullet ou mini indicador; não precisa de eixos.

---

## Cabe em 1/3 do ecrã?

Em layout de 3 colunas (cada uma ≈ 1/3 da largura), estes gráficos **funcionam bem em 1/3**:

| Gráfico | Cabe em 1/3? | Notas |
|---------|--------------|--------|
| **Distribuição por categoria (Pie/Donut)** | ✅ Sim | Pie/donut é compacto; legenda pode ficar em baixo ou tooltip. |
| **Recorrentes vs variáveis** | ✅ Sim | Só 2 segmentos (barras de progresso ou donut pequeno). |
| **Progresso das metas** | ✅ Sim | Lista vertical de barras de progresso; ocupa pouco largo. |
| **Cofre (Emergência vs Investimento)** | ✅ Sim | Dois blocos (valor + barra) ou mini bar; poucos elementos. |
| **Categorias em risco** | ✅ Sim | Lista com bullet ou mini indicador; não precisa de eixos. |
| **Ritmo semanal (7 dias)** | ✅ Sim | Só 7 barras (Seg–Dom); dá para compactar com labels curtos. |
| **Concentração “X% em 2 categorias”** | ✅ Sim | Um número + dois nomes; bloco KPI puro. |

Estes **precisam de mais largura** (2/3 ou linha inteira):

| Gráfico | Cabe em 1/3? | Notas |
|---------|--------------|--------|
| **Evolução do saldo (Area/Line)** | ❌ Não | Muitos pontos no tempo; eixo X precisa de espaço. → **2/3 ou full** |
| **Comparação atual vs anterior (Bar)** | ⚠️ Apertado | 3 grupos × 2 barras + labels; legível em 1/2, em 1/3 fica denso. → **1/2 ou 2/3** |
| **Volume por mês (Bar)** | ❌ Não | Vários meses + eixo Y; em 1/3 as barras ficam finas. → **2/3** |
| **Despesas por dia do mês (1–31)** | ❌ Não | 31 barras; precisa de largura para leitura. → **2/3 ou full** |
| **Ticket médio por categoria (Bar horizontal)** | ❌ Não | Nomes de categorias + barras horizontais; exige coluna larga. → **2/3 ou full** |
| **Ganhos de afiliado (Line/Area)** | ❌ Não | Série temporal; mesmo caso que evolução do saldo. → **2/3 ou full** |

---

## Resumo – Ordem sugerida na Análise Pro

| # | Gráfico | Fonte de dados | Já na app? | **Cabe em 1/3?** |
|---|---------|----------------|------------|------------------|
| 1 | Evolução saldo / património | Transações → cumulative | Sim (evolution) | ❌ 2/3 ou full |
| 2 | Atual vs anterior (receitas, despesas, saldo) | Snapshot + período | Sim | ⚠️ 1/2–2/3 |
| 3 | Distribuição por categoria (Pie) | Transações + categorias | Sim | ✅ Sim |
| 4 | Volume por mês (nº transações) | Transações | Sim | ❌ 2/3 |
| 5 | Despesas por dia do mês (1–31) | Transações | Sim | ❌ 2/3 ou full |
| 6 | Ticket médio por categoria | Transações + categorias | Sim | ❌ 2/3 ou full |
| 7 | Recorrentes vs variáveis | Transações + recurring | Sim | ✅ Sim |
| 8 | Progresso das metas | Goals | Sim | ✅ Sim |
| 9 | Cofre (emergência + investimento) | Transações (vault_type) | Sim | ✅ Sim |
| 10 | Ritmo semanal (dia da semana) | Transações → weekly | Dados sim | ✅ Sim |
| (bónus) | Categorias em risco | Limites + gastos | Sim | ✅ Sim |
| (bónus) | Concentração top 2 categorias | distribution | Sim | ✅ Sim |
| (bónus) | Ganhos de afiliado (timeline) | /affiliate/stats | — | ❌ 2/3 ou full |

---

## Sugestão de layout em grid (exemplo)

- **Linha 1:** Evolução do saldo (2/3) | Categorias em risco ou Resumo período (1/3)  
- **Linha 2:** Comparação atual vs anterior (2/3) | Distribuição Pie (1/3)  
- **Linha 3:** Volume por mês (1/2) | Despesas por dia do mês (1/2)  
- **Linha 4:** Distribuição por categoria ou Ticket médio (2/3) | Concentração top 2 (1/3)  
- **Linha 5:** Recorrentes vs variáveis (1/3) | Progresso metas (1/3) | Cofre (1/3)  
- **Linha 6:** Ritmo semanal (1/3) | [outro 1/3] | [outro 1/3]

Assim, **7–8 gráficos** podem viver confortavelmente em colunas de **1/3**; o resto fica em **2/3 ou linha inteira** para não ficar ilegível.
