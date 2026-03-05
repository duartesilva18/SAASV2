import html as html_module
import os
import uuid as uuid_mod
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func, and_
from ..core.config import settings
from ..core.dependencies import conf, get_db
from ..models import database as models
from ..schemas.schemas import SupportMessageSend, SupportMessageOut, SupportConversationOut
from .auth import get_current_user
from fastapi_mail import FastMail, MessageSchema, MessageType
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api/support', tags=['support'])

MAX_ATTACHMENTS = 3
MAX_FILE_SIZE_MB = 5
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads', 'support')
os.makedirs(UPLOAD_DIR, exist_ok=True)

ADMIN_EMAIL = 'duarte.nuno.silva18@gmail.com'


def _is_auto_reply_enabled(db: Session) -> bool:
    setting = db.query(models.AppSetting).filter(models.AppSetting.key == 'support_auto_reply').first()
    return setting is not None and setting.value == '1'


async def _generate_auto_reply(db: Session, conversation_id, user_email: str):
    try:
        msgs = (
            db.query(models.SupportMessage)
            .filter(models.SupportMessage.conversation_id == conversation_id)
            .order_by(models.SupportMessage.created_at.asc())
            .all()
        )
        chat_history = "\n".join([
            f"{'Utilizador' if m.sender_type == 'user' else 'Suporte Finly'}: {m.content}"
            for m in msgs[-15:]
        ])

        system_prompt = f"""És o assistente de suporte automático da Finly, uma plataforma SaaS de gestão financeira pessoal.
Responde à mensagem do utilizador de forma profissional, simpática e útil.

Regras:
- Responde em português de Portugal (não brasileiro)
- Sê conciso mas completo
- Mantém um tom profissional mas amigável
- Não uses emojis em excesso (1-2 no máximo)
- Se for uma questão técnica, sugere passos práticos
- Se for algo que precisa de intervenção humana (parcerias, bugs complexos, faturação), diz que a equipa vai analisar e que receberão resposta em breve
- Se for uma saudação simples, responde com boas-vindas e pergunta como podes ajudar
- Nunca inventes funcionalidades que não existem

Utilizador: {user_email}

Histórico:
{chat_history}

Gera APENAS o texto da resposta, sem prefixos ou aspas."""

        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": system_prompt}],
            max_tokens=500,
            temperature=0.7,
        )
        reply_text = response.choices[0].message.content.strip()
        if reply_text:
            auto_msg = models.SupportMessage(
                conversation_id=conversation_id,
                sender_type='admin',
                sender_id=None,
                content=reply_text,
            )
            db.add(auto_msg)
            db.commit()
            logger.info(f'Auto-reply sent for conversation {conversation_id}')
    except Exception as e:
        logger.error(f'Auto-reply failed: {e}')


