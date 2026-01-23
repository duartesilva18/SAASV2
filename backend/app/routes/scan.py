from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import google.generativeai as genai
from PIL import Image
import io
import json
import re
from datetime import datetime
from ..core.config import settings
from ..core.dependencies import get_db
from .auth import get_current_user
from ..models.database import User
from typing import Dict, Optional, Literal
from pydantic import BaseModel, Field

import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scan", tags=["AI Scan"])

# Configura o Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)

def get_gemini_model():
    """Tenta inicializar o melhor modelo disponível"""
    # Priorizar 1.5-flash por estabilidade de quota
    available_models = ['gemini-1.5-flash', 'gemini-flash-latest']
    for model_name in available_models:
        try:
            m = genai.GenerativeModel(model_name)
            # Teste rápido não é possível sem chamada API, mas vamos confiar no nome
            return m
        except:
            continue
    return genai.GenerativeModel('gemini-pro-vision') # Último fallback

model = get_gemini_model()

from pydantic import BaseModel, Field
from typing import Dict, Optional, Literal

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
    # 1. Validação de Ficheiro (Tamanho e Tipo)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Formato não suportado. Use JPG, PNG, WEBP ou PDF.")

    try:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Ficheiro demasiado grande. Máximo 10MB.")
        
        if not content:
            raise HTTPException(status_code=400, detail="Ficheiro vazio.")

        # 2. Prompt Estruturado (System Instruction)
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

        # 3. Chamada à IA com Retry e Diversos Modelos
        content_parts = [prompt, {"mime_type": file.content_type, "data": content}]
        
        models_to_try = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest']
        last_error = None
        text_response = ""

        for model_name in models_to_try:
            try:
                current_model = genai.GenerativeModel(model_name)
                response = current_model.generate_content(content_parts)
                if response and response.text:
                    text_response = response.text.strip()
                    break
            except Exception as e:
                logger.warning(f"Falha com {model_name}: {str(e)}")
                last_error = e
                continue

        if not text_response:
            raise Exception(f"A IA não conseguiu processar o ficheiro: {str(last_error)}")

        # 4. Limpeza e Parse de Segurança
        # Remove blocos markdown ```json ... ```
        clean_json = re.search(r'\{[\s\S]*\}', text_response)
        if clean_json:
            text_response = clean_json.group(0)
        
        try:
            data = json.loads(text_response)
            # Validação via Pydantic para garantir que o frontend recebe o que espera
            validated_data = ScanResponse(**data)
            return validated_data
        except Exception as parse_err:
            logger.error(f"Erro no parse de resposta IA: {text_response}")
            raise Exception("A resposta da IA veio num formato inválido. Tenta novamente.")

    except Exception as e:
        logger.error(f"Erro no Scan Gemini: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

