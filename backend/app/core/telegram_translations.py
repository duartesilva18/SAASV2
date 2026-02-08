"""
Telegram bot translations for backend messages
"""
TELEGRAM_TRANSLATIONS = {
    'pt': {
        'welcome_new': (
            "<b>Bem-vindo ao Finan</b><i>Zen</i>\n\n"
            "🧘‍♂️ O teu <b>ecossistema financeiro</b> está à distância de uma mensagem.\n\n"
            "📧 Para começarmos, envia o <b>email</b> que utilizas na plataforma Finly.\n\n"
            "💎 <i>Domina o teu dinheiro com simplicidade.</i>"
        ),
        'welcome_return': (
            "<b>Olá de novo, Mestre!</b>\n\n"
            "💎 O teu <b>ecossistema Zen</b> está pronto.\n\n"
            "📝 <b>Envia transações como:</b>\n"
            "• 🍽️ Almoço 15€\n"
            "• 💰 Salário 1000€\n"
            "• ⛽ Gasolina 50€\n\n"
            "📖 Envia <code>/info</code> para mais ajuda.\n\n"
            "🧘‍♂️ <i>Paz financeira em cada mensagem.</i>"
        ),
        'help_guide': (
            "<b>Guia do Mestre Finan</b><i>Zen</i>\n\n"
            "📝 <b>Formato de mensagem:</b>\n"
            "<code>Descrição Valor€</code>\n\n"
            "💡 <b>Exemplos:</b>\n"
            "• 🍽️ Almoço 15€\n"
            "• 💰 Salário 1000€\n"
            "• 🏋️ Ginásio 30€\n"
            "• 🍽️ Almoço 25€ ⛽ Gasolina 10€\n\n"
            "🎯 <b>Funcionalidades:</b>\n"
            "• Categorização automática com IA\n"
            "• Especifica categoria: <code>Descrição - Categoria Valor€</code>\n"
            "• Data específica: <code>Almoço 15€ 28/01</code> ou <code>dia 28 Almoço 15€</code>\n"
            "• Múltiplas transações numa mensagem ou num áudio: <code>Almoço 15€ gasolina 40€</code>\n\n"
            "🧘‍♂️ <i>Simplicidade é a chave do controlo financeiro.</i>"
        ),
        'rate_limit': (
            "⏱️ <b>Muitas mensagens</b>\n\n"
            "💡 Aguarda um momento antes de enviar mais transações.\n\n"
            "🧘‍♂️ <i>Paz financeira requer paciência.</i>"
        ),
        'session_expired': (
            "⚠️ Sessão expirada. Envia /start para começar."
        ),
        'unauthorized': (
            "<b>Bem-vindo ao Finan</b><i>Zen</i>\n\n"
            "📧 Para começares, envia o teu <b>email</b> que utilizas na plataforma.\n\n"
            "💡 Ou envia <code>/start</code> para começar.\n\n"
            "🧘‍♂️ <i>Domina o teu dinheiro com simplicidade.</i>"
        ),
        'workspace_not_found': (
            "⚠️ <b>Workspace não encontrado</b>\n\n"
            "💡 Por favor, contacta o suporte.\n\n"
            "🧘‍♂️ <i>Estamos aqui para ajudar.</i>"
        ),
        'invalid_email': (
            "⚠️ <b>Email inválido</b>\n\n"
            "📧 Por favor, envia um email válido.\n\n"
            "💡 <i>Exemplo: o-teu-email@exemplo.com</i>"
        ),
        'email_not_found': (
            "<b>Email recebido</b>\n\n"
            "💎 Se estiveres associado a uma conta <b>Pro</b>, já podes começar a usar o bot.\n\n"
            "🧘‍♂️ <i>O teu ecossistema financeiro está quase pronto.</i>"
        ),
        'pro_required': (
            "💎 <b>Conta Pro Necessária</b>\n\n"
            "Esta funcionalidade requer uma conta <b>Pro</b>.\n\n"
            "Faz upgrade na plataforma para desbloqueares o bot Telegram.\n\n"
            "🧘‍♂️ <i>Transforma a gestão financeira numa experiência Zen.</i>"
        ),
        'already_associated': (
            "⚠️ <b>Telegram já associado</b>\n\n"
            "📧 Este Telegram já está associado a outra conta:\n"
            "<code>{email}</code>\n\n"
            "💡 <i>Um Telegram só pode estar associado a uma conta.</i>"
        ),
        'account_linked_success': (
            "<b>Conta associada com sucesso!</b>\n\n"
            "💎 <b>Conta:</b> <code>{email}</code>\n\n"
            "🎯 <b>Agora podes enviar transações:</b>\n"
            "• 🍽️ Almoço 15€\n"
            "• 💰 Salário 1000€\n"
            "• ⛽ Gasolina 50€\n\n"
            "📖 Envia <code>/info</code> para ver todos os formatos.\n\n"
            "🧘‍♂️ <i>O teu ecossistema Zen está ativo.</i>"
        ),
        'photo_not_supported': (
            "📸 <b>Processamento de imagens</b>\n\n"
            "⚠️ Esta funcionalidade está temporariamente indisponível.\n\n"
            "📝 Por favor, escreve a transação em texto:\n"
            "• <code>Almoço 15€</code>\n"
            "• <code>Gasolina 50€</code>\n\n"
            "🧘‍♂️ <i>Simplicidade é a chave.</i>"
        ),
        'photo_rate_limit': (
            "📸 <b>Limite de pedidos atingido</b>\n\n"
            "⏳ Enviaste demasiados pedidos neste momento (limite da API).\n\n"
            "Espera 1–2 minutos e tenta enviar a foto de novo, ou escreve a transação em texto:\n"
            "• <code>Almoço 15€</code>\n"
            "• <code>Gasolina 50€</code>\n\n"
            "🧘‍♂️ <i>Simplicidade é a chave.</i>"
        ),
        'parse_error': (
            "🤔 <b>Não consegui entender</b>\n\n"
            "💡 <b>Tenta formatos como:</b>\n"
            "• 🍽️ <code>Almoço 15€</code>\n"
            "• ⛽ <code>Gasolina 50€</code>\n"
            "• 💰 <code>Recebi 500€</code>\n"
            "• 🍽️ <code>Almoço - Alimentação 25€</code>\n\n"
            "📖 Envia <code>/info</code> para ver todos os formatos.\n\n"
            "🧘‍♂️ <i>Simplicidade é a chave.</i>"
        ),
        'ai_unavailable': (
            "⚠️ <b>Neste momento não consigo processar</b>\n\n"
            "A categorização automática está temporariamente indisponível.\n"
            "Tenta novamente daqui a uns minutos."
        ),
        'transaction_pending': (
            "<b>Nova Transação</b>\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Descrição:</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Valor:</b> <code>{amount}€</code>\n"
            "🏷️ <b>Categoria:</b> {category} {origin_line}\n"
            "📊 <b>Tipo:</b> {type}\n"
            "{date_line}"
            "\n━━━━━━━━━━━━━━━━━━\n"
            "✅ Confirma esta transação?"
        ),
        'transaction_confirmed': (
            "<b>Transação Confirmada!</b>\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Descrição:</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Valor:</b> <code>{amount}€</code>\n"
            "🏷️ <b>Categoria:</b> {category} {origin_line}\n"
            "📊 <b>Tipo:</b> {type}\n"
            "{date_line}"
            "\n━━━━━━━━━━━━━━━━━━\n"
            "🧘‍♂️ <i>Registado no teu ecossistema Zen.</i>"
        ),
        'transaction_registered': (
            "<b>Transação Registada!</b>\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Descrição:</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Valor:</b> <code>{amount}€</code>\n"
            "🏷️ <b>Categoria:</b> {category} {origin_line}\n"
            "📊 <b>Tipo:</b> {type}\n"
            "{date_line}"
            "\n━━━━━━━━━━━━━━━━━━\n"
            "🧘‍♂️ <i>Registado no teu ecossistema Zen.</i>"
        ),
        'date_line': "\n📅 <b>Data:</b> {date}\n",
        'date_line_empty': "",
        'transaction_not_found': (
            "❌ Transação não encontrada ou já processada."
        ),
        'transaction_cancelled': (
            "🚫 <b>Transação Cancelada</b>\n\n"
            "💡 A transação foi cancelada e não foi registada.\n\n"
            "🧘‍♂️ <i>Podes enviar uma nova transação quando quiseres.</i>"
        ),
        'transaction_cancel_not_found': (
            "⚠️ <b>Transação não encontrada</b>\n\n"
            "💡 Esta transação já foi processada ou não existe.\n\n"
            "🧘‍♂️ <i>Podes enviar uma nova transação.</i>"
        ),
        'list_pending_header': (
            "📋 <b>Lista de transações</b><br><br>"
        ),
        'list_pending_line': "• {description} — {amount}€ — {category}<br>",
        'list_pending_total': "━━━━━━━━━━<br>💰 <b>Total:</b> {total}€<br><br>",
        'list_confirm_question': "✅ Confirma todas estas transações?",
        'button_confirm_all': "✅ Confirmar tudo",
        'button_cancel_all': "🚫 Cancelar tudo",
        'list_confirmed': (
            "<b>Transações registadas!</b>\n\n"
            "💎 Todas as transações da lista foram guardadas.\n\n"
            "🧘‍♂️ <i>O teu ecossistema Zen está atualizado.</i>"
        ),
        'list_cancelled': (
            "🚫 <b>Lista cancelada</b>\n\n"
            "💡 Nenhuma transação foi registada.\n\n"
            "🧘‍♂️ <i>Podes enviar uma nova lista quando quiseres.</i>"
        ),
        'batch_list_empty': "✓ Lista atualizada. Todas as linhas foram processadas.",
        'categoria_default_set': "✅ Categoria por defeito definida: <b>{name}</b>. As próximas mensagens usarão esta categoria até enviares <code>/categoria stop</code>.",
        'categoria_default_cleared': "✅ Categoria por defeito removida. As mensagens voltam a ser categorizadas normalmente.",
        'categoria_not_found': "⚠️ Categoria «{name}» não encontrada no teu workspace. Usa o nome exato (ex.: Alimentação).",
        'multiple_transactions_created': (
            "<b>{count} Transação(ões) Criada(s)!</b>\n\n"
            "💎 Todas as transações foram registadas automaticamente.\n\n"
            "🧘‍♂️ <i>O teu ecossistema Zen está atualizado.</i>"
        ),
        'clear_success': (
            "<b>Limpeza Concluída!</b>\n\n"
            "🧹 <b>{count} transação(ões) pendente(s)</b> foram eliminadas.\n\n"
            "💎 O teu ecossistema Zen está limpo.\n\n"
            "🧘‍♂️ <i>Podes começar a registar novas transações.</i>"
        ),
        'clear_empty': (
            "<b>Já está limpo!</b>\n\n"
            "💎 Não há transações pendentes para limpar.\n\n"
            "🧘‍♂️ <i>O teu ecossistema Zen está organizado.</i>"
        ),
        'clear_unauthorized': (
            "⚠️ <b>Não autorizado</b>\n\n"
            "💡 Envia <code>/start</code> para começar."
        ),
        'type_expense': 'Despesa',
        'type_income': 'Receita',
        'button_confirm': 'Confirmar',
        'button_cancel': '🚫 Cancelar',
        'button_change_category': '🏷️ Mudar categoria',
        'change_category_prompt': '🏷️ <b>Escolhe a categoria:</b>',
        'source_cache': 'Por cache',
        'source_history': 'Por histórico',
        'source_openai': 'Por IA',
        'source_fallback': 'Por defeito',
        'source_explicit': 'Por ti',
        'origin_suffix': "(<i>{origin}</i>)",
        'processing_photo': "⏳ A processar a imagem…",
        'document_processing': "⏳ A processar o documento…",
        'document_not_supported': (
            "📎 <b>Tipo de ficheiro não suportado</b>\n\n"
            "Aceito: <b>PDF</b>, <b>imagens</b> (JPEG/PNG/WebP), <b>CSV</b> e <b>Excel</b> (.xlsx) com lista de movimentos.\n\n"
            "💡 Ou escreve em texto:\n"
            "• <code>Almoço 15€</code>\n"
            "• <code>Gasolina 50€</code>\n\n"
            "📖 <code>/info</code> para ver formatos.\n\n"
            "🧘‍♂️ <i>Simplicidade é a chave.</i>"
        ),
        'document_pdf_empty': (
            "📎 <b>PDF sem movimentos reconhecidos</b>\n\n"
            "Não consegui extrair texto ou valores neste PDF.\n\n"
            "💡 <b>Sugestões:</b>\n"
            "• Envia uma <b>foto</b> do recibo ou extrato\n"
            "• Escreve as transações em texto: <code>Descrição 10€</code>\n"
            "• Garante que o PDF contém valores em € (ex.: 15,00 €)\n\n"
            "📖 <code>/info</code> para ver formatos.\n\n"
            "🧘‍♂️ <i>Simplicidade é a chave.</i>"
        ),
        'document_no_data': (
            "📎 <b>Sem movimentos reconhecidos</b>\n\n"
            "Não consegui extrair transações deste ficheiro.\n\n"
            "💡 <b>Sugestões:</b>\n"
            "• PDF/CSV/Excel: garante que há coluna com valores em € (ex.: 15,00 €)\n"
            "• Imagem: envia foto nítida do recibo ou extrato\n"
            "• Ou escreve em texto: <code>Descrição 10€</code>\n\n"
            "📖 <code>/info</code> para formatos.\n\n"
            "🧘‍♂️ <i>Simplicidade é a chave.</i>"
        ),
        'processing_audio': "⏳ A processar o áudio…",
        'audio_error': (
            "🎤 <b>Áudio não processado</b>\n\n"
            "Não consegui transcrever esta mensagem de voz.\n"
            "💡 Envia a transação por texto, por ex: <code>Almoço 15€</code>"
        ),
        'summary_today': (
            "📊 <b>Resumo de hoje</b>\n\n"
            "📉 Despesas: <b>{expenses}€</b>\n"
            "📈 Receitas: <b>{income}€</b>\n"
            "📝 Transações: <b>{count}</b>\n\n"
            "🧘‍♂️ <i>Saldo do dia: {balance}€</i>"
        ),
        'summary_month': (
            "📊 <b>Resumo do mês</b>\n\n"
            "📉 Despesas: <b>{expenses}€</b>\n"
            "📈 Receitas: <b>{income}€</b>\n"
            "📝 Transações: <b>{count}</b>\n\n"
            "🧘‍♂️ <i>Saldo do mês: {balance}€</i>"
        ),
        'summary_empty': "📊 Ainda sem transações neste período.",
        'pendentes_list': "📋 <b>Transações pendentes</b> ({count})<br><br>{lines}💡 Confirma ou cancela cada uma na mensagem original, ou usa /clear para limpar todas.",
        'pendentes_empty': "Não tens transações pendentes.",
        'revoke_ok': "✅ Telegram desvinculado. Para voltar a usar, envia /start e o teu email.",
        'language_set': "✅ Idioma definido para Português.",
        'language_set_en': "✅ Language set to English.",
        'help_short': "📖 Comandos: /info (formato) · /resumo (hoje) · /mes · /pendentes · /clear · /revoke (desvincular)",
        'tip_multi': "💡 Dica: podes enviar várias assim: Almoço 15€ Gasolina 40€",
        'too_many_pending': "⚠️ Tens muitas transações pendentes ({count}). Confirma ou usa /clear antes de adicionar mais.",
        'ai_busy': "⏳ Muitos pedidos neste momento. Tenta daqui a um minuto.",
        'create_category_prompt': "🏷️ A IA sugeriu a categoria <b>«{name}»</b> que não existe no teu workspace.\n\nQueres criar esta categoria e usar para esta transação?",
        'button_create_category': "✅ Sim, criar",
        'button_skip_category': "❌ Não, cancelar",
        'category_created_confirm': "✅ Categoria <b>«{name}»</b> criada. Confirma a transação abaixo?",
        'generic_error': "⚠️ Algo correu mal. Tenta de novo ou envia <code>/info</code>.",
        'pending_duplicate': "💡 Já tens esta transação pendente. Confirma ou cancela na mensagem original.",
        'pending_stale': "⏳ Tens transações pendentes há mais de 24h. Confirma ou usa /clear.",
    },
    'en': {
        'welcome_new': (
            "<b>Welcome to Finan</b><i>Zen</i>\n\n"
            "🧘‍♂️ Your <b>financial ecosystem</b> is just a message away.\n\n"
            "📧 To get started, send the <b>email</b> you use on the Finly platform.\n\n"
            "💎 <i>Master your money with simplicity.</i>"
        ),
        'welcome_return': (
            "<b>Hello again, Master!</b>\n\n"
            "💎 Your <b>Zen ecosystem</b> is ready.\n\n"
            "📝 <b>Send transactions like:</b>\n"
            "• 🍽️ Lunch 15€\n"
            "• 💰 Salary 1000€\n"
            "• ⛽ Gas 50€\n\n"
            "📖 Send <code>/info</code> for more help.\n\n"
            "🧘‍♂️ <i>Financial peace in every message.</i>"
        ),
        'help_guide': (
            "<b>Master's Guide to Finan</b><i>Zen</i>\n\n"
            "📝 <b>Message format:</b>\n"
            "<code>Description Value€</code>\n\n"
            "💡 <b>Examples:</b>\n"
            "• 🍽️ Lunch 15€\n"
            "• 💰 Salary 1000€\n"
            "• 🏋️ Gym 30€\n"
            "• 🍽️ Lunch 25€ ⛽ Gas 10€\n\n"
            "🎯 <b>Features:</b>\n"
            "• Automatic categorization with AI\n"
            "• Specify category: <code>Description - Category Value€</code>\n"
            "• Specific date: <code>Lunch 15€ 28/01</code> or <code>day 28 Lunch 15€</code>\n"
            "• Multiple transactions in one message or one voice note: <code>Lunch 15€ gas 40€</code>\n\n"
            "🧘‍♂️ <i>Simplicity is the key to financial control.</i>"
        ),
        'rate_limit': (
            "⏱️ <b>Too many messages</b>\n\n"
            "💡 Please wait a moment before sending more transactions.\n\n"
            "🧘‍♂️ <i>Financial peace requires patience.</i>"
        ),
        'session_expired': (
            "⚠️ Session expired. Send /start to begin."
        ),
        'unauthorized': (
            "<b>Welcome to Finan</b><i>Zen</i>\n\n"
            "📧 To get started, send the <b>email</b> you use on the platform.\n\n"
            "💡 Or send <code>/start</code> to begin.\n\n"
            "🧘‍♂️ <i>Master your money with simplicity.</i>"
        ),
        'workspace_not_found': (
            "⚠️ <b>Workspace not found</b>\n\n"
            "💡 Please contact support.\n\n"
            "🧘‍♂️ <i>We're here to help.</i>"
        ),
        'invalid_email': (
            "⚠️ <b>Invalid email</b>\n\n"
            "📧 Please send a valid email.\n\n"
            "💡 <i>Example: your-email@example.com</i>"
        ),
        'email_not_found': (
            "<b>Email received</b>\n\n"
            "💎 If you're associated with a <b>Pro</b> account, you can start using the bot.\n\n"
            "🧘‍♂️ <i>Your financial ecosystem is almost ready.</i>"
        ),
        'pro_required': (
            "💎 <b>Pro Account Required</b>\n\n"
            "This feature requires a <b>Pro</b> account.\n\n"
            "Upgrade on the platform to unlock the Telegram bot.\n\n"
            "🧘‍♂️ <i>Transform financial management into a Zen experience.</i>"
        ),
        'already_associated': (
            "⚠️ <b>Telegram already associated</b>\n\n"
            "📧 This Telegram is already associated with another account:\n"
            "<code>{email}</code>\n\n"
            "💡 <i>One Telegram can only be associated with one account.</i>"
        ),
        'account_linked_success': (
            "<b>Account linked successfully!</b>\n\n"
            "💎 <b>Account:</b> <code>{email}</code>\n\n"
            "🎯 <b>You can now send transactions:</b>\n"
            "• 🍽️ Lunch 15€\n"
            "• 💰 Salary 1000€\n"
            "• ⛽ Gas 50€\n\n"
            "📖 Send <code>/info</code> to see all formats.\n\n"
            "🧘‍♂️ <i>Your Zen ecosystem is active.</i>"
        ),
        'photo_not_supported': (
            "📸 <b>Image processing</b>\n\n"
            "⚠️ This feature is temporarily unavailable.\n\n"
            "📝 Please write the transaction in text:\n"
            "• <code>Lunch 15€</code>\n"
            "• <code>Gas 50€</code>\n\n"
            "🧘‍♂️ <i>Simplicity is the key.</i>"
        ),
        'photo_rate_limit': (
            "📸 <b>Rate limit reached</b>\n\n"
            "⏳ Too many requests right now (API limit).\n\n"
            "Wait 1–2 minutes and try sending the photo again, or write the transaction in text:\n"
            "• <code>Lunch 15€</code>\n"
            "• <code>Gas 50€</code>\n\n"
            "🧘‍♂️ <i>Simplicity is the key.</i>"
        ),
        'parse_error': (
            "🤔 <b>I couldn't understand</b>\n\n"
            "💡 <b>Try formats like:</b>\n"
            "• 🍽️ <code>Lunch 15€</code>\n"
            "• ⛽ <code>Gas 50€</code>\n"
            "• 💰 <code>Received 500€</code>\n"
            "• 🍽️ <code>Lunch - Food 25€</code>\n\n"
            "📖 Send <code>/info</code> to see all formats.\n\n"
            "🧘‍♂️ <i>Simplicity is the key.</i>"
        ),
        'ai_unavailable': (
            "⚠️ <b>I can't process right now</b>\n\n"
            "Automatic categorization is temporarily unavailable.\n"
            "Please try again in a few minutes."
        ),
        'transaction_pending': (
            "<b>New Transaction</b>\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Description:</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Value:</b> <code>{amount}€</code>\n"
            "🏷️ <b>Category:</b> {category} {origin_line}\n"
            "📊 <b>Type:</b> {type}\n"
            "{date_line}"
            "\n━━━━━━━━━━━━━━━━━━\n"
            "✅ Confirm this transaction?"
        ),
        'transaction_confirmed': (
            "<b>Transaction Confirmed!</b>\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Description:</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Value:</b> <code>{amount}€</code>\n"
            "🏷️ <b>Category:</b> {category} {origin_line}\n"
            "📊 <b>Type:</b> {type}\n"
            "{date_line}"
            "\n━━━━━━━━━━━━━━━━━━\n"
            "🧘‍♂️ <i>Registered in your Zen ecosystem.</i>"
        ),
        'transaction_registered': (
            "<b>Transaction Registered!</b>\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Description:</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Value:</b> <code>{amount}€</code>\n"
            "🏷️ <b>Category:</b> {category} {origin_line}\n"
            "📊 <b>Type:</b> {type}\n"
            "{date_line}"
            "\n━━━━━━━━━━━━━━━━━━\n"
            "🧘‍♂️ <i>Registered in your Zen ecosystem.</i>"
        ),
        'date_line': "\n📅 <b>Date:</b> {date}\n",
        'date_line_empty': "",
        'transaction_not_found': (
            "❌ Transaction not found or already processed."
        ),
        'transaction_cancelled': (
            "🚫 <b>Transaction Cancelled</b>\n\n"
            "💡 The transaction was cancelled and not registered.\n\n"
            "🧘‍♂️ <i>You can send a new transaction whenever you want.</i>"
        ),
        'transaction_cancel_not_found': (
            "⚠️ <b>Transaction not found</b>\n\n"
            "💡 This transaction has already been processed or doesn't exist.\n\n"
            "🧘‍♂️ <i>You can send a new transaction.</i>"
        ),
        'list_pending_header': (
            "📋 <b>Transaction list</b><br><br>"
        ),
        'list_pending_line': "• {description} — {amount}€ — {category}<br>",
        'list_pending_total': "━━━━━━━━━━<br>💰 <b>Total:</b> {total}€<br><br>",
        'list_confirm_question': "✅ Confirm all these transactions?",
        'button_confirm_all': "✅ Confirm all",
        'button_cancel_all': "🚫 Cancel all",
        'list_confirmed': (
            "<b>Transactions registered!</b>\n\n"
            "💎 All transactions in the list were saved.\n\n"
            "🧘‍♂️ <i>Your Zen ecosystem is updated.</i>"
        ),
        'list_cancelled': (
            "🚫 <b>List cancelled</b>\n\n"
            "💡 No transactions were registered.\n\n"
            "🧘‍♂️ <i>You can send a new list whenever you want.</i>"
        ),
        'batch_list_empty': "✓ List updated. All lines have been processed.",
        'categoria_default_set': "✅ Default category set: <b>{name}</b>. Next messages will use this category until you send <code>/categoria stop</code>.",
        'categoria_default_cleared': "✅ Default category cleared. Messages will be categorized normally again.",
        'categoria_not_found': "⚠️ Category «{name}» not found in your workspace. Use the exact name (e.g. Food).",
        'multiple_transactions_created': (
            "<b>{count} Transaction(s) Created!</b>\n\n"
            "💎 All transactions were registered automatically.\n\n"
            "🧘‍♂️ <i>Your Zen ecosystem is updated.</i>"
        ),
        'clear_success': (
            "<b>Cleanup Complete!</b>\n\n"
            "🧹 <b>{count} pending transaction(s)</b> were deleted.\n\n"
            "💎 Your Zen ecosystem is clean.\n\n"
            "🧘‍♂️ <i>You can start registering new transactions.</i>"
        ),
        'clear_empty': (
            "<b>Already clean!</b>\n\n"
            "💎 There are no pending transactions to clear.\n\n"
            "🧘‍♂️ <i>Your Zen ecosystem is organized.</i>"
        ),
        'clear_unauthorized': (
            "⚠️ <b>Not authorized</b>\n\n"
            "💡 Send <code>/start</code> to begin."
        ),
        'type_expense': 'Expense',
        'type_income': 'Income',
        'button_confirm': 'Confirm',
        'button_cancel': '🚫 Cancel',
        'button_change_category': '🏷️ Change category',
        'change_category_prompt': '🏷️ <b>Choose category:</b>',
        'source_cache': 'From cache',
        'source_history': 'From history',
        'source_openai': 'From AI',
        'source_fallback': 'Default',
        'source_explicit': 'By you',
        'origin_suffix': "(<i>{origin}</i>)",
        'processing_photo': "⏳ Processing image…",
        'document_processing': "⏳ Processing document…",
        'document_not_supported': (
            "📎 <b>File type not supported</b>\n\n"
            "I accept: <b>PDF</b>, <b>images</b> (JPEG/PNG/WebP), <b>CSV</b> and <b>Excel</b> (.xlsx) with a list of movements.\n\n"
            "💡 Or type in text:\n"
            "• <code>Lunch 15€</code>\n"
            "• <code>Gas 50€</code>\n\n"
            "📖 <code>/info</code> for formats.\n\n"
            "🧘‍♂️ <i>Simplicity is key.</i>"
        ),
        'document_no_data': (
            "📎 <b>No movements recognised</b>\n\n"
            "I couldn't extract transactions from this file.\n\n"
            "💡 <b>Suggestions:</b>\n"
            "• PDF/CSV/Excel: ensure there's a column with amounts in € (e.g. 15.00 €)\n"
            "• Image: send a clear photo of the receipt or statement\n"
            "• Or type in text: <code>Description 10€</code>\n\n"
            "📖 <code>/info</code> for formats.\n\n"
            "🧘‍♂️ <i>Simplicity is key.</i>"
        ),
        'document_pdf_empty': (
            "📎 <b>PDF with no recognised movements</b>\n\n"
            "I couldn't extract text or amounts from this PDF.\n\n"
            "💡 <b>Suggestions:</b>\n"
            "• Send a <b>photo</b> of the receipt or statement\n"
            "• Type the transactions: <code>Description 10€</code>\n"
            "• Make sure the PDF contains values in € (e.g. 15.00 €)\n\n"
            "📖 <code>/info</code> for formats.\n\n"
            "🧘‍♂️ <i>Simplicity is key.</i>"
        ),
        'document_no_data': (
            "📎 <b>No movements recognised</b>\n\n"
            "I couldn't extract transactions from this file.\n\n"
            "💡 <b>Suggestions:</b>\n"
            "• PDF/CSV/Excel: ensure there's a column with amounts in € (e.g. 15.00 €)\n"
            "• Image: send a clear photo of the receipt or statement\n"
            "• Or type in text: <code>Description 10€</code>\n\n"
            "📖 <code>/info</code> for formats.\n\n"
            "🧘‍♂️ <i>Simplicity is key.</i>"
        ),
        'processing_audio': "⏳ Processing audio…",
        'audio_error': (
            "🎤 <b>Audio not processed</b>\n\n"
            "I couldn't transcribe this voice message.\n"
            "💡 Send the transaction as text, e.g. <code>Lunch 15€</code>"
        ),
        'summary_today': (
            "📊 <b>Today's summary</b>\n\n"
            "📉 Expenses: <b>{expenses}€</b>\n"
            "📈 Income: <b>{income}€</b>\n"
            "📝 Transactions: <b>{count}</b>\n\n"
            "🧘‍♂️ <i>Daily balance: {balance}€</i>"
        ),
        'summary_month': (
            "📊 <b>Month summary</b>\n\n"
            "📉 Expenses: <b>{expenses}€</b>\n"
            "📈 Income: <b>{income}€</b>\n"
            "📝 Transactions: <b>{count}</b>\n\n"
            "🧘‍♂️ <i>Monthly balance: {balance}€</i>"
        ),
        'summary_empty': "📊 No transactions in this period yet.",
        'pendentes_list': "📋 <b>Pending transactions</b> ({count})<br><br>{lines}💡 Confirm or cancel each in the original message, or use /clear to clear all.",
        'pendentes_empty': "You have no pending transactions.",
        'revoke_ok': "✅ Telegram unlinked. To use again, send /start and your email.",
        'language_set': "✅ Language set to Portuguese.",
        'language_set_en': "✅ Language set to English.",
        'help_short': "📖 Commands: /info (format) · /resumo (today) · /mes · /pendentes · /clear · /revoke (unlink)",
        'tip_multi': "💡 Tip: you can send several like this: Lunch 15€ Gas 40€",
        'too_many_pending': "⚠️ You have too many pending transactions ({count}). Confirm or use /clear before adding more.",
        'ai_busy': "⏳ Too many requests right now. Try again in a minute.",
        'create_category_prompt': "🏷️ The AI suggested the category <b>«{name}»</b> which doesn't exist in your workspace.\n\nDo you want to create this category and use it for this transaction?",
        'button_create_category': "✅ Yes, create",
        'button_skip_category': "❌ No, cancel",
        'category_created_confirm': "✅ Category <b>«{name}»</b> created. Confirm the transaction below?",
        'generic_error': "⚠️ Something went wrong. Try again or send <code>/info</code>.",
        'pending_duplicate': "💡 You already have this transaction pending. Confirm or cancel in the original message.",
        'pending_stale': "⏳ You have pending transactions older than 24h. Confirm or use /clear.",
    }
}

def get_telegram_translation(language: str = 'pt', key: str = None):
    """
    Get Telegram bot translations for a specific language
    
    Args:
        language: Language code ('pt' or 'en')
        key: Optional key to return specific translation
    
    Returns:
        Dictionary with translations for the specified language, or specific translation if key provided
    """
    lang = language if language in TELEGRAM_TRANSLATIONS else 'pt'
    translations = TELEGRAM_TRANSLATIONS[lang]
    
    if key:
        return translations.get(key, '')
    return translations

def get_telegram_t(language: str = 'pt'):
    """
    Get a callable translation function for a specific language
    
    Args:
        language: Language code ('pt' or 'en')
    
    Returns:
        A function that takes a key and returns the translation
    """
    lang = language if language in TELEGRAM_TRANSLATIONS else 'pt'
    translations = TELEGRAM_TRANSLATIONS[lang]
    
    def t(key: str, **kwargs) -> str:
        """Get translation for a key, with optional formatting"""
        text = translations.get(key, '')
        if kwargs:
            try:
                return text.format(**kwargs)
            except KeyError:
                return text
        return text
    
    return t

