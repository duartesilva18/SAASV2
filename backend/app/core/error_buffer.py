"""
Registo de erros críticos (persistido na BD, fallback em memória).
"""
from datetime import datetime
from typing import List, Dict, Any

MAX_ERRORS = 50
MAX_DB_ROWS = 500

_errors: List[Dict[str, Any]] = []


def add_error(path: str, message: str, exc_type: str = "Exception") -> None:
    """Regista um erro na BD; em caso de falha, guarda em memória."""
    msg = (message[:2000] if message else "") or ""
    path_safe = (path[:500] if path else "") or "/"
    exc_safe = (exc_type[:100] if exc_type else "Exception") or "Exception"

    try:
        from ..core.dependencies import SessionLocal
        from ..models.database import AdminErrorLog

        db = SessionLocal()
        try:
            db.add(AdminErrorLog(path=path_safe, message=msg, exc_type=exc_safe))
            db.commit()
        finally:
            db.close()
        return
    except Exception:
        pass

    global _errors
    _errors.insert(0, {
        "path": path_safe,
        "message": msg[:500],
        "exc_type": exc_safe,
        "at": datetime.utcnow().isoformat() + "Z",
    })
    _errors[:] = _errors[:MAX_ERRORS]


def clear_memory_errors() -> None:
    """Limpa erros em memória (fallback)."""
    global _errors
    _errors.clear()


def get_recent_errors_from_db(db, limit: int = 20) -> List[Dict[str, Any]]:
    """Retorna os últimos erros da BD (formato compatível com o frontend)."""
    from ..models.database import AdminErrorLog

    rows = db.query(AdminErrorLog).order_by(AdminErrorLog.created_at.desc()).limit(limit).all()
    out = []
    for r in rows:
        out.append({
            "path": r.path or "",
            "message": r.message or "",
            "exc_type": r.exc_type or "Exception",
            "at": r.created_at.isoformat() if r.created_at else "",
        })
    return out
