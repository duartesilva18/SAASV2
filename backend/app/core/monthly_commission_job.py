"""
Job agendado para calcular comissões mensais automaticamente
Pode ser executado via cron job ou scheduler externo
"""
import asyncio
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from ..core.dependencies import get_db
from ..models import database as models
from ..core.affiliate_tracking import calculate_monthly_commissions
from fastapi_mail import FastMail, MessageSchema, MessageType
from ..core.dependencies import conf
from sqlalchemy import extract, and_

logger = logging.getLogger(__name__)

async def send_admin_monthly_report(
    admin_email: str,
    commissions: list,
    month: int,
    year: int,
    db: Session
):
    """Envia relatório mensal para o admin"""
    month_names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    
    total_commissions = sum(c.commission_amount_cents for c in commissions)
    total_pending = sum(c.commission_amount_cents for c in commissions if not c.is_paid)
    
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; background: #020617; color: #ffffff; }}
            .container {{ max-width: 800px; margin: 40px auto; background: #0f172a; border-radius: 24px; padding: 40px; border: 1px solid #1e293b; }}
            h1 {{ color: #3b82f6; font-size: 28px; margin-bottom: 20px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #1e293b; }}
            th {{ background: #1e293b; color: #3b82f6; font-weight: bold; }}
            .total {{ font-size: 20px; font-weight: bold; color: #3b82f6; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Relatório Mensal de Afiliados - {month_names[month-1]} {year}</h1>
            <p>Total de comissões: €{total_commissions/100:.2f}</p>
            <p>Total pendente: €{total_pending/100:.2f}</p>
            <table>
                <thead>
                    <tr>
                        <th>Afiliado</th>
                        <th>Referências</th>
                        <th>Conversões</th>
                        <th>Receita</th>
                        <th>Comissão</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    '''
    
    for comm in commissions:
        affiliate = db.query(models.Affiliate).filter(models.Affiliate.id == comm.affiliate_id).first()
        user = db.query(models.User).filter(models.User.id == affiliate.affiliate_id).first() if affiliate else None
        
        html += f'''
                    <tr>
                        <td>{user.email if user else 'N/A'}</td>
                        <td>{comm.total_referrals}</td>
                        <td>{comm.total_conversions}</td>
                        <td>€{comm.total_revenue_cents/100:.2f}</td>
                        <td>€{comm.commission_amount_cents/100:.2f}</td>
                        <td>{"Pago" if comm.is_paid else "Pendente"}</td>
                    </tr>
        '''
    
    html += '''
                </tbody>
            </table>
        </div>
    </body>
    </html>
    '''
    
    message = MessageSchema(
        subject=f'Relatório Mensal de Afiliados - {month_names[month-1]} {year}',
        recipients=[admin_email],
        body=html,
        subtype=MessageType.html
    )
    
    fm = FastMail(conf)
    try:
        await fm.send_message(message)
        logger.info(f'Email de relatório mensal enviado para admin: {admin_email}')
    except Exception as e:
        logger.error(f'Erro ao enviar email para admin: {str(e)}')

async def send_affiliate_monthly_report(
    affiliate_email: str,
    commission: models.Commission,
    month: int,
    year: int,
    db: Session
):
    """Envia relatório mensal para o afiliado"""
    month_names = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; background: #020617; color: #ffffff; }}
            .container {{ max-width: 600px; margin: 40px auto; background: #0f172a; border-radius: 24px; padding: 40px; border: 1px solid #1e293b; }}
            h1 {{ color: #3b82f6; font-size: 24px; margin-bottom: 20px; }}
            .stats {{ background: #1e293b; padding: 20px; border-radius: 12px; margin: 20px 0; }}
            .stat-item {{ margin: 10px 0; }}
            .total {{ font-size: 24px; font-weight: bold; color: #3b82f6; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>O Teu Relatório Mensal de Afiliado - {month_names[month-1]} {year}</h1>
            <div class="stats">
                <div class="stat-item">
                    <strong>Referências:</strong> {commission.total_referrals}
                </div>
                <div class="stat-item">
                    <strong>Conversões:</strong> {commission.total_conversions}
                </div>
                <div class="stat-item">
                    <strong>Receita Gerada:</strong> €{commission.total_revenue_cents/100:.2f}
                </div>
                <div class="total">
                    <strong>A Ganhar:</strong> €{commission.commission_amount_cents/100:.2f}
                </div>
            </div>
            <p>Obrigado por partilhares o Finly!</p>
        </div>
    </body>
    </html>
    '''
    
    message = MessageSchema(
        subject=f'Relatório Mensal de Afiliado - {month_names[month-1]} {year}',
        recipients=[affiliate_email],
        body=html,
        subtype=MessageType.html
    )
    
    fm = FastMail(conf)
    try:
        await fm.send_message(message)
        logger.info(f'Email de relatório mensal enviado para afiliado: {affiliate_email}')
    except Exception as e:
        logger.error(f'Erro ao enviar email para afiliado: {str(e)}')

async def run_monthly_commission_job():
    """
    Função principal que calcula comissões e envia emails.
    Deve ser chamada automaticamente no primeiro dia de cada mês.
    Pode ser executada via:
    - Cron job no servidor
    - GitHub Actions (schedule)
    - Vercel Cron Jobs
    - Outro serviço de agendamento
    """
    from ..core.dependencies import SessionLocal
    
    db = SessionLocal()
    try:
        # Obter mês anterior
        now = datetime.now()
        if now.month == 1:
            month = 12
            year = now.year - 1
        else:
            month = now.month - 1
            year = now.year
        
        logger.info(f'Iniciando cálculo de comissões mensais para {month}/{year}')
        
        # Verificar se o sistema está ativo
        settings = db.query(models.AffiliateSettings).first()
        if not settings or not settings.is_system_active:
            logger.info('Sistema de afiliados está desativado, abortando cálculo de comissões')
            return
        
        # Calcular comissões
        calculate_monthly_commissions(db, month, year)
        
        # Obter todas as comissões do mês
        commissions = db.query(models.Commission).filter(
            and_(
                models.Commission.month == month,
                models.Commission.year == year
            )
        ).all()
        
        logger.info(f'Encontradas {len(commissions)} comissões para {month}/{year}')
        
        # Enviar email para admin
        if settings.admin_email:
            await send_admin_monthly_report(settings.admin_email, commissions, month, year, db)
        
        # Enviar emails para afiliados
        for commission in commissions:
            affiliate = db.query(models.Affiliate).filter(
                models.Affiliate.id == commission.affiliate_id
            ).first()
            
            if affiliate and affiliate.is_active:
                user = db.query(models.User).filter(
                    models.User.id == affiliate.affiliate_id
                ).first()
                
                if user:
                    await send_affiliate_monthly_report(
                        user.email, 
                        commission, 
                        month, 
                        year, 
                        db
                    )
        
        logger.info(f'Cálculo de comissões mensais concluído para {month}/{year}')
        
    except Exception as e:
        logger.error(f'Erro ao executar job de comissões mensais: {str(e)}', exc_info=True)
    finally:
        db.close()

if __name__ == '__main__':
    # Para testar localmente
    asyncio.run(run_monthly_commission_job())

