"""
Middleware para otimizações - Cache de workspace
"""
from fastapi import Request
from sqlalchemy.orm import Session
from ..models import database as models
from .dependencies import get_db


async def workspace_cache_middleware(request: Request, call_next):
    """
    Middleware para cachear workspace no request state.
    Evita buscar workspace múltiplas vezes no mesmo request.
    """
    # Se já tem workspace no state, usar
    if hasattr(request.state, 'workspace'):
        return await call_next(request)
    
    # Se não tem user autenticado, passar adiante
    if not hasattr(request.state, 'user') or not request.state.user:
        return await call_next(request)
    
    # Buscar workspace e cachear no request state
    # Nota: Em produção, usar cache Redis ou similar
    db: Session = next(get_db())
    try:
        workspace = db.query(models.Workspace).filter(
            models.Workspace.owner_id == request.state.user.id
        ).first()
        
        if workspace:
            request.state.workspace = workspace
    except Exception:
        pass  # Se falhar, não cachear
    finally:
        db.close()
    
    return await call_next(request)

