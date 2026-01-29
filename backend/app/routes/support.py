import html as html_module
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from ..core.config import settings
from ..core.dependencies import conf
from ..models import database as models
from .auth import get_current_user
from fastapi_mail import FastMail, MessageSchema, MessageType
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api/support', tags=['support'])

MAX_ATTACHMENTS = 3
MAX_FILE_SIZE_MB = 5


@router.post('/contact')
async def contact_support(
    message: str = Form(...),
    files: list[UploadFile] = File(default=[]),
    current_user: models.User = Depends(get_current_user),
):
    """Envia a mensagem do utilizador para o email de suporte, com anexos opcionais."""
    message = (message or '').strip()
    if not message:
        raise HTTPException(status_code=400, detail='Introduz uma mensagem.')
    support_email = getattr(settings, 'SUPPORT_EMAIL', None) or settings.MAIL_FROM
    if not support_email:
        logger.warning('SUPPORT_EMAIL e MAIL_FROM vazios; não é possível enviar contacto.')
        raise HTTPException(status_code=503, detail='Serviço de suporte temporariamente indisponível.')
    user_name = html_module.escape((current_user.full_name or '').strip() or current_user.email or '')
    user_email = html_module.escape(current_user.email or '')
    msg_escaped = html_module.escape(message)
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; background-color: #ffffff; color: #1e293b; padding: 24px; margin: 0;">
        <p style="font-size: 12px; color: #64748b; margin: 0 0 8px 0;">De: {user_name} &lt;{user_email}&gt;</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
        <p style="line-height: 1.6; font-size: 15px; white-space: pre-wrap; margin: 0;">{msg_escaped}</p>
    </body>
    </html>
    """
    max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
    valid_files: list[UploadFile] = []
    for f in (files or [])[:MAX_ATTACHMENTS]:
        if not f.filename or f.filename.strip() == '':
            continue
        content = await f.read()
        if len(content) > max_bytes:
            continue
        # Repor o ponteiro para o fastapi-mail poder ler o ficheiro ao enviar
        if hasattr(f.file, 'seek'):
            f.file.seek(0)
        valid_files.append(f)
    fm = FastMail(conf)
    subject_tag = "[Finly Suporte]"
    msg = MessageSchema(
        subject=f"{subject_tag} Contacto – {current_user.email or 'utilizador'}",
        recipients=[support_email],
        body=html,
        subtype=MessageType.html,
        attachments=valid_files,
    )
    try:
        await fm.send_message(msg)
        logger.info(f'Contacto de suporte enviado por {current_user.email} para {support_email}')
        return {"ok": True, "message": "Mensagem enviada. Obrigado!"}
    except Exception as e:
        logger.error(f'Erro ao enviar contacto de suporte: {e}', exc_info=True)
        raise HTTPException(status_code=500, detail='Não foi possível enviar a mensagem. Tenta novamente mais tarde.')
