from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from .routes import auth, categories, transactions, stripe as stripe_routes, insights, recurring, admin, goals, dashboard, affiliate, support
from .routes.auth import create_default_categories
from .webhooks import stripe as stripe_webhooks, whatsapp as whatsapp_webhooks, telegram as telegram_webhooks
from .webhooks.telegram import setup_bot_commands
from .models.database import Base, SystemSetting, User, Workspace
from .core.dependencies import engine, get_db, SessionLocal
from .core import security
from .core.limiter import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from sqlalchemy.orm import Session
import logging
import os
import asyncio

# Configuração de logging com UTF-8 para evitar erros de encoding no Windows
import sys
if sys.platform == 'win32':
    # Configurar stdout/stderr para UTF-8 no Windows
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('security.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('FinlyAPI')

# Suprimir erros de conexão do asyncio no Windows (não críticos)
if sys.platform == 'win32':
    asyncio_logger = logging.getLogger('asyncio')
    asyncio_logger.setLevel(logging.CRITICAL)  # Só mostra erros críticos do asyncio

# Criar tabelas no banco de dados
Base.metadata.create_all(bind=engine)

# Admin criado ao arrancar (se CREATE_DEFAULT_ADMIN=true e não existir)
# No Render: define DEFAULT_ADMIN_EMAIL e DEFAULT_ADMIN_PASSWORD e altera a password após 1º login.
# Para não criar admin automaticamente: CREATE_DEFAULT_ADMIN=false
CREATE_DEFAULT_ADMIN = os.getenv('CREATE_DEFAULT_ADMIN', 'true').lower() in ('1', 'true', 'yes')
DEFAULT_ADMIN_EMAIL = os.getenv('DEFAULT_ADMIN_EMAIL', 'admin@admin.pt')
DEFAULT_ADMIN_PASSWORD = os.getenv('DEFAULT_ADMIN_PASSWORD', 'admin')

app = FastAPI(title='Finly - Gestão Financeira Pessoal API')
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configuração de CORS - em produção sem variáveis usa https://app.finlybot.com como base
environment = os.getenv('ENVIRONMENT', 'development')
_default_origins = 'https://app.finlybot.com' if environment == 'production' else 'https://app.finlybot.com,http://localhost:3000,http://127.0.0.1:3000'
allowed_origins_str = os.getenv('ALLOWED_ORIGINS', _default_origins)
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(',') if origin.strip()]

if environment == 'production' and ('*' in allowed_origins or not allowed_origins):
    logger.warning(
        "CORS em produção sem ALLOWED_ORIGINS válido. A usar origem por defeito: https://app.finlybot.com"
    )
    allowed_origins = ['https://app.finlybot.com']

# Log das origens CORS configuradas
logger.info(f"🌐 CORS configurado com {len(allowed_origins)} origens: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allow_headers=['*'],
    expose_headers=['*']
)

# Handler para erros de validação (422) - DEPOIS do CORS
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Erro de validação em {request.url.path}: {exc.errors()}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

# Handler global para erros não tratados (garantir que CORS funciona mesmo com erros)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    from .core.error_buffer import add_error
    logger.error(f"Erro não tratado em {request.url.path}: {str(exc)}", exc_info=True)
    logger.error(f"Traceback: {traceback.format_exc()}")
    add_error(request.url.path, str(exc), exc.__class__.__name__)
    
    # Obter origem da request para adicionar header CORS
    origin = request.headers.get('origin')
    response = JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor. Por favor, tente novamente mais tarde."}
    )
    
    # CORS em erros: usar a mesma lista de origens do middleware (só env)
    if origin and origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
    
    return response

# Incluir rotas
app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(insights.router)
app.include_router(recurring.router)
app.include_router(admin.router)
app.include_router(goals.router)
app.include_router(dashboard.router)
app.include_router(stripe_routes.router)
app.include_router(affiliate.router)
app.include_router(support.router)
app.include_router(stripe_webhooks.router)
app.include_router(whatsapp_webhooks.router)
app.include_router(telegram_webhooks.router)

# Configurar comandos e informações do bot Telegram ao iniciar
try:
    from .webhooks.telegram import setup_bot_commands, setup_bot_info
    setup_bot_commands()
    setup_bot_info()
except Exception as e:
    logger.warning(f"Não foi possível configurar bot Telegram: {e}")


