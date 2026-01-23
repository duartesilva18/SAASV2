from sqlalchemy.orm import Session
from fastapi import Request
from ..models import database
import uuid

async def log_action(db: Session, action: str, user_id: uuid.UUID = None, details: str = None, request: Request = None):
    ip = request.client.host if request else None
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
    except:
        db.rollback()
