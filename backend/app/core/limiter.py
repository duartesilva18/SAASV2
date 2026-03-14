"""
Rate limiting com SlowAPI. Para ativar, no sítio onde crias a FastAPI app faz:

    from fastapi import FastAPI
    from app.core.limiter import limiter, attach_limiter

    app = FastAPI()
    attach_limiter(app)

As rotas que usam @limiter.limit("X/minute") passam a devolver 429 quando o limite é excedido (por IP).
"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)


def attach_limiter(app):
    """Ata o limiter à app e regista o handler de 429. Obrigatório para os limites terem efeito."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

