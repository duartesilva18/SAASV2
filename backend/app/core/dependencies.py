from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from .config import settings
from fastapi_mail import ConnectionConfig

engine = create_engine(settings.DATABASE_URL)
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
    MAIL_FROM_NAME=settings.PROJECT_NAME
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

