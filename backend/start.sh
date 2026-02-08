#!/bin/bash
# Script de inicialização para o Render

echo "Iniciando FinanZen Backend..."

# Executar migrações do Alembic se existirem
if [ -d "alembic" ] && [ -f "alembic.ini" ]; then
    echo "📦 Executando migrações do banco de dados..."
    alembic upgrade head
fi

# Iniciar o servidor
echo "✅ Iniciando servidor FastAPI..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}







