from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import datetime, timedelta, timezone, date
from typing import Optional
import secrets
import re
import uuid
import requests
from jose import jwt, JWTError
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
import logging
from ..core import security
from ..core.config import settings
from ..core.dependencies import get_db
from ..models import database as models
from ..schemas import schemas
from ..core.limiter import limiter
from ..core.audit import log_action
from ..core.email_translations import get_email_translation

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/auth', tags=['auth'])
VERIFICATION_EXPIRY_MINUTES = 30


def _frontend_base_url() -> str:
    """Um único URL base para links em emails (evita lista separada por vírgulas)."""
    url = (getattr(settings, 'FRONTEND_URL', None) or '').strip()
    return (url.split(',')[0].strip().rstrip('/') or 'https://app.finlybot.com')


async def _send_verification_email_background(to_email: str, subject: str, body_html: str) -> None:
    """Envia email de verificação em background (não bloqueia a resposta do registo)."""
    if not (to_email and str(to_email).strip()):
        logger.warning('Email de verificação ignorado: destinatário vazio.')
        return
    if not (subject and str(subject).strip()):
        logger.warning(f'Email de verificação ignorado: assunto vazio (para {to_email}).')
        return
    if not (body_html and str(body_html).strip()):
        logger.warning(f'Email de verificação ignorado: corpo vazio (para {to_email}).')
        return
    mail_user = (getattr(settings, 'MAIL_USERNAME', '') or '').strip()
    mail_from = (getattr(settings, 'MAIL_FROM', '') or '').strip() or mail_user
    conf = ConnectionConfig(
        MAIL_USERNAME=mail_user,
        MAIL_PASSWORD=(getattr(settings, 'MAIL_PASSWORD', '') or '').strip(),
        MAIL_FROM=mail_from,
        MAIL_PORT=getattr(settings, 'MAIL_PORT', 587),
        MAIL_SERVER=(getattr(settings, 'MAIL_SERVER', '') or 'smtp.gmail.com').strip(),
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
        MAIL_FROM_NAME=getattr(settings, 'MAIL_FROM_NAME', 'Finly') or 'Finly',
    )
    msg = MessageSchema(subject=subject.strip(), recipients=[to_email.strip()], body=body_html, subtype=MessageType.html)
    fm = FastMail(conf)
    try:
        await fm.send_message(msg)
        logger.info(f'Email de verificação enviado para {to_email}')
    except Exception as e:
        logger.error(f'Erro ao enviar email de verificação para {to_email}: {e}')


def purge_expired_unverified_users(db: Session):
    """Remove contas não verificadas expiradas (30 min)."""
    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=VERIFICATION_EXPIRY_MINUTES)
    expired = db.query(models.User).filter(
        models.User.is_email_verified == False,
        models.User.created_at < cutoff
    ).all()
    for u in expired:
        db.query(models.EmailVerification).filter(models.EmailVerification.email == u.email).delete(synchronize_session=False)
        db.delete(u)
    if expired:
        db.commit()

def normalize_email(email: str) -> str:
    """Normaliza email: trim, minúsculas e remove ponto final (typo comum)."""
    if not email:
        return ''
    return (email.strip().lower()).rstrip('.')


def validate_email(email: str) -> bool:
    """Valida formato de email usando regex robusto"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_password(password: str) -> tuple[bool, str]:
    """Valida força da senha"""
    if len(password.encode('utf-8')) > 72:
        return False, "A senha não pode ter mais de 72 caracteres"
    if len(password) < 8:
        return False, "A senha deve ter pelo menos 8 caracteres"
    if not re.search(r'[A-Z]', password):
        return False, "A senha deve conter pelo menos uma letra maiúscula"
    if not re.search(r'[a-z]', password):
        return False, "A senha deve conter pelo menos uma letra minúscula"
    if not re.search(r'\d', password):
        return False, "A senha deve conter pelo menos um número"
    return True, ""

async def get_current_user(request: Request, db: Session = Depends(get_db), token: str = Depends(security.oauth2_scheme)):
    purge_expired_unverified_users(db)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Could not validate credentials',
        headers={'WWW-Authenticate': 'Bearer'}
    )
    try:
        auth_header = request.headers.get("authorization")
        token_preview = token[:10] + "..." if token else "none"
        logger.info(
            f'🔐 Auth header received: {bool(auth_header)} '
            f'(token_len={len(token) if token else 0}, token_preview={token_preview}) '
            f'from {request.client.host if request.client else "unknown"}'
        )
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get('sub')
        if email is None:
            raise credentials_exception
        # Reject refresh tokens used as access tokens
        token_type = payload.get('type', 'access')
        if token_type != 'access':
            logger.warning(f'❌ Token rejeitado: tipo "{token_type}" não é "access"')
            raise credentials_exception
    except JWTError as e:
        logger.warning(f'❌ JWTError ao validar token: {str(e)}')
        raise credentials_exception
    
    # Lookup por email insensível a maiúsculas (evita contas duplicadas Telegram vs Google)
    email_normalized = normalize_email(email or "")
    user = db.query(models.User).filter(func.lower(models.User.email) == email_normalized).first()
    if user is None:
        logger.warning(f'❌ Token válido mas utilizador não encontrado: {email}')
        raise credentials_exception
    # Block deactivated users
    if not getattr(user, 'is_active', True):
        logger.warning(f'❌ Conta desativada: {email}')
        raise HTTPException(status_code=403, detail='Account deactivated')
    logger.info(f'✅ Utilizador autenticado: {email}')
    return user

def _purge_expired_registration_verifications(db: Session):
    """Remove códigos de verificação de registo expirados."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
    deleted = db.query(models.RegistrationVerification).filter(
        models.RegistrationVerification.expires_at < cutoff
    ).delete(synchronize_session=False)
    if deleted:
        db.commit()


def _get_referrer_by_code(db: Session, code: Optional[str]):
    """Lookup afiliado por código: case-insensitive e trim. Devolve (referrer, affiliate_code_canonical) ou (None, None)."""
    if not code or not str(code).strip():
        return None, None
    normalized = str(code).strip().lower()
    referrer = db.query(models.User).filter(
        and_(
            models.User.is_affiliate == True,
            func.lower(func.coalesce(models.User.affiliate_code, '')) == normalized
        )
    ).first()
    if not referrer or not referrer.affiliate_code:
        return None, None
    return referrer, referrer.affiliate_code


