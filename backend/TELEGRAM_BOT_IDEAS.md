# Ideias para melhorar o Bot Telegram (FinanZen)

Sugestões organizadas por **processamento** (performance, IA, dados) e **funcionalidades** (comandos, UX, novas capacidades).

---

## 1. Processamento

### 1.1 Categorização e aprendizagem

- **Tabela de keywords por categoria (workspace):** permitir ao utilizador definir palavras-chave que mapeiam para uma categoria (ex.: "uber" → Transportes). Isto evita IA e melhora hits antes do histórico. Pode ser um comando `/categoria Transportes: uber, bolt, taxi` ou na app.
- **Similaridade fuzzy (Levenshtein/trigram):** além de palavras em comum, aceitar descrições “quase iguais” (ex.: "Almoco Pingo Doce" vs "Almoço Pingo Doce") com um threshold de distância. Aumenta hits de histórico sem IA.
- **Cache por substring:** além do cache exato (canonical), guardar ou consultar por substrings comuns (ex.: "Pingo Doce" em qualquer descrição → Alimentação). Cuidado com falsos positivos; pode ser só para termos muito usados.
- **Explicar ao utilizador a origem da categoria:** na mensagem de confirmação, indicar brevemente “por histórico” / “por cache” / “por regra” / “por IA”. Aumenta confiança e permite corrigir se vier errado.
- **Correção e reaprendizagem:** comando ou botão “Mudar categoria para X” numa transação pendente; ao confirmar, atualizar cache e (se existir) token_scores para essa descrição → o bot aprende com a correção.

### 1.2 Fotos (Vision)

- **Compressão de imagem antes de enviar à API:** redimensionar ou comprimir imagens grandes (ex.: max 1024px ou JPEG 85%) para reduzir tokens e custo, mantendo legibilidade para recibos.
- **Timeout e retry com backoff:** em caso de 429 ou timeout da Vision, fazer 1–2 retries com espera curta e mensagem “A processar…” para não parecer que o bot ignorou.
- **Suporte a documento (PDF):** hoje só imagem. Se quiseres recibos em PDF, seria um fluxo à parte (extrair texto do PDF ou enviar páginas como imagem para a Vision), com custo e complexidade maiores.

### 1.3 Texto e parsing

- **Reconhecer mais formatos de valor:** "15 euros", "15e", "15.50", "15,50€", "15 000€" (espaço como separador de milhares). O regex atual já cobre boa parte; rever edge cases a partir de mensagens reais.
- **Datas na mensagem:** aceitar “Almoço 15€ 28/01” ou “15€ dia 28” e usar essa data em vez de hoje. Útil para registar despesas passadas.
- **Múltiplas transações por linha mais flexível:** melhorar a extração quando há várias quantias na mesma frase (ex.: “Café 2€ e pastel 3€”) para criar duas linhas em vez de uma.
- **Idioma da mensagem:** detetar PT/EN (ou usar definição do user) para respostas e para melhorar token scoring/cache por idioma se no futuro tiveres descrições em ambos.

### 1.4 Performance e custo

- **Rate limit por utilizador (IA):** além do rate limit global de mensagens, limitar chamadas à IA por user/dia (ex.: 20/dia) para evitar abuso e controlar custo.
- **Circuit-breaker por workspace:** já existe no motor; garantir que no Telegram também se respeita (não chamar IA se o circuito estiver aberto) e que a mensagem ao user é clara (“Muitos pedidos; tenta mais tarde”).
- **Índices na BD:** garantir índices em `transaction_date`, `workspace_id`, `description` (ou canonical) nas tabelas usadas para histórico e cache, para que find_similar e get_cached_category sejam rápidos com muitos dados.
- **Cache em memória (opcional):** para get_cached_category, um cache em memória (ex.: TTL 5 min) por workspace reduz leituras à BD em picos de uso; invalidação ao save_cached_category.

---

## 2. Funcionalidades

### 2.1 Comandos novos

