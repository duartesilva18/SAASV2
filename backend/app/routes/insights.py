from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.requests import Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, date
from typing import List, Dict, Tuple, Optional
import random
from collections import defaultdict
from ..core.dependencies import get_db
from ..models import database as models
from .. import schemas
from .auth import get_current_user
from .transactions import process_automatic_recurring

router = APIRouter(prefix='/insights', tags=['insights'])

@router.get('/', response_model=schemas.ZenInsightsResponse)
async def get_zen_insights(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    header_lang = (request.headers.get('accept-language') or '').lower()
    user_lang = (getattr(current_user, 'language', None) or 'pt').lower()
    lang = header_lang or user_lang
    is_en = lang.startswith('en')
    def tr(pt: str, en: str) -> str:
        return en if is_en else pt

    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    
    process_automatic_recurring(db, workspace.id)
    
    thirty_days_ago = datetime.now() - timedelta(days=30)
    
    # Filtrar transações de seed (1 cêntimo) diretamente na query SQL - muito mais rápido
    transactions = db.query(models.Transaction).filter(
        models.Transaction.workspace_id == workspace.id,
        models.Transaction.transaction_date >= thirty_days_ago.date(),
        func.abs(models.Transaction.amount_cents) != 1
    ).all()
    
    categories = db.query(models.Category).filter(
        models.Category.workspace_id == workspace.id
    ).all()
    
    cat_map = {cat.id: cat for cat in categories}
    
    def calculate_totals(txs):
        income = 0
        expenses = 0
        vault = 0
        exp_by_cat = {}
        for t in txs:
            cat = cat_map.get(t.category_id)
            amount = abs(t.amount_cents / 100)
            if cat:
                if cat.type == 'income':
                    income += amount
                elif cat.vault_type != 'none':
                    # IMPORTANTE: amount_cents positivo = depósito (aumenta), negativo = resgate (diminui)
                    if t.amount_cents > 0:
                        # Depósito: adicionar valor
                        vault += t.amount_cents / 100
                    else:
                        # Resgate: subtrair valor absoluto
                        vault -= abs(t.amount_cents / 100)
                else:
                    expenses += amount
                    exp_by_cat[cat.name] = exp_by_cat.get(cat.name, 0) + amount
            else:
                expenses += amount
        return income, expenses, vault, exp_by_cat

    total_income, total_expenses, total_vault, expenses_by_cat = calculate_totals(transactions)
    
    now = datetime.now()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
    
    # Filtrar transações de seed (1 cêntimo) diretamente na query SQL - muito mais rápido
    this_month_transactions = db.query(models.Transaction).filter(
        models.Transaction.workspace_id == workspace.id,
        models.Transaction.transaction_date >= this_month_start.date(),
        func.abs(models.Transaction.amount_cents) != 1
    ).all()
    
    last_month_transactions = db.query(models.Transaction).filter(
        models.Transaction.workspace_id == workspace.id,
        models.Transaction.transaction_date >= last_month_start.date(),
        models.Transaction.transaction_date < this_month_start.date(),
        func.abs(models.Transaction.amount_cents) != 1
    ).all()
    
    this_income, this_expenses, this_vault, this_expenses_by_cat = calculate_totals(this_month_transactions)
    last_income, last_expenses, last_vault, last_expenses_by_cat = calculate_totals(last_month_transactions)
    
    insights = []
    health_score = 50 # Base neutra (era 65)
    
    # 1. Taxa de Poupança (Saving Rate) - A métrica mestre
    if this_income > 0:
        saving_rate = ((this_income - this_expenses) / this_income) * 100
        if saving_rate >= 50:
            health_score += 25 # Bónus de elite
            insights.append(schemas.InsightItem(
                type='success',
                title=tr('💎 MESTRE DA ABUNDÂNCIA', '💎 ABUNDANCE MASTER'),
                message=tr(
                    f"Uau! Estás a poupar {saving_rate:.0f}%. Este é o nível de elite da liberdade financeira.",
                    f"Wow! You're saving {saving_rate:.0f}%. This is the elite level of financial freedom."
                ),
                icon='sparkles'
            ))
        elif saving_rate >= 25:
            health_score += 15
            insights.append(schemas.InsightItem(
                type='success',
                title=tr('📈 RITMO POSITIVO', '📈 POSITIVE MOMENTUM'),
                message=tr(
                    f"Estás a reter {saving_rate:.0f}% do teu rendimento. Mantém este fôlego para construir o teu império.",
                    f"You're retaining {saving_rate:.0f}% of your income. Keep this momentum to build your empire."
                ),
                icon='trending-up'
            ))
        elif saving_rate >= 10:
            health_score += 5
            insights.append(schemas.InsightItem(
                type='info',
                title=tr('⚖️ EQUILÍBRIO JUSTO', '⚖️ FAIR BALANCE'),
                message=tr(
                    f"A tua taxa de poupança está em {saving_rate:.0f}%. Tenta reduzir despesas supérfluas.",
                    f"Your savings rate is {saving_rate:.0f}%. Try reducing non-essential spending."
                ),
                icon='compass'
            ))
        elif saving_rate >= 0:
            health_score -= 5 # Poupança medíocre tira pontos
            insights.append(schemas.InsightItem(
                type='warning',
                title=tr('🐌 RITMO LENTO', '🐌 SLOW PACE'),
                message=tr(
                    f"A tua taxa de poupança ({saving_rate:.0f}%) é baixa. Estás muito próximo do limite de segurança.",
                    f"Your savings rate ({saving_rate:.0f}%) is low. You're very close to the safety threshold."
                ),
                icon='activity'
            ))
        else:
            health_score -= 45 # Penalização severa para défice
            insights.append(schemas.InsightItem(
                type='danger',
                title=tr('🚨 DÉFICE CRÍTICO', '🚨 CRITICAL DEFICIT'),
                message=tr(
                    f"ALERTA: Estás a gastar {abs(saving_rate):.0f}% acima do que ganhas. O teu ecossistema está em risco.",
                    f"ALERT: You're spending {abs(saving_rate):.0f}% more than you earn. Your ecosystem is at risk."
                ),
                icon='alert-circle'
            ))
    elif this_expenses > 0:
        health_score -= 40
        insights.append(schemas.InsightItem(
            type='warning',
            title=tr('⚠️ CONSUMO SEM RECEITA', '⚠️ SPENDING WITHOUT INCOME'),
            message=tr(
                "Detetámos gastos mas ainda não registaste receitas este mês.",
                "We detected spending, but you haven't recorded any income this month."
            ),
            icon='alert-circle'
        ))

    # 2. Consistência de Investimento (Cofre)
    if this_vault > 0:
        investment_ratio = (this_vault / this_income * 100) if this_income > 0 else 10
        # Só ganha pontos reais se investir mais de 10%
        if investment_ratio >= 20:
            health_score += 20
        elif investment_ratio >= 10:
            health_score += 10
        else:
            health_score += 2
            
        if last_vault > 0 and this_vault >= last_vault:
            insights.append(schemas.InsightItem(
                type='success',
                title=tr('🛡️ ESCUDO ZEN', '🛡️ ZEN SHIELD'),
                message=tr(
                    "A tua disciplina de investimento está impecável.",
                    "Your investing discipline is impeccable."
                ),
                icon='shield-check'
            ))
    elif this_income > 0:
        health_score -= 20 # Punição severa por não investir
        insights.append(schemas.InsightItem(
            type='info',
            title=tr('🌱 SEMEIA O FUTURO', '🌱 PLANT THE FUTURE'),
            message=tr(
                "Ainda não reforçaste o teu Cofre este mês.",
                "You haven't contributed to your Vault this month."
            ),
            icon='target'
        ))

    # 3. Análise de Limites de Categorias
    categories_near_limit = []
    for cat in categories:
        if cat.type == 'expense' and cat.monthly_limit_cents > 0:
            spent = this_expenses_by_cat.get(cat.name, 0)
            limit = cat.monthly_limit_cents / 100
            if spent > limit:
                categories_near_limit.append((cat.name, (spent/limit)*100, True))
            elif spent >= limit * 0.8:
                categories_near_limit.append((cat.name, (spent/limit)*100, False))

    if categories_near_limit:
        critical_violations = [c for c in categories_near_limit if c[2]]
        if critical_violations:
            health_score -= (25 * len(critical_violations)) # Muito punitivo
            top = max(critical_violations, key=lambda x: x[1])
            insights.append(schemas.InsightItem(
                type='danger',
                title=tr('💀 LIMITE EXCEDIDO', '💀 LIMIT EXCEEDED'),
                message=tr(
                    f"A categoria {top[0]} ultrapassou o teto planeado ({top[1]:.0f}%).",
                    f"The category {top[0]} exceeded the planned cap ({top[1]:.0f}%)."
                ),
                icon='zap'
            ))
        else:
            health_score -= 15
            top = max(categories_near_limit, key=lambda x: x[1])
            insights.append(schemas.InsightItem(
                type='warning',
                title=tr('⚠️ ZONA AMARELA', '⚠️ YELLOW ZONE'),
                message=tr(
                    f"Atenção a {top[0]} ({top[1]:.0f}% do limite).",
                    f"Watch out for {top[0]} ({top[1]:.0f}% of the limit)."
                ),
                icon='zap'
            ))

    # 4. Detetção de Anomalias (Spikes)
    if this_expenses > 0 and len(this_month_transactions) > 0:
        avg_trans = this_expenses / len(this_month_transactions)
        big_spenders = [t for t in this_month_transactions if (t.amount_cents/100) > avg_trans * 4 and t.amount_cents > 10000]
        if big_spenders:
            health_score -= 20 # Penalização pesada para impulsividade
            insights.append(schemas.InsightItem(
                type='info',
                title=tr('⚡ PICO DE CONSUMO', '⚡ SPENDING SPIKE'),
                message=tr(
                    f"Detetámos um gasto singular elevado em '{big_spenders[0].description}'.",
                    f"We detected a high one-off expense: '{big_spenders[0].description}'."
                ),
                icon='activity'
            ))

    # 5. Pequenos Gastos (Ghost Spending)
    small_expenses = [t for t in this_month_transactions if 0 < t.amount_cents < 1000]
    if len(small_expenses) > 6: # Limite de tolerância menor (era 8)
        health_score -= 15
        insights.append(schemas.InsightItem(
            type='info',
            title=tr('👻 GASTOS FANTASMA', '👻 GHOST SPENDING'),
            message=tr(
                f"Fizeste {len(small_expenses)} pequenas compras. Estas fugas silenciosas destroem a tua paz.",
                f"You made {len(small_expenses)} small purchases. These silent leaks destroy your peace."
            ),
            icon='ghost'
        ))

    # 6. Análise de Tendências Mensais
    income_trend = 'stable'
    expense_trend = 'stable'
    if last_income > 0:
        income_change = ((this_income - last_income) / last_income) * 100
        if income_change > 10:
            income_trend = 'up'
            health_score += 5
        elif income_change < -10:
            income_trend = 'down'
            health_score -= 10
    
    if last_expenses > 0:
        expense_change = ((this_expenses - last_expenses) / last_expenses) * 100
        if expense_change < -10:
            expense_trend = 'down'
            health_score += 10
        elif expense_change > 20:
            expense_trend = 'up'
            health_score -= 15
    
    # 7. Consistência de Registos
    days_with_transactions = len(set(t.transaction_date for t in this_month_transactions))
    days_in_month = now.day
    consistency_rate = (days_with_transactions / days_in_month) * 100 if days_in_month > 0 else 0
    
    if consistency_rate >= 80:
        health_score += 10
        if len(insights) < 3:
            insights.append(schemas.InsightItem(
                type='success',
                title=tr('📊 DISCIPLINA EXEMPLAR', '📊 EXEMPLARY DISCIPLINE'),
                message=tr(
                    f"Registas transações em {consistency_rate:.0f}% dos dias. Esta consistência é o segredo do sucesso.",
                    f"You record transactions on {consistency_rate:.0f}% of days. This consistency is the secret to success."
                ),
                icon='activity',
                value=consistency_rate,
                trend='up'
            ))
    elif consistency_rate < 40:
        health_score -= 10
    
    # 8. Análise de Diversificação de Gastos
    if len(expenses_by_cat) > 0:
        top_category_share = max(expenses_by_cat.values()) / this_expenses * 100 if this_expenses > 0 else 0
        if top_category_share > 50:
            health_score -= 10
            if len(insights) < 3:
                top_cat = max(expenses_by_cat.items(), key=lambda x: x[1])[0]
                insights.append(schemas.InsightItem(
                    type='warning',
                    title=tr('🎯 CONCENTRAÇÃO ALTA', '🎯 HIGH CONCENTRATION'),
                    message=tr(
                        f"{top_cat} representa {top_category_share:.0f}% dos teus gastos. Considera diversificar.",
                        f"{top_cat} represents {top_category_share:.0f}% of your spending. Consider diversifying."
                    ),
                    icon='target',
                    value=top_category_share,
                    trend='down'
                ))
    
    # 9. Eficiência de Poupança (Vault vs Expenses)
    if this_expenses > 0 and this_vault > 0:
        vault_efficiency = (this_vault / this_expenses) * 100
        if vault_efficiency >= 30:
            health_score += 15
        elif vault_efficiency >= 15:
            health_score += 5
    
    # 10. PREVISÕES AVANÇADAS DA IA - VERSÃO MELHORADA
    
    # Inicializar variáveis de previsão
    months_ahead = []
    categories_at_risk = []
    avg_monthly_income = 0
    avg_monthly_expenses = 0
    avg_monthly_vault = 0
    prediction_confidence = 0
    
    # Obter histórico mais longo para análises preditivas (últimos 12 meses para melhor precisão)
    twelve_months_ago = now - timedelta(days=365)
    historical_transactions = db.query(models.Transaction).filter(
        models.Transaction.workspace_id == workspace.id,
        models.Transaction.transaction_date >= twelve_months_ago.date(),
        func.abs(models.Transaction.amount_cents) != 1
    ).order_by(models.Transaction.transaction_date.asc()).all()
    
    # Obter transações recorrentes para incluir nas previsões
    recurring_transactions = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.workspace_id == workspace.id,
        models.RecurringTransaction.is_active == True
    ).all()
    
    # Calcular médias mensais históricas com detalhamento por categoria
    monthly_data = defaultdict(lambda: {'income': 0, 'expenses': 0, 'vault': 0, 'count': 0, 'by_category': defaultdict(float)})
    for t in historical_transactions:
        month_key = t.transaction_date.strftime('%Y-%m')
        cat = cat_map.get(t.category_id)
        amount = abs(t.amount_cents / 100)
        if cat:
            if cat.type == 'income':
                monthly_data[month_key]['income'] += amount
            elif cat.vault_type != 'none':
                monthly_data[month_key]['vault'] += amount
            else:
                monthly_data[month_key]['expenses'] += amount
                monthly_data[month_key]['by_category'][cat.name] += amount
        else:
            monthly_data[month_key]['expenses'] += amount
        monthly_data[month_key]['count'] += 1
    
    # Calcular médias históricas com média móvel ponderada (meses recentes têm mais peso)
    if len(monthly_data) > 0:
        sorted_months = sorted(monthly_data.keys())
        total_weight = 0
        weighted_income = 0
        weighted_expenses = 0
        weighted_vault = 0
        
        # Média móvel ponderada: meses mais recentes têm peso maior
        for i, month_key in enumerate(sorted_months):
            # Peso exponencial: último mês = 1.0, penúltimo = 0.8, etc.
            weight = 0.8 ** (len(sorted_months) - 1 - i)
            total_weight += weight
            weighted_income += monthly_data[month_key]['income'] * weight
            weighted_expenses += monthly_data[month_key]['expenses'] * weight
            weighted_vault += monthly_data[month_key]['vault'] * weight
        
        avg_monthly_income = weighted_income / total_weight if total_weight > 0 else 0
        avg_monthly_expenses = weighted_expenses / total_weight if total_weight > 0 else 0
        avg_monthly_vault = weighted_vault / total_weight if total_weight > 0 else 0
        
        # Calcular confiança baseada na quantidade de dados
        prediction_confidence = min(100, (len(monthly_data) / 6) * 100)  # Máximo 100% com 6+ meses
        
        # Regressão linear simples para prever tendências
        def calculate_trend(values_list):
            """Calcula a tendência usando regressão linear simples"""
            if len(values_list) < 2:
                return 0
            n = len(values_list)
            x = list(range(n))
            y = values_list
            x_mean = sum(x) / n
            y_mean = sum(y) / n
            numerator = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(n))
            denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
            if denominator == 0:
                return 0
            slope = numerator / denominator
            return slope
        
        # Calcular tendências mensais
        income_trend_slope = calculate_trend([monthly_data[m]['income'] for m in sorted_months])
        expense_trend_slope = calculate_trend([monthly_data[m]['expenses'] for m in sorted_months])
        
        # Calcular volatilidade (desvio padrão)
        def calculate_volatility(values_list):
            """Calcula a volatilidade (desvio padrão)"""
            if len(values_list) < 2:
                return 0
            mean = sum(values_list) / len(values_list)
            variance = sum((x - mean) ** 2 for x in values_list) / len(values_list)
            return variance ** 0.5
        
        income_volatility = calculate_volatility([monthly_data[m]['income'] for m in sorted_months])
        expense_volatility = calculate_volatility([monthly_data[m]['expenses'] for m in sorted_months])
        
        # Inicializar variáveis para uso posterior
        category_monthly_avg = defaultdict(float)
        category_monthly_count = defaultdict(int)
        
        # Projeção de saldo futuro (próximos 3 meses) - MELHORADA
        current_balance = this_income - this_expenses  # Saldo líquido do mês atual
        projected_balance = current_balance
        months_ahead = []
        
        # Incluir transações recorrentes nas previsões
        recurring_monthly_total = sum(abs(r.amount_cents) / 100 for r in recurring_transactions)
        
        for i in range(1, 4):
            next_month = now + timedelta(days=30 * i)
            next_month_date = now.replace(day=1) + timedelta(days=32 * i)
            next_month_date = next_month_date.replace(day=1)
            
            # Calcular receitas projetadas usando regressão linear + média ponderada
            # Tendência baseada na inclinação da regressão
            months_from_now = i
            trend_factor_income = (income_trend_slope * months_from_now) / avg_monthly_income if avg_monthly_income > 0 else 0
            trend_factor_expense = (expense_trend_slope * months_from_now) / avg_monthly_expenses if avg_monthly_expenses > 0 else 0
            
            # Projeção = média ponderada + tendência + volatilidade (margem de segurança)
            projected_income = avg_monthly_income * (1 + trend_factor_income)
            # Adicionar margem de segurança baseada na volatilidade (10% da volatilidade)
            projected_income = max(0, projected_income + (income_volatility * 0.1))
            
            # Para despesas, incluir transações recorrentes conhecidas
            projected_expenses = avg_monthly_expenses * (1 + trend_factor_expense)
            # Adicionar despesas recorrentes conhecidas
            projected_expenses += recurring_monthly_total
            # Adicionar margem de segurança baseada na volatilidade
            projected_expenses = projected_expenses + (expense_volatility * 0.15)  # 15% para despesas (mais conservador)
            
            # Ajustar baseado nas tendências qualitativas também
            if income_trend == 'up':
                projected_income *= 1.02  # Bónus de 2% se tendência é crescente
            elif income_trend == 'down':
                projected_income *= 0.98  # Redução de 2% se tendência é decrescente
            
            if expense_trend == 'up':
                projected_expenses *= 1.03  # Aumento de 3% se tendência é crescente
            elif expense_trend == 'down':
                projected_expenses *= 0.97  # Redução de 3% se tendência é decrescente
            
            projected_balance += (projected_income - projected_expenses)
            
            months_ahead.append({
                'month': next_month_date.strftime('%B'),
                'balance': projected_balance,
                'income': projected_income,
                'expenses': projected_expenses,
                'confidence': max(50, prediction_confidence - (i * 5))  # Confiança diminui com distância temporal
            })
        
        # Previsão de risco de exceder limites (próximo mês) - MELHORADA
        # Calcular projeção do próximo mês com maior precisão
        trend_factor_next = (expense_trend_slope * 1) / avg_monthly_expenses if avg_monthly_expenses > 0 else 0
        next_month_projected_expenses = avg_monthly_expenses * (1 + trend_factor_next) + recurring_monthly_total
        if expense_trend == 'up':
            next_month_projected_expenses *= 1.03
        elif expense_trend == 'down':
            next_month_projected_expenses *= 0.97
        next_month_projected_expenses += (expense_volatility * 0.15)
        
        categories_at_risk = []
        # Calcular médias históricas por categoria (se ainda não calculado)
        if not category_monthly_avg:
            for month_key in sorted_months:
                for cat_name, amount in monthly_data[month_key]['by_category'].items():
                    category_monthly_avg[cat_name] += amount
                    category_monthly_count[cat_name] += 1
        
        for cat_name in category_monthly_avg:
            if category_monthly_count[cat_name] > 0:
                category_monthly_avg[cat_name] /= category_monthly_count[cat_name]
        
        for cat in categories:
            if cat.type == 'expense' and cat.monthly_limit_cents > 0:
                limit = cat.monthly_limit_cents / 100
                
                # Usar média histórica da categoria se disponível, senão usar proporção atual
                if cat.name in category_monthly_avg:
                    cat_historical_avg = category_monthly_avg[cat.name]
                    # Calcular tendência da categoria
                    cat_values = [monthly_data[m]['by_category'].get(cat.name, 0) for m in sorted_months]
                    cat_trend_slope = calculate_trend(cat_values)
                    cat_volatility = calculate_volatility(cat_values)
                    
                    # Projeção da categoria = média histórica + tendência + volatilidade
                    projected_cat_expense = cat_historical_avg
                    if cat_historical_avg > 0:
                        trend_factor_cat = (cat_trend_slope * 1) / cat_historical_avg
                        projected_cat_expense = cat_historical_avg * (1 + trend_factor_cat)
                    projected_cat_expense += (cat_volatility * 0.2)  # Margem de segurança de 20%
                else:
                    # Fallback: usar proporção atual
                    cat_avg = this_expenses_by_cat.get(cat.name, 0)
                    if cat_avg > 0:
                        cat_ratio = cat_avg / this_expenses if this_expenses > 0 else 0
                        projected_cat_expense = next_month_projected_expenses * cat_ratio
                    else:
                        continue
                
                if projected_cat_expense > limit * 0.85:  # Reduzido de 0.9 para 0.85 para detetar mais cedo
                    risk_level = (projected_cat_expense / limit) * 100 if limit > 0 else 0
                    categories_at_risk.append((cat.name, risk_level, projected_cat_expense, limit))
        
        # Adicionar insights preditivos
        if projected_balance < 0 and len(insights) < 3:
            months_until_negative = 0
            temp_balance = current_balance
            for i, month_data in enumerate(months_ahead):
                temp_balance = month_data['balance']
                if temp_balance < 0:
                    months_until_negative = i + 1
                    break
            
            if months_until_negative > 0:
                insights.append(schemas.InsightItem(
                    type='danger',
                    title=tr('🔮 PREVISÃO CRÍTICA', '🔮 CRITICAL FORECAST'),
                    message=tr(
                        f"Se mantiveres este ritmo, o teu saldo ficará negativo em {months_until_negative} mês(es). Ação urgente necessária.",
                        f"If you keep this pace, your balance will turn negative in {months_until_negative} month(s). Urgent action required."
                    ),
                    icon='trending-down',
                    value=months_until_negative,
                    trend='down'
                ))
            else:
                insights.append(schemas.InsightItem(
                    type='warning',
                    title=tr('⚠️ PROJEÇÃO NEGATIVA', '⚠️ NEGATIVE PROJECTION'),
                    message=tr(
                        "Projeção indica saldo negativo nos próximos 3 meses. Reavalia os teus gastos.",
                        "Projection indicates a negative balance in the next 3 months. Reevaluate your spending."
                    ),
                    icon='alert-triangle',
                    trend='down'
                ))
        
        # Previsão de risco de limites
        if categories_at_risk and len(insights) < 3:
            top_risk = max(categories_at_risk, key=lambda x: x[1])
            if top_risk[1] >= 100:
                insights.append(schemas.InsightItem(
                    type='danger',
                    title=tr('🎯 RISCO DE EXCEDER LIMITE', '🎯 RISK OF EXCEEDING LIMIT'),
                    message=tr(
                        f"{top_risk[0]} pode exceder o limite ({top_risk[3]:.0f}€) no próximo mês. Projeção: {top_risk[2]:.0f}€.",
                        f"{top_risk[0]} may exceed the limit (€{top_risk[3]:.0f}) next month. Projection: €{top_risk[2]:.0f}."
                    ),
                    icon='target',
                    value=top_risk[1],
                    trend='up'
                ))
            elif top_risk[1] >= 90:
                insights.append(schemas.InsightItem(
                    type='warning',
                    title=tr('⚠️ ATENÇÃO: LIMITE PRÓXIMO', '⚠️ ATTENTION: LIMIT NEAR'),
                    message=tr(
                        f"{top_risk[0]} está a aproximar-se do limite ({top_risk[3]:.0f}€). Projeção: {top_risk[2]:.0f}€.",
                        f"{top_risk[0]} is approaching the limit (€{top_risk[3]:.0f}). Projection: €{top_risk[2]:.0f}."
                    ),
                    icon='alert-circle',
                    value=top_risk[1],
                    trend='up'
                ))
        
        # Previsão de metas financeiras (se houver investimento) - MELHORADA
        if avg_monthly_vault > 0 and this_vault > 0:
            # Calcular tempo para atingir metas comuns
            current_vault_total = sum(d['vault'] for d in monthly_data.values())
            # Usar média ponderada para projeção de contribuições futuras
            vault_trend_slope = calculate_trend([monthly_data[m]['vault'] for m in sorted_months])
            monthly_vault_contribution = avg_monthly_vault
            
            # Ajustar contribuição baseada na tendência
            if vault_trend_slope > 0:
                monthly_vault_contribution *= 1.05  # Aumento de 5% se tendência positiva
            elif vault_trend_slope < 0:
                monthly_vault_contribution *= 0.95  # Redução de 5% se tendência negativa
            
            # Meta: 6 meses de despesas (fundo de emergência)
            emergency_goal = avg_monthly_expenses * 6
            if current_vault_total < emergency_goal and monthly_vault_contribution > 0:
                months_to_goal = (emergency_goal - current_vault_total) / monthly_vault_contribution
                if months_to_goal <= 12 and len(insights) < 3:
                    insights.append(schemas.InsightItem(
                        type='success',
                        title=tr('🎯 META EM VISTA', '🎯 GOAL IN SIGHT'),
                        message=tr(
                            f"Com este ritmo, atinges 6 meses de fundo de emergência em {months_to_goal:.0f} mês(es). Mantém o foco!",
                            f"At this pace, you'll reach 6 months of emergency fund in {months_to_goal:.0f} month(s). Keep focused!"
                        ),
                        icon='target',
                        value=months_to_goal,
                        trend='up'
                    ))
            
            # Meta adicional: 12 meses de despesas (fundo de emergência completo)
            full_emergency_goal = avg_monthly_expenses * 12
            if current_vault_total < full_emergency_goal and monthly_vault_contribution > 0:
                months_to_full_goal = (full_emergency_goal - current_vault_total) / monthly_vault_contribution
                if 12 < months_to_full_goal <= 24 and len(insights) < 3:
                    insights.append(schemas.InsightItem(
                        type='info',
                        title=tr('💎 OBJETIVO DE LONGO PRAZO', '💎 LONG-TERM GOAL'),
                        message=tr(
                            f"A caminho de 12 meses de fundo de emergência em {months_to_full_goal:.0f} mês(es).",
                            f"On track to 12 months of emergency fund in {months_to_full_goal:.0f} month(s)."
                        ),
                        icon='target',
                        value=months_to_full_goal,
                        trend='up'
                    ))
        
        # Análise de padrões sazonais
        if len(monthly_data) >= 3:
            recent_months = sorted(monthly_data.keys())[-3:]
            recent_avg_expenses = sum(monthly_data[m]['expenses'] for m in recent_months) / len(recent_months)
            older_avg_expenses = sum(monthly_data[m]['expenses'] for m in monthly_data.keys() if m not in recent_months) / (len(monthly_data) - len(recent_months)) if len(monthly_data) > len(recent_months) else recent_avg_expenses
            
            seasonal_change = ((recent_avg_expenses - older_avg_expenses) / older_avg_expenses * 100) if older_avg_expenses > 0 else 0
            if abs(seasonal_change) > 15 and len(insights) < 3:
                if seasonal_change > 0:
                    insights.append(schemas.InsightItem(
                        type='warning',
                        title=tr('📊 PADRÃO SAZONAL DETETADO', '📊 SEASONAL PATTERN DETECTED'),
                        message=tr(
                            f"Os teus gastos aumentaram {seasonal_change:.0f}% nos últimos meses. Pode ser um padrão sazonal.",
                            f"Your spending increased {seasonal_change:.0f}% in recent months. This may be a seasonal pattern."
                        ),
                        icon='trending-up',
                        value=seasonal_change,
                        trend='up'
                    ))
                else:
                    insights.append(schemas.InsightItem(
                        type='success',
                        title=tr('📉 TENDÊNCIA POSITIVA', '📉 POSITIVE TREND'),
                        message=tr(
                            f"Os teus gastos diminuíram {abs(seasonal_change):.0f}% nos últimos meses. Excelente progresso!",
                            f"Your spending decreased {abs(seasonal_change):.0f}% in recent months. Excellent progress!"
                        ),
                        icon='trending-down',
                        value=abs(seasonal_change),
                        trend='down'
                    ))
    
    # Previsão de Runway (quando não há dados históricos suficientes)
    monthly_burn = this_expenses
    if monthly_burn > 0 and this_income > 0:
        net_monthly = this_income - this_expenses
        if net_monthly < 0 and len(insights) < 3 and len(monthly_data) == 0:
            insights.append(schemas.InsightItem(
                type='danger',
                title=tr('⏳ RUNWAY LIMITADO', '⏳ LIMITED RUNWAY'),
                message=tr(
                    "Com este ritmo de gastos, o teu capital está a diminuir rapidamente.",
                    "At this spending pace, your capital is shrinking quickly."
                ),
                icon='alert-circle',
                trend='down'
            ))
    
    # Ajuste final do score e fallbacks
    health_score = max(0, min(100, health_score))
    
    # Adicionar valores e tendências aos insights existentes
    for insight in insights:
        if insight.type == 'success' and 'poupar' in insight.message.lower():
            saving_rate_val = ((this_income - this_expenses) / this_income * 100) if this_income > 0 else 0
            insight.value = saving_rate_val
            insight.trend = 'up' if saving_rate_val >= 25 else 'stable'
        elif insight.type == 'danger' and 'défice' in insight.message.lower():
            saving_rate_val = ((this_income - this_expenses) / this_income * 100) if this_income > 0 else 0
            insight.value = abs(saving_rate_val)
            insight.trend = 'down'
    
    fallbacks = [
        schemas.InsightItem(
            type='info',
            title=tr('💎 SABEDORIA ZEN', '💎 ZEN WISDOM'),
            message=tr(
                'O dinheiro é um bom servo, mas um mestre perigoso. Mantém a clareza.',
                'Money is a good servant, but a dangerous master. Keep clarity.'
            ),
            icon='lightbulb'
        ),
        schemas.InsightItem(
            type='info',
            title=tr('🧘‍♂️ FOCO NO AGORA', '🧘‍♂️ FOCUS ON NOW'),
            message=tr(
                'Regista as tuas despesas no momento em que acontecem para manter o controlo.',
                'Record your expenses as they happen to stay in control.'
            ),
            icon='sparkles'
        ),
        schemas.InsightItem(
            type='info',
            title=tr('🚀 EVOLUÇÃO', '🚀 EVOLUTION'),
            message=tr(
                'O teu futuro financeiro é construído com as decisões que tomas hoje.',
                'Your financial future is built by the decisions you make today.'
            ),
            icon='trending-up'
        )
    ]
    
    for fb in fallbacks:
        if len(insights) >= 3:
            break
        insights.append(fb)
    
    # Calcular métricas adicionais
    metrics = {
        'saving_rate': ((this_income - this_expenses) / this_income * 100) if this_income > 0 else 0,
        'investment_ratio': (this_vault / this_income * 100) if this_income > 0 else 0,
        'consistency_rate': consistency_rate,
        'income_change': ((this_income - last_income) / last_income * 100) if last_income > 0 else 0,
        'expense_change': ((this_expenses - last_expenses) / last_expenses * 100) if last_expenses > 0 else 0,
        'total_transactions': len(this_month_transactions),
        'days_active': days_with_transactions
    }
    
    trends = {
        'income': income_trend,
        'expenses': expense_trend,
        'saving_rate': 'up' if metrics['saving_rate'] > 0 else 'down' if metrics['saving_rate'] < 0 else 'stable'
    }
    
    # Preparar previsões para retorno - MELHORADO
    predictions = {}
    if len(monthly_data) > 0 and months_ahead:
        # Calcular métricas adicionais de previsão
        avg_confidence = sum(m.get('confidence', prediction_confidence) for m in months_ahead) / len(months_ahead) if months_ahead else prediction_confidence
        
        # Previsão de cash flow diário (próximos 7 dias)
        daily_cashflow = []
        today = now.date()
        avg_daily_income = avg_monthly_income / 30
        avg_daily_expenses = avg_monthly_expenses / 30
        
        # Incluir transações recorrentes conhecidas nos próximos 7 dias
        for day_offset in range(1, 8):
            day_date = today + timedelta(days=day_offset)
            day_income = avg_daily_income
            day_expenses = avg_daily_expenses
            
            # Verificar se há transações recorrentes neste dia
            for rec in recurring_transactions:
                if rec.day_of_month == day_date.day:
                    day_expenses += abs(rec.amount_cents) / 100
            
            daily_cashflow.append({
                'date': day_date.isoformat(),
                'day_name': day_date.strftime('%A'),
                'projected_income': day_income,
                'projected_expenses': day_expenses,
                'net': day_income - day_expenses
            })
        
        # Análise de correlações entre categorias (detetar padrões)
        category_correlations = []
        if len(sorted_months) >= 3 and category_monthly_avg:
            top_categories = sorted(category_monthly_avg.items(), key=lambda x: x[1], reverse=True)[:5]
            for i, (cat1_name, _) in enumerate(top_categories):
                for cat2_name, _ in top_categories[i+1:]:
                    cat1_values = [monthly_data[m]['by_category'].get(cat1_name, 0) for m in sorted_months]
                    cat2_values = [monthly_data[m]['by_category'].get(cat2_name, 0) for m in sorted_months]
                    
                    # Calcular correlação simples (coeficiente de correlação de Pearson simplificado)
                    if len(cat1_values) == len(cat2_values) and len(cat1_values) > 1:
                        mean1 = sum(cat1_values) / len(cat1_values)
                        mean2 = sum(cat2_values) / len(cat2_values)
                        numerator = sum((cat1_values[j] - mean1) * (cat2_values[j] - mean2) for j in range(len(cat1_values)))
                        denom1 = sum((cat1_values[j] - mean1) ** 2 for j in range(len(cat1_values)))
                        denom2 = sum((cat2_values[j] - mean2) ** 2 for j in range(len(cat2_values)))
                        if denom1 > 0 and denom2 > 0:
                            correlation = numerator / ((denom1 * denom2) ** 0.5)
                            if abs(correlation) > 0.7:  # Correlação forte
                                category_correlations.append({
                                    'category1': cat1_name,
                                    'category2': cat2_name,
                                    'correlation': correlation
                                })
        
        predictions = {
            'projected_balance_3months': months_ahead[-1]['balance'] if months_ahead else None,
            'projected_monthly_income': avg_monthly_income,
            'projected_monthly_expenses': avg_monthly_expenses,
            'months_ahead': months_ahead,
            'categories_at_risk': [
                {'name': c[0], 'risk_percent': c[1], 'projected': c[2], 'limit': c[3]} 
                for c in categories_at_risk
            ],
            'confidence': avg_confidence,
            'volatility': {
                'income': income_volatility,
                'expenses': expense_volatility
            },
            'trends': {
                'income_slope': income_trend_slope,
                'expense_slope': expense_trend_slope
            },
            'daily_cashflow': daily_cashflow,
            'category_correlations': category_correlations[:3]  # Top 3 correlações
        }
        
    summary = tr(
        'O teu ecossistema financeiro está em constante evolução.',
        'Your financial ecosystem is constantly evolving.'
    )
    if health_score < 40:
        summary = tr(
            '⚠️ CRÍTICO: O teu equilíbrio financeiro necessita de intervenção urgente.',
            '⚠️ CRITICAL: Your financial balance needs urgent intervention.'
        )
    elif health_score < 60:
        summary = tr(
            '⚠️ ATENÇÃO: Estás a consumir capital. Reavalia as tuas prioridades.',
            '⚠️ ATTENTION: You are consuming capital. Reevaluate your priorities.'
        )
    elif health_score > 90:
        summary = tr(
            '✨ EXCELENTE: Estás em plena harmonia e domínio do teu capital.',
            '✨ EXCELLENT: You are in full harmony and mastery of your capital.'
        )
    elif health_score > 75:
        summary = tr(
            '🧘‍♂️ ZEN: O teu ecossistema segue um trilho saudável e equilibrado.',
            '🧘‍♂️ ZEN: Your ecosystem is on a healthy and balanced path.'
        )
    elif health_score > 60:
        summary = tr(
            '⚖️ ESTÁVEL: Manténs o controlo, mas há margem para otimização.',
            '⚖️ STABLE: You are in control, but there is room for optimization.'
        )
        
    return schemas.ZenInsightsResponse(
        insights=insights[:3],
        summary=summary,
        health_score=health_score,
        metrics=metrics,
        trends=trends,
        predictions=predictions if predictions else None
    )

