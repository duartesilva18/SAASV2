from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, model_validator
from uuid import UUID

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=72)
    language: Optional[str] = 'pt'
    referral_code: Optional[str] = None  # Código de afiliado (opcional)

class UserResponse(UserBase):
    id: UUID
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    currency: str
    language: str = 'pt'
    gender: Optional[str] = None
    is_active: bool
    is_admin: bool
    is_email_verified: bool
    is_onboarded: bool
    marketing_opt_in: bool
    subscription_status: Optional[str] = 'none'
    pro_granted_until: Optional[datetime] = None  # Pro concedido por admin até esta data
    terms_accepted: bool = False
    terms_accepted_at: Optional[datetime] = None
    onboarding_spotlight_seen: bool = False
    created_at: datetime
    has_password: bool = True  # True = conta criada com email/password; False = só Google/social

    @model_validator(mode='after')
    def admin_or_granted_has_pro(self):
        """Contas admin ou com Pro concedido têm subscription_status = active para o frontend."""
        from datetime import datetime, timezone
        if self.is_admin and (not self.subscription_status or self.subscription_status not in ('active', 'trialing', 'cancel_at_period_end')):
            object.__setattr__(self, 'subscription_status', 'active')
            return self
        if self.pro_granted_until and self.pro_granted_until > datetime.now(timezone.utc):
            if self.subscription_status not in ('active', 'trialing', 'cancel_at_period_end'):
                object.__setattr__(self, 'subscription_status', 'active')
        return self

    class Config:
        from_attributes = True

class UserUpdateOnboarding(BaseModel):
    full_name: str
    phone_number: str
    currency: str
    gender: str
    marketing_opt_in: bool = False

class UserUpdateLanguage(BaseModel):
    language: str


class UserUpdateEmail(BaseModel):
    new_email: EmailStr
    current_password: str


class UserChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str


class RegisterResponse(BaseModel):
    message: str
    email: str
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = 'bearer'

class RegisterPendingResponse(BaseModel):
    """Resposta do registo quando se envia código por email (sem tokens)."""
    message: str
    email: str
    dev_code: Optional[str] = None  # só em development quando o envio do email falha

class RegisterConfirmRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)

class TokenData(BaseModel):
    email: Optional[str] = None

class ResendVerificationRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetVerify(BaseModel):
    email: EmailStr
    code: str

