import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()

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
    
    STRIPE_API_KEY: str = os.getenv('STRIPE_API_KEY', '')
    STRIPE_WEBHOOK_SECRET: str = os.getenv('STRIPE_WEBHOOK_SECRET', '')
    
    WHATSAPP_TOKEN: str = os.getenv('WHATSAPP_TOKEN', '').strip().strip('"')
    WHATSAPP_PHONE_NUMBER_ID: str = os.getenv('WHATSAPP_PHONE_NUMBER_ID', '').strip().strip('"')
    WHATSAPP_VERIFY_TOKEN: str = os.getenv('WHATSAPP_VERIFY_TOKEN', 'zen_secret_token').strip().strip('"')
    
    TELEGRAM_BOT_TOKEN: str = os.getenv('TELEGRAM_BOT_TOKEN', '').strip().strip('"')
    TELEGRAM_WEBHOOK_SECRET: str = os.getenv('TELEGRAM_WEBHOOK_SECRET', '').strip().strip('"')
    GEMINI_API_KEY: str = os.getenv('GEMINI_API_KEY', '').strip().strip('"')
    
    MAIL_USERNAME: str = os.getenv('MAIL_USERNAME', '').strip()
    MAIL_PASSWORD: str = os.getenv('MAIL_PASSWORD', '').strip()
    MAIL_FROM: str = os.getenv('MAIL_FROM', '').strip()
    MAIL_PORT: int = int(os.getenv('MAIL_PORT', 587))
    MAIL_SERVER: str = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    
    GOOGLE_CLIENT_ID: str = os.getenv('GOOGLE_CLIENT_ID', '')
    FRONTEND_URL: str = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    
    # Configuração de ambiente
    ENVIRONMENT: str = os.getenv('ENVIRONMENT', 'development')

settings = Settings()

