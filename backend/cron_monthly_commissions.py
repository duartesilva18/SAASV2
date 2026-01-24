#!/usr/bin/env python3
"""
Script para executar o cálculo de comissões mensais
Pode ser executado via cron job no servidor ou GitHub Actions

Para configurar no crontab (executa no dia 1 de cada mês às 00:00):
0 0 1 * * /usr/bin/python3 /caminho/para/cron_monthly_commissions.py

Ou usar GitHub Actions (RECOMENDADO para Render + GitHub)
"""
import asyncio
import sys
import os

# Adicionar o diretório do projeto ao path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

# Mudar para o diretório do projeto para imports funcionarem
os.chdir(project_root)

from app.core.monthly_commission_job import run_monthly_commission_job

if __name__ == '__main__':
    print('🚀 Iniciando cálculo de comissões mensais...')
    try:
        asyncio.run(run_monthly_commission_job())
        print('✅ Cálculo de comissões concluído com sucesso!')
    except Exception as e:
        print(f'❌ Erro ao calcular comissões: {str(e)}')
        import traceback
        traceback.print_exc()
        sys.exit(1)

