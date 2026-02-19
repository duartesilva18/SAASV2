from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import base64
import json
import re
from datetime import datetime
from ..core.config import settings
from ..core.dependencies import get_db
from .auth import get_current_user
from ..models.database import User
from typing import Literal
from pydantic import BaseModel, Field

import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scan", tags=["AI Scan"])

# Tipos de imagem suportados pelo OpenAI vision (PDF não suportado)
IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']


class ScanResponse(BaseModel):
    amount: float = Field(..., description="O valor total da transação")
    description: str = Field(..., description="Uma descrição curta")
    type: Literal["expense", "income"] = Field(..., description="Tipo de transação")
    date: str = Field(..., description="Data no formato YYYY-MM-DD")
    category_suggestion: str = Field(..., description="Sugestão de categoria")


@router.post("/", response_model=ScanResponse)
async def scan_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
) -> ScanResponse:
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

    if file.content_type not in IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Formato não suportado. Use JPG, PNG, WEBP ou GIF. PDF não é suportado com OpenAI."
        )

    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OpenAI API não configurada.")

    try:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Ficheiro demasiado grande. Máximo 10MB.")
        if not content:
            raise HTTPException(status_code=400, detail="Ficheiro vazio.")

        prompt = f"""
És um especialista em contabilidade. Analisa este documento (recibo, fatura ou nota).
Extrai os dados com precisão máxima.

DATA ATUAL: {datetime.now().strftime('%Y-%m-%d')}

REGRAS DE EXTRAÇÃO:
- 'amount': Apenas o valor total final. Se houver várias moedas, converte para a principal se possível. Use ponto decimal.
- 'description': Nome do estabelecimento + item principal (ex: "Continente - Mercearias"). Máximo 40 caracteres.
- 'type': Se for dinheiro a sair (compra) = 'expense'. Se for dinheiro a entrar (reembolso, salário) = 'income'.
- 'date': Tenta encontrar a data de emissão. Se não encontrares, usa a DATA ATUAL fornecida. Formato: YYYY-MM-DD.
- 'category_suggestion': Sugere uma destas: Alimentação, Transportes, Saúde, Habitação, Lazer, Educação, Compras, Outros.

RESPONDE APENAS COM UM JSON PURO. NÃO ADICIONES COMENTÁRIOS OU MARKDOWN.
"""

        b64 = base64.b64encode(content).decode("utf-8")
        data_url = f"data:{file.content_type};base64,{b64}"

        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            max_tokens=500,
            temperature=0.1,
        )

        text_response = ""
        if response.choices and response.choices[0].message.content:
            text_response = response.choices[0].message.content.strip()

        if not text_response:
            raise Exception("A IA não devolveu resposta.")

        clean_json = re.search(r'\{[\s\S]*\}', text_response)
        if clean_json:
            text_response = clean_json.group(0)

        try:
            data = json.loads(text_response)
            validated_data = ScanResponse(**data)
            return validated_data
        except Exception as parse_err:
            logger.error(f"Erro no parse de resposta IA: {text_response}")
            raise Exception("A resposta da IA veio num formato inválido. Tenta novamente.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro no Scan OpenAI: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail='Erro ao processar imagem. Tenta novamente.')