@router.post('/register', response_model=schemas.RegisterPendingResponse)
@limiter.limit('30/hour')
async def register(request: Request, user_in: schemas.UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Registo: envia código de 6 dígitos por email. O utilizador confirma em POST /register/confirm."""
    try:
        purge_expired_unverified_users(db)
        _purge_expired_registration_verifications(db)

        email_normalized = normalize_email(user_in.email)
        if not validate_email(email_normalized):
            raise HTTPException(status_code=400, detail='Formato de email inválido.')
        is_valid, error_msg = validate_password(user_in.password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

        db_user = db.query(models.User).filter(models.User.email == email_normalized).first()
        if db_user:
            logger.warning(f'Tentativa de registo com email já existente: {email_normalized}')
            raise HTTPException(status_code=400, detail='Este email já está registado. Inicia sessão na página de login.')

        hashed_pw = security.get_password_hash(user_in.password)
        referral_code_raw = getattr(user_in, 'referral_code', None)
        referral_code = (referral_code_raw or '').strip() or None  # guardar limpo
        user_lang = getattr(user_in, 'language', 'pt') or 'pt'
        if user_lang not in ['pt', 'en']:
            user_lang = 'pt'

        # Remover verificação anterior para este email (novo pedido)
        db.query(models.RegistrationVerification).filter(
            models.RegistrationVerification.email == email_normalized
        ).delete(synchronize_session=False)

        code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        rv = models.RegistrationVerification(
            email=email_normalized,
            password_hash=hashed_pw,
            language=user_lang,
            referral_code=referral_code,
            code=code,
            expires_at=expires_at,
        )
        db.add(rv)
        db.commit()

        t = get_email_translation(user_lang, 'register_verify')
        html = f'''<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body,table,td{{margin:0;padding:0;-webkit-text-size-adjust:100%}}img{{border:0;display:block}}table{{border-collapse:collapse}}@media only screen and (max-width:600px){{.mpad{{padding:16px 12px!important}}.card{{max-width:100%!important;width:100%!important;border-radius:20px!important}}.hpad{{padding:28px 20px!important}}.ctpad{{padding:24px 20px 28px!important}}.ctpad h2{{font-size:20px!important}}.codebox{{padding:28px 20px!important}}.code{{font-size:40px!important;letter-spacing:8px!important}}.fpad{{padding:20px 16px!important;font-size:9px!important}}}}</style></head><body style="margin:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f172a;min-height:100vh"><tr><td align="center" class="mpad" style="padding:32px 20px"><table role="presentation" class="card" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;width:100%;background:#0f172a;border-radius:24px;overflow:hidden;border:1px solid #1e293b;box-shadow:0 25px 50px -12px rgba(0,0,0,.5)"><tr><td style="height:4px;background:linear-gradient(90deg,#10b981 0%,#3b82f6 100%)"></td></tr><tr><td class="hpad" style="background:#020617;padding:36px 28px;text-align:center;border-bottom:1px solid #1e293b"><img src="https://app.finlybot.com/images/logo/logo-semfundo.png" alt="" width="72" height="72" style="display:block;margin:0 auto 8px;width:72px;height:72px;object-fit:contain" /><p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.02em">Finly</p></td></tr><tr><td class="ctpad" style="padding:32px 28px 36px;color:#94a3b8;line-height:1.65;font-size:15px;text-align:center"><h2 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;letter-spacing:-0.02em">{t['title']}</h2><p style="margin:0 0 24px;color:#94a3b8">{t['message']}</p><div class="codebox" style="background:#020617;border:2px dashed #1e293b;border-radius:20px;padding:36px 24px;text-align:center;margin:0 0 24px"><p style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:.15em;color:#64748b;font-weight:700">{t['code_label']}</p><p class="code" style="font-size:48px;font-weight:800;color:#10b981;letter-spacing:10px;margin:0;font-family:ui-monospace,monospace">{code}</p></div><p style="margin:0;font-size:12px;color:#64748b;font-style:italic">{t['security_notice']}</p></td></tr><tr><td class="fpad" style="background:#020617;padding:24px 28px;text-align:center;border-top:1px solid #1e293b;color:#475569;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em">{t['footer']}</td></tr></table></td></tr></table></body></html>'''
        env = getattr(settings, 'ENVIRONMENT', 'development')
        if not (getattr(settings, 'MAIL_USERNAME', '') or '').strip() or not (getattr(settings, 'MAIL_PASSWORD', '') or '').strip():
            logger.warning('MAIL_USERNAME ou MAIL_PASSWORD vazios no .env – o email de verificação pode não ser enviado.')

        conf = ConnectionConfig(
            MAIL_USERNAME=(getattr(settings, 'MAIL_USERNAME', '') or '').strip(),
            MAIL_PASSWORD=(getattr(settings, 'MAIL_PASSWORD', '') or '').strip(),
            MAIL_FROM=(getattr(settings, 'MAIL_FROM', '') or '').strip() or (getattr(settings, 'MAIL_USERNAME', '') or '').strip(),
            MAIL_PORT=getattr(settings, 'MAIL_PORT', 587),
            MAIL_SERVER=(getattr(settings, 'MAIL_SERVER', '') or 'smtp.gmail.com').strip(),
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=True,
            MAIL_FROM_NAME=getattr(settings, 'MAIL_FROM_NAME', 'Finly') or 'Finly',
        )
        msg = MessageSchema(subject=t['subject'], recipients=[email_normalized], body=html, subtype=MessageType.html)
        fm = FastMail(conf)
        email_sent = False
        try:
            await fm.send_message(msg)
            email_sent = True
            logger.info(f'Email de verificação de registo enviado com sucesso para {email_normalized}')
        except Exception as e:
            logger.error(f'Erro ao enviar email de verificação de registo para {email_normalized}: {e}', exc_info=True)

        out = {'message': 'Código de verificação enviado para o teu email.', 'email': email_normalized}
        if not email_sent and str(env).lower() == 'development':
            out['dev_code'] = code
            logger.warning(f'[DEV] Envio falhou – usar código manualmente: {code}')
        return out
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Erro ao processar registo para {user_in.email}: {str(e)}', exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail='Erro interno ao processar registo. Por favor, tente novamente mais tarde.'
        )


@router.post('/register/confirm', response_model=schemas.Token)
@limiter.limit('20/hour')
async def register_confirm(request: Request, data: schemas.RegisterConfirmRequest, db: Session = Depends(get_db)):
    """Confirma o registo com email + código de 6 dígitos. Cria o utilizador e devolve tokens."""
    _purge_expired_registration_verifications(db)
    email_normalized = normalize_email(data.email or '')
    code_clean = (data.code or '').strip()
    if len(code_clean) != 6 or not code_clean.isdigit():
        raise HTTPException(status_code=400, detail='Código inválido ou expirado.')

    rv = db.query(models.RegistrationVerification).filter(
        models.RegistrationVerification.email == email_normalized,
        models.RegistrationVerification.code == code_clean,
        models.RegistrationVerification.is_used == False,
        models.RegistrationVerification.expires_at > datetime.now(timezone.utc),
    ).first()
    if not rv:
        raise HTTPException(status_code=400, detail='Código inválido ou expirado.')

    referrer_id = None
    referral_code = (getattr(rv, 'referral_code', None) or '').strip() or None
    if referral_code:
        referrer, canonical_code = _get_referrer_by_code(db, referral_code)
        if referrer:
            referrer_id = referrer.id
            referral_code = canonical_code  # usar valor canónico para AffiliateReferral

    user = models.User(
        email=email_normalized,
        password_hash=rv.password_hash,
        is_email_verified=True,
        language=rv.language,
        referrer_id=referrer_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if referrer_id and referral_code:
        existing = db.query(models.AffiliateReferral).filter(
            models.AffiliateReferral.referred_user_id == user.id
        ).first()
        if not existing:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get('user-agent', '')[:500] if request.headers.get('user-agent') else None
            affiliate_ref = models.AffiliateReferral(
                referrer_id=referrer_id,
                referred_user_id=user.id,
                referral_code=referral_code,
                has_subscribed=False,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            db.add(affiliate_ref)
            db.commit()

    new_workspace = models.Workspace(owner_id=user.id, name='Meu Workspace')
    db.add(new_workspace)
    db.commit()
    db.refresh(new_workspace)
    user_lang = getattr(user, 'language', 'pt') or 'pt'
    categories_map = create_default_categories(db, new_workspace.id, user_lang)
    create_seed_transactions(db, new_workspace.id, categories_map)

    rv.is_used = True
    db.commit()

    await log_action(db, action='register', user_id=user.id, details=f'Registo confirmado: {user.email}', request=request)
    access_token = security.create_access_token(subject=user.email)
    refresh_token = security.create_refresh_token(subject=user.email)
    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_type': 'bearer',
    }


@router.post('/resend-verification')
@limiter.limit('3/hour')
async def resend_verification(
    request: Request,
    data: schemas.ResendVerificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Reenvia o link de verificação de email para um registo pendente."""
    purge_expired_unverified_users(db)
    email_lower = normalize_email(data.email or '')
    if not email_lower or not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email_lower):
        raise HTTPException(status_code=400, detail='Formato de email inválido.')

    user = db.query(models.User).filter(models.User.email == email_lower).first()
    if not user or user.is_email_verified:
        raise HTTPException(
            status_code=400,
            detail='Não existe registo pendente para este email. Regista-te primeiro ou faz login.'
        )

    ev = db.query(models.EmailVerification).filter(
        models.EmailVerification.email == email_lower,
        models.EmailVerification.is_used == False,
    ).first()
    if not ev:
        raise HTTPException(
            status_code=400,
            detail='Não existe pedido de verificação pendente. Regista-te primeiro.'
        )

    new_token = secrets.token_urlsafe(32)
    new_expires = datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_EXPIRY_MINUTES)
    ev.token = new_token
    ev.expires_at = new_expires
    db.commit()

    user_lang = getattr(user, 'language', 'pt') or 'pt'
    if user_lang not in ('pt', 'en'):
        user_lang = 'pt'
    t = get_email_translation(user_lang, 'verify_email')
    base = _frontend_base_url()
    verify_url = f"{base}/auth/verify-email?token={new_token}"
    if getattr(ev, 'referral_code', None):
        verify_url += f"&ref={ev.referral_code}"
    btn_style = (
        'display:inline-block;margin:24px 0 0;background:#3b82f6;color:#ffffff !important;text-decoration:none;'
        'padding:14px 28px;border-radius:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;font-size:12px;'
    )
    html = f'''<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body,table,td{{margin:0;padding:0;-webkit-text-size-adjust:100%}}img{{border:0;display:block}}table{{border-collapse:collapse}}@media only screen and (max-width:600px){{.mpad{{padding:16px 12px!important}}.card{{max-width:100%!important;width:100%!important;border-radius:20px!important}}.hpad{{padding:28px 20px!important}}.ctpad{{padding:24px 20px 28px!important}}.ctpad h2{{font-size:20px!important}}.ctpad p,.ctpad a{{font-size:14px!important}}.fpad{{padding:20px 16px!important;font-size:9px!important}}}}</style></head><body style="margin:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f172a;min-height:100vh"><tr><td align="center" class="mpad" style="padding:32px 20px"><table role="presentation" class="card" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;width:100%;background:#0f172a;border-radius:24px;overflow:hidden;border:1px solid #1e293b;box-shadow:0 25px 50px -12px rgba(0,0,0,.5)"><tr><td style="height:4px;background:linear-gradient(90deg,#3b82f6 0%,#6366f1 100%)"></td></tr><tr><td class="hpad" style="background:#020617;padding:36px 28px;text-align:center;border-bottom:1px solid #1e293b"><img src="https://app.finlybot.com/images/logo/logo-semfundo.png" alt="" width="72" height="72" style="display:block;margin:0 auto 8px;width:72px;height:72px;object-fit:contain" /><p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.02em">Finly</p></td></tr><tr><td class="ctpad" style="padding:32px 28px 36px;color:#94a3b8;line-height:1.65;font-size:15px;text-align:center"><h2 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;letter-spacing:-0.02em">{t["title"]}</h2><p style="margin:0 0 16px;color:#94a3b8">{t["welcome"]}</p><p style="margin:0"><a href="{verify_url}" style="{btn_style}">{t["button"]}</a></p><p style="margin:20px 0 0;font-size:12px;color:#64748b;font-style:italic">{t["security_notice"]}</p></td></tr><tr><td class="fpad" style="background:#020617;padding:24px 28px;text-align:center;border-top:1px solid #1e293b;color:#475569;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em">{t["footer"]}</td></tr></table></td></tr></table></body></html>'''

    background_tasks.add_task(_send_verification_email_background, email_lower, t['subject'], html)
    logger.info(f'Link de verificação reenviado para {email_lower}')
    return {'message': 'Link de verificação reenviado. Verifica o teu email (e a pasta de spam).'}


