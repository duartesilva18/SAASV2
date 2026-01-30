from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Union, Tuple
import uuid
from jose import jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    jti: Optional[str] = None,
) -> Tuple[str, str]:
    """Cria access token com jti (session id). Retorna (token, jti) para registar sessão."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    session_jti = jti or str(uuid.uuid4())
    to_encode = {"exp": expire, "sub": str(subject), "type": "access", "jti": session_jti}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt, session_jti

def create_refresh_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=7)
    
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