- **`/resumo` ou `/hoje`:** enviar um resumo do dia (total despesas, total receitas, número de transações). Dados do workspace do user.
- **`/mes`:** resumo do mês atual (totais por categoria ou total geral).
- **`/pendentes`:** listar transações pendentes (se houver) com botões para confirmar/cancelar cada uma, em vez de só /clear tudo.
- **`/categoria [nome]` ou `/definir`:** definir categoria por defeito para as próximas mensagens (ex.: “tudo o que enviar agora é Alimentação até dizer stop”). Reduz confirmações quando o user está a registar muitas da mesma categoria.
- **`/ajuda`:** atalho para o mesmo que /info ou uma mensagem mais curta com os comandos disponíveis.
- **`/desligar` ou `/pause`:** desativar temporariamente o processamento de transações (só responder a comandos). Útil para quem usa o chat para outras coisas.
- **`/idioma pt|en`:** mudar idioma das mensagens do bot para o user (gravar em User.language e usar nas traduções).
/desaçociar chat a conta
### 2.2 Confirmação e listas

- **Confirmar/cancelar por linha na lista:** além de “Confirmar tudo” e “Cancelar tudo”, permitir “Cancelar linha 2” ou botões por item (ex.: ✅❌ por linha). Mais flexível quando uma linha está errada.
- **Editar valor ou categoria antes de confirmar:** botão “Editar” numa transação pendente que leva a um mini-fluxo (valor ou categoria) e depois volta à confirmação.
- **Reenviar última lista:** se o user cancelar por engano, comando “Reenviar última lista” (guardar último batch_id cancelado ou último texto por chat com TTL curto).

### 2.3 Notificações e lembretes

- **Lembrete diário (opcional):** “Regista as despesas de hoje” a uma hora configurável (ex.: 20h). Requer job/cron e preferência por user (ativar/desativar e hora).
- **Resumo semanal por mensagem:** enviar ao domingo um resumo da semana (totais, top categorias). Opt-in por user.
- **Aviso quando há muitas pendentes:** ex.: “Tens 5 transações por confirmar. Usa /pendentes ou /clear.”

### 2.4 Integração com o resto da app

- **Metas (goals):** comando `/meta Nome 100€` para criar uma meta de poupança ou “Adicionar 20€ à meta X” para depositar numa meta existente (chamar API de goals).
- **Cofre/vault:** “Depositar 50€ no Cofre” ou “Retirar 30€ do Cofre” a partir de texto, com confirmação.
- **Ligação a conta:** fluxo para associar conta (ex.: link para a app ou token de ligação) e mostrar saldo ou últimas transações por comando (ex.: `/saldo`).

### 2.5 UX e mensagens

- **Resposta rápida “A processar…”:** para fotos ou mensagens longas, enviar logo uma mensagem “A processar…” e depois editar ou enviar o resultado, para o user não achar que o bot não respondeu.
- **Formatação consistente:** usar a mesma estrutura (emoji, ordem campos) em todas as mensagens de transação (pendente, confirmada, lista) para reconhecimento visual.
- **Sugestão após primeira transação:** após a primeira transação confirmada, enviar uma dica curta: “Dica: podes enviar várias assim: Almoço 15€ Gasolina 40€”.
- **Mensagem de boas-vindas melhorada:** no /start, incluir 1–2 exemplos de mensagem e referência a /info e /clear.

### 2.6 Segurança e limites

- **Limite de pendentes por chat:** ex.: máx 20 pendentes; acima disso pedir para confirmar ou usar /clear antes de aceitar mais.
- **Comando /revoke:** desvincular o Telegram da conta (limpar phone_number e opcionalmente invalidar sessão), para o user poder “sair” do bot.
- **Log de ações sensíveis:** registrar em log (ou auditoria) quando se desvincula conta, /clear em massa, ou quando há muitas chamadas IA num curto período.

---

## 3. Priorização sugerida (rápido impacto)

