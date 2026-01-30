"""
Telegram bot translations for backend messages
"""
TELEGRAM_TRANSLATIONS = {
    'pt': {
        'welcome_new': (
            "✨ <b>Bem-vindo ao Finan</b><i>Zen</i> ✨\n\n"
            "🧘‍♂️ O teu <b>ecossistema financeiro</b> está à distância de uma mensagem.\n\n"
            "📧 Para começarmos, envia o <b>email</b> que utilizas na plataforma Finly.\n\n"
            "📄 Também podes enviar <b>extratos</b> (imagem/PDF/CSV) e eu organizo por categoria.\n"
            "✅ Antes de criar transações, confirmas tudo.\n"
            "⚠️ Limite: 2 imagens/ficheiros por dia.\n\n"
            "💎 <i>Domina o teu dinheiro com simplicidade.</i>"
        ),
        'welcome_return': (
            "✨ <b>Olá de novo, Mestre!</b> ✨\n\n"
            "💎 O teu <b>ecossistema Zen</b> está pronto.\n\n"
            "📝 <b>Envia transações como:</b>\n"
            "• 🍽️ Almoço 15€\n"
            "• 💰 Salário 1000€\n"
            "• ⛽ Gasolina 50€\n\n"
            "📄 <b>Ou envia um extrato</b> (imagem/PDF/CSV) para importar em lote.\n"
            "⚠️ Limite: 2 imagens/ficheiros por dia.\n\n"
            "📖 Envia <code>/info</code> para mais ajuda.\n\n"
            "🧘‍♂️ <i>Paz financeira em cada mensagem.</i>"
        ),
        'help_guide': (
            "✨ <b>Guia do Mestre Finan</b><i>Zen</i> ✨\n\n"
            "📝 <b>Formato de mensagem:</b>\n"
            "<code>Descrição Valor€</code>\n\n"
            "💡 <b>Exemplos:</b>\n"
            "• 🍽️ Almoço 15€\n"
            "• 💰 Salário 1000€\n"
            "• 🏋️ Ginásio 30€\n"
            "• 🍽️ Almoço 25€ ⛽ Gasolina 10€\n\n"
            "📄 <b>Extratos/recibos:</b>\n"
            "• Envia imagem/PDF/CSV\n"
            "• Recebes uma lista e confirmas a importação\n"
            "• Limite: 2 imagens/ficheiros por dia\n\n"
            "🎯 <b>Funcionalidades:</b>\n"
            "• Categorização automática com IA\n"
            "• Especifica categoria: <code>Descrição - Categoria Valor€</code>\n"
            "• Múltiplas transações numa mensagem\n\n"
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
            "✨ <b>Bem-vindo ao Finan</b><i>Zen</i> ✨\n\n"
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
            "✨ <b>Email recebido</b> ✨\n\n"
            "💎 Se estiveres associado a uma conta <b>Pro</b>, já podes começar a usar o bot.\n\n"
            "🧘‍♂️ <i>O teu ecossistema financeiro está quase pronto.</i>"
        ),
        'pro_required': (
            "💎 <b>Conta Pro Necessária</b>\n\n"
            "✨ Esta funcionalidade requer uma conta <b>Pro</b>.\n\n"
            "🚀 Faz upgrade na plataforma para desbloqueares o bot Telegram.\n\n"
            "🧘‍♂️ <i>Transforma a gestão financeira numa experiência Zen.</i>"
        ),
        'already_associated': (
            "⚠️ <b>Telegram já associado</b>\n\n"
            "📧 Este Telegram já está associado a outra conta:\n"
            "<code>{email}</code>\n\n"
            "💡 <i>Um Telegram só pode estar associado a uma conta.</i>"
        ),
        'account_linked_success': (
            "✨ <b>Conta associada com sucesso!</b> ✨\n\n"
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
        'media_not_supported': (
            "⚠️ <b>Ficheiro não suportado</b>\n\n"
            "✅ Envia imagem, PDF ou CSV.\n"
            "❌ Excel ainda não é suportado (exporta para CSV ou PDF).\n"
        ),
        'media_excel_not_supported': (
            "⚠️ <b>Excel não suportado</b>\n\n"
            "✅ Exporta para CSV ou PDF e envia novamente.\n"
        ),
        'media_too_large': (
            "⚠️ <b>Ficheiro demasiado grande</b>\n\n"
            "Máximo: 10MB.\n"
        ),
        'media_processing': (
            "🧠 <b>A analisar o extrato...</b>\n\n"
            "Isto pode demorar alguns segundos."
        ),
        'media_parse_error': (
            "⚠️ <b>Não consegui ler o extrato</b>\n\n"
            "Tenta outra imagem/PDF/CSV ou uma foto mais nítida."
        ),
        'media_limit_reached': (
            "⚠️ <b>Limite diário atingido</b>\n\n"
            "Já usaste as 2 imagens/ficheiros de hoje."
        ),
        'media_summary_header': (
            "📄 <b>Resumo do extrato</b>\n\n"
        ),
        'media_summary_totals': (
            "📊 <b>Total por categoria</b>"
        ),
        'media_summary_truncated': (
            "⚠️ Resumo truncado devido ao tamanho."
        ),
        'category_create_prompt': (
            "🏷️ <b>Categoria não encontrada</b>\n\n"
            "Queres criar a categoria <b>{category}</b> para:\n"
            "<code>{description}</code>"
        ),
        'category_created': (
            "✅ Categoria criada: <b>{category}</b>"
        ),
        'category_skipped': (
            "➡️ Usei a categoria: <b>{category}</b>"
        ),
        'batch_not_found': (
            "⚠️ <b>Importação não encontrada</b>\n\n"
            "Envia novamente o extrato."
        ),
        'batch_import_confirmed': (
            "✅ <b>Importação concluída</b>\n\n"
            "{count} transações criadas."
        ),
        'batch_import_cancelled': (
            "🚫 <b>Importação cancelada</b>"
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
        'transaction_pending': (
            "✨ <b>Nova Transação</b> ✨\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Descrição:</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Valor:</b> <code>{amount}€</code>\n"
            "🏷️ <b>Categoria:</b> {category}\n"
            "📊 <b>Tipo:</b> {type}\n\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "✅ Confirma esta transação?"
        ),
        'transaction_confirmed': (
            "✨ <b>Transação Confirmada!</b> ✨\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Descrição:</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Valor:</b> <code>{amount}€</code>\n"
            "🏷️ <b>Categoria:</b> {category}\n"
            "📊 <b>Tipo:</b> {type}\n\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "🧘‍♂️ <i>Registado no teu ecossistema Zen.</i>"
        ),
        'transaction_registered': (
            "✨ <b>Transação Registada!</b> ✨\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Descrição:</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Valor:</b> <code>{amount}€</code>\n"
            "🏷️ <b>Categoria:</b> {category}\n"
            "📊 <b>Tipo:</b> {type}\n\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "🧘‍♂️ <i>Registado no teu ecossistema Zen.</i>"
        ),
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
        'multiple_transactions_created': (
            "✨ <b>{count} Transação(ões) Criada(s)!</b> ✨\n\n"
            "💎 Todas as transações foram registadas automaticamente.\n\n"
            "🧘‍♂️ <i>O teu ecossistema Zen está atualizado.</i>"
        ),
        'clear_success': (
            "✨ <b>Limpeza Concluída!</b> ✨\n\n"
            "🧹 <b>{count} transação(ões) pendente(s)</b> foram eliminadas.\n\n"
            "💎 O teu ecossistema Zen está limpo.\n\n"
            "🧘‍♂️ <i>Podes começar a registar novas transações.</i>"
        ),
        'clear_empty': (
            "✨ <b>Já está limpo!</b> ✨\n\n"
            "💎 Não há transações pendentes para limpar.\n\n"
            "🧘‍♂️ <i>O teu ecossistema Zen está organizado.</i>"
        ),
        'clear_unauthorized': (
            "⚠️ <b>Não autorizado</b>\n\n"
            "💡 Envia <code>/start</code> para começar."
        ),
        'type_expense': 'Despesa',
        'type_income': 'Receita',
        'button_confirm': '✨ Confirmar',
        'button_cancel': '🚫 Cancelar',
        'button_create_category': '✅ Criar',
        'button_skip_category': '➡️ Usar padrão',
        'button_confirm_import': '✅ Confirmar importação',
        'button_cancel_import': '🚫 Cancelar importação',
    },
    'en': {
        'welcome_new': (
            "✨ <b>Welcome to Finan</b><i>Zen</i> ✨\n\n"
            "🧘‍♂️ Your <b>financial ecosystem</b> is just a message away.\n\n"
            "📧 To get started, send the <b>email</b> you use on the Finly platform.\n\n"
            "📄 You can also send <b>statements</b> (image/PDF/CSV) and I'll categorize them.\n"
            "✅ You confirm before any transactions are created.\n"
            "⚠️ Limit: 2 images/files per day.\n\n"
            "💎 <i>Master your money with simplicity.</i>"
        ),
        'welcome_return': (
            "✨ <b>Hello again, Master!</b> ✨\n\n"
            "💎 Your <b>Zen ecosystem</b> is ready.\n\n"
            "📝 <b>Send transactions like:</b>\n"
            "• 🍽️ Lunch 15€\n"
            "• 💰 Salary 1000€\n"
            "• ⛽ Gas 50€\n\n"
            "📄 <b>Or send a statement</b> (image/PDF/CSV) to import in bulk.\n"
            "⚠️ Limit: 2 images/files per day.\n\n"
            "📖 Send <code>/info</code> for more help.\n\n"
            "🧘‍♂️ <i>Financial peace in every message.</i>"
        ),
        'help_guide': (
            "✨ <b>Master's Guide to Finan</b><i>Zen</i> ✨\n\n"
            "📝 <b>Message format:</b>\n"
            "<code>Description Value€</code>\n\n"
            "💡 <b>Examples:</b>\n"
            "• 🍽️ Lunch 15€\n"
            "• 💰 Salary 1000€\n"
            "• 🏋️ Gym 30€\n"
            "• 🍽️ Lunch 25€ ⛽ Gas 10€\n\n"
            "📄 <b>Statements/receipts:</b>\n"
            "• Send image/PDF/CSV\n"
            "• You get a list and confirm the import\n"
            "• Limit: 2 images/files per day\n\n"
            "🎯 <b>Features:</b>\n"
            "• Automatic categorization with AI\n"
            "• Specify category: <code>Description - Category Value€</code>\n"
            "• Multiple transactions in one message\n\n"
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
            "✨ <b>Welcome to Finan</b><i>Zen</i> ✨\n\n"
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
            "✨ <b>Email received</b> ✨\n\n"
            "💎 If you're associated with a <b>Pro</b> account, you can start using the bot.\n\n"
            "🧘‍♂️ <i>Your financial ecosystem is almost ready.</i>"
        ),
        'pro_required': (
            "💎 <b>Pro Account Required</b>\n\n"
            "✨ This feature requires a <b>Pro</b> account.\n\n"
            "🚀 Upgrade on the platform to unlock the Telegram bot.\n\n"
            "🧘‍♂️ <i>Transform financial management into a Zen experience.</i>"
        ),
        'already_associated': (
            "⚠️ <b>Telegram already associated</b>\n\n"
            "📧 This Telegram is already associated with another account:\n"
            "<code>{email}</code>\n\n"
            "💡 <i>One Telegram can only be associated with one account.</i>"
        ),
        'account_linked_success': (
            "✨ <b>Account linked successfully!</b> ✨\n\n"
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
        'media_not_supported': (
            "⚠️ <b>File not supported</b>\n\n"
            "✅ Send image, PDF or CSV.\n"
            "❌ Excel isn't supported yet (export to CSV or PDF).\n"
        ),
        'media_excel_not_supported': (
            "⚠️ <b>Excel not supported</b>\n\n"
            "✅ Export to CSV or PDF and try again.\n"
        ),
        'media_too_large': (
            "⚠️ <b>File too large</b>\n\n"
            "Maximum: 10MB.\n"
        ),
        'media_processing': (
            "🧠 <b>Analyzing statement...</b>\n\n"
            "This may take a few seconds."
        ),
        'media_parse_error': (
            "⚠️ <b>Couldn't read the statement</b>\n\n"
            "Try another image/PDF/CSV or a clearer photo."
        ),
        'media_limit_reached': (
            "⚠️ <b>Daily limit reached</b>\n\n"
            "You've already used today's 2 images/files."
        ),
        'media_summary_header': (
            "📄 <b>Statement summary</b>\n\n"
        ),
        'media_summary_totals': (
            "📊 <b>Totals by category</b>"
        ),
        'media_summary_truncated': (
            "⚠️ Summary truncated due to size."
        ),
        'category_create_prompt': (
            "🏷️ <b>Category not found</b>\n\n"
            "Create category <b>{category}</b> for:\n"
            "<code>{description}</code>"
        ),
        'category_created': (
            "✅ Category created: <b>{category}</b>"
        ),
        'category_skipped': (
            "➡️ Using category: <b>{category}</b>"
        ),
        'batch_not_found': (
            "⚠️ <b>Import not found</b>\n\n"
            "Please send the statement again."
        ),
        'batch_import_confirmed': (
            "✅ <b>Import completed</b>\n\n"
            "{count} transactions created."
        ),
        'batch_import_cancelled': (
            "🚫 <b>Import cancelled</b>"
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
        'transaction_pending': (
            "✨ <b>New Transaction</b> ✨\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Description:</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Value:</b> <code>{amount}€</code>\n"
            "🏷️ <b>Category:</b> {category}\n"
            "📊 <b>Type:</b> {type}\n\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "✅ Confirm this transaction?"
        ),
        'transaction_confirmed': (
            "✨ <b>Transaction Confirmed!</b> ✨\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Description:</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Value:</b> <code>{amount}€</code>\n"
            "🏷️ <b>Category:</b> {category}\n"
            "📊 <b>Type:</b> {type}\n\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "🧘‍♂️ <i>Registered in your Zen ecosystem.</i>"
        ),
        'transaction_registered': (
            "✨ <b>Transaction Registered!</b> ✨\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Description:</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Value:</b> <code>{amount}€</code>\n"
            "🏷️ <b>Category:</b> {category}\n"
            "📊 <b>Type:</b> {type}\n\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "🧘‍♂️ <i>Registered in your Zen ecosystem.</i>"
        ),
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
        'multiple_transactions_created': (
            "✨ <b>{count} Transaction(s) Created!</b> ✨\n\n"
            "💎 All transactions were registered automatically.\n\n"
            "🧘‍♂️ <i>Your Zen ecosystem is updated.</i>"
        ),
        'clear_success': (
            "✨ <b>Cleanup Complete!</b> ✨\n\n"
            "🧹 <b>{count} pending transaction(s)</b> were deleted.\n\n"
            "💎 Your Zen ecosystem is clean.\n\n"
            "🧘‍♂️ <i>You can start registering new transactions.</i>"
        ),
        'clear_empty': (
            "✨ <b>Already clean!</b> ✨\n\n"
            "💎 There are no pending transactions to clear.\n\n"
            "🧘‍♂️ <i>Your Zen ecosystem is organized.</i>"
        ),
        'clear_unauthorized': (
            "⚠️ <b>Not authorized</b>\n\n"
            "💡 Send <code>/start</code> to begin."
        ),
        'type_expense': 'Expense',
        'type_income': 'Income',
        'button_confirm': '✨ Confirm',
        'button_cancel': '🚫 Cancel',
        'button_create_category': '✅ Create',
        'button_skip_category': '➡️ Use default',
        'button_confirm_import': '✅ Confirm import',
        'button_cancel_import': '🚫 Cancel import',
    },
    'fr': {
        'welcome_new': (
            "✨ <b>Bienvenue sur Finan</b><i>Zen</i> ✨\n\n"
            "🧘‍♂️ Ton <b>écosystème financier</b> est à un message.\n\n"
            "📧 Pour commencer, envoie l'<b>email</b> que tu utilises sur la plateforme Finly.\n\n"
            "📄 Tu peux aussi envoyer des <b>relevés</b> (image/PDF/CSV) et je les organise par catégorie.\n"
            "✅ Tu confirmes tout avant la création des transactions.\n"
            "⚠️ Limite : 2 images/fichiers par jour.\n\n"
            "💎 <i>Maîtrise ton argent avec simplicité.</i>"
        ),
        'welcome_return': (
            "✨ <b>Bon retour, Maître !</b> ✨\n\n"
            "💎 Ton <b>écosystème Zen</b> est prêt.\n\n"
            "📝 <b>Envoie des transactions comme :</b>\n"
            "• 🍽️ Déjeuner 15€\n"
            "• 💰 Salaire 1000€\n"
            "• ⛽ Essence 50€\n\n"
            "📄 <b>Ou envoie un relevé</b> (image/PDF/CSV) pour importer en lot.\n"
            "⚠️ Limite : 2 images/fichiers par jour.\n\n"
            "📖 Envoie <code>/info</code> pour plus d'aide.\n\n"
            "🧘‍♂️ <i>Paix financière à chaque message.</i>"
        ),
        'help_guide': (
            "✨ <b>Guide du Maître Finan</b><i>Zen</i> ✨\n\n"
            "📝 <b>Format du message :</b>\n"
            "<code>Description Montant€</code>\n\n"
            "💡 <b>Exemples :</b>\n"
            "• 🍽️ Déjeuner 15€\n"
            "• 💰 Salaire 1000€\n"
            "• 🏋️ Salle de sport 30€\n"
            "• 🍽️ Déjeuner 25€ ⛽ Essence 10€\n\n"
            "📄 <b>Relevés/reçus :</b>\n"
            "• Envoie image/PDF/CSV\n"
            "• Tu reçois une liste et tu confirmes l'import\n"
            "• Limite : 2 images/fichiers par jour\n\n"
            "🎯 <b>Fonctionnalités :</b>\n"
            "• Catégorisation automatique par IA\n"
            "• Spécifier la catégorie : <code>Description - Catégorie Montant€</code>\n"
            "• Plusieurs transactions en un message\n\n"
            "🧘‍♂️ <i>La simplicité est la clé du contrôle financier.</i>"
        ),
        'rate_limit': (
            "⏱️ <b>Trop de messages</b>\n\n"
            "💡 Attends un peu avant d'envoyer d'autres transactions.\n\n"
            "🧘‍♂️ <i>La paix financière demande de la patience.</i>"
        ),
        'session_expired': (
            "⚠️ Session expirée. Envoie /start pour commencer."
        ),
        'unauthorized': (
            "✨ <b>Bienvenue sur Finan</b><i>Zen</i> ✨\n\n"
            "📧 Pour commencer, envoie l'<b>email</b> que tu utilises sur la plateforme.\n\n"
            "💡 Ou envoie <code>/start</code> pour commencer.\n\n"
            "🧘‍♂️ <i>Maîtrise ton argent avec simplicité.</i>"
        ),
        'workspace_not_found': (
            "⚠️ <b>Espace de travail introuvable</b>\n\n"
            "💡 Contacte le support.\n\n"
            "🧘‍♂️ <i>Nous sommes là pour t'aider.</i>"
        ),
        'invalid_email': (
            "⚠️ <b>Email invalide</b>\n\n"
            "📧 Envoie un email valide.\n\n"
            "💡 <i>Exemple : ton-email@exemple.com</i>"
        ),
        'email_not_found': (
            "✨ <b>Email reçu</b> ✨\n\n"
            "💎 Si tu as un compte <b>Pro</b>, tu peux commencer à utiliser le bot.\n\n"
            "🧘‍♂️ <i>Ton écosystème financier est presque prêt.</i>"
        ),
        'pro_required': (
            "💎 <b>Compte Pro requis</b>\n\n"
            "✨ Cette fonctionnalité nécessite un compte <b>Pro</b>.\n\n"
            "🚀 Passe à la version Pro sur la plateforme pour débloquer le bot Telegram.\n\n"
            "🧘‍♂️ <i>Transforme la gestion financière en expérience Zen.</i>"
        ),
        'already_associated': (
            "⚠️ <b>Telegram déjà associé</b>\n\n"
            "📧 Ce Telegram est déjà associé à un autre compte :\n"
            "<code>{email}</code>\n\n"
            "💡 <i>Un Telegram ne peut être associé qu'à un seul compte.</i>"
        ),
        'account_linked_success': (
            "✨ <b>Compte associé avec succès !</b> ✨\n\n"
            "💎 <b>Compte :</b> <code>{email}</code>\n\n"
            "🎯 <b>Tu peux maintenant envoyer des transactions :</b>\n"
            "• 🍽️ Déjeuner 15€\n"
            "• 💰 Salaire 1000€\n"
            "• ⛽ Essence 50€\n\n"
            "📖 Envoie <code>/info</code> pour voir tous les formats.\n\n"
            "🧘‍♂️ <i>Ton écosystème Zen est actif.</i>"
        ),
        'photo_not_supported': (
            "📸 <b>Traitement d'images</b>\n\n"
            "⚠️ Cette fonctionnalité est temporairement indisponible.\n\n"
            "📝 Écris la transaction en texte :\n"
            "• <code>Déjeuner 15€</code>\n"
            "• <code>Essence 50€</code>\n\n"
            "🧘‍♂️ <i>La simplicité est la clé.</i>"
        ),
        'media_not_supported': (
            "⚠️ <b>Fichier non supporté</b>\n\n"
            "✅ Envoie image, PDF ou CSV.\n"
            "❌ Excel n'est pas encore supporté (exporte en CSV ou PDF).\n"
        ),
        'media_excel_not_supported': (
            "⚠️ <b>Excel non supporté</b>\n\n"
            "✅ Exporte en CSV ou PDF et réessaie.\n"
        ),
        'media_too_large': (
            "⚠️ <b>Fichier trop volumineux</b>\n\n"
            "Maximum : 10 Mo.\n"
        ),
        'media_processing': (
            "🧠 <b>Analyse du relevé en cours...</b>\n\n"
            "Cela peut prendre quelques secondes."
        ),
        'media_parse_error': (
            "⚠️ <b>Impossible de lire le relevé</b>\n\n"
            "Essaie une autre image/PDF/CSV ou une photo plus nette."
        ),
        'media_limit_reached': (
            "⚠️ <b>Limite quotidienne atteinte</b>\n\n"
            "Tu as déjà utilisé tes 2 images/fichiers du jour."
        ),
        'media_summary_header': (
            "📄 <b>Résumé du relevé</b>\n\n"
        ),
        'media_summary_totals': (
            "📊 <b>Total par catégorie</b>"
        ),
        'media_summary_truncated': (
            "⚠️ Résumé tronqué pour la taille."
        ),
        'category_create_prompt': (
            "🏷️ <b>Catégorie introuvable</b>\n\n"
            "Créer la catégorie <b>{category}</b> pour :\n"
            "<code>{description}</code>"
        ),
        'category_created': (
            "✅ Catégorie créée : <b>{category}</b>"
        ),
        'category_skipped': (
            "➡️ J'ai utilisé la catégorie : <b>{category}</b>"
        ),
        'batch_not_found': (
            "⚠️ <b>Import introuvable</b>\n\n"
            "Envoie à nouveau le relevé."
        ),
        'batch_import_confirmed': (
            "✅ <b>Import terminé</b>\n\n"
            "{count} transaction(s) créée(s)."
        ),
        'batch_import_cancelled': (
            "🚫 <b>Import annulé</b>"
        ),
        'parse_error': (
            "🤔 <b>Je n'ai pas compris</b>\n\n"
            "💡 <b>Essaie des formats comme :</b>\n"
            "• 🍽️ <code>Déjeuner 15€</code>\n"
            "• ⛽ <code>Essence 50€</code>\n"
            "• 💰 <code>Reçu 500€</code>\n"
            "• 🍽️ <code>Déjeuner - Alimentation 25€</code>\n\n"
            "📖 Envoie <code>/info</code> pour voir tous les formats.\n\n"
            "🧘‍♂️ <i>La simplicité est la clé.</i>"
        ),
        'transaction_pending': (
            "✨ <b>Nouvelle transaction</b> ✨\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Description :</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Montant :</b> <code>{amount}€</code>\n"
            "🏷️ <b>Catégorie :</b> {category}\n"
            "📊 <b>Type :</b> {type}\n\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "✅ Confirmer cette transaction ?"
        ),
        'transaction_confirmed': (
            "✨ <b>Transaction confirmée !</b> ✨\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Description :</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Montant :</b> <code>{amount}€</code>\n"
            "🏷️ <b>Catégorie :</b> {category}\n"
            "📊 <b>Type :</b> {type}\n\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "🧘‍♂️ <i>Enregistré dans ton écosystème Zen.</i>"
        ),
        'transaction_registered': (
            "✨ <b>Transaction enregistrée !</b> ✨\n"
            "━━━━━━━━━━━━━━━━━━\n\n"
            "📝 <b>Description :</b>\n"
            "<code>{description}</code>\n\n"
            "{emoji} <b>Montant :</b> <code>{amount}€</code>\n"
            "🏷️ <b>Catégorie :</b> {category}\n"
            "📊 <b>Type :</b> {type}\n\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "🧘‍♂️ <i>Enregistré dans ton écosystème Zen.</i>"
        ),
        'transaction_not_found': (
            "❌ Transaction introuvable ou déjà traitée."
        ),
        'transaction_cancelled': (
            "🚫 <b>Transaction annulée</b>\n\n"
            "💡 La transaction a été annulée et n'a pas été enregistrée.\n\n"
            "🧘‍♂️ <i>Tu peux envoyer une nouvelle transaction quand tu veux.</i>"
        ),
        'transaction_cancel_not_found': (
            "⚠️ <b>Transaction introuvable</b>\n\n"
            "💡 Cette transaction a déjà été traitée ou n'existe pas.\n\n"
            "🧘‍♂️ <i>Tu peux envoyer une nouvelle transaction.</i>"
        ),
        'multiple_transactions_created': (
            "✨ <b>{count} transaction(s) créée(s) !</b> ✨\n\n"
            "💎 Toutes les transactions ont été enregistrées automatiquement.\n\n"
            "🧘‍♂️ <i>Ton écosystème Zen est à jour.</i>"
        ),
        'clear_success': (
            "✨ <b>Nettoyage terminé !</b> ✨\n\n"
            "🧹 <b>{count} transaction(s) en attente</b> supprimée(s).\n\n"
            "💎 Ton écosystème Zen est propre.\n\n"
            "🧘‍♂️ <i>Tu peux enregistrer de nouvelles transactions.</i>"
        ),
        'clear_empty': (
            "✨ <b>Déjà propre !</b> ✨\n\n"
            "💎 Aucune transaction en attente à supprimer.\n\n"
            "🧘‍♂️ <i>Ton écosystème Zen est organisé.</i>"
        ),
        'clear_unauthorized': (
            "⚠️ <b>Non autorisé</b>\n\n"
            "💡 Envoie <code>/start</code> pour commencer."
        ),
        'type_expense': 'Dépense',
        'type_income': 'Revenu',
        'button_confirm': '✨ Confirmer',
        'button_cancel': '🚫 Annuler',
        'button_create_category': '✅ Créer',
        'button_skip_category': '➡️ Par défaut',
        'button_confirm_import': '✅ Confirmer l\'import',
        'button_cancel_import': '🚫 Annuler l\'import',
    }
}

def get_telegram_translation(language: str = 'pt', key: str = None):
    """
    Get Telegram bot translations for a specific language
    
    Args:
        language: Language code ('pt', 'en', or 'fr')
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
        language: Language code ('pt', 'en', or 'fr')
    
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