@app.on_event("startup")
def create_default_admin():
    """Cria utilizador admin se não existir, ao arrancar o servidor (quando CREATE_DEFAULT_ADMIN=true)."""
    if not CREATE_DEFAULT_ADMIN:
        logger.info("CREATE_DEFAULT_ADMIN está desativado; não será criado admin por defeito.")
        return
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == DEFAULT_ADMIN_EMAIL).first()
        if existing:
            if not existing.is_admin:
                existing.is_admin = True
                db.commit()
                logger.info(f"Utilizador {DEFAULT_ADMIN_EMAIL} promovido a admin.")
            return
        password_hash = security.get_password_hash(DEFAULT_ADMIN_PASSWORD)
        admin_user = User(
            email=DEFAULT_ADMIN_EMAIL,
            full_name="Admin",
            password_hash=password_hash,
            is_admin=True,
            is_email_verified=True,
            language="pt",
            terms_accepted=True,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        workspace = Workspace(owner_id=admin_user.id, name="Meu Workspace")
        db.add(workspace)
        db.commit()
        db.refresh(workspace)
        create_default_categories(db, workspace.id, "pt")
        logger.info(f"Utilizador admin criado: {DEFAULT_ADMIN_EMAIL}. Altera a password após o primeiro login em produção.")
    except Exception as e:
        logger.exception(f"Erro ao criar admin por defeito: {e}")
        db.rollback()
    finally:
        db.close()


def _job_affiliate_first_invoices_pending():
    """Job diário: verifica 1ª invoices sem Transfer manual (para o admin tratar)."""
    db = SessionLocal()
    try:
        from .routes.admin import get_affiliate_first_invoices_pending_list
        pending = get_affiliate_first_invoices_pending_list(db, limit=80)
        if pending:
            logger.warning(
                "[Job diário] 1ª invoices pendentes (Transfer manual): %d. "
                "Ver GET /admin/affiliates/first-invoices-pending",
                len(pending)
            )
    except Exception as e:
        logger.exception(f"Erro no job first-invoices-pending: {e}")
    finally:
        db.close()


def _job_recurring_transactions():
    """Job diário: cria transações automáticas para todas as recorrentes (despesas/receitas mensais)."""
    from .routes.transactions import process_automatic_recurring
    db = SessionLocal()
    try:
        workspaces = db.query(Workspace).with_entities(Workspace.id).all()
        for (ws_id,) in workspaces:
            try:
                process_automatic_recurring(db, ws_id)
            except Exception as e:
                logger.exception(f"Erro ao processar recorrentes do workspace {ws_id}: {e}")
        logger.info("[Job diário] Recorrentes processadas para %d workspace(s)", len(workspaces))
    except Exception as e:
        logger.exception(f"Erro no job recurring-transactions: {e}")
    finally:
        db.close()


@app.on_event("startup")
def start_scheduler():
    """Agenda jobs diários: 1ª invoices pendentes (9:00 UTC), recorrentes (2:00 UTC)."""
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        scheduler = BackgroundScheduler()
        scheduler.add_job(_job_affiliate_first_invoices_pending, "cron", hour=9, minute=0)
        scheduler.add_job(_job_recurring_transactions, "cron", hour=2, minute=0)
        scheduler.start()
        logger.info("Jobs diários agendados: first-invoices-pending (9:00 UTC), recurring-transactions (2:00 UTC)")
    except Exception as e:
        logger.warning(f"Não foi possível iniciar scheduler: {e}")


# Novo endpoint público para as definições básicas do sistema
@app.get('/api/settings/public')
async def get_public_settings(db: Session = Depends(get_db)):
    phone = db.query(SystemSetting).filter(SystemSetting.key == 'support_phone').first()
    return {"support_phone": phone.value if phone else "351925989577"}

@app.options('/{full_path:path}')
async def options_handler(request: Request, full_path: str):
    """Handler explícito para OPTIONS requests (preflight CORS)"""
    origin = request.headers.get('origin')
    if origin and origin in allowed_origins:
        response = Response()
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Max-Age"] = "3600"
        return response
    return Response(status_code=200)

@app.get('/')
@app.head('/')
@limiter.limit('5/minute')
async def root(request: Request):
    return {'message': 'Bem-vindo à API de Gestão Financeira'}

# Health check endpoint para o Render (sem rate limiting)
@app.get('/health')
@app.head('/health')
async def health_check():
    """Health check endpoint para o Render verificar se o serviço está ativo"""
    return {'status': 'ok', 'service': 'finanzen-backend'}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
