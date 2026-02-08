from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from .config import settings
from fastapi_mail import ConnectionConfig

# pool_pre_ping: testa a ligação antes de usar (evita "SSL unexpected eof" / "Connection reset by peer")
# pool_recycle: recicla ligações antes do timeout do servidor (ex.: 10 min em managed Postgres)
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=600,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME or "placeholder@example.com",
    MAIL_PASSWORD=settings.MAIL_PASSWORD or "password",
    MAIL_FROM=settings.MAIL_FROM or "placeholder@example.com",
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=settings.USE_CREDENTIALS,
    VALIDATE_CERTS=True,
    MAIL_FROM_NAME=getattr(settings, 'MAIL_FROM_NAME', None) or settings.PROJECT_NAME,
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

