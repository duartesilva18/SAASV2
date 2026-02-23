import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Carregar .env da pasta backend; .env.local sobrepõe (override=True para ter prioridade)
_backend_dir = Path(__file__).resolve().parent.parent.parent
load_dotenv(_backend_dir / ".env")
load_dotenv(_backend_dir / ".env.local", override=True)
load_dotenv()  # fallback: cwd


def _get_stripe_api_key() -> str:
    """Usa STRIPE_API_KEY ou, em alternativa, STRIPE_API_KEY_TEST/STRIPE_API_KEY_LIVE conforme STRIPE_MODE."""
    key = os.getenv('STRIPE_API_KEY', '').strip()
    if key:
        return key
    mode = (os.getenv('STRIPE_MODE') or 'test').lower()
    if mode == 'test':
        return (os.getenv('STRIPE_API_KEY_TEST') or '').strip()
    return (os.getenv('STRIPE_API_KEY_LIVE') or '').strip()


def _get_stripe_webhook_secret() -> str:
    """Usa STRIPE_WEBHOOK_SECRET ou, em alternativa, STRIPE_WEBHOOK_SECRET_TEST/STRIPE_WEBHOOK_SECRET_LIVE conforme STRIPE_MODE."""
    secret = os.getenv('STRIPE_WEBHOOK_SECRET', '').strip()
    if secret:
        return secret
    mode = (os.getenv('STRIPE_MODE') or 'test').lower()
    if mode == 'test':
        return (os.getenv('STRIPE_WEBHOOK_SECRET_TEST') or '').strip()
    return (os.getenv('STRIPE_WEBHOOK_SECRET_LIVE') or '').strip()


# DATABASE_URL vem do .env ou .env.local. Para usar a BD do Render localmente: põe a connection string no .env.local
_LOCAL_DB_URL = 'postgresql://postgres:postgres@localhost:5432/saas_db'
_def_db = os.getenv('DATABASE_URL', _LOCAL_DB_URL)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra='ignore')
    PROJECT_NAME: str = 'FinSaaS - Gestão Financeira'
    DATABASE_URL: str = _def_db
    
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
    
    # Stripe: suporta STRIPE_API_KEY ou STRIPE_API_KEY_TEST/STRIPE_API_KEY_LIVE + STRIPE_MODE
    STRIPE_API_KEY: str = ''
    # Webhook: STRIPE_WEBHOOK_SECRET ou STRIPE_WEBHOOK_SECRET_TEST/STRIPE_WEBHOOK_SECRET_LIVE + STRIPE_MODE
    STRIPE_WEBHOOK_SECRET: str = ''
    # Price IDs dos planos (Live)
    STRIPE_PRICE_BASIC_MONTHLY: str = 'price_1SvKuoLtWlVpaXrbf1krzn1r'
    STRIPE_PRICE_PLUS: str = 'price_1SvKumLtWlVpaXrbh45T3Vez'
    STRIPE_PRICE_YEARLY: str = 'price_1SvKujLtWlVpaXrbGlU70upk'

    @field_validator('STRIPE_API_KEY', mode='before')
    @classmethod
    def set_stripe_api_key(cls, v: str) -> str:
        if v and isinstance(v, str) and v.strip():
            return v.strip()
        return _get_stripe_api_key()

    @field_validator('STRIPE_WEBHOOK_SECRET', mode='before')
    @classmethod
    def set_stripe_webhook_secret(cls, v: str) -> str:
        if v and isinstance(v, str) and v.strip():
            return v.strip()
        return _get_stripe_webhook_secret()
    
    WHATSAPP_TOKEN: str = os.getenv('WHATSAPP_TOKEN', '').strip().strip('"')
    WHATSAPP_PHONE_NUMBER_ID: str = os.getenv('WHATSAPP_PHONE_NUMBER_ID', '').strip().strip('"')
    WHATSAPP_VERIFY_TOKEN: str = os.getenv('WHATSAPP_VERIFY_TOKEN', 'zen_secret_token').strip().strip('"')
    
    TELEGRAM_BOT_TOKEN: str = os.getenv('TELEGRAM_BOT_TOKEN', '').strip().strip('"')
    TELEGRAM_WEBHOOK_SECRET: str = os.getenv('TELEGRAM_WEBHOOK_SECRET', '').strip().strip('"')
    OPENAI_API_KEY: str = os.getenv('OPENAI_API_KEY', '').strip().strip('"')
    
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