| Prioridade | Ideia | Esforço | Impacto |
|------------|--------|---------|--------|
| Alta | Explicar origem da categoria (“por histórico”) | Baixo | Confiança + debug |
| Alta | Comando `/resumo` ou `/hoje` | Baixo | Utilidade diária |
| Alta | Resposta “A processar…” para fotos | Baixo | UX |
| Média | Similaridade fuzzy (Levenshtein) no histórico | Médio | Menos IA |
| Média | Comando `/pendentes` com botões por item | Médio | Flexibilidade |
| Média | Keywords por categoria (workspace) | Médio | Menos IA + personalização |
| Baixa | Lembrete diário opt-in | Médio | Engajamento |
| Baixa | Editar valor/categoria antes de confirmar | Alto | UX avançada |

---

## 4. Onde implementar (referência)

- **Processamento/categorização:** `app/webhooks/telegram.py` (parse_transaction, find_similar_transaction, get_cached_category, categorize_with_ai) e `app/core/categorization_engine.py`.
- **Comandos:** mesmo ficheiro, bloco onde se trata `text.startswith('/...)`.
- **Novos endpoints (resumo, metas):** `app/routes/` (ex.: dashboard, goals) e chamadas a partir do webhook.
- **Traduções:** `app/core/telegram_translations.py`.
- **Documentação da lógica:** `TELEGRAM_BOT_LOGIC.md`.

Se quiseres, podemos pegar numa destas ideias (ex.: `/resumo` ou “origem da categoria”) e desenhar o fluxo e as alterações ficheiro a ficheiro.

---

## 5. Mais ideias (foco em lógica)

Sugestões extra para **lógica de parsing**, **categorização**, **batch**, **consistência** e **aprendizagem**.

### 5.1 Parsing e extração

- **Descrição “canónica” por valor:** ao extrair várias transações (“A 10€ B 20€”), atribuir a cada valor a descrição mais próxima no texto (ex.: texto entre o valor anterior e o atual). Evita “A” ficar com 20€ ou “B” com 10€.
- **Receita vs despesa mais rica:** além de “recebi”, “salário”, reconhecer “venda”, “reembolso”, “devolução”, “cashback”, “entrada”; e “pago”, “paguei”, “debitado”, “saída”. Reduz erros de tipo.
- **Valores negativos explícitos:** aceitar “-15€” ou “15€ negativo” como despesa de 15€ sem depender de palavras-chave.
- **Ignorar números na descrição para cache/histórico:** “Almoço 15€” e “Almoço 20€” devem partilhar a mesma chave de cache / mesmo match no histórico (descrição lógica = “Almoço”). Já existe canonicalize; garantir que números no meio da frase não quebram o match.
- **Limites de valor:** rejeitar ou avisar se valor > 999 999€ ou < -999 999€ para evitar erros de parsing ou input acidental.
- **Truncagem de descrição:** garantir max 255 caracteres e truncar com "…" antes de guardar (evitar erro na BD).

### 5.2 Categorização (waterfall e motor)

- **Circuit-breaker no Telegram:** antes de chamar `categorize_with_ai`, chamar `check_gemini_circuit_breaker(db, models, workspace_id)`. Se aberto, não chamar IA e devolver mensagem `ai_busy` (ou equivalente). Alinha com o motor e evita custo em picos.
- **Match fuzzy da categoria devolvida pela IA:** se a IA devolver um nome que não existe exatamente no workspace (ex.: “Alimentação” vs “Alimentação e Bebidas”), usar `find_best_category_match` antes de fallback para “primeira categoria”. Reduz frustração.
- **Histórico: peso por recência:** em `find_similar_transaction`, dar mais peso a transações dos últimos 7/30 dias (já há algum; pode subir o bónus) para refletir mudanças de hábitos.
- **Cache por substring (conservador):** além da chave canonical exata, permitir lookup por substrings muito comuns (ex.: se “Pingo Doce” está no cache como Alimentação, qualquer descrição que *contenha* “Pingo Doce” usar essa categoria). Apenas para termos com N confirmações (ex.: ≥3) para evitar falsos positivos.
- **Prioridade tipo na similaridade:** em `find_similar_transaction` já se filtra por expense/income; garantir que transações do mesmo tipo têm prioridade absoluta (nunca devolver categoria de despesa para uma receita e vice-versa).

