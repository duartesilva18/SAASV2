"""
Telegram bot translations for backend messages
"""
TELEGRAM_TRANSLATIONS = {
    'pt': {
        'welcome_new': (
            "✨ <b>Bem-vindo ao Finan</b><i>Zen</i> ✨\n\n"
            "🧘‍♂️ O teu <b>ecossistema financeiro</b> está à distância de uma mensagem.\n\n"
            "📧 Para começarmos, envia o <b>email</b> que utilizas na plataforma Finly.\n\n"
            "💎 <i>Domina o teu dinheiro com simplicidade.</i>"
        ),
        'welcome_return': (
            "✨ <b>Olá de novo, Mestre!</b> ✨\n\n"
            "💎 O teu <b>ecossistema Zen</b> está pronto.\n\n"
            "📝 <b>Envia transações como:</b>\n"
            "• 🍽️ Almoço 15€\n"
            "• 💰 Salário 1000€\n"
            "• ⛽ Gasolina 50€\n\n"
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
    },
    'en': {
        'welcome_new': (
            "✨ <b>Welcome to Finan</b><i>Zen</i> ✨\n\n"
            "🧘‍♂️ Your <b>financial ecosystem</b> is just a message away.\n\n"
            "📧 To get started, send the <b>email</b> you use on the Finly platform.\n\n"
            "💎 <i>Master your money with simplicity.</i>"
        ),
        'welcome_return': (
            "✨ <b>Hello again, Master!</b> ✨\n\n"
            "💎 Your <b>Zen ecosystem</b> is ready.\n\n"
            "📝 <b>Send transactions like:</b>\n"
            "• 🍽️ Lunch 15€\n"
            "• 💰 Salary 1000€\n"
            "• ⛽ Gas 50€\n\n"
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

