from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from .routes import auth, categories, transactions, stripe as stripe_routes, insights, recurring, admin, goals, dashboard
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

# Criar tabelas no banco de dados
Base.metadata.create_all(bind=engine)

# Migração: Atualizar tabela category_mapping_cache se necessário
def migrate_category_mapping_cache():
    """Migra a tabela category_mapping_cache para o novo schema"""
    from sqlalchemy import text, inspect
    from .core.dependencies import engine
    
    inspector = inspect(engine)
    columns = {col['name']: col for col in inspector.get_columns('category_mapping_cache')} if 'category_mapping_cache' in inspector.get_table_names() else {}
    
    with engine.begin() as conn:  # Usar begin() para transações automáticas
        # Verificar se a coluna category_name existe
        if 'category_name' not in columns:
            logger.info("Adicionando coluna category_name à tabela category_mapping_cache...")
            try:
                conn.execute(text("""
                    ALTER TABLE category_mapping_cache 
                    ADD COLUMN category_name VARCHAR(100) NOT NULL DEFAULT 'Outros'
                """))
                logger.info("Coluna category_name adicionada com sucesso")
            except Exception as e:
                logger.warning(f"Erro ao adicionar category_name (pode já existir): {e}")
        
        # Verificar se a coluna is_global existe
        if 'is_global' not in columns:
            logger.info("Adicionando coluna is_global à tabela category_mapping_cache...")
            try:
                conn.execute(text("""
                    ALTER TABLE category_mapping_cache 
                    ADD COLUMN is_global BOOLEAN NOT NULL DEFAULT FALSE
                """))
                logger.info("Coluna is_global adicionada com sucesso")
            except Exception as e:
                logger.warning(f"Erro ao adicionar is_global (pode já existir): {e}")
        
        # Tornar workspace_id nullable se ainda não for
        if 'workspace_id' in columns and not columns['workspace_id']['nullable']:
            logger.info("Tornando workspace_id nullable na tabela category_mapping_cache...")
            try:
                # Primeiro, remover o constraint único antigo se existir
                try:
                    conn.execute(text("ALTER TABLE category_mapping_cache DROP CONSTRAINT IF EXISTS unique_mapping"))
                except:
                    pass
                
                # Tornar nullable
                conn.execute(text("""
                    ALTER TABLE category_mapping_cache 
                    ALTER COLUMN workspace_id DROP NOT NULL
                """))
                
                # Adicionar novo constraint único (permite NULL)
                # Nota: PostgreSQL trata NULL como valores distintos, então múltiplos NULLs são permitidos
                try:
                    conn.execute(text("""
                        ALTER TABLE category_mapping_cache 
                        ADD CONSTRAINT unique_workspace_mapping 
                        UNIQUE (workspace_id, description_normalized, transaction_type)
                    """))
                except Exception as constraint_error:
                    # Constraint pode já existir
                    logger.info(f"Constraint unique_workspace_mapping pode já existir: {constraint_error}")
                logger.info("workspace_id agora é nullable")
            except Exception as e:
                logger.warning(f"Erro ao tornar workspace_id nullable: {e}")
        
        # Tornar category_id nullable se ainda não for
        if 'category_id' in columns and not columns['category_id']['nullable']:
            logger.info("Tornando category_id nullable na tabela category_mapping_cache...")
            try:
                conn.execute(text("""
                    ALTER TABLE category_mapping_cache 
                    ALTER COLUMN category_id DROP NOT NULL
                """))
                logger.info("category_id agora é nullable")
            except Exception as e:
                logger.warning(f"Erro ao tornar category_id nullable: {e}")
        
        # Atualizar category_name para registos existentes que não têm nome
        try:
            conn.execute(text("""
                UPDATE category_mapping_cache 
                SET category_name = (
                    SELECT c.name 
                    FROM categories c 
                    WHERE c.id = category_mapping_cache.category_id
                )
                WHERE category_name = 'Outros' AND category_id IS NOT NULL
            """))
        except Exception as e:
            logger.warning(f"Erro ao atualizar category_name: {e}")

# Executar migração
try:
    migrate_category_mapping_cache()
except Exception as e:
    logger.error(f"Erro na migração da tabela category_mapping_cache: {e}")

app = FastAPI(title='Finly - Gestão Financeira Pessoal API')
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configuração de CORS
allowed_origins_str = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(',') if origin.strip()]

# Em produção, nunca permitir '*' com allow_credentials=True
environment = os.getenv('ENVIRONMENT', 'development')
if environment == 'production' and ('*' in allowed_origins or not allowed_origins):
    logger.warning("CORS configurado de forma insegura para produção! Configurando origens padrão.")
    allowed_origins = ['https://finanzen.pt']  # Ajustar para o domínio real

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allow_headers=['*'],
    expose_headers=['*']
)

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

@app.get('/')
@limiter.limit('5/minute')
async def root(request: Request):
    return {'message': 'Bem-vindo à API de Gestão Financeira'}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
