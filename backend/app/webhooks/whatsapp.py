from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
import re
import requests
import logging
import json
import io
from ..core.config import settings
from ..core.dependencies import get_db
from ..models import database as models
from datetime import datetime

logger = logging.getLogger("whatsapp_webhook")

router = APIRouter(prefix='/webhooks', tags=['webhooks'])

@router.get('/whatsapp')
async def verify_whatsapp_webhook(request: Request):
    from fastapi.responses import Response
    # FORÇAR VERIFICAÇÃO: Retorna o challenge independentemente do token
    challenge = request.query_params.get('hub.challenge')
    if challenge:
        print(f"✅ [WHATSAPP] Verificação forçada com sucesso! Challenge: {challenge}")
        return Response(content=str(challenge), media_type='text/plain')
    return Response(content="Webhook Ativo")

async def get_media_url(media_id: str):
    url = f"https://graph.facebook.com/v17.0/{media_id}"
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"}
    res = requests.get(url, headers=headers)
    return res.json().get('url')

async def download_media(url: str):
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"}
    res = requests.get(url, headers=headers)
    return res.content

@router.post('/whatsapp')
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    print("🚀 [WHATSAPP] MENSAGEM RECEBIDA!")
    try:
        # Tenta ler o corpo da mensagem como JSON
        body = await request.body()
        print(f"📦 Raw Body: {body.decode()}")
        
        try:
            data = json.loads(body)
        except Exception:
            print("⚠️ O corpo não é um JSON válido")
            from fastapi.responses import Response
            return Response(content="OK", media_type='text/plain')

        print(f"📥 Webhook Recebido: {json.dumps(data)}")
        logger.info(f"Webhook recebido: {json.dumps(data)}")

        if not data.get('entry'):
            return {'status': 'no entry'}

        entry = data['entry'][0]
        if not entry.get('changes'):
            return {'status': 'no changes'}

        value = entry['changes'][0]['value']
        if not value.get('messages'):
            # Pode ser um status de entrega (delivery/read), ignoramos por agora
            return {'status': 'no messages'}

        message = value['messages'][0]
        from_phone = message['from']  # Formato: 351925989577
        msg_type = message.get('type')

        print(f"📱 Mensagem de: {from_phone} | Tipo: {msg_type}")

        # 1. Encontrar Utilizador (Log para debug)
        user = db.query(models.User).filter(models.User.phone_number.contains(from_phone)).first()
        if not user:
            print(f"⚠️ Utilizador não encontrado para o número: {from_phone}")
            # Se não encontrar, vamos tentar procurar sem o prefixo 351
            short_phone = from_phone[3:] if from_phone.startswith('351') else from_phone
            user = db.query(models.User).filter(models.User.phone_number.contains(short_phone)).first()
            
            if not user:
                # Tenta enviar uma mensagem de erro se tivermos token
                send_whatsapp_confirmation(from_phone, "⚠️ Olá! Não encontrei o teu número no sistema Finly. Regista o teu número nas definições do site para usares o Bot. 🧘‍♂️")
                return {'status': 'user not found'}

        print(f"👤 Utilizador Identificado: {user.email}")

        workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
        if not workspace:
            return {'status': 'workspace not found'}

        transaction_data = None

        # 2. Processar por Tipo (Texto apenas, sem IA)
        if msg_type == 'text':
            text = message['text']['body']
            # Processamento básico de texto removido - funcionalidade IA desativada
            logger.warning(f"Processamento de texto via WhatsApp desativado (IA removida): {text}")
            send_whatsapp_confirmation(from_phone, "⚠️ Processamento automático temporariamente indisponível. Por favor, usa a aplicação web.")
            return {'status': 'not_supported'}

        elif msg_type == 'image':
            # Processamento de imagens removido - funcionalidade IA desativada
            logger.warning("Processamento de imagem via WhatsApp desativado (IA removida)")
            send_whatsapp_confirmation(from_phone, "⚠️ Processamento de imagens temporariamente indisponível. Por favor, usa a aplicação web.")
            return {'status': 'not_supported'}

        # 3. Guardar Transação
        if transaction_data:
            # Mapear categoria
            cat_name = transaction_data.get('category', 'Outros')
            category = db.query(models.Category).filter(
                models.Category.workspace_id == workspace.id,
                models.Category.name.ilike(f"%{cat_name}%")
            ).first()
            
            if not category:
                # Fallback para primeira categoria do tipo correto
                category = db.query(models.Category).filter(
                    models.Category.workspace_id == workspace.id,
                    models.Category.type == transaction_data.get('type', 'expense')
                ).first()

            amount_cents = int(float(transaction_data['amount']) * 100)
            if transaction_data['type'] == 'expense':
                amount_cents = -abs(amount_cents)
            else:
                amount_cents = abs(amount_cents)

            new_trans = models.Transaction(
                workspace_id=workspace.id,
                category_id=category.id if category else None,
                amount_cents=amount_cents,
                description=transaction_data.get('description', 'WhatsApp'),
                transaction_date=datetime.now().date()
            )
            db.add(new_trans)
            db.commit()

            # 4. Responder ao Utilizador
            tipo_emoji = "💸" if amount_cents < 0 else "💰"
            msg_confirmacao = f"{tipo_emoji} *Registado com Sucesso!*\n\n" \
                              f"📝 *O quê:* {transaction_data['description']}\n" \
                              f"💰 *Valor:* {abs(transaction_data['amount']):.2f}€\n" \
                              f"🏷️ *Categoria:* {category.name if category else 'Outros'}\n\n" \
                              f"🧘‍♂️ _A tua jornada Zen continua._"
            
            send_whatsapp_confirmation(from_phone, msg_confirmacao)

        return {'status': 'success'}
    except Exception as e:
        logger.error(f"Erro no webhook WhatsApp: {str(e)}", exc_info=True)
        return {'status': 'error', 'detail': str(e)}

def send_whatsapp_confirmation(to: str, text: str):
    if not settings.WHATSAPP_PHONE_NUMBER_ID or not settings.WHATSAPP_TOKEN:
        return
        
    url = f"https://graph.facebook.com/v17.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        'Authorization': f"Bearer {settings.WHATSAPP_TOKEN}",
        'Content-Type': 'application/json'
    }
    payload = {
        'messaging_product': 'whatsapp',
        'to': to,
        'type': 'text',
        'text': {'body': text}
    }
    requests.post(url, json=payload, headers=headers)