@router.get('/verification-status/{email}')
async def check_verification_status(email: str, db: Session = Depends(get_db)):
    purge_expired_unverified_users(db)
    email_norm = normalize_email(email or '')
    user = db.query(models.User).filter(models.User.email == email_norm).first()
    ev = db.query(models.EmailVerification).filter(
        models.EmailVerification.email == email_norm,
        models.EmailVerification.is_used == False
    ).first()
    return {
        'is_verified': user.is_email_verified if user else False,
        'verification_expires_at': ev.expires_at if ev else None
    }

# Nomes das categorias padrão por língua (PT/EN/FR). Usado ao criar workspace.
DEFAULT_CATEGORY_NAMES = {
    'pt': {
        'vault_investment': 'Cofre Investimentos',
        'vault_emergency': 'Cofre Emergência',
        'food': 'Alimentação',
        'entertainment': 'Entretenimento',
        'transport': 'Transportes',
        'housing': 'Habitação',
        'health': 'Saúde',
        'salary': 'Salário',
        'general_expense': 'Despesas gerais',
    },
    'en': {
        'vault_investment': 'Investment Vault',
        'vault_emergency': 'Emergency Fund',
        'food': 'Food',
        'entertainment': 'Entertainment',
        'transport': 'Transport',
        'housing': 'Housing',
        'health': 'Health',
        'salary': 'Salary',
        'general_expense': 'General expenses',
    },
    'fr': {
        'vault_investment': 'Cofre Investissements',
        'vault_emergency': 'Fonds d\'urgence',
        'food': 'Alimentation',
        'entertainment': 'Divertissement',
        'transport': 'Transports',
        'housing': 'Logement',
        'health': 'Santé',
        'salary': 'Salaire',
        'general_expense': 'Dépenses générales',
    },
}


def _default_cats_spec(language: str):
    """Lista de especificações de categorias padrão (com key). name é preenchido por língua."""
    names = DEFAULT_CATEGORY_NAMES.get(language) or DEFAULT_CATEGORY_NAMES['pt']
    return [
        {"key": "vault_investment", "type": "expense", "vault_type": "investment", "color_hex": "#3B82F6", "icon": "TrendingUp", "is_default": True},
        {"key": "vault_emergency", "type": "expense", "vault_type": "emergency", "color_hex": "#F97316", "icon": "ShieldCheck", "is_default": True},
        {"key": "food", "type": "expense", "vault_type": "none", "color_hex": "#F59E0B", "icon": "Utensils", "is_default": False},
        {"key": "entertainment", "type": "expense", "vault_type": "none", "color_hex": "#EC4899", "icon": "Gamepad", "is_default": False},
        {"key": "transport", "type": "expense", "vault_type": "none", "color_hex": "#3B82F6", "icon": "Car", "is_default": False},
        {"key": "housing", "type": "expense", "vault_type": "none", "color_hex": "#8B5CF6", "icon": "Home", "is_default": False},
        {"key": "health", "type": "expense", "vault_type": "none", "color_hex": "#10B981", "icon": "Heart", "is_default": False},
        {"key": "general_expense", "type": "expense", "vault_type": "none", "color_hex": "#64748B", "icon": "Wallet", "is_default": False},
        {"key": "salary", "type": "income", "vault_type": "none", "color_hex": "#10B981", "icon": "Landmark", "is_default": False},
    ], names


def ensure_salary_and_general_expense_for_workspace(db: Session, workspace_id: uuid.UUID, language: str, commit: bool = True) -> None:
    """Cria Salário e Despesas gerais num workspace se ainda não existirem. Usado na migração para contas antigas.
    Se commit=False, não faz commit (útil quando o caller gere a transação)."""
    lang = (language or 'pt').lower()[:2]
    if lang not in DEFAULT_CATEGORY_NAMES:
        lang = 'pt'
    names = DEFAULT_CATEGORY_NAMES[lang]
    specs = [
        {"key": "general_expense", "type": "expense", "vault_type": "none", "color_hex": "#64748B", "icon": "Wallet", "is_default": False},
        {"key": "salary", "type": "income", "vault_type": "none", "color_hex": "#10B981", "icon": "Landmark", "is_default": False},
    ]
    existing_names = {c.name for c in db.query(models.Category).filter(models.Category.workspace_id == workspace_id).all()}
    for spec in specs:
        name = names.get(spec["key"], spec["key"])
        if name in existing_names:
            continue
        new_cat = models.Category(
            workspace_id=workspace_id,
            name=name,
            type=spec["type"],
            vault_type=spec["vault_type"],
            color_hex=spec["color_hex"],
            icon=spec["icon"],
            is_default=spec["is_default"],
        )
        db.add(new_cat)
        existing_names.add(name)
    if commit:
        db.commit()


