import logging
from sqlalchemy.orm import Session
from fastapi import Request
from ..models import database
import uuid

logger = logging.getLogger(__name__)


async def log_action(db: Session, action: str, user_id: uuid.UUID = None, details: str = None, request: Request = None):
    ip = request.client.host if request and request.client else None
    log = database.AuditLog(
        id=uuid.uuid4(),
        user_id=user_id,
        action=action,
        details=details,
        ip_address=ip
    )
    db.add(log)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"Erro ao gravar audit log (action={action}): {e}")