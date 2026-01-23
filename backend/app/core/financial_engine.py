"""
Financial Engine - Fonte única de verdade para cálculos financeiros
"""
from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import date, datetime
from ..models import database as models


@dataclass
class FinancialSnapshot:
    """Snapshot financeiro completo calculado uma vez"""
    income: float
    expenses: float
    vault_total: float
    vault_emergency: float
    vault_investment: float
    available_cash: float
    net_worth: float
    saving_rate: float
    cumulative_balance: float
    
    # Métricas adicionais
    period_start: Optional[date]
    period_end: Optional[date]
    transaction_count: int
    category_totals: Dict[str, float]  # {category_id: total}


class FinancialEngine:
    """Motor financeiro único - fonte de verdade"""
    
    @staticmethod
    def calculate_snapshot(
        transactions: List[models.Transaction],
        categories: List[models.Category],
        workspace: Optional[models.Workspace] = None,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None
    ) -> FinancialSnapshot:
        """
        Calcula snapshot financeiro completo.
        ÚNICA fonte de verdade para todos os cálculos.
        """
        # Filtrar por período se fornecido
        if period_start or period_end:
            transactions = [
                t for t in transactions
                if (not period_start or t.transaction_date >= period_start)
                and (not period_end or t.transaction_date <= period_end)
            ]
        
        # Criar mapas de categorias
        cat_map = {c.id: c for c in categories}
        
        # Inicializar totais
        income = 0.0
        expenses = 0.0
        vault_emergency = 0.0
        vault_investment = 0.0
        cumulative_balance = 0.0
        category_totals: Dict[str, float] = {}
        
        # Processar transações
        for t in transactions:
            cat = cat_map.get(t.category_id)
            if not cat:
                # Categoria não encontrada, tratar como despesa
                expenses += abs(t.amount_cents / 100)
                cumulative_balance += t.amount_cents / 100
                continue
            
            # Verificar se é transação do cofre
            is_vault = cat.vault_type != 'none'
            
            if is_vault:
                # Vault: positivo = depósito, negativo = resgate
                amount = t.amount_cents / 100
                if cat.vault_type == 'emergency':
                    vault_emergency += amount
                elif cat.vault_type == 'investment':
                    vault_investment += amount
                # Vault não afeta income/expenses nem cumulative_balance
            else:
                # Receitas e despesas regulares
                amount = t.amount_cents / 100
                
                # Acumular por categoria (para limites)
                cat_id_str = str(cat.id)
                if cat_id_str not in category_totals:
                    category_totals[cat_id_str] = 0.0
                category_totals[cat_id_str] += abs(amount)
                
                if cat.type == 'income':
                    income += amount  # Já é positivo
                    cumulative_balance += amount
                elif cat.type == 'expense':
                    expenses += abs(amount)  # Converter negativo para positivo
                    cumulative_balance += amount  # amount já é negativo
        
        vault_total = vault_emergency + vault_investment
        
        # Calcular cash disponível
        opening_balance = (workspace.opening_balance_cents / 100) if workspace and workspace.opening_balance_cents else 0.0
        available_cash = max(0.0, opening_balance + income - expenses)
        
        # Calcular net worth
        net_worth = vault_total + available_cash
        
        # Calcular saving rate (com clamping)
        MIN_INCOME_THRESHOLD = 100.0  # 1€ mínimo
        saving_rate = 0.0
        if income >= MIN_INCOME_THRESHOLD:
            calculated = ((income - expenses) / income) * 100
            saving_rate = max(-100.0, min(100.0, calculated))
        
        # Determinar período
        if transactions:
            period_start = period_start or min(t.transaction_date for t in transactions)
            period_end = period_end or max(t.transaction_date for t in transactions)
        else:
            period_start = period_start or date.today()
            period_end = period_end or date.today()
        
        return FinancialSnapshot(
            income=income,
            expenses=expenses,
            vault_total=vault_total,
            vault_emergency=vault_emergency,
            vault_investment=vault_investment,
            available_cash=available_cash,
            net_worth=net_worth,
            saving_rate=saving_rate,
            cumulative_balance=cumulative_balance,
            period_start=period_start,
            period_end=period_end,
            transaction_count=len(transactions),
            category_totals=category_totals
        )