def create_default_categories(db: Session, workspace_id: uuid.UUID, language: str = 'pt'):
    """Cria categorias padrão no workspace. Nomes conforme a língua do utilizador (pt/en/fr)."""
    lang = (language or 'pt').lower()[:2]
    if lang not in DEFAULT_CATEGORY_NAMES:
        lang = 'pt'
    spec_list, names = _default_cats_spec(lang)
    categories_map = {}
    for spec in spec_list:
        name = names.get(spec["key"], spec["key"])
        cat_data = {
            "workspace_id": workspace_id,
            "name": name,
            "type": spec["type"],
            "vault_type": spec["vault_type"],
            "color_hex": spec["color_hex"],
            "icon": spec["icon"],
            "is_default": spec["is_default"],
        }
        new_cat = models.Category(**cat_data)
        db.add(new_cat)
        categories_map[spec["key"]] = new_cat
    db.commit()
    return categories_map

def create_seed_transactions(db: Session, workspace_id: uuid.UUID, categories_map: dict):
    """Cria transações de exemplo (1 cêntimo) para ajudar o Telegram a categorizar melhor.
    categories_map usa keys: food, transport, housing, health, entertainment, vault_investment, vault_emergency, salary, general_expense."""
    seed_transactions = [
        {"category": "food", "description": "Supermercado Continente", "amount_cents": -1, "days_ago": 5},
        {"category": "food", "description": "Pingo Doce compras", "amount_cents": -1, "days_ago": 3},
        {"category": "food", "description": "Restaurante McDonald's", "amount_cents": -1, "days_ago": 2},
        {"category": "food", "description": "Uber Eats entrega", "amount_cents": -1, "days_ago": 1},
        {"category": "food", "description": "Café Starbucks", "amount_cents": -1, "days_ago": 0},
        {"category": "transport", "description": "Uber viagem", "amount_cents": -1, "days_ago": 4},
        {"category": "transport", "description": "Bolt transporte", "amount_cents": -1, "days_ago": 2},
        {"category": "transport", "description": "Combustível Galp", "amount_cents": -1, "days_ago": 6},
        {"category": "transport", "description": "Bilhete metro Lisboa", "amount_cents": -1, "days_ago": 1},
        {"category": "transport", "description": "Estacionamento parque", "amount_cents": -1, "days_ago": 3},
        {"category": "housing", "description": "Renda apartamento", "amount_cents": -1, "days_ago": 7},
        {"category": "housing", "description": "Conta luz EDP", "amount_cents": -1, "days_ago": 10},
        {"category": "housing", "description": "Água EPAL", "amount_cents": -1, "days_ago": 8},
        {"category": "housing", "description": "Internet MEO", "amount_cents": -1, "days_ago": 5},
        {"category": "housing", "description": "Condomínio prédio", "amount_cents": -1, "days_ago": 4},
        {"category": "health", "description": "Farmácia medicamentos", "amount_cents": -1, "days_ago": 3},
        {"category": "health", "description": "Consulta médico", "amount_cents": -1, "days_ago": 5},
        {"category": "health", "description": "Ginásio fitness", "amount_cents": -1, "days_ago": 1},
        {"category": "health", "description": "Seguro saúde", "amount_cents": -1, "days_ago": 15},
        {"category": "entertainment", "description": "Netflix subscrição", "amount_cents": -1, "days_ago": 2},
        {"category": "entertainment", "description": "Spotify Premium", "amount_cents": -1, "days_ago": 1},
        {"category": "entertainment", "description": "Cinema NOS", "amount_cents": -1, "days_ago": 4},
        {"category": "entertainment", "description": "Jantar restaurante", "amount_cents": -1, "days_ago": 3},
        {"category": "entertainment", "description": "PlayStation Store", "amount_cents": -1, "days_ago": 6},
        {"category": "vault_investment", "description": "Ações bolsa", "amount_cents": -1, "days_ago": 7},
        {"category": "vault_investment", "description": "ETF investimento", "amount_cents": -1, "days_ago": 10},
        {"category": "vault_investment", "description": "Criptomoedas Bitcoin", "amount_cents": -1, "days_ago": 5},
        {"category": "vault_emergency", "description": "Poupança emergência", "amount_cents": -1, "days_ago": 14},
        {"category": "vault_emergency", "description": "Reserva fundo", "amount_cents": -1, "days_ago": 20},
        {"category": "general_expense", "description": "Trf. Mb Way Para", "amount_cents": -1, "days_ago": 2},
        {"category": "salary", "description": "Salário mensal", "amount_cents": 1, "days_ago": 0},
        {"category": "salary", "description": "Ordenado empresa", "amount_cents": 1, "days_ago": 30},
    ]
    
    today = date.today()
    
    for trans_data in seed_transactions:
        category = categories_map.get(trans_data["category"])
        if category:
            transaction_date = today - timedelta(days=trans_data["days_ago"])
            
            new_transaction = models.Transaction(
                workspace_id=workspace_id,
                category_id=category.id,
                amount_cents=trans_data["amount_cents"],
                description=trans_data["description"],
                transaction_date=transaction_date
            )
            db.add(new_transaction)
    
    db.commit()
    logger.info(f'Transações de exemplo criadas para workspace {workspace_id}')

