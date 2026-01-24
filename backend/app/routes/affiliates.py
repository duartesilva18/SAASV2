from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_, extract
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
import secrets
import string
from ..core.dependencies import get_db, conf
from ..models import database as models
from .. import schemas
from .auth import get_current_user
from .admin import check_admin
from ..core.affiliate_tracking import calculate_monthly_commissions
from fastapi_mail import FastMail, MessageSchema, MessageType
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/affiliates', tags=['affiliates'])

def generate_affiliate_code(length: int = 8, db: Session = None) -> str:
    """Gera um código único de afiliado"""
    characters = string.ascii_uppercase + string.digits
    max_attempts = 100
    for _ in range(max_attempts):
        code = ''.join(secrets.choice(characters) for _ in range(length))
        # Verificar se já existe
        if db:
            existing = db.query(models.Affiliate).filter(models.Affiliate.code == code).first()
            if not existing:
                return code
        else:
            return code
    raise Exception('Não foi possível gerar código único de afiliado após várias tentativas')

async def check_affiliate(current_user: models.User = Depends(get_current_user)):
    """Verifica se o utilizador é afiliado"""
    if not current_user.is_affiliate:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Acesso negado. Apenas afiliados.'
        )
    return current_user

# ============ ROTAS PARA AFILIADOS ============

@router.get('/me', response_model=schemas.AffiliateResponse)
async def get_my_affiliate_info(
    affiliate: models.User = Depends(check_affiliate),
    db: Session = Depends(get_db)
):
    """Obtém informações do afiliado atual"""
    affiliate_record = db.query(models.Affiliate).filter(
        models.Affiliate.affiliate_id == affiliate.id
    ).first()
    
    if not affiliate_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Registo de afiliado não encontrado'
        )
    
    return affiliate_record

@router.get('/me/link', response_model=schemas.AffiliateLinkResponse)
async def get_my_affiliate_link(
    request: Request,
    affiliate: models.User = Depends(check_affiliate),
    db: Session = Depends(get_db)
):
    """Obtém o link de afiliado do utilizador atual"""
    affiliate_record = db.query(models.Affiliate).filter(
        models.Affiliate.affiliate_id == affiliate.id
    ).first()
    
    if not affiliate_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Registo de afiliado não encontrado'
        )
    
    # Usar URL do frontend em vez do backend
    from ..core.config import settings
    frontend_url = settings.FRONTEND_URL.rstrip('/')
    link = f"{frontend_url}/auth/register?ref={affiliate_record.code}"
    
    return schemas.AffiliateLinkResponse(
        code=affiliate_record.code,
        link=link
    )

@router.get('/me/stats', response_model=schemas.AffiliateStats)
async def get_my_affiliate_stats(
    affiliate: models.User = Depends(check_affiliate),
    db: Session = Depends(get_db)
):
    """Obtém estatísticas do afiliado atual"""
    affiliate_record = db.query(models.Affiliate).filter(
        models.Affiliate.affiliate_id == affiliate.id
    ).first()
    
    if not affiliate_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Registo de afiliado não encontrado'
        )
    
    # Calcular taxa de conversão
    conversion_rate = 0.0
    if affiliate_record.total_referrals > 0:
        conversion_rate = (affiliate_record.total_conversions / affiliate_record.total_referrals) * 100
    
    # Obter estatísticas mensais
    monthly_stats = db.query(
        func.extract('month', models.Commission.created_at).label('month'),
        func.extract('year', models.Commission.created_at).label('year'),
        func.sum(models.Commission.total_referrals).label('referrals'),
        func.sum(models.Commission.total_conversions).label('conversions'),
        func.sum(models.Commission.commission_amount_cents).label('earnings')
    ).filter(
        models.Commission.affiliate_id == affiliate_record.id
    ).group_by(
        func.extract('month', models.Commission.created_at),
        func.extract('year', models.Commission.created_at)
    ).order_by(desc('year'), desc('month')).all()
    
    monthly_data = [
        {
            'month': int(stat.month),
            'year': int(stat.year),
            'referrals': int(stat.referrals or 0),
            'conversions': int(stat.conversions or 0),
            'earnings_cents': int(stat.earnings or 0)
        }
        for stat in monthly_stats
    ]
    
    pending_earnings = affiliate_record.total_earnings_cents - affiliate_record.total_paid_cents
    
    return schemas.AffiliateStats(
        total_referrals=affiliate_record.total_referrals,
        total_conversions=affiliate_record.total_conversions,
        conversion_rate=round(conversion_rate, 2),
        total_earnings_cents=affiliate_record.total_earnings_cents,
        total_paid_cents=affiliate_record.total_paid_cents,
        pending_earnings_cents=pending_earnings,
        monthly_stats=monthly_data
    )

