"""
Script simples para configurar o webhook do Telegram
"""
import os
import requests
from dotenv import load_dotenv

# Carregar variáveis do .env
load_dotenv()

# Obter token e secret do .env
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '').strip().strip('"')
WEBHOOK_SECRET = os.getenv('TELEGRAM_WEBHOOK_SECRET', '').strip().strip('"')
WEBHOOK_URL = "https://finanzen-backend.onrender.com/telegram/webhook"

if not BOT_TOKEN:
    print("ERRO: TELEGRAM_BOT_TOKEN nao encontrado no .env")
    exit(1)

if not WEBHOOK_SECRET:
    print("ERRO: TELEGRAM_WEBHOOK_SECRET nao encontrado no .env")
    exit(1)

print(f"Configurando webhook do Telegram...")
print(f"   URL: {WEBHOOK_URL}")
print(f"   Secret: {WEBHOOK_SECRET[:10]}...")

# Configurar webhook
response = requests.post(
    f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook",
    json={
        "url": WEBHOOK_URL,
        "secret_token": WEBHOOK_SECRET
    }
)

if response.status_code == 200:
    result = response.json()
    if result.get('ok'):
        print("SUCESSO: Webhook configurado!")
        print(f"   {result.get('description', '')}")
    else:
        print(f"ERRO: {result.get('description', 'Erro desconhecido')}")
else:
    print(f"ERRO HTTP {response.status_code}: {response.text}")

# Verificar webhook atual
print("\nVerificando webhook atual...")
response = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo")
if response.status_code == 200:
    info = response.json()
    if info.get('ok'):
        webhook_info = info.get('result', {})
        print(f"   URL: {webhook_info.get('url', 'N/A')}")
        print(f"   Pending updates: {webhook_info.get('pending_update_count', 0)}")
        if webhook_info.get('last_error_date'):
            print(f"   AVISO - Ultimo erro: {webhook_info.get('last_error_message', 'N/A')}")

