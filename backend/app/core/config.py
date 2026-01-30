import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()

_stripe_mode = os.getenv('STRIPE_MODE', 'test').strip().lower()
_stripe_api_key_legacy = os.getenv('STRIPE_API_KEY', '').strip()
_stripe_api_key_test = os.getenv('STRIPE_API_KEY_TEST', '').strip()
_stripe_api_key_live = os.getenv('STRIPE_API_KEY_LIVE', '').strip()
_stripe_webhook_secret_legacy = os.getenv('STRIPE_WEBHOOK_SECRET', '').strip()
_stripe_webhook_secret_test = os.getenv('STRIPE_WEBHOOK_SECRET_TEST', '').strip()
_stripe_webhook_secret_live = os.getenv('STRIPE_WEBHOOK_SECRET_LIVE', '').strip()

# Price IDs (test = Stripe Test mode, live = Stripe Live). Em produção: define STRIPE_PRICE_*_LIVE e STRIPE_MODE=live.
_stripe_price_basic_test = os.getenv('STRIPE_PRICE_BASIC_TEST', 'price_1SuIypLtWlVpaXrbD7ph1fhf').strip()
_stripe_price_plus_test = os.getenv('STRIPE_PRICE_PLUS_TEST', 'price_1SuIzcLtWlVpaXrbLkHE0QbS').strip()
_stripe_price_yearly_test = os.getenv('STRIPE_PRICE_YEARLY_TEST', 'price_1SuJ0GLtWlVpaXrb8BH9HIve').strip()
_stripe_price_basic_live = os.getenv('STRIPE_PRICE_BASIC_LIVE', '').strip()
_stripe_price_plus_live = os.getenv('STRIPE_PRICE_PLUS_LIVE', '').strip()
_stripe_price_yearly_live = os.getenv('STRIPE_PRICE_YEARLY_LIVE', '').strip()

def _pick_stripe_value(mode: str, test_val: str, live_val: str, legacy_val: str) -> str:
    if mode == 'live':
        return live_val or legacy_val or ''
    if mode == 'test':
        return test_val or legacy_val or ''
    return legacy_val or test_val or live_val or ''

class Settings(BaseSettings):
    PROJECT_NAME: str = 'FinSaaS - Gestão Financeira'
    DATABASE_URL: str = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/saas_db')
    
    # SECRET_KEY - OBRIGATÓRIO em produção via env
    _secret_key = os.getenv('SECRET_KEY', '').strip()
    _environment = os.getenv('ENVIRONMENT', 'development').lower()
    
    if not _secret_key:
        if _environment == 'production':
            raise ValueError(
                "❌ ERRO CRÍTICO: SECRET_KEY não configurado!\n"
                "Para produção, defina SECRET_KEY no ficheiro .env\n"
                "Gere uma chave segura com: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
            )
        # Apenas em desenvolvimento: usar chave padrão
        _secret_key = 'secret_key_super_secreta_para_desenvolvimento'
        import warnings
        warnings.warn("⚠️  Usando SECRET_KEY padrão de desenvolvimento. NÃO USE EM PRODUÇÃO!")
    elif _secret_key == 'secret_key_super_secreta_para_desenvolvimento' and _environment == 'production':
        raise ValueError(
            "❌ ERRO: Não é permitido usar a SECRET_KEY de desenvolvimento em produção!\n"
            "Defina uma SECRET_KEY segura no ficheiro .env"
        )
    
    SECRET_KEY: str = _secret_key
    
    ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120  # 2 horas
    
    STRIPE_MODE: str = _stripe_mode
    STRIPE_API_KEY_TEST: str = _stripe_api_key_test
    STRIPE_API_KEY_LIVE: str = _stripe_api_key_live
    STRIPE_WEBHOOK_SECRET_TEST: str = _stripe_webhook_secret_test
    STRIPE_WEBHOOK_SECRET_LIVE: str = _stripe_webhook_secret_live
    STRIPE_API_KEY: str = _pick_stripe_value(
        _stripe_mode, _stripe_api_key_test, _stripe_api_key_live, _stripe_api_key_legacy
    )
    STRIPE_WEBHOOK_SECRET: str = _pick_stripe_value(
        _stripe_mode, _stripe_webhook_secret_test, _stripe_webhook_secret_live, _stripe_webhook_secret_legacy
    )
    STRIPE_PRICE_BASIC: str = _pick_stripe_value(
        _stripe_mode, _stripe_price_basic_test, _stripe_price_basic_live, _stripe_price_basic_test
    )
    STRIPE_PRICE_PLUS: str = _pick_stripe_value(
        _stripe_mode, _stripe_price_plus_test, _stripe_price_plus_live, _stripe_price_plus_test
    )
    STRIPE_PRICE_YEARLY: str = _pick_stripe_value(
        _stripe_mode, _stripe_price_yearly_test, _stripe_price_yearly_live, _stripe_price_yearly_test
    )

    WHATSAPP_TOKEN: str = os.getenv('WHATSAPP_TOKEN', '').strip().strip('"')
    WHATSAPP_PHONE_NUMBER_ID: str = os.getenv('WHATSAPP_PHONE_NUMBER_ID', '').strip().strip('"')
    WHATSAPP_VERIFY_TOKEN: str = os.getenv('WHATSAPP_VERIFY_TOKEN', 'zen_secret_token').strip().strip('"')
    
    TELEGRAM_BOT_TOKEN: str = os.getenv('TELEGRAM_BOT_TOKEN', '').strip().strip('"')
    TELEGRAM_WEBHOOK_SECRET: str = os.getenv('TELEGRAM_WEBHOOK_SECRET', '').strip().strip('"')
    GEMINI_API_KEY: str = os.getenv('GEMINI_API_KEY', '').strip().strip('"')
    
    MAIL_USERNAME: str = os.getenv('MAIL_USERNAME', '').strip()
    MAIL_PASSWORD: str = os.getenv('MAIL_PASSWORD', '').strip()
    MAIL_FROM: str = os.getenv('MAIL_FROM', '').strip()
    MAIL_FROM_NAME: str = os.getenv('MAIL_FROM_NAME', 'Finly').strip()
    # Email para onde são enviadas as mensagens do formulário de contacto/suporte (botão flutuante).
    SUPPORT_EMAIL: str = (os.getenv('SUPPORT_EMAIL') or os.getenv('MAIL_FROM', '')).strip()
    MAIL_PORT: int = int(os.getenv('MAIL_PORT', 587))
    MAIL_SERVER: str = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    
    GOOGLE_CLIENT_ID: str = os.getenv('GOOGLE_CLIENT_ID', '')
    # Um único URL base para links em emails e redirects (ex.: https://app.finlybot.com).
    # Se vier lista separada por vírgulas, usa o primeiro.
    FRONTEND_URL: str = (os.getenv('FRONTEND_URL') or 'https://app.finlybot.com').split(',')[0].strip().rstrip('/')
    
    # Configuração de ambiente
    ENVIRONMENT: str = os.getenv('ENVIRONMENT', 'development')

settings = Settings()