async def _notify_admin_new_message(user_email: str, preview: str):
    try:
        fm = FastMail(conf)
        body = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; background: #0f172a; color: #e2e8f0; padding: 32px; margin: 0;">
            <div style="max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 28px; border: 1px solid #334155;">
                <h2 style="margin: 0 0 16px; font-size: 18px; color: #fff;">💬 Nova mensagem de suporte</h2>
                <p style="font-size: 13px; color: #94a3b8; margin: 0 0 6px;">De: <strong style="color: #e2e8f0;">{html_module.escape(user_email)}</strong></p>
                <div style="background: #0f172a; border-radius: 10px; padding: 14px; margin: 14px 0; border: 1px solid #334155;">
                    <p style="font-size: 14px; color: #cbd5e1; margin: 0; white-space: pre-wrap;">{html_module.escape(preview[:300])}</p>
                </div>
                <a href="{settings.FRONTEND_URL or 'http://localhost:3000'}/admin/support"
                   style="display: inline-block; background: #3b82f6; color: #fff; text-decoration: none; padding: 10px 22px; border-radius: 10px; font-size: 13px; font-weight: 600;">
                    Ver conversa
                </a>
            </div>
        </body>
        </html>
        """
        msg = MessageSchema(
            subject='[Finly] Nova mensagem de suporte',
            recipients=[ADMIN_EMAIL],
            body=body,
            subtype=MessageType.html,
        )
        await fm.send_message(msg)
    except Exception as e:
        logger.warning(f'Falha ao enviar notificação admin: {e}')


# ── Image upload ──

@router.post('/upload-image')
async def upload_support_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail='Tipo de ficheiro não suportado. Usa JPEG, PNG, GIF ou WebP.')

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f'Ficheiro demasiado grande. Máx: {MAX_FILE_SIZE_MB}MB.')

    ext = file.filename.rsplit('.', 1)[-1].lower() if file.filename and '.' in file.filename else 'jpg'
    if ext not in ('jpg', 'jpeg', 'png', 'gif', 'webp'):
        ext = 'jpg'
    filename = f"{uuid_mod.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, 'wb') as f:
        f.write(content)

    image_url = f"/api/support/images/{filename}"
    return {"image_url": image_url}


@router.get('/images/{filename}')
async def serve_support_image(filename: str):
    safe_name = os.path.basename(filename)
    filepath = os.path.join(UPLOAD_DIR, safe_name)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail='Imagem não encontrada')
    return FileResponse(filepath, headers={"Cache-Control": "public, max-age=31536000"})


# ── Legacy email contact ──

@router.post('/contact')
async def contact_support(
    message: str = Form(...),
    files: list[UploadFile] = File(default=[]),
    current_user: models.User = Depends(get_current_user),
):
    message = (message or '').strip()
    if not message:
        raise HTTPException(status_code=400, detail='Introduz uma mensagem.')
    support_email = getattr(settings, 'SUPPORT_EMAIL', None) or settings.MAIL_FROM
    if not support_email:
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
        if hasattr(f.file, 'seek'):
            f.file.seek(0)
        valid_files.append(f)
    fm = FastMail(conf)
    msg = MessageSchema(
        subject=f"[Finly Suporte] Contacto – {current_user.email or 'utilizador'}",
        recipients=[support_email],
        body=html,
        subtype=MessageType.html,
        attachments=valid_files,
    )
    try:
        await fm.send_message(msg)
        return {"ok": True, "message": "Mensagem enviada. Obrigado!"}
    except Exception as e:
        logger.error(f'Erro ao enviar contacto de suporte: {e}', exc_info=True)
        raise HTTPException(status_code=500, detail='Não foi possível enviar a mensagem.')


# ── Chat-based support ──

def _serialize_message(m: models.SupportMessage) -> dict:
    base_url = (process_env_api_url := getattr(settings, 'API_URL', '')) or ''
    img = m.image_url
    return {
        'id': str(m.id),
        'sender_type': m.sender_type,
        'content': m.content,
        'image_url': img,
        'is_read': m.is_read,
        'created_at': m.created_at.isoformat() if hasattr(m.created_at, 'isoformat') else str(m.created_at),
    }


@router.get('/conversations')
async def list_my_conversations(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    convos = (
        db.query(models.SupportConversation)
        .filter(models.SupportConversation.user_id == current_user.id)
        .order_by(models.SupportConversation.updated_at.desc())
        .limit(20)
        .all()
    )
    cids = [c.id for c in convos]
    if not cids:
        return []

    unread_counts = dict(
        db.query(models.SupportMessage.conversation_id, sa_func.count(models.SupportMessage.id))
        .filter(
            models.SupportMessage.conversation_id.in_(cids),
            models.SupportMessage.sender_type == 'admin',
            models.SupportMessage.is_read == False,
        )
        .group_by(models.SupportMessage.conversation_id)
        .all()
    )

    from sqlalchemy import literal_column
    last_msgs_sub = (
        db.query(
            models.SupportMessage.conversation_id,
            models.SupportMessage.content,
            sa_func.row_number().over(
                partition_by=models.SupportMessage.conversation_id,
                order_by=models.SupportMessage.created_at.desc()
            ).label('rn')
        )
        .filter(models.SupportMessage.conversation_id.in_(cids))
        .subquery()
    )
    last_msgs = dict(
        db.query(last_msgs_sub.c.conversation_id, last_msgs_sub.c.content)
        .filter(last_msgs_sub.c.rn == 1)
        .all()
    )

    return [
        {
            'id': str(c.id),
            'subject': c.subject,
            'status': c.status,
            'created_at': c.created_at.isoformat(),
            'updated_at': c.updated_at.isoformat(),
            'unread_count': unread_counts.get(c.id, 0),
            'last_message': (last_msgs.get(c.id) or '')[:100] or None,
        }
        for c in convos
    ]


@router.post('/conversations')
async def create_conversation(
    content: str = Form(...),
    image: UploadFile = File(default=None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = (content or '').strip()
    if not content and not image:
        raise HTTPException(status_code=400, detail='Mensagem vazia.')

    image_url = None
    if image and image.filename and image.content_type in ALLOWED_IMAGE_TYPES:
        img_data = await image.read()
        if len(img_data) <= MAX_FILE_SIZE_MB * 1024 * 1024:
            ext = image.filename.rsplit('.', 1)[-1].lower() if '.' in image.filename else 'jpg'
            if ext not in ('jpg', 'jpeg', 'png', 'gif', 'webp'):
                ext = 'jpg'
            fname = f"{uuid_mod.uuid4().hex}.{ext}"
            with open(os.path.join(UPLOAD_DIR, fname), 'wb') as f:
                f.write(img_data)
            image_url = f"/api/support/images/{fname}"

    if not content:
        content = '📷 Imagem'

    active = (
        db.query(models.SupportConversation)
        .filter(
            models.SupportConversation.user_id == current_user.id,
            models.SupportConversation.status == 'open',
        )
        .first()
    )
    if active:
        msg = models.SupportMessage(
            conversation_id=active.id,
            sender_type='user',
            sender_id=current_user.id,
            content=content,
            image_url=image_url,
        )
        active.updated_at = sa_func.now()
        db.add(msg)
        db.commit()
        db.refresh(msg)
        # Follow-up: only auto-reply if enabled, NO email (avoids spam)
        if _is_auto_reply_enabled(db):
            await _generate_auto_reply(db, active.id, current_user.email)
        return {"conversation_id": str(active.id), "message_id": str(msg.id)}

    # New conversation: email admin once + auto-reply if enabled
    convo = models.SupportConversation(
        user_id=current_user.id,
        subject=content[:80],
    )
    db.add(convo)
    db.flush()
    msg = models.SupportMessage(
        conversation_id=convo.id,
        sender_type='user',
        sender_id=current_user.id,
        content=content,
        image_url=image_url,
    )
    db.add(msg)
    db.commit()
    db.refresh(convo)
    db.refresh(msg)
    if _is_auto_reply_enabled(db):
        await _generate_auto_reply(db, convo.id, current_user.email)
    await _notify_admin_new_message(current_user.email, content)
    return {"conversation_id": str(convo.id), "message_id": str(msg.id)}


@router.get('/conversations/{conversation_id}/messages')
async def get_conversation_messages(
    conversation_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from uuid import UUID as _UUID
    try:
        cid = _UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail='ID inválido')

    convo = (
        db.query(models.SupportConversation)
        .filter(
            models.SupportConversation.id == cid,
            models.SupportConversation.user_id == current_user.id,
        )
        .first()
    )
    if not convo:
        raise HTTPException(status_code=404, detail='Conversa não encontrada')

    msgs = (
        db.query(models.SupportMessage)
        .filter(models.SupportMessage.conversation_id == cid)
        .order_by(models.SupportMessage.created_at.asc())
        .all()
    )

    db.query(models.SupportMessage).filter(
        models.SupportMessage.conversation_id == cid,
        models.SupportMessage.sender_type == 'admin',
        models.SupportMessage.is_read == False,
    ).update({'is_read': True})
    db.commit()

    return [_serialize_message(m) for m in msgs]


@router.get('/unread-count')
async def get_unread_count(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = (
        db.query(sa_func.count(models.SupportMessage.id))
        .join(models.SupportConversation, models.SupportMessage.conversation_id == models.SupportConversation.id)
        .filter(
            models.SupportConversation.user_id == current_user.id,
            models.SupportMessage.sender_type == 'admin',
            models.SupportMessage.is_read == False,
        )
        .scalar()
    )
    return {"unread": count or 0}