### 5.3 Batch e pendentes

- **Ordenação explícita no batch:** ao construir a lista “• A — 10€ … • B — 20€”, usar a mesma ordem em que os valores aparecem no texto (ou por `created_at`). Evita confusão entre mensagem e BD.
- **Expiração de pendentes:** após X horas (ex.: 24h ou 48h), marcar pendentes como “stale” ou não contá-los para o limite de 20; ou enviar aviso “Tens transações pendentes há mais de 24h. Confirma ou usa /clear.”
- **Deduplicação suave:** se a nova mensagem (canonical + valor + tipo) for igual a uma pendente já existente no chat, não criar outro pendente; enviar “Já tens esta transação pendente. Confirma ou cancela na mensagem original.”
- **Idempotência do webhook:** usar `update_id` ou `message_id` do Telegram como chave de idempotência (em cache/Redis ou BD) para ignorar reenvios do mesmo update e não duplicar transações.

### 5.4 Vision (lógica)

- **Múltiplos itens numa foto:** alguns recibos têm várias linhas (ex.: café 2€, pastel 3€). No prompt da Vision, pedir “lista de itens com valor” e devolver array; no backend criar várias transações (ou um batch) em vez de uma única.
- **Confiança baixa:** se a Vision devolver um campo `confidence` ou o modelo indicar incerteza, marcar `needs_review=True` ou mostrar na mensagem “Categoria sugerida (verifica se está correta)”.

### 5.5 Aprendizagem e correção

- **Aprendizagem só ao confirmar:** já está; ao cancelar não se guarda no cache. Manter.
- **Botão “Mudar categoria” numa pendente:** ao escolher outra categoria e confirmar, guardar no cache a nova associação (descrição → nova categoria) e opcionalmente invalidar ou não reutilizar a antiga para essa descrição. O bot “aprende” com a correção.
- **Peso por recência no cache (opcional):** em get_cached_category, se houver várias entradas para a mesma chave (ex.: cache por substring), preferir a mais recente (por `updated_at` ou contador de uso).

### 5.6 Consistência e robustez

- **Transação DB atómica:** ao criar N pendentes num batch, usar uma única transação DB; em caso de falha a meio, rollback de todos. Já se faz commit no fim; garantir que não há commit intermédio antes de enviar a mensagem.
- **Log de ações sensíveis:** registrar (log ou tabela de auditoria) quando: /revoke (desvinculação), /clear em massa, número de chamadas IA por workspace/dia acima de um limiar. Ajuda a detetar abuso e a debugar.
- **Mensagem de erro genérica em exceções:** em qualquer exceção não tratada no handler da mensagem, enviar uma mensagem amigável (“Algo correu mal. Tenta de novo ou usa /info.”) e logar o traceback completo. Evita o user ver silêncio ou erro técnico.

### 5.7 Priorização (lógica)

| Prioridade | Ideia (lógica) | Esforço | Impacto |
|------------|-----------------|---------|--------|
| Alta | Circuit-breaker antes de IA no Telegram | Baixo | Custo + consistência |
| Alta | Match fuzzy da categoria devolvida pela IA | Baixo | Menos categorias erradas |
| Média | Deduplicação de pendentes (mesma desc+valor+tipo) | Médio | Menos ruído |
| Média | Idempotência do webhook (update_id) | Médio | Zero duplicados |
| Média | Receita/despesa mais rica (mais palavras) | Baixo | Menos erros de tipo |
| Baixa | Expiração ou aviso de pendentes antigos | Médio | UX |
| Baixa | Múltiplos itens numa foto (Vision) | Alto | Funcionalidade |
| Baixa | Botão “Mudar categoria” + reaprendizagem | Alto | Aprendizagem |