@router.get('/me/referrals', response_model=List[schemas.ReferralResponse])
async def get_my_referrals(
    affiliate: models.User = Depends(check_affiliate),
    db: Session = Depends(get_db)
):
    """Obtém lista de utilizadores referidos pelo afiliado"""
    affiliate_record = db.query(models.Affiliate).filter(
        models.Affiliate.affiliate_id == affiliate.id
    ).first()
    
    if not affiliate_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Registo de afiliado não encontrado'
        )
    
    referrals = db.query(models.Referral).filter(
        models.Referral.affiliate_id == affiliate_record.id
    ).order_by(desc(models.Referral.created_at)).all()
    
    result = []
    for ref in referrals:
        user = db.query(models.User).filter(models.User.id == ref.referred_user_id).first()
        result.append(schemas.ReferralResponse(
            id=ref.id,
            affiliate_id=ref.affiliate_id,
            referred_user_id=ref.referred_user_id,
            has_converted=ref.has_converted,
            conversion_date=ref.conversion_date,
            conversion_amount_cents=ref.conversion_amount_cents,
            created_at=ref.created_at,
            referred_user_email=user.email if user else None,
            referred_user_name=user.full_name if user else None
        ))
    
    return result

@router.get('/me/commissions', response_model=List[schemas.CommissionResponse])
async def get_my_commissions(
    affiliate: models.User = Depends(check_affiliate),
    db: Session = Depends(get_db)
):
    """Obtém histórico de comissões do afiliado"""
    affiliate_record = db.query(models.Affiliate).filter(
        models.Affiliate.affiliate_id == affiliate.id
    ).first()
    
    if not affiliate_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Registo de afiliado não encontrado'
        )
    
    commissions = db.query(models.Commission).filter(
        models.Commission.affiliate_id == affiliate_record.id
    ).order_by(desc(models.Commission.year), desc(models.Commission.month)).all()
    
    return commissions

# ============ ROTAS ADMIN ============

