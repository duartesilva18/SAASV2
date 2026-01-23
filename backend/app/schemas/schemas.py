from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from uuid import UUID

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    language: Optional[str] = 'pt'

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
    terms_accepted: bool = False
    terms_accepted_at: Optional[datetime] = None
    created_at: datetime

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

class Token(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

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
    amount_cents: int
    day_of_month: int
    category_id: Optional[UUID] = None
    is_active: bool = True
    process_automatically: bool = False

class RecurringTransactionCreate(RecurringTransactionBase):
    pass

class RecurringTransactionUpdate(BaseModel):
    description: Optional[str] = None
    amount_cents: Optional[int] = None
    day_of_month: Optional[int] = None
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
    created_at: datetime
    is_active: bool
    is_admin: bool
    login_count: int
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True

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
    target_amount_cents: int
    current_amount_cents: int = 0
    target_date: date
    icon: str = 'Target'
    color_hex: str = '#3B82F6'

class SavingsGoalCreate(SavingsGoalBase):
    pass

class SavingsGoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount_cents: Optional[int] = None
    current_amount_cents: Optional[int] = None
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

