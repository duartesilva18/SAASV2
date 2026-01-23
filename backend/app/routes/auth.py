from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone, date
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

def validate_email(email: str) -> bool:
    """Valida formato de email usando regex robusto"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_password(password: str) -> tuple[bool, str]:
    """Valida força da senha"""
    if len(password) < 8:
        return False, "A senha deve ter pelo menos 8 caracteres"
    if not re.search(r'[A-Z]', password):
        return False, "A senha deve conter pelo menos uma letra maiúscula"
    if not re.search(r'[a-z]', password):
        return False, "A senha deve conter pelo menos uma letra minúscula"
    if not re.search(r'\d', password):
        return False, "A senha deve conter pelo menos um número"
    return True, ""

async def get_current_user(db: Session = Depends(get_db), token: str = Depends(security.oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Could not validate credentials',
        headers={'WWW-Authenticate': 'Bearer'}
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get('sub')
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Corrigido: usar email diretamente em vez de token_data não definido
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

@router.post('/register', response_model=schemas.UserResponse)
@limiter.limit('30/hour')
async def register(request: Request, user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    # Validação de email
    if not validate_email(user_in.email):
        raise HTTPException(status_code=400, detail='Formato de email inválido.')
    
    # Validação de senha forte
    is_valid, error_msg = validate_password(user_in.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    db_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_user:
        logger.warning(f'Tentativa de registo com email já existente: {user_in.email}')
        raise HTTPException(status_code=400, detail='Este email já está registado e verificado.')
    
    # Remove any existing pending verification for this email
    db.query(models.EmailVerification).filter(models.EmailVerification.email == user_in.email).delete()
    
    hashed_pw = security.get_password_hash(user_in.password)
    # Usar secrets.token_urlsafe para token criptograficamente seguro
    token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    
    verification = models.EmailVerification(
        email=user_in.email,
        password_hash=hashed_pw,
        token=token,
        expires_at=expires_at
    )
    db.add(verification)
    db.commit()
    
    verify_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={token}"
    # Get user language preference from user_in or default to 'pt'
    user_lang = getattr(user_in, 'language', 'pt') or 'pt'
    # Validate language (only 'pt' or 'en' supported)
    if user_lang not in ['pt', 'en']:
        user_lang = 'pt'
    t = get_email_translation(user_lang, 'verify_email')
    
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }}
            .container {{ max-width: 600px; margin: 40px auto; background-color: #0f172a; border-radius: 32px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 40px 100px -20px rgba(0,0,0,0.8); }}
            .header {{ background: #020617; padding: 60px 20px; text-align: center; border-bottom: 1px solid #1e293b; }}
            .logo {{ font-size: 36px; font-weight: 900; color: #ffffff; letter-spacing: -1.5px; }}
            .logo span {{ color: #3b82f6; font-style: italic; }}
            .content {{ padding: 50px; color: #94a3b8; line-height: 1.8; text-align: center; }}
            .content h2 {{ color: #ffffff; margin-top: 0; font-size: 28px; font-weight: 900; letter-spacing: -1px; }}
            .btn {{ display: inline-block; padding: 20px 45px; background-color: #3b82f6; color: #ffffff !important; text-decoration: none; border-radius: 20px; font-weight: 900; font-size: 15px; text-transform: uppercase; letter-spacing: 2px; margin: 35px 0; transition: all 0.3s ease; box-shadow: 0 15px 30px rgba(59, 130, 246, 0.3); }}
            .footer {{ background-color: #020617; padding: 40px; text-align: center; border-top: 1px solid #1e293b; color: #475569; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; }}
            .security-notice {{ font-size: 12px; color: #334155; margin-top: 30px; font-style: italic; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">Finly</div>
            </div>
            <div class="content">
                <h2>{t['title']}</h2>
                <p>{t['welcome']}</p>
                <a href="{verify_url}" class="btn">{t['button']}</a>
                <p class="security-notice">{t['security_notice']}</p>
            </div>
            <div class="footer">
                {t['footer']}
            </div>
        </div>
    </body>
    </html>
    '''
    
    message = MessageSchema(
        subject=t['subject'],
        recipients=[user_in.email],
        body=html,
        subtype=MessageType.html
    )
    
    from ..core.dependencies import conf
    fm = FastMail(conf)
    try:
        await fm.send_message(message)
    except Exception as e:
        logger.error(f'Erro ao enviar email de verificação: {str(e)}')
    
    logger.info(f'Novo registo pendente (aguardando verificação): {user_in.email}')
    
    return {
        'id': uuid.uuid4(),
        'email': user_in.email,
        'is_active': True,
        'is_email_verified': False,
        'is_onboarded': False,
        'marketing_opt_in': False,
        'currency': 'EUR',
        'created_at': datetime.now(timezone.utc)
    }

@router.get('/verification-status/{email}')
async def check_verification_status(email: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    return {'is_verified': user.is_email_verified if user else False}

def create_default_categories(db: Session, workspace_id: uuid.UUID):
    default_cats = [
        {"name": "Investimento", "type": "expense", "vault_type": "investment", "color_hex": "#3B82F6", "icon": "TrendingUp", "is_default": True},
        {"name": "Fundo de Emergência", "type": "expense", "vault_type": "emergency", "color_hex": "#F97316", "icon": "ShieldCheck", "is_default": True},
        {"name": "Alimentação", "type": "expense", "vault_type": "none", "color_hex": "#F59E0B", "icon": "Utensils", "is_default": False},
        {"name": "Entretenimento", "type": "expense", "vault_type": "none", "color_hex": "#EC4899", "icon": "Gamepad", "is_default": False},
        {"name": "Transportes", "type": "expense", "vault_type": "none", "color_hex": "#3B82F6", "icon": "Car", "is_default": False},
        {"name": "Habitação", "type": "expense", "vault_type": "none", "color_hex": "#8B5CF6", "icon": "Home", "is_default": False},
        {"name": "Saúde", "type": "expense", "vault_type": "none", "color_hex": "#10B981", "icon": "Heart", "is_default": False},
        {"name": "Salário", "type": "income", "vault_type": "none", "color_hex": "#10B981", "icon": "Landmark", "is_default": False},
    ]
    
    categories_map = {}
    for cat_data in default_cats:
        new_cat = models.Category(
            workspace_id=workspace_id,
            **cat_data
        )
        db.add(new_cat)
        categories_map[cat_data["name"]] = new_cat
    db.commit()
    
    # Retornar o mapa de categorias para usar no seed de transações
    return categories_map

def create_seed_transactions(db: Session, workspace_id: uuid.UUID, categories_map: dict):
    """Cria transações de exemplo (1 cêntimo) para ajudar o Telegram a categorizar melhor"""
    
    # Transações de exemplo com descrições comuns que ajudam o Telegram a categorizar
    seed_transactions = [
        # Alimentação
        {"category": "Alimentação", "description": "Supermercado Continente", "amount_cents": -1, "days_ago": 5},
        {"category": "Alimentação", "description": "Pingo Doce compras", "amount_cents": -1, "days_ago": 3},
        {"category": "Alimentação", "description": "Restaurante McDonald's", "amount_cents": -1, "days_ago": 2},
        {"category": "Alimentação", "description": "Uber Eats entrega", "amount_cents": -1, "days_ago": 1},
        {"category": "Alimentação", "description": "Café Starbucks", "amount_cents": -1, "days_ago": 0},
        
        # Transportes
        {"category": "Transportes", "description": "Uber viagem", "amount_cents": -1, "days_ago": 4},
        {"category": "Transportes", "description": "Bolt transporte", "amount_cents": -1, "days_ago": 2},
        {"category": "Transportes", "description": "Combustível Galp", "amount_cents": -1, "days_ago": 6},
        {"category": "Transportes", "description": "Bilhete metro Lisboa", "amount_cents": -1, "days_ago": 1},
        {"category": "Transportes", "description": "Estacionamento parque", "amount_cents": -1, "days_ago": 3},
        
        # Habitação
        {"category": "Habitação", "description": "Renda apartamento", "amount_cents": -1, "days_ago": 7},
        {"category": "Habitação", "description": "Conta luz EDP", "amount_cents": -1, "days_ago": 10},
        {"category": "Habitação", "description": "Água EPAL", "amount_cents": -1, "days_ago": 8},
        {"category": "Habitação", "description": "Internet MEO", "amount_cents": -1, "days_ago": 5},
        {"category": "Habitação", "description": "Condomínio prédio", "amount_cents": -1, "days_ago": 4},
        
        # Saúde
        {"category": "Saúde", "description": "Farmácia medicamentos", "amount_cents": -1, "days_ago": 3},
        {"category": "Saúde", "description": "Consulta médico", "amount_cents": -1, "days_ago": 5},
        {"category": "Saúde", "description": "Ginásio fitness", "amount_cents": -1, "days_ago": 1},
        {"category": "Saúde", "description": "Seguro saúde", "amount_cents": -1, "days_ago": 15},
        
        # Entretenimento
        {"category": "Entretenimento", "description": "Netflix subscrição", "amount_cents": -1, "days_ago": 2},
        {"category": "Entretenimento", "description": "Spotify Premium", "amount_cents": -1, "days_ago": 1},
        {"category": "Entretenimento", "description": "Cinema NOS", "amount_cents": -1, "days_ago": 4},
        {"category": "Entretenimento", "description": "Jantar restaurante", "amount_cents": -1, "days_ago": 3},
        {"category": "Entretenimento", "description": "PlayStation Store", "amount_cents": -1, "days_ago": 6},
        
        # Investimento
        {"category": "Investimento", "description": "Ações bolsa", "amount_cents": -1, "days_ago": 7},
        {"category": "Investimento", "description": "ETF investimento", "amount_cents": -1, "days_ago": 10},
        {"category": "Investimento", "description": "Criptomoedas Bitcoin", "amount_cents": -1, "days_ago": 5},
        
        # Fundo de Emergência
        {"category": "Fundo de Emergência", "description": "Poupança emergência", "amount_cents": -1, "days_ago": 14},
        {"category": "Fundo de Emergência", "description": "Reserva fundo", "amount_cents": -1, "days_ago": 20},
        
        # Salário (receita)
        {"category": "Salário", "description": "Salário mensal", "amount_cents": 1, "days_ago": 0},
        {"category": "Salário", "description": "Ordenado empresa", "amount_cents": 1, "days_ago": 30},
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
async def verify_email(request: Request, token: str, db: Session = Depends(get_db)):
    verification = db.query(models.EmailVerification).filter(
        models.EmailVerification.token == token,
        models.EmailVerification.is_used == False,
        models.EmailVerification.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not verification:
        raise HTTPException(status_code=400, detail='Token de verificação inválido ou expirado.')
    
    user = db.query(models.User).filter(models.User.email == verification.email).first()
    
    if not user:
        # Get language from verification if stored, or default to 'pt'
        user_language = getattr(verification, 'language', 'pt') or 'pt'
        if user_language not in ['pt', 'en']:
            user_language = 'pt'
        user = models.User(
            email=verification.email,
            password_hash=verification.password_hash,
            is_email_verified=True,
            language=user_language
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        new_workspace = models.Workspace(owner_id=user.id, name='Meu Workspace')
        db.add(new_workspace)
        db.commit()
        db.refresh(new_workspace)
        
        # Criar categorias padrão (Investimento e Fundo de Emergência)
        categories_map = create_default_categories(db, new_workspace.id)
        
        # Criar transações de exemplo para ajudar o Telegram a categorizar
        create_seed_transactions(db, new_workspace.id, categories_map)
        
        logger.info(f'Utilizador criado e verificado: {user.email}')
        await log_action(db, action='register_success', user_id=user.id, details=f'Novo utilizador registado: {user.email}', request=request)
    else:
        user.is_email_verified = True
        db.commit()
    
    verification.is_used = True
    db.commit()
    
    access_token = security.create_access_token(subject=user.email)
    refresh_token = security.create_refresh_token(subject=user.email)
    
    return {
        'message': 'Email verificado com sucesso!',
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_type': 'bearer'
    }

@router.get('/me', response_model=schemas.UserResponse)
async def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@router.post('/onboarding', response_model=schemas.UserResponse)
async def complete_onboarding(onboarding_data: schemas.UserUpdateOnboarding, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.full_name = onboarding_data.full_name
    current_user.phone_number = onboarding_data.phone_number
    current_user.currency = onboarding_data.currency
    current_user.gender = onboarding_data.gender
    current_user.marketing_opt_in = onboarding_data.marketing_opt_in
    current_user.is_onboarded = True
    
    db.commit()
    db.refresh(current_user)
    
    logger.info(f'Utilizador completou onboarding: {current_user.email}')
    return current_user

@router.patch('/profile', response_model=schemas.UserResponse)
async def update_profile(request: Request, onboarding_data: schemas.UserUpdateOnboarding, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
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

@router.delete('/account')
async def delete_user_account(request: Request, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        user_email = current_user.email
        user_id = current_user.id
        db.delete(current_user)
        db.commit()
        
        await log_action(db, action='account_delete', user_id=user_id, details=f'Conta eliminada por utilizador: {user_email}', request=request)
        logger.info(f'Utilizador eliminou a conta: {user_email}')
        return {'message': 'Account deleted successfully'}
    except Exception as e:
        db.rollback()
        logger.error(f'Erro ao eliminar conta {current_user.email}: {str(e)}')
        raise HTTPException(status_code=500, detail='Erro ao eliminar a conta.')

@router.post('/login', response_model=schemas.Token)
@limiter.limit('5/minute')
async def login(request: Request, db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.password_hash):
        logger.warning(f'Falha de login para: {form_data.username} de {request.client.host}')
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Incorrect email or password',
            headers={'WWW-Authenticate': 'Bearer'}
        )
    
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Por favor, confirme o seu email antes de fazer login.'
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
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user:
        logger.warning(f'Pedido de reset de password para email inexistente: {data.email}')
        raise HTTPException(status_code=404, detail='Não existe nenhuma conta associada a este email.')
    
    # Usar secrets para código seguro
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    reset_obj = models.PasswordReset(email=data.email, code=code, expires_at=expires_at)
    db.add(reset_obj)
    db.commit()
    
    await log_action(db, action='password_reset_request', user_id=user.id, details=f'Pedido de reset: {data.email}', request=request)
    
    # Get user language preference from user model (already in database)
    # If language field doesn't exist yet (before migration), default to 'pt'
    user_lang = getattr(user, 'language', None) or 'pt'
    # Validate language (only 'pt' or 'en' supported)
    if user_lang not in ['pt', 'en']:
        user_lang = 'pt'
    t = get_email_translation(user_lang, 'password_reset')
    
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }}
            .container {{ max-width: 600px; margin: 40px auto; background-color: #0f172a; border-radius: 32px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 40px 100px -20px rgba(0,0,0,0.8); }}
            .header {{ background: #020617; padding: 60px 20px; text-align: center; border-bottom: 1px solid #1e293b; }}
            .logo {{ font-size: 36px; font-weight: 900; color: #ffffff; letter-spacing: -1.5px; }}
            .logo span {{ color: #3b82f6; font-style: italic; }}
            .content {{ padding: 50px; color: #94a3b8; line-height: 1.8; text-align: center; }}
            .content h2 {{ color: #ffffff; margin-top: 0; font-size: 28px; font-weight: 900; letter-spacing: -1px; }}
            .code-box {{ background-color: #020617; border: 2px dashed #1e293b; border-radius: 24px; padding: 45px; text-align: center; margin: 35px 0; }}
            .code {{ font-size: 52px; font-weight: 900; color: #3b82f6; letter-spacing: 12px; margin: 0; text-shadow: 0 0 30px rgba(59, 130, 246, 0.4); }}
            .footer {{ background-color: #020617; padding: 40px; text-align: center; border-top: 1px solid #1e293b; color: #475569; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; }}
            .security-notice {{ font-size: 12px; color: #334155; margin-top: 30px; font-style: italic; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">Finly</div>
            </div>
            <div class="content">
                <h2>{t['title']}</h2>
                <p>{t['message']}</p>
                <div class="code-box">
                    <p style="margin-bottom: 15px; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #475569; font-weight: 800;">{t['code_label']}</p>
                    <div class="code">{code}</div>
                </div>
                <p class="security-notice">{t['security_notice']}</p>
            </div>
            <div class="footer">
                {t['footer']}
            </div>
        </div>
    </body>
    </html>
    '''
    
    current_conf = ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME.strip(),
        MAIL_PASSWORD=settings.MAIL_PASSWORD.strip(),
        MAIL_FROM=settings.MAIL_FROM.strip(),
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
        MAIL_FROM_NAME='Finly Portugal'
    )
    
    message = MessageSchema(
        subject=t['subject'],
        recipients=[data.email],
        body=html,
        subtype=MessageType.html
    )
    
    fm = FastMail(current_conf)
    try:
        await fm.send_message(message)
    except Exception as e:
        logger.error(f'ERRO CRÍTICO EMAIL para {data.email}: {str(e)}')
    
    return {'message': 'Código de recuperação enviado para o email.'}

@router.post('/password-reset/verify')
async def verify_reset_code(request: Request, data: schemas.PasswordResetVerify, db: Session = Depends(get_db)):
    reset_obj = db.query(models.PasswordReset).filter(
        models.PasswordReset.email == data.email,
        models.PasswordReset.code == data.code,
        models.PasswordReset.is_used == False,
        models.PasswordReset.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not reset_obj:
        raise HTTPException(status_code=400, detail='Código inválido ou expirado')
    
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if user:
        await log_action(db, action='password_reset_verify', user_id=user.id, details=f'Código verificado: {data.email}', request=request)
    
    return {'message': 'Código verificado com sucesso.'}

@router.post('/password-reset/confirm')
async def confirm_password_reset(request: Request, data: schemas.PasswordResetConfirm, db: Session = Depends(get_db)):
    reset_obj = db.query(models.PasswordReset).filter(
        models.PasswordReset.email == data.email,
        models.PasswordReset.code == data.code,
        models.PasswordReset.is_used == False,
        models.PasswordReset.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not reset_obj:
        raise HTTPException(status_code=400, detail='Código inválido ou expirado')
    
    user = db.query(models.User).filter(models.User.email == data.email).first()
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
    email = None
    social_id = None
    
    if data.provider == 'google':
        try:
            google_response = requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {data.token}'}
            )
            if google_response.status_code != 200:
                raise Exception('Falha ao validar token com a Google')
            idinfo = google_response.json()
            email = idinfo.get('email')
            social_id = idinfo.get('sub')
        except Exception as e:
            raise HTTPException(status_code=400, detail='Token do Google inválido ou expirado')
    
    if not email:
        raise HTTPException(status_code=400, detail='Não foi possível obter o email do provedor social')
    
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if not user:
        # Get language from request data or default to 'pt'
        user_language = getattr(data, 'language', 'pt') or 'pt'
        if user_language not in ['pt', 'en']:
            user_language = 'pt'
        user = models.User(
            email=email,
            google_id=social_id if data.provider == 'google' else None,
            is_email_verified=True,
            language=user_language,
            login_count=1,
            last_login=datetime.now(timezone.utc)
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        new_workspace = models.Workspace(owner_id=user.id, name='Meu Workspace')
        db.add(new_workspace)
        db.commit()
        db.refresh(new_workspace)
        
        # Criar categorias padrão (Investimento e Fundo de Emergência)
        categories_map = create_default_categories(db, new_workspace.id)
        
        # Criar transações de exemplo para ajudar o Telegram a categorizar
        create_seed_transactions(db, new_workspace.id, categories_map)
    else:
        if data.provider == 'google' and not user.google_id:
            user.google_id = social_id
        user.login_count += 1
        user.last_login = datetime.now(timezone.utc)
        db.commit()
    
    await log_action(db, action='login_social', user_id=user.id, details=f'Login via {data.provider}: {user.email}', request=request)
    
    access_token = security.create_access_token(subject=user.email)
    refresh_token = security.create_refresh_token(subject=user.email)
    
    logger.info(f"Login social bem-sucedido para {user.email}. Token gerado.")
    
    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_type': 'bearer'
    }