@router.get('/admin/all')
async def get_all_affiliates(
    request: Request,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Lista todos os afiliados com informações do utilizador e link (apenas admin)"""
    from ..core.config import settings
    frontend_url = settings.FRONTEND_URL.rstrip('/')
    
    affiliates = db.query(models.Affiliate).order_by(desc(models.Affiliate.created_at)).all()
    
    result = []
    for aff in affiliates:
        user = db.query(models.User).filter(models.User.id == aff.affiliate_id).first()
        link = f"{frontend_url}/auth/register?ref={aff.code}"
        
        result.append({
            **schemas.AffiliateResponse.from_orm(aff).dict(),
            'affiliate_email': user.email if user else None,
            'affiliate_name': user.full_name if user else None,
            'affiliate_link': link
        })
    
    return result

@router.get('/admin/top')
async def get_top_affiliates(
    request: Request,
    limit: int = 3,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Obtém top N afiliados por conversões com informações do utilizador (apenas admin)"""
    from ..core.config import settings
    frontend_url = settings.FRONTEND_URL.rstrip('/')
    
    top_affiliates = db.query(models.Affiliate).order_by(
        desc(models.Affiliate.total_conversions),
        desc(models.Affiliate.total_referrals)
    ).limit(limit).all()
    
    result = []
    for aff in top_affiliates:
        user = db.query(models.User).filter(models.User.id == aff.affiliate_id).first()
        link = f"{frontend_url}/auth/register?ref={aff.code}"
        
        result.append({
            **schemas.AffiliateResponse.from_orm(aff).dict(),
            'affiliate_email': user.email if user else None,
            'affiliate_name': user.full_name if user else None,
            'affiliate_link': link
        })
    
    return result

@router.post('/admin/promote', response_model=schemas.AffiliateResponse)
async def promote_to_affiliate(
    request_data: schemas.PromoteToAffiliateRequest,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Promove um utilizador a afiliado (apenas admin)"""
    user = db.query(models.User).filter(models.User.id == request_data.user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Utilizador não encontrado'
        )
    
    if user.is_affiliate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Utilizador já é afiliado'
        )
    
    # Obter configurações padrão
    settings = db.query(models.AffiliateSettings).first()
    if not settings:
        # Criar configurações padrão se não existirem
        settings = models.AffiliateSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    commission_percentage = request_data.commission_percentage or float(settings.default_commission_percentage)
    
    # Gerar código único
    code = generate_affiliate_code(db=db)
    
    # Criar registo de afiliado
    affiliate = models.Affiliate(
        affiliate_id=user.id,
        code=code,
        commission_percentage=commission_percentage,
        is_active=True
    )
    
    user.is_affiliate = True
    user.affiliate_code = code
    
    db.add(affiliate)
    db.commit()
    db.refresh(affiliate)
    
    logger.info(f'Utilizador {user.email} promovido a afiliado com código {code}')
    
    return affiliate

@router.get('/admin/{affiliate_id}/referrals', response_model=List[schemas.ReferralResponse])
async def get_affiliate_referrals(
    affiliate_id: UUID,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Obtém referências de um afiliado específico (apenas admin)"""
    affiliate = db.query(models.Affiliate).filter(models.Affiliate.id == affiliate_id).first()
    
    if not affiliate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Afiliado não encontrado'
        )
    
    referrals = db.query(models.Referral).filter(
        models.Referral.affiliate_id == affiliate.id
    ).order_by(desc(models.Referral.created_at)).all()
    
    result = []
    for ref in referrals:
        user = db.query(models.User).filter(models.User.id == ref.referred_user_id).first()
        result.append(schemas.ReferralResponse(
            id=ref.id,
            affiliate_id=ref.affiliate_id,
            referred_user_id=ref.referred_user_id,
            has_converted=ref.has_converted,
            conversion_date=ref.conversion_date,
            conversion_amount_cents=ref.conversion_amount_cents,
            created_at=ref.created_at,
            referred_user_email=user.email if user else None,
            referred_user_name=user.full_name if user else None
        ))
    
    return result

@router.get('/admin/stats', response_model=dict)
async def get_affiliate_system_stats(
    affiliate_id: Optional[UUID] = None,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Obtém estatísticas gerais do sistema de afiliados (apenas admin)"""
    query = db.query(models.Affiliate)
    
    if affiliate_id:
        query = query.filter(models.Affiliate.id == affiliate_id)
    
    affiliates = query.all()
    
    total_affiliates = len(affiliates)
    total_referrals = sum(a.total_referrals for a in affiliates)
    total_conversions = sum(a.total_conversions for a in affiliates)
    total_earnings = sum(a.total_earnings_cents for a in affiliates)
    total_paid = sum(a.total_paid_cents for a in affiliates)
    
    conversion_rate = 0.0
    if total_referrals > 0:
        conversion_rate = (total_conversions / total_referrals) * 100
    
    return {
        'total_affiliates': total_affiliates,
        'total_referrals': total_referrals,
        'total_conversions': total_conversions,
        'total_earnings_cents': total_earnings,
        'total_paid_cents': total_paid,
        'pending_payments_cents': total_earnings - total_paid,
        'conversion_rate': round(conversion_rate, 2)
    }

@router.get('/admin/revenue-comparison')
async def get_revenue_comparison(
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Retorna dados de faturamento mensal com e sem afiliados para gráfico"""
    from datetime import datetime, timedelta
    from collections import defaultdict
    import stripe
    from ..core.config import settings
    
    stripe.api_key = settings.STRIPE_API_KEY
    
    try:
        # Buscar invoices do Stripe dos últimos 12 meses
        invoices = stripe.Invoice.list(limit=100)
        
        # Agrupar faturamento por mês
        monthly_revenue = defaultdict(int)
        for inv in invoices.data:
            if inv.status == 'paid' and inv.created:
                if isinstance(inv.created, (int, float)):
                    inv_date = datetime.fromtimestamp(inv.created)
                else:
                    inv_date = inv.created
                month_key = inv_date.strftime('%Y-%m')
                monthly_revenue[month_key] += inv.amount_paid
        
        # Buscar comissões pagas por mês
        commissions = db.query(models.Commission).order_by(
            models.Commission.year, models.Commission.month
        ).all()
        
        monthly_commissions = defaultdict(int)
        for comm in commissions:
            month_key = f"{comm.year}-{comm.month:02d}"
            # Só contar comissões que foram pagas
            if comm.is_paid:
                monthly_commissions[month_key] += comm.commission_amount_cents
        
        # Criar dados dos últimos 12 meses
        now = datetime.now()
        chart_data = []
        
        for i in range(11, -1, -1):
            month_date = now - timedelta(days=30 * i)
            month_key = month_date.strftime('%Y-%m')
            month_label = month_date.strftime('%b %Y')
            
            revenue_with_affiliates = monthly_revenue.get(month_key, 0)
            commissions_paid = monthly_commissions.get(month_key, 0)
            revenue_without_affiliates = revenue_with_affiliates + commissions_paid
            
            chart_data.append({
                'month': month_label,
                'month_key': month_key,
                'revenue_with_affiliates_cents': revenue_with_affiliates,
                'revenue_without_affiliates_cents': revenue_without_affiliates,
                'commissions_paid_cents': commissions_paid
            })
        
        return chart_data
    except Exception as e:
        logger.error(f'Erro ao calcular comparação de faturamento: {str(e)}')
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Erro ao calcular dados: {str(e)}'
        )

@router.get('/admin/settings', response_model=schemas.AffiliateSettingsResponse)
async def get_affiliate_settings(
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Obtém configurações do sistema de afiliados"""
    settings = db.query(models.AffiliateSettings).first()
    
    if not settings:
        # Criar configurações padrão
        settings = models.AffiliateSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return settings

@router.put('/admin/settings', response_model=schemas.AffiliateSettingsResponse)
async def update_affiliate_settings(
    settings_update: schemas.AffiliateSettingsUpdate,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Atualiza configurações do sistema de afiliados"""
    settings = db.query(models.AffiliateSettings).first()
    
    if not settings:
        settings = models.AffiliateSettings()
        db.add(settings)
    
    if settings_update.default_commission_percentage is not None:
        if settings_update.default_commission_percentage < 0 or settings_update.default_commission_percentage > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Percentagem de comissão deve estar entre 0 e 100'
            )
        settings.default_commission_percentage = settings_update.default_commission_percentage
    
    if settings_update.admin_email is not None:
        settings.admin_email = settings_update.admin_email
    
    if settings_update.is_system_active is not None:
        settings.is_system_active = settings_update.is_system_active
    
    if settings_update.min_payout_cents is not None:
        if settings_update.min_payout_cents < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Valor mínimo de pagamento não pode ser negativo'
            )
        settings.min_payout_cents = settings_update.min_payout_cents
    
    db.commit()
    db.refresh(settings)
    
    logger.info(f'Configurações de afiliados atualizadas por {admin.email}')
    
    return settings