@router.get('/verify-email')
async def verify_email(request: Request, token: str, ref: str = None, db: Session = Depends(get_db)):
    token_clean = (token or '').strip()
    if not token_clean:
        raise HTTPException(status_code=400, detail='Link inválido: falta o token de verificação.')

    verification = db.query(models.EmailVerification).filter(
        models.EmailVerification.token == token_clean,
        models.EmailVerification.is_used == False,
        models.EmailVerification.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not verification:
        # Distinguir "já usado" de "expirado/inválido" para mensagem mais clara
        used = db.query(models.EmailVerification).filter(
            models.EmailVerification.token == token_clean,
            models.EmailVerification.is_used == True
        ).first()
        if used:
            raise HTTPException(
                status_code=400,
                detail='Este link de verificação já foi utilizado. O teu email já está ativo — faz login na aplicação.'
            )
        raise HTTPException(
            status_code=400,
            detail='Link expirado ou inválido. Os links expiram em 30 minutos. Pede um novo link na página de login (Reenviar link).'
        )
    
    user = db.query(models.User).filter(models.User.email == verification.email).first()
    
    # Processar referência se fornecida (lookup case-insensitive)
    referrer_id = None
    referral_code = None
    ref_clean = (ref or '').strip() if ref else None
    if ref_clean:
        logger.info(f'🔍 Processando código de referência: {ref_clean} para email: {verification.email}')
        referrer, canonical_code = _get_referrer_by_code(db, ref_clean)
        if referrer:
            # Prevenir auto-referência (mesmo utilizador)
            if referrer.email != verification.email:
                referrer_id = referrer.id
                referral_code = canonical_code
                logger.info(f'✅ Código de referência válido: {ref_clean} -> afiliado {referrer.email} (ID: {referrer_id})')
            else:
                logger.warning(f'🚫 Auto-referência bloqueada: {verification.email} tentou usar seu próprio código')
        else:
            logger.warning(f'⚠️ Código de referência inválido ou afiliado não encontrado: {ref_clean}')
    else:
        logger.info(f'ℹ️ Nenhum código de referência fornecido na URL (ref={ref})')
    
    if not user:
        # Get language from verification if stored, or default to 'pt'
        user_language = getattr(verification, 'language', 'pt') or 'pt'
        if user_language not in ['pt', 'en']:
            user_language = 'pt'
        user = models.User(
            email=verification.email,
            password_hash=verification.password_hash,
            is_email_verified=True,
            language=user_language,
            referrer_id=referrer_id  # Definir referrer se existir
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Criar referência de afiliado se aplicável
        if referrer_id and referral_code:
            # Verificar se já existe referência para este usuário
            existing_referral = db.query(models.AffiliateReferral).filter(
                models.AffiliateReferral.referred_user_id == user.id
            ).first()
            
            if not existing_referral:
                ip_address = request.client.host if request.client else None
                user_agent = request.headers.get('user-agent', '')[:500] if request.headers.get('user-agent') else None
                
                referral = models.AffiliateReferral(
                    referrer_id=referrer_id,
                    referred_user_id=user.id,
                    referral_code=referral_code,
                    has_subscribed=False,  # Será atualizado quando subscrever
                    ip_address=ip_address,
                    user_agent=user_agent
                )
                db.add(referral)
                db.commit()
                logger.info(f'✅ Referência criada: {referrer.email} -> {user.email} (código: {referral_code})')
            else:
                logger.warning(f'⚠️ Referência já existe para {user.email}, não criando duplicado')
        else:
            if ref:
                logger.warning(f'⚠️ Código de referência fornecido ({ref}) mas referrer_id ou referral_code não foi definido')
            logger.info(f'ℹ️ Nenhuma referência criada para {user.email} (ref={ref}, referrer_id={referrer_id}, referral_code={referral_code})')
        
        new_workspace = models.Workspace(owner_id=user.id, name='Meu Workspace')
        db.add(new_workspace)
        db.commit()
        db.refresh(new_workspace)
        user_lang = getattr(user, 'language', 'pt') or 'pt'
        categories_map = create_default_categories(db, new_workspace.id, user_lang)
        create_seed_transactions(db, new_workspace.id, categories_map)
        logger.info(f'Utilizador criado e verificado: {user.email}')
        await log_action(db, action='register_success', user_id=user.id, details=f'Novo utilizador registado: {user.email}', request=request)
    else:
        # Usuário já existe - referências só podem ser criadas para contas novas
        user.is_email_verified = True
        if ref:
            logger.warning(f'⚠️ Tentativa de criar referência para usuário existente bloqueada: {user.email} (código: {ref}). Referências só são válidas para contas novas.')
        db.commit()
    
    verification.is_used = True
    db.commit()
    
    access_token = security.create_access_token(subject=user.email)
    refresh_token = security.create_refresh_token(subject=user.email)
    logger.info(f'🔑 Tokens gerados para {user.email} (access_len={len(access_token)}, refresh_len={len(refresh_token)})')
    
    return {
        'message': 'Email verificado com sucesso!',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_type': 'bearer'
    }

@router.get('/me', response_model=schemas.UserResponse)
async def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post('/spotlight-seen', response_model=schemas.UserResponse)
async def set_spotlight_seen(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marca que o utilizador já viu o onboarding spotlight (guardado na BD)."""
    current_user.onboarding_spotlight_seen = True
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post('/onboarding', response_model=schemas.UserResponse)
async def complete_onboarding(request: Request, onboarding_data: schemas.UserUpdateOnboarding, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verificar se o número de telefone já existe noutra conta
    if onboarding_data.phone_number:
        existing_user = db.query(models.User).filter(
            models.User.phone_number == onboarding_data.phone_number,
            models.User.id != current_user.id
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail=f'O número de telefone {onboarding_data.phone_number} já está associado a outra conta.'
            )
    
    current_user.full_name = onboarding_data.full_name
    current_user.phone_number = onboarding_data.phone_number
    current_user.currency = onboarding_data.currency
    current_user.gender = onboarding_data.gender
    current_user.marketing_opt_in = onboarding_data.marketing_opt_in
    current_user.is_onboarded = True
    
    # Verificar se o usuário tem referrer_id mas ainda não tem referência criada
    if current_user.referrer_id:
        existing_referral = db.query(models.AffiliateReferral).filter(
            models.AffiliateReferral.referred_user_id == current_user.id
        ).first()
        
        if not existing_referral:
            # Buscar o afiliado para obter o código
            referrer = db.query(models.User).filter(models.User.id == current_user.referrer_id).first()
            if referrer and referrer.is_affiliate and referrer.affiliate_code:
                ip_address = request.client.host if request.client else None
                user_agent = request.headers.get('user-agent', '')[:500] if request.headers.get('user-agent') else None
                
                referral = models.AffiliateReferral(
                    referrer_id=current_user.referrer_id,
                    referred_user_id=current_user.id,
                    referral_code=referrer.affiliate_code,
                    has_subscribed=False,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
                db.add(referral)
                logger.info(f'✅ Referência criada no onboarding: {referrer.email} -> {current_user.email} (código: {referrer.affiliate_code})')
            else:
                logger.warning(f'⚠️ Usuário tem referrer_id mas afiliado não encontrado ou inválido: {current_user.referrer_id}')
        else:
            logger.info(f'ℹ️ Referência já existe para {current_user.email}, não criando duplicado no onboarding')
    
    db.commit()
    db.refresh(current_user)
    
    logger.info(f'Utilizador completou onboarding: {current_user.email}')
    return current_user

@router.patch('/profile', response_model=schemas.UserResponse)
async def update_profile(request: Request, onboarding_data: schemas.UserUpdateOnboarding, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Verificar se o número de telefone já existe noutra conta
    if onboarding_data.phone_number:
        existing_user = db.query(models.User).filter(
            models.User.phone_number == onboarding_data.phone_number,
            models.User.id != current_user.id
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail=f'O número de telefone {onboarding_data.phone_number} já está associado a outra conta.'
            )
    
    current_user.full_name = onboarding_data.full_name
    current_user.phone_number = onboarding_data.phone_number
    current_user.currency = onboarding_data.currency
    current_user.gender = onboarding_data.gender
    current_user.marketing_opt_in = onboarding_data.marketing_opt_in
    current_user.is_onboarded = True
    
    db.commit()
    db.refresh(current_user)
    
    await log_action(db, action='profile_update', user_id=current_user.id, details=f'Perfil atualizado: {current_user.email}', request=request)
    logger.info(f'Utilizador atualizou perfil: {current_user.email}')
    return current_user


@router.patch('/email', response_model=schemas.UserResponse)
async def update_email(request: Request, data: schemas.UserUpdateEmail, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.password_hash:
        raise HTTPException(status_code=400, detail='Alteração de email não disponível para contas ligadas a redes sociais.')
    if not security.verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail='Password atual incorreta.')
    new_email_normalized = normalize_email(data.new_email or '')
    if not validate_email(new_email_normalized):
        raise HTTPException(status_code=400, detail='Formato de email inválido.')
    if new_email_normalized == current_user.email:
        raise HTTPException(status_code=400, detail='O novo email é igual ao atual.')
    existing = db.query(models.User).filter(models.User.email == new_email_normalized).first()
    if existing:
        raise HTTPException(status_code=400, detail='Este email já está associado a outra conta.')
    current_user.email = new_email_normalized
    current_user.is_email_verified = False
    db.commit()
    db.refresh(current_user)
    await log_action(db, action='email_update', user_id=current_user.id, details=f'Email alterado para {new_email_normalized}', request=request)
    logger.info(f'Utilizador alterou email para: {new_email_normalized}')
    return current_user


@router.post('/change-password')
async def change_password(request: Request, data: schemas.UserChangePassword, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.password_hash:
        raise HTTPException(status_code=400, detail='Alteração de password não disponível para contas ligadas a redes sociais.')
    if not security.verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail='Password atual incorreta.')
    is_valid, error_msg = validate_password(data.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    if data.current_password == data.new_password:
        raise HTTPException(status_code=400, detail='A nova password deve ser diferente da atual.')
    current_user.password_hash = security.get_password_hash(data.new_password)
    db.commit()
    await log_action(db, action='password_change', user_id=current_user.id, details='Password alterada', request=request)
    logger.info(f'Utilizador alterou password: {current_user.email}')
    return {'message': 'Password alterada com sucesso!'}


@router.patch('/language', response_model=schemas.UserResponse)
async def update_language(request: Request, language_data: schemas.UserUpdateLanguage, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validate language (only 'pt' or 'en' supported)
    if language_data.language not in ['pt', 'en']:
        raise HTTPException(status_code=400, detail='Idioma não suportado. Use "pt" ou "en".')
    
    current_user.language = language_data.language
    db.commit()
    db.refresh(current_user)
    
    await log_action(db, action='language_update', user_id=current_user.id, details=f'Idioma atualizado para {language_data.language}: {current_user.email}', request=request)
    logger.info(f'Utilizador atualizou idioma para {language_data.language}: {current_user.email}')
    return current_user

@router.post('/accept-terms', response_model=schemas.UserResponse)
async def accept_terms(request: Request, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    from datetime import datetime, timezone
    
    current_user.terms_accepted = True
    current_user.terms_accepted_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(current_user)
    
    await log_action(db, action='terms_accepted', user_id=current_user.id, details=f'Termos aceites: {current_user.email}', request=request)
    logger.info(f'Utilizador aceitou termos: {current_user.email}')
    return current_user

def _safe_isoformat(d):
    """Serializa date/datetime para string ISO ou None."""
    if d is None:
        return None
    if hasattr(d, 'isoformat'):
        return d.isoformat()
    return str(d)


@router.get('/export-data')
async def export_user_data(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Exporta todos os dados da conta (workspaces, categorias, transações, metas, recorrentes)
    em JSON para backup ou para importar noutra conta no futuro.
    """
    try:
        workspaces = (
            db.query(models.Workspace)
            .filter(models.Workspace.owner_id == current_user.id)
            .order_by(models.Workspace.created_at)
            .all()
        )
        out_workspaces = []
        for ws in workspaces:
            categories = db.query(models.Category).filter(models.Category.workspace_id == ws.id).order_by(models.Category.name).all()
            category_id_to_name = {str(c.id): c.name for c in categories}
            transactions = (
                db.query(models.Transaction)
                .filter(models.Transaction.workspace_id == ws.id)
                .order_by(models.Transaction.transaction_date, models.Transaction.created_at)
                .all()
            )
            recurring = (
                db.query(models.RecurringTransaction)
                .filter(models.RecurringTransaction.workspace_id == ws.id)
                .order_by(models.RecurringTransaction.description)
                .all()
            )
            goals = (
                db.query(models.SavingsGoal)
                .filter(models.SavingsGoal.workspace_id == ws.id)
                .order_by(models.SavingsGoal.name)
                .all()
            )
            out_workspaces.append({
                'name': ws.name or 'Workspace',
                'opening_balance_cents': int(ws.opening_balance_cents) if ws.opening_balance_cents is not None else 0,
                'opening_balance_date': _safe_isoformat(ws.opening_balance_date),
                'categories': [
                    {
                        'name': c.name or '',
                        'type': c.type or 'expense',
                        'color_hex': c.color_hex or '#3B82F6',
                        'icon': c.icon or 'Tag',
                        'monthly_limit_cents': int(c.monthly_limit_cents) if c.monthly_limit_cents is not None else 0,
                        'vault_type': c.vault_type or 'none',
                    }
                    for c in categories
                ],
                'transactions': [
                    {
                        'amount_cents': int(t.amount_cents),
                        'description': t.description if t.description is not None else '',
                        'transaction_date': _safe_isoformat(t.transaction_date),
                        'category_name': category_id_to_name.get(str(t.category_id)) if t.category_id else None,
                    }
                    for t in transactions
                ],
                'recurring_transactions': [
                    {
                        'description': r.description or '',
                        'amount_cents': int(r.amount_cents),
                        'day_of_month': int(r.day_of_month),
                        'category_name': category_id_to_name.get(str(r.category_id)) if r.category_id else None,
                        'is_active': bool(r.is_active),
                        'process_automatically': bool(r.process_automatically),
                    }
                    for r in recurring
                ],
                'savings_goals': [
                    {
                        'name': g.name or 'Meta',
                        'goal_type': g.goal_type or 'expense',
                        'target_amount_cents': int(g.target_amount_cents),
                        'current_amount_cents': int(g.current_amount_cents) if g.current_amount_cents is not None else 0,
                        'target_date': _safe_isoformat(g.target_date),
                        'icon': g.icon or 'Target',
                        'color_hex': g.color_hex or '#3B82F6',
                    }
                    for g in goals
                ],
            })
        return {
            'version': 1,
            'exported_at': datetime.now(timezone.utc).isoformat(),
            'profile': {
                'full_name': current_user.full_name or '',
                'currency': current_user.currency or 'EUR',
                'language': current_user.language or 'pt',
            },
            'workspaces': out_workspaces,
        }
    except Exception as e:
        logger.exception('Erro ao exportar dados do utilizador %s', current_user.email)
        raise HTTPException(status_code=500, detail='Erro ao exportar dados. Tenta novamente.')


def _parse_date(s):
    """Parse ISO date string to date object."""
    if not s:
        return None
    if isinstance(s, date):
        return s
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00')).date()
    except (ValueError, TypeError):
        return None


@router.post('/import-data')
async def import_user_data(
    request: Request,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Importa dados de um ficheiro JSON exportado pelo Finly.
    Faz merge no teu workspace atual (o primeiro) para as transações aparecerem em Transações.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail='Corpo inválido. Envia um ficheiro JSON exportado pelo Finly.')
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail='O ficheiro deve ser um objeto JSON válido.')
    version = body.get('version')
    workspaces_data = body.get('workspaces')
    if version != 1 or not isinstance(workspaces_data, list):
        raise HTTPException(
            status_code=400,
            detail='Formato não reconhecido. Usa um ficheiro exportado pelo Finly (Exportar dados da conta).'
        )
    ws = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).order_by(models.Workspace.created_at).first()
    if not ws:
        ws = models.Workspace(owner_id=current_user.id, name='Meu Workspace')
        db.add(ws)
        db.flush()
    stats = {'workspaces': 0, 'categories': 0, 'transactions': 0, 'recurring': 0, 'goals': 0}
    existing_cats = {c.name: c.id for c in db.query(models.Category).filter(models.Category.workspace_id == ws.id).all()}
    cat_name_to_id = dict(existing_cats)
    for ws_data in workspaces_data:
        if not isinstance(ws_data, dict):
            continue
        stats['workspaces'] += 1
        for c in ws_data.get('categories') or []:
            if not isinstance(c, dict) or not c.get('name'):
                continue
            cname = (c.get('name') or '')[:100]
            if cname in cat_name_to_id:
                continue
            ctype = c.get('type') in ('income', 'expense') and c.get('type') or 'expense'
            cat = models.Category(
                workspace_id=ws.id,
                name=cname,
                type=ctype,
                color_hex=(c.get('color_hex') or '#3B82F6')[:7],
                icon=(c.get('icon') or 'Tag')[:50],
                monthly_limit_cents=int(c.get('monthly_limit_cents', 0)),
                vault_type=(c.get('vault_type') or 'none')[:20],
            )
            db.add(cat)
            db.flush()
            cat_name_to_id[cname] = cat.id
            stats['categories'] += 1
        for t in ws_data.get('transactions') or []:
            if not isinstance(t, dict) or t.get('amount_cents') is None:
                continue
            amount = int(t['amount_cents'])
            if amount == 0:
                continue
            td = _parse_date(t.get('transaction_date'))
            if not td:
                continue
            cat_name = t.get('category_name')
            cat_id = cat_name_to_id.get(cat_name) if cat_name else None
            tr = models.Transaction(
                workspace_id=ws.id,
                category_id=cat_id,
                amount_cents=amount,
                description=(t.get('description') or '')[:255],
                transaction_date=td,
            )
            db.add(tr)
            stats['transactions'] += 1
        for r in ws_data.get('recurring_transactions') or []:
            if not isinstance(r, dict) or r.get('description') is None or r.get('amount_cents') is None:
                continue
            day = min(28, max(1, int(r.get('day_of_month', 1))))
            cat_name = r.get('category_name')
            cat_id = cat_name_to_id.get(cat_name) if cat_name else None
            rec = models.RecurringTransaction(
                workspace_id=ws.id,
                category_id=cat_id,
                description=(r.get('description') or '')[:255],
                amount_cents=int(r['amount_cents']),
                day_of_month=day,
                is_active=bool(r.get('is_active', True)),
                process_automatically=bool(r.get('process_automatically', True)),
            )
            db.add(rec)
            stats['recurring'] += 1
        for g in ws_data.get('savings_goals') or []:
            if not isinstance(g, dict) or not g.get('name') or g.get('target_amount_cents') is None:
                continue
            gdate = _parse_date(g.get('target_date'))
            if not gdate:
                continue
            goal = models.SavingsGoal(
                workspace_id=ws.id,
                name=(g.get('name') or 'Meta')[:100],
                goal_type=(g.get('goal_type') or 'expense')[:20],
                target_amount_cents=int(g['target_amount_cents']),
                current_amount_cents=int(g.get('current_amount_cents', 0)),
                target_date=gdate,
                icon=(g.get('icon') or 'Target')[:50],
                color_hex=(g.get('color_hex') or '#3B82F6')[:7],
            )
            db.add(goal)
            stats['goals'] += 1
    db.commit()
    logger.info(f'Importação concluída para {current_user.email}: {stats}')
    return {'ok': True, 'message': 'Dados importados com sucesso.', 'imported': stats}


@router.delete('/account')
async def delete_user_account(request: Request, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        user_email = current_user.email
        # user_id=None: o user vai ser apagado; audit_logs.user_id tem FK CASCADE — gravar com NULL evita violação e o log não é apagado
        await log_action(db, action='account_delete', user_id=None, details=f'Conta eliminada por utilizador: {user_email}', request=request)
        db.delete(current_user)
        db.commit()
        logger.info(f'Utilizador eliminou a conta: {user_email}')
        return {'message': 'Account deleted successfully'}
    except Exception as e:
        db.rollback()
        logger.error(f'Erro ao eliminar conta {current_user.email}: {str(e)}')
        raise HTTPException(status_code=500, detail='Erro ao eliminar a conta.')

@router.post('/purge-data')
async def purge_user_data(request: Request, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        user_email = current_user.email
        user_id = current_user.id

        workspaces = db.query(models.Workspace).filter(models.Workspace.owner_id == user_id).all()
        for ws in workspaces:
            db.delete(ws)
        db.commit()

        # Recriar workspace limpo com categorias padrão e seed
        new_workspace = models.Workspace(owner_id=user_id, name='Meu Workspace')
        db.add(new_workspace)
        db.commit()
        db.refresh(new_workspace)
        user_lang = getattr(current_user, 'language', 'pt') or 'pt'
        categories_map = create_default_categories(db, new_workspace.id, user_lang)
        create_seed_transactions(db, new_workspace.id, categories_map)

        await log_action(db, action='data_purge', user_id=user_id, details=f'Dados apagados pelo utilizador: {user_email}', request=request)
        logger.info(f'Dados apagados e workspace recriado para: {user_email}')
        return {'message': 'Data purged successfully'}
    except Exception as e:
        db.rollback()
        logger.error(f'Erro ao apagar dados de {current_user.email}: {str(e)}')
        raise HTTPException(status_code=500, detail='Erro ao apagar dados da conta.')

@router.get('/referral-code/validate')
async def validate_referral_code(code: Optional[str] = None, db: Session = Depends(get_db)):
    """Valida se um código de afiliado existe e está ativo. Público (sem auth)."""
    code_clean = (code or '').strip()
    if not code_clean:
        return {'valid': False}
    referrer, _ = _get_referrer_by_code(db, code_clean)
    return {'valid': referrer is not None}


@router.post('/login', response_model=schemas.Token)
@limiter.limit('5/minute')
async def login(request: Request, db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    email_lower = normalize_email(form_data.username or '')
    user = db.query(models.User).filter(models.User.email == email_lower).first()
    if not user or not user.password_hash or not security.verify_password(form_data.password, user.password_hash):
        logger.warning(f'Falha de login para: {form_data.username} de {request.client.host if request.client else "unknown"}')
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Incorrect email or password',
            headers={'WWW-Authenticate': 'Bearer'}
        )
    
    user.login_count += 1
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    
    await log_action(db, action='login', user_id=user.id, details=f'Login bem-sucedido: {user.email}', request=request)
    
    access_token = security.create_access_token(subject=user.email)
    refresh_token = security.create_refresh_token(subject=user.email)
    
    logger.info(f'Login bem-sucedido: {user.email}')
    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_type': 'bearer'
    }

@router.post('/password-reset/request')
@limiter.limit('3/hour')
async def request_password_reset(request: Request, data: schemas.PasswordResetRequest, db: Session = Depends(get_db)):
    email_norm = normalize_email(data.email or '')
    user = db.query(models.User).filter(models.User.email == email_norm).first()
    if not user:
        logger.warning(f'Pedido de reset de password para email inexistente: {data.email}')
        raise HTTPException(status_code=404, detail='Não existe nenhuma conta associada a este email.')
    
    # Usar secrets para código seguro
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    reset_obj = models.PasswordReset(email=email_norm, code=code, expires_at=expires_at)
    db.add(reset_obj)
    db.commit()
    
    await log_action(db, action='password_reset_request', user_id=user.id, details=f'Pedido de reset: {email_norm}', request=request)
    
    # Get user language preference from user model (already in database)
    # If language field doesn't exist yet (before migration), default to 'pt'
    user_lang = getattr(user, 'language', None) or 'pt'
    # Validate language (only 'pt' or 'en' supported)
    if user_lang not in ['pt', 'en']:
        user_lang = 'pt'
    t = get_email_translation(user_lang, 'password_reset')
    
    html = f'''<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body,table,td{{margin:0;padding:0;-webkit-text-size-adjust:100%}}img{{border:0;display:block}}table{{border-collapse:collapse}}@media only screen and (max-width:600px){{.mpad{{padding:16px 12px!important}}.card{{max-width:100%!important;width:100%!important;border-radius:20px!important}}.hpad{{padding:28px 20px!important}}.ctpad{{padding:24px 20px 28px!important}}.ctpad h2{{font-size:20px!important}}.codebox{{padding:28px 20px!important}}.code{{font-size:40px!important;letter-spacing:8px!important}}.fpad{{padding:20px 16px!important;font-size:9px!important}}}}</style></head><body style="margin:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f172a;min-height:100vh"><tr><td align="center" class="mpad" style="padding:32px 20px"><table role="presentation" class="card" width="520" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;width:100%;background:#0f172a;border-radius:24px;overflow:hidden;border:1px solid #1e293b;box-shadow:0 25px 50px -12px rgba(0,0,0,.5)"><tr><td style="height:4px;background:linear-gradient(90deg,#3b82f6 0%,#6366f1 100%)"></td></tr><tr><td class="hpad" style="background:#020617;padding:36px 28px;text-align:center;border-bottom:1px solid #1e293b"><img src="https://app.finlybot.com/images/logo/logo-semfundo.png" alt="" width="72" height="72" style="display:block;margin:0 auto 8px;width:72px;height:72px;object-fit:contain" /><p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.02em">Finly</p></td></tr><tr><td class="ctpad" style="padding:32px 28px 36px;color:#94a3b8;line-height:1.65;font-size:15px;text-align:center"><h2 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;letter-spacing:-0.02em">{t['title']}</h2><p style="margin:0 0 24px;color:#94a3b8">{t['message']}</p><div class="codebox" style="background:#020617;border:2px dashed #1e293b;border-radius:20px;padding:36px 24px;text-align:center;margin:0 0 24px"><p style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:.15em;color:#64748b;font-weight:700">{t['code_label']}</p><p class="code" style="font-size:48px;font-weight:800;color:#3b82f6;letter-spacing:10px;margin:0;font-family:ui-monospace,monospace">{code}</p></div><p style="margin:0;font-size:12px;color:#64748b;font-style:italic">{t['security_notice']}</p></td></tr><tr><td class="fpad" style="background:#020617;padding:24px 28px;text-align:center;border-top:1px solid #1e293b;color:#475569;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em">{t['footer']}</td></tr></table></td></tr></table></body></html>'''
    
    _mail_user = (getattr(settings, 'MAIL_USERNAME', '') or '').strip()
    current_conf = ConnectionConfig(
        MAIL_USERNAME=_mail_user,
        MAIL_PASSWORD=(getattr(settings, 'MAIL_PASSWORD', '') or '').strip(),
        MAIL_FROM=(getattr(settings, 'MAIL_FROM', '') or '').strip() or _mail_user,
        MAIL_PORT=getattr(settings, 'MAIL_PORT', 587),
        MAIL_SERVER=(getattr(settings, 'MAIL_SERVER', '') or 'smtp.gmail.com').strip(),
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
        MAIL_FROM_NAME=getattr(settings, 'MAIL_FROM_NAME', 'Finly') or 'Finly',
    )
    
    message = MessageSchema(
        subject=t['subject'],
        recipients=[email_norm],
        body=html,
        subtype=MessageType.html
    )
    
    fm = FastMail(current_conf)
    try:
        await fm.send_message(message)
    except Exception as e:
        logger.error(f'ERRO CRÍTICO EMAIL para {email_norm}: {str(e)}')
    
    return {'message': 'Código de recuperação enviado para o email.'}

@router.post('/password-reset/verify')
async def verify_reset_code(request: Request, data: schemas.PasswordResetVerify, db: Session = Depends(get_db)):
    email_norm = normalize_email(data.email or '')
    reset_obj = db.query(models.PasswordReset).filter(
        models.PasswordReset.email == email_norm,
        models.PasswordReset.code == data.code,
        models.PasswordReset.is_used == False,
        models.PasswordReset.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not reset_obj:
        raise HTTPException(status_code=400, detail='Código inválido ou expirado')
    
    user = db.query(models.User).filter(models.User.email == email_norm).first()
    if user:
        await log_action(db, action='password_reset_verify', user_id=user.id, details=f'Código verificado: {email_norm}', request=request)
    
    return {'message': 'Código verificado com sucesso.'}

@router.post('/password-reset/confirm')
async def confirm_password_reset(request: Request, data: schemas.PasswordResetConfirm, db: Session = Depends(get_db)):
    email_norm = normalize_email(data.email or '')
    reset_obj = db.query(models.PasswordReset).filter(
        models.PasswordReset.email == email_norm,
        models.PasswordReset.code == data.code,
        models.PasswordReset.is_used == False,
        models.PasswordReset.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not reset_obj:
        raise HTTPException(status_code=400, detail='Código inválido ou expirado')
    
    user = db.query(models.User).filter(models.User.email == email_norm).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')
    
    # Validação de senha forte
    is_valid, error_msg = validate_password(data.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    user.password_hash = security.get_password_hash(data.new_password)
    reset_obj.is_used = True
    db.commit()
    
    await log_action(db, action='password_reset_confirm', user_id=user.id, details=f'Password redefinida: {user.email}', request=request)
    return {'message': 'Password alterada com sucesso!'}

@router.post('/social-login', response_model=schemas.Token)
async def social_login(request: Request, data: schemas.SocialLoginRequest, db: Session = Depends(get_db)):
    try:
        email = None
        social_id = None
        
        if data.provider == 'google':
            try:
                google_response = requests.get(
                    'https://www.googleapis.com/oauth2/v3/userinfo',
                    headers={'Authorization': f'Bearer {data.token}'},
                    timeout=10  # Timeout de 10 segundos
                )
                if google_response.status_code != 200:
                    logger.error(f'Erro ao validar token Google: {google_response.status_code} - {google_response.text}')
                    raise Exception('Falha ao validar token com a Google')
                idinfo = google_response.json()
                email = idinfo.get('email')
                social_id = idinfo.get('sub')
            except Exception as e:
                logger.error(f'Erro ao validar token Google: {str(e)}', exc_info=True)
                raise HTTPException(status_code=400, detail='Token do Google inválido ou expirado')
        
        if not email:
            raise HTTPException(status_code=400, detail='Não foi possível obter o email do provedor social')
        
        # Lookup insensível a maiúsculas: mesma conta Telegram (ex: Joao@...) e Google (joao@...)
        email_normalized = normalize_email(email or "")
        user = db.query(models.User).filter(func.lower(models.User.email) == email_normalized).first()
        
        # Se o usuário já existe, não criar referência (referências só para contas novas)
        if user:
            referral_code = getattr(data, 'referral_code', None)
            if referral_code:
                logger.warning(f'⚠️ Tentativa de criar referência para usuário existente bloqueada via social login: {user.email} (código: {referral_code}). Referências só são válidas para contas novas.')
        
        if not user:
            # Get language from request data or default to 'pt'
            user_language = getattr(data, 'language', 'pt') or 'pt'
            if user_language not in ['pt', 'en']:
                user_language = 'pt'
            
            # Validar código de referência se fornecido (lookup case-insensitive)
            referrer_id = None
            referral_code_raw = getattr(data, 'referral_code', None)
            referral_code = (referral_code_raw or '').strip() or None
            if referral_code:
                referrer, canonical_code = _get_referrer_by_code(db, referral_code)
                if referrer:
                    referrer_id = referrer.id
                    referral_code = canonical_code  # valor canónico para AffiliateReferral
                else:
                    logger.warning(f'Código de referência inválido no social login: {referral_code_raw}')
            
            user = models.User(
                email=email_normalized,
                google_id=social_id if data.provider == 'google' else None,
                is_email_verified=True,
                language=user_language,
                login_count=1,
                last_login=datetime.now(timezone.utc),
                referrer_id=referrer_id
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Criar referência de afiliado se aplicável (verificar auto-referência)
            if referrer_id and referral_code and referrer_id != user.id:
                # Verificar se já existe referência para este usuário
                existing_referral = db.query(models.AffiliateReferral).filter(
                    models.AffiliateReferral.referred_user_id == user.id
                ).first()
                
                if not existing_referral:
                    ip_address = request.client.host if request.client else None
                    user_agent = request.headers.get('user-agent', '')[:500] if request.headers.get('user-agent') else None
                    
                    referral = models.AffiliateReferral(
                        referrer_id=referrer_id,
                        referred_user_id=user.id,
                        referral_code=referral_code,
                        has_subscribed=False,  # Será atualizado quando subscrever
                        ip_address=ip_address,
                        user_agent=user_agent
                    )
                    db.add(referral)
                    db.commit()
                    logger.info(f'✅ Referência criada via social login: {referrer.email} -> {user.email} (código: {referral_code})')
                else:
                    logger.warning(f'⚠️ Referência já existe para {user.email} via social login, não criando duplicado')
            elif referrer_id == user.id:
                logger.warning(f'🚫 Tentativa de auto-referência bloqueada: {email}')
                # Remover referrer_id se for auto-referência
                user.referrer_id = None
                db.commit()
            else:
                if referral_code:
                    logger.warning(f'⚠️ Código de referência fornecido ({referral_code}) mas referrer_id não foi definido ou é inválido')
                logger.info(f'ℹ️ Nenhuma referência criada para {user.email} via social login (referral_code={referral_code}, referrer_id={referrer_id})')
            
            new_workspace = models.Workspace(owner_id=user.id, name='Meu Workspace')
            db.add(new_workspace)
            db.commit()
            db.refresh(new_workspace)
            user_lang = getattr(user, 'language', 'pt') or 'pt'
            categories_map = create_default_categories(db, new_workspace.id, user_lang)
            create_seed_transactions(db, new_workspace.id, categories_map)
        else:
            if data.provider == 'google' and not user.google_id:
                user.google_id = social_id
            user.login_count += 1
            user.last_login = datetime.now(timezone.utc)
            db.commit()
        
        try:
            await log_action(db, action='login_social', user_id=user.id, details=f'Login via {data.provider}: {user.email}', request=request)
        except Exception as e:
            logger.warning(f'Erro ao logar ação (não crítico): {str(e)}')
        
        access_token = security.create_access_token(subject=user.email)
        refresh_token = security.create_refresh_token(subject=user.email)
        
        logger.info(f"Login social bem-sucedido para {user.email}. Token gerado.")
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_type': 'bearer'
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Erro inesperado no social-login: {str(e)}', exc_info=True)
        raise HTTPException(status_code=500, detail='Erro interno do servidor.')

