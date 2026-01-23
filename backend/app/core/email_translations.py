"""
Email translations for backend email templates
"""
EMAIL_TRANSLATIONS = {
    'pt': {
        'verify_email': {
            'subject': 'Finly - Confirme o seu registo',
            'title': 'O seu futuro começa agora.',
            'welcome': 'Bem-vindo à elite financeira. Falta apenas validar o seu acesso para desbloquear o controlo total sobre o seu património.',
            'button': 'Ativar Conta Premium',
            'security_notice': 'Este link é pessoal, intransmissível e expira em 24 horas.',
            'footer': 'Finly Portugal © 2026 <br> High-End Financial Management'
        },
        'password_reset': {
            'subject': 'Finly - Código de Recuperação',
            'title': 'Recuperação de Acesso',
            'message': 'Recebemos um pedido para redefinir a sua password. Utilize o código de segurança abaixo para prosseguir com a redefinição:',
            'code_label': 'Código de Segurança',
            'security_notice': 'Este código é válido por apenas 15 minutos e destina-se apenas ao destinatário deste email.',
            'footer': 'Finly Portugal © 2026 <br> Segurança Bancária Certificada'
        },
        'marketing_footer': 'Recebeu este email porque aceitou as comunicações de marketing do Finly.'
    },
    'en': {
        'verify_email': {
            'subject': 'Finly - Confirm Your Registration',
            'title': 'Your future starts now.',
            'welcome': 'Welcome to the financial elite. You just need to validate your access to unlock total control over your assets.',
            'button': 'Activate Premium Account',
            'security_notice': 'This link is personal, non-transferable and expires in 24 hours.',
            'footer': 'Finly Portugal © 2026 <br> High-End Financial Management'
        },
        'password_reset': {
            'subject': 'Finly - Recovery Code',
            'title': 'Access Recovery',
            'message': 'We received a request to reset your password. Use the security code below to proceed with the reset:',
            'code_label': 'Security Code',
            'security_notice': 'This code is valid for only 15 minutes and is intended only for the recipient of this email.',
            'footer': 'Finly Portugal © 2026 <br> Bank-Level Security Certified'
        },
        'marketing_footer': 'You received this email because you accepted marketing communications from Finly.'
    }
}

def get_email_translation(language: str = 'pt', section: str = None):
    """
    Get email translations for a specific language
    
    Args:
        language: Language code ('pt' or 'en')
        section: Optional section to return (e.g., 'verify_email', 'password_reset')
    
    Returns:
        Dictionary with translations for the specified language and section
    """
    lang = language if language in EMAIL_TRANSLATIONS else 'pt'
    translations = EMAIL_TRANSLATIONS[lang]
    
    if section:
        return translations.get(section, {})
    return translations