@router.delete('/admin/{affiliate_id}/remove')
async def remove_affiliate(
    affiliate_id: UUID,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Remove o status de afiliado de um utilizador (apenas admin)"""
    affiliate = db.query(models.Affiliate).filter(models.Affiliate.id == affiliate_id).first()
    
    if not affiliate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Afiliado não encontrado'
        )
    
    # Remover status de afiliado do utilizador
    user = db.query(models.User).filter(models.User.id == affiliate.affiliate_id).first()
    if user:
        user.is_affiliate = False
        user.affiliate_code = None
    
    # Remover registo de afiliado
    db.delete(affiliate)
    db.commit()
    
    logger.info(f'Afiliado {affiliate.code} removido por {admin.email}')
    
    return {'message': 'Afiliado removido com sucesso'}

@router.post('/admin/{affiliate_id}/toggle-active')
async def toggle_affiliate_active(
    affiliate_id: UUID,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Ativa/desativa um afiliado"""
    affiliate = db.query(models.Affiliate).filter(models.Affiliate.id == affiliate_id).first()
    
    if not affiliate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Afiliado não encontrado'
        )
    
    affiliate.is_active = not affiliate.is_active
    db.commit()
    
    return {'message': f'Afiliado {"ativado" if affiliate.is_active else "desativado"}'}