class PasswordResetConfirm(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(..., min_length=6)

class SocialLoginRequest(BaseModel):
    token: str
    provider: str
    language: Optional[str] = 'pt'
    referral_code: Optional[str] = None  # Código de afiliado (opcional)

class CategoryBase(BaseModel):
    name: str
    type: str
    vault_type: str = 'none'
    monthly_limit_cents: int = 0
    color_hex: str = '#3B82F6'
    icon: str = 'Tag'
    is_default: bool = False

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    vault_type: Optional[str] = None
    monthly_limit_cents: Optional[int] = None
    color_hex: Optional[str] = None
    icon: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryStats(BaseModel):
    category_id: UUID
    name: str
    total_spent_cents: int
    count: int
    percentage: float
    color: str
    icon: str

class CategoryResponse(CategoryBase):
    id: UUID
    workspace_id: UUID

    class Config:
        from_attributes = True

class TransactionBase(BaseModel):
    amount_cents: int
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    transaction_date: date
    is_installment: bool = False

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    amount_cents: Optional[int] = None
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    transaction_date: Optional[date] = None

class TransactionResponse(TransactionBase):
    id: UUID
    workspace_id: UUID
    installment_group_id: Optional[UUID] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class InsightItem(BaseModel):
    type: str
    title: str
    message: str
    icon: str
    value: Optional[float] = None
    trend: Optional[str] = None  # 'up', 'down', 'stable'

class ZenInsightsResponse(BaseModel):
    insights: List[InsightItem]
    summary: str
    health_score: int
    metrics: Optional[dict] = None  # Métricas adicionais
    trends: Optional[dict] = None  # Tendências mensais
    predictions: Optional[dict] = None  # Previsões da IA

class RecurringTransactionBase(BaseModel):
    description: str
    amount_cents: int = Field(..., ne=0)
    day_of_month: int = Field(..., ge=1, le=31)
    category_id: Optional[UUID] = None
    is_active: bool = True
    process_automatically: bool = True

class RecurringTransactionCreate(RecurringTransactionBase):
    pass

class RecurringTransactionUpdate(BaseModel):
    description: Optional[str] = None
    amount_cents: Optional[int] = Field(None, ne=0)
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    category_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    process_automatically: Optional[bool] = None

class RecurringTransactionResponse(RecurringTransactionBase):
    id: UUID
    workspace_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class WorkspaceResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    created_at: datetime

    class Config:
        from_attributes = True

class AnalyticsCompositeResponse(BaseModel):
    transactions: List[TransactionResponse]
    categories: List[CategoryResponse]
    insights: ZenInsightsResponse
    recurring: List[RecurringTransactionResponse]
    currency: str

class FinancialSnapshotResponse(BaseModel):
    """
    Snapshot financeiro estável - fonte de verdade.
    Esta estrutura NÃO deve mudar para acomodar UI específica.
    """
    income: float
    expenses: float
    vault_total: float
    vault_emergency: float
    vault_investment: float
    available_cash: float
    net_worth: float
    saving_rate: float
    cumulative_balance: float
    daily_allowance: float
    remaining_money: float
    days_left: int
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    transaction_count: int

class DashboardCollectionsResponse(BaseModel):
    """
    Collections descartáveis para UI específica.
    Pode mudar conforme necessidades da UI.
    """
    recent_transactions: List[TransactionResponse]
    categories: List[CategoryResponse]
    recurring: List[RecurringTransactionResponse]

class DashboardSnapshotResponse(BaseModel):
    """
    Resposta do endpoint /dashboard/snapshot
    Estrutura clara: snapshot (estável) vs collections (descartável)
    """
    version: str = "1.0"
    snapshot: FinancialSnapshotResponse
    collections: DashboardCollectionsResponse
    currency: str

class AuditLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class SystemSettingBase(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class SystemSettingUpdate(BaseModel):
    value: str

class SystemSettingResponse(SystemSettingBase):
    id: UUID
    updated_at: datetime

    class Config:
        from_attributes = True

class AdminStats(BaseModel):
    total_users: int
    total_transactions: int
    total_recurring: int
    active_subscriptions: int
    total_visits: int
    recent_logs: List[AuditLogResponse]

class AdminUserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    marketing_opt_in: bool = False
    subscription_status: str
    pro_granted_until: Optional[datetime] = None
    had_refund: bool = False
    created_at: datetime
    is_active: bool
    is_admin: bool
    login_count: int
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class GrantProRequest(BaseModel):
    """Conceder Pro até uma data ou por N meses."""
    until: Optional[datetime] = None  # Data limite (UTC)
    months: Optional[int] = None  # Alternativa: até agora + N meses (ignorado se until for enviado)

class AdminUserDetail(AdminUserResponse):
    workspaces: List[WorkspaceResponse]
    logs: List[AuditLogResponse]

    class Config:
        from_attributes = True

class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    subscription_status: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None

class BroadcastRequest(BaseModel):
    subject: str
    message: str

# Metas de Poupança
class SavingsGoalBase(BaseModel):
    name: str
    goal_type: str = 'expense'
    target_amount_cents: int = Field(..., gt=0)
    current_amount_cents: int = Field(0, ge=0)
    target_date: date
    icon: str = 'Target'
    color_hex: str = '#3B82F6'

class SavingsGoalCreate(SavingsGoalBase):
    pass

class SavingsGoalUpdate(BaseModel):
    name: Optional[str] = None
    goal_type: Optional[str] = None
    target_amount_cents: Optional[int] = Field(None, gt=0)
    current_amount_cents: Optional[int] = Field(None, ge=0)
    target_date: Optional[date] = None
    icon: Optional[str] = None
    color_hex: Optional[str] = None

class SavingsGoalResponse(SavingsGoalBase):
    id: UUID
    workspace_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Schemas de Afiliados
class AffiliateRequest(BaseModel):
    """Solicitação para se tornar afiliado"""
    pass

class AffiliateResponse(BaseModel):
    """Resposta com informações do afiliado"""
    is_affiliate: bool
    affiliate_code: Optional[str] = None
    affiliate_link: Optional[str] = None
    total_referrals: int = 0
    total_conversions: int = 0
    total_earnings_cents: int = 0
    pending_earnings_cents: int = 0
    stripe_connect_configured: bool = False  # Se tem Stripe Connect configurado e ativo
    stripe_connect_account_id: Optional[str] = None

    class Config:
        from_attributes = True

class AffiliateReferralResponse(BaseModel):
    """Informações de uma referência"""
    id: UUID
    referred_user_email: str
    referred_user_full_name: Optional[str] = None
    has_subscribed: bool
    subscription_date: Optional[datetime] = None
    created_at: datetime
    payment_info: Optional[dict] = None  # Informações de pagamento do Stripe

    class Config:
        from_attributes = True

class AffiliateStats(BaseModel):
    """Estatísticas do afiliado"""
    total_referrals: int
    total_conversions: int
    conversion_rate: float
    total_earnings_cents: int
    pending_earnings_cents: int
    paid_earnings_cents: int
    commission_plus_percent: Optional[float] = 20.0  # Comissão plano Plus (editável pelo admin)
    commission_pro_percent: Optional[float] = 25.0  # Comissão plano Pro (editável pelo admin)
    referrals: List[AffiliateReferralResponse]
    monthly_commissions: List[dict]  # {month: str, revenue_cents: int, commission_cents: int, conversions: int}
    weekly_revenue: List[dict]  # {week: str, revenue_cents: int, commission_cents: int, week_label: str}

class AffiliateCommissionResponse(BaseModel):
    """Comissão mensal"""
    id: UUID
    month: date
    total_revenue_cents: int
    commission_percentage: float
    commission_amount_cents: int
    referrals_count: int
    conversions_count: int
    is_paid: bool
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Schemas Admin Afiliados
class AdminAffiliateResponse(BaseModel):
    """Resposta admin com informações do afiliado"""
    user_id: UUID
    email: str
    full_name: Optional[str] = None
    affiliate_code: Optional[str] = None
    is_affiliate: bool
    total_referrals: int
    total_conversions: int
    total_earnings_cents: int
    created_at: datetime

class AdminAffiliateDetail(AdminAffiliateResponse):
    """Detalhes completos do afiliado para admin"""
    referrals: List[AffiliateReferralResponse]
    commissions: List[AffiliateCommissionResponse]

class PromoteToAffiliateRequest(BaseModel):
    """Promover utilizador a afiliado"""
    user_id: UUID

class AffiliateSettingsUpdate(BaseModel):
    """Atualizar percentagem de comissão"""
    commission_percentage: float = Field(..., ge=0, le=100)


class ProjectExpenseCreate(BaseModel):
    """Criar despesa do projeto (admin)"""
    description: str = Field(..., min_length=1, max_length=500)
    amount_cents: int = Field(..., gt=0, le=99999999)
    expense_date: Optional[date] = Field(None, alias='date')  # JSON: "date" (ISO YYYY-MM-DD)

    class Config:
        extra = 'ignore'
        populate_by_name = True