@router.get('/composite', response_model=schemas.AnalyticsCompositeResponse)
async def get_analytics_composite(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Usar workspace cacheado se disponível
    workspace = getattr(request.state, 'workspace', None)
    if not workspace:
        workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
        if not workspace:
            raise HTTPException(status_code=404, detail='Workspace not found')
        request.state.workspace = workspace
    
    process_automatic_recurring(db, workspace.id)
    
    zen_insights = await get_zen_insights(request, db, current_user)
    
    # Filtrar transações de seed (1 cêntimo) diretamente na query SQL - muito mais rápido
    # Usar eager loading para evitar N+1 queries
    from sqlalchemy.orm import joinedload
    transactions = db.query(models.Transaction).options(
        joinedload(models.Transaction.category)
    ).filter(
        models.Transaction.workspace_id == workspace.id,
        func.abs(models.Transaction.amount_cents) != 1
    ).order_by(models.Transaction.transaction_date.desc()).all()
    
    categories = db.query(models.Category).filter(
        models.Category.workspace_id == workspace.id
    ).all()
    
    recurring = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.workspace_id == workspace.id
    ).all()
    
    return schemas.AnalyticsCompositeResponse(
        transactions=transactions,
        categories=categories,
        insights=zen_insights,
        recurring=recurring,
        currency=current_user.currency
    )