@router.put('/admin/{affiliate_id}/commission')
async def update_affiliate_commission(
    affiliate_id: UUID,
    commission_percentage: float,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Atualiza percentagem de comissão de um afiliado"""
    if commission_percentage < 0 or commission_percentage > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Percentagem de comissão deve estar entre 0 e 100'
        )
    
    affiliate = db.query(models.Affiliate).filter(models.Affiliate.id == affiliate_id).first()
    
    if not affiliate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Afiliado não encontrado'
        )
    
    affiliate.commission_percentage = commission_percentage
    db.commit()
    db.refresh(affiliate)
    
    return affiliate

@router.post('/admin/calculate-monthly-commissions')
async def calculate_commissions_endpoint(
    month: Optional[int] = None,
    year: Optional[int] = None,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Calcula comissões mensais e envia emails (apenas admin)"""
    from datetime import datetime
    
    # Se não especificado, usar mês anterior
    if not month or not year:
        now = datetime.now()
        if now.month == 1:
            month = 12
            year = now.year - 1
        else:
            month = now.month - 1
            year = now.year
    
    # Calcular comissões
    calculate_monthly_commissions(db, month, year)
    
    # Obter configurações
    settings = db.query(models.AffiliateSettings).first()
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Configurações de afiliados não encontradas'
        )
    
    # Obter todas as comissões do mês
    commissions = db.query(models.Commission).filter(
        and_(
            models.Commission.month == month,
            models.Commission.year == year
        )
    ).all()
    
    # Enviar email para admin
    if settings.admin_email:
        await send_admin_monthly_report(settings.admin_email, commissions, month, year, db)
    
    # Enviar emails para afiliados
    for commission in commissions:
        affiliate = db.query(models.Affiliate).filter(models.Affiliate.id == commission.affiliate_id).first()
        if affiliate and affiliate.is_active:
            user = db.query(models.User).filter(models.User.id == affiliate.affiliate_id).first()
            if user:
                await send_affiliate_monthly_report(user.email, commission, month, year, db)
    
    return {
        'message': f'Comissões calculadas e emails enviados para {month}/{year}',
        'commissions_count': len(commissions)
    }

async def send_admin_monthly_report(
    admin_email: str,
    commissions: List[models.Commission],
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
    
    # Obter referências do mês
    referrals = db.query(models.Referral).filter(
        and_(
            models.Referral.affiliate_id == commission.affiliate_id,
            extract('month', models.Referral.conversion_date) == month,
            extract('year', models.Referral.conversion_date) == year,
            models.Referral.has_converted == True
        )
    ).all()
    
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

