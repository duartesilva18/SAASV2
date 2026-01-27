from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from .routes import auth, categories, transactions, stripe as stripe_routes, insights, recurring, admin, goals, dashboard, affiliate
from .webhooks import stripe as stripe_webhooks, whatsapp as whatsapp_webhooks, telegram as telegram_webhooks
from .webhooks.telegram import setup_bot_commands
from .models.database import Base, SystemSetting
from .core.dependencies import engine, get_db
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

app = FastAPI(title='Finly - Gestão Financeira Pessoal API')
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configuração de CORS - apenas variáveis de ambiente (sem listas fixas no código)
allowed_origins_str = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(',') if origin.strip()]

environment = os.getenv('ENVIRONMENT', 'development')
if environment == 'production' and ('*' in allowed_origins or not allowed_origins):
    logger.warning(
        "CORS em produção sem ALLOWED_ORIGINS válido. "
        "Defina ALLOWED_ORIGINS no ambiente (ex: https://finanzen.pt,https://app.finanzen.pt)."
    )
    allowed_origins = []  # sem fallback; quem faz deploy define as origens no env

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
    logger.error(f"Erro não tratado em {request.url.path}: {str(exc)}", exc_info=True)
    logger.error(f"Traceback: {traceback.format_exc()}")
    
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
