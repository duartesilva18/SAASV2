from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Date, CheckConstraint, UniqueConstraint, Numeric, Text, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from ..core.dependencies import Base

class User(Base):
    __tablename__ = 'users'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=True)
    password_hash = Column(String, nullable=True)
    google_id = Column(String, unique=True, nullable=True)
    phone_number = Column(String, unique=True, nullable=True)
    currency = Column(String(3), nullable=False, server_default='EUR')
    language = Column(String(5), nullable=False, server_default='pt')
    gender = Column(String(20), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_admin = Column(Boolean, nullable=False, default=False)
    is_email_verified = Column(Boolean, nullable=False, default=False)
    is_onboarded = Column(Boolean, nullable=False, default=False)
    marketing_opt_in = Column(Boolean, nullable=False, default=False)
    terms_accepted = Column(Boolean, nullable=False, default=False)
    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)
    onboarding_spotlight_seen = Column(Boolean, nullable=False, default=False)
    login_count = Column(Integer, nullable=False, default=0)
    last_login = Column(DateTime(timezone=True), nullable=True)
    subscription_status = Column(String(50), nullable=False, default='none')
    stripe_customer_id = Column(String(255), unique=True, nullable=True)
    stripe_subscription_id = Column(String(255), unique=True, nullable=True)
    telegram_auto_confirm = Column(Boolean, nullable=False, default=False)
    telegram_default_category_id = Column(UUID(as_uuid=True), ForeignKey('categories.id', ondelete='SET NULL'), nullable=True)
    # Pro concedido por admin até uma data (acesso Pro temporário sem subscrição Stripe)
    pro_granted_until = Column(DateTime(timezone=True), nullable=True)
    had_refund = Column(Boolean, nullable=False, default=False)  # True se alguma vez teve reembolso (Stripe)
    # Campos de afiliado
    is_affiliate = Column(Boolean, nullable=False, default=False)
    affiliate_code = Column(String(20), unique=True, nullable=True, index=True)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    affiliate_requested_at = Column(DateTime(timezone=True), nullable=True)
    # Campos Stripe Connect
    stripe_connect_account_id = Column(String(255), unique=True, nullable=True, index=True)
    stripe_connect_onboarding_completed = Column(Boolean, nullable=False, default=False)
    stripe_connect_account_status = Column(String(50), nullable=True, default='pending')
    affiliate_payout_enabled = Column(Boolean, nullable=False, default=False)  # Cache lógico
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    workspaces = relationship('Workspace', back_populates='owner', cascade='all, delete-orphan')
    referrer = relationship('User', remote_side=[id], foreign_keys=[referrer_id])
    referrals = relationship('AffiliateReferral', foreign_keys='AffiliateReferral.referrer_id', back_populates='referrer')
    commissions = relationship('AffiliateCommission', back_populates='affiliate')

    @property
    def has_password(self) -> bool:
        """True se a conta foi criada com email/password; False se entrou só por Google/social."""
        return self.password_hash is not None

    def has_effective_pro(self) -> bool:
        """True se o utilizador tem acesso Pro: admin, subscrição ativa ou Pro concedido até uma data futura."""
        from datetime import datetime, timezone
        if self.is_admin:
            return True
        if self.subscription_status in ('active', 'trialing', 'cancel_at_period_end'):
            return True
        if self.pro_granted_until:
            now = datetime.now(timezone.utc)
            return self.pro_granted_until > now
        return False

class Workspace(Base):
    __tablename__ = 'workspaces'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(100), nullable=False, server_default='Meu Workspace')
    opening_balance_cents = Column(Integer, nullable=False, default=0)  # Saldo inicial em cêntimos
    opening_balance_date = Column(Date, nullable=True)  # Data do saldo inicial
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    owner = relationship('User', back_populates='workspaces')
    categories = relationship('Category', back_populates='workspace', cascade='all, delete-orphan')
    transactions = relationship('Transaction', back_populates='workspace', cascade='all, delete-orphan')
    recurring_transactions = relationship('RecurringTransaction', back_populates='workspace', cascade='all, delete-orphan')
    installment_groups = relationship('InstallmentGroup', back_populates='workspace', cascade='all, delete-orphan')
    savings_goals = relationship('SavingsGoal', back_populates='workspace', cascade='all, delete-orphan')

class Category(Base):
    __tablename__ = 'categories'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(10), nullable=False)
    vault_type = Column(String(20), nullable=False, server_default='none')
    monthly_limit_cents = Column(Integer, nullable=False, server_default='0')
    color_hex = Column(String(7), nullable=False, server_default='#3B82F6')
    icon = Column(String(50), nullable=False, server_default='Tag')
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    workspace = relationship('Workspace', back_populates='categories')
    transactions = relationship('Transaction', back_populates='category')
    
    __table_args__ = (
        CheckConstraint("type IN ('income', 'expense')"),
        CheckConstraint('monthly_limit_cents >= 0'),
        UniqueConstraint('workspace_id', 'name', name='categories_unique_name'),
    )


class CategoryKeyword(Base):
    __tablename__ = 'category_keywords'
    workspace_id = Column(UUID(as_uuid=True), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False, primary_key=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey('categories.id', ondelete='CASCADE'), nullable=False, primary_key=True)
    keyword = Column(String(100), nullable=False, primary_key=True)


class InstallmentGroup(Base):
    __tablename__ = 'installment_groups'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    total_amount_cents = Column(Integer, nullable=False)
    installment_count = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    workspace = relationship('Workspace', back_populates='installment_groups')
    transactions = relationship('Transaction', back_populates='installment_group')
    
    __table_args__ = (
        CheckConstraint('total_amount_cents > 0'),
        CheckConstraint('installment_count > 1'),
    )

class Transaction(Base):
    __tablename__ = 'transactions'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey('categories.id', ondelete='SET NULL'), nullable=True, index=True)
    installment_group_id = Column(UUID(as_uuid=True), ForeignKey('installment_groups.id', ondelete='SET NULL'), nullable=True)
    amount_cents = Column(BigInteger, nullable=False)
    description = Column(String(255), nullable=True)
    transaction_date = Column(Date, nullable=False, index=True)
    inference_source = Column(String(50), nullable=True)
    decision_reason = Column(String(255), nullable=True)
    needs_review = Column(Boolean, nullable=False, default=False)
    is_installment = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    workspace = relationship('Workspace', back_populates='transactions')
    category = relationship('Category', back_populates='transactions')
    installment_group = relationship('InstallmentGroup', back_populates='transactions')
    
    __table_args__ = (
        CheckConstraint('amount_cents <> 0'),
    )

class SystemSetting(Base):
    __tablename__ = 'system_settings'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(50), unique=True, index=True, nullable=False)
    value = Column(String, nullable=True)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

class RecurringTransaction(Base):
    __tablename__ = 'recurring_transactions'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey('categories.id', ondelete='SET NULL'), nullable=True)
    description = Column(String(255), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    day_of_month = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    process_automatically = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    workspace = relationship('Workspace', back_populates='recurring_transactions')
    category = relationship('Category')

    __table_args__ = (
        CheckConstraint('amount_cents <> 0'),
        CheckConstraint('day_of_month >= 1 AND day_of_month <= 31'),
    )

class EmailVerification(Base):
    __tablename__ = 'email_verifications'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, index=True)
    token = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=True)  # Guarda o hash da password temporariamente
    referral_code = Column(String(20), nullable=True)  # Código de referência se fornecido
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

class PasswordReset(Base):
    __tablename__ = 'password_resets'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, index=True)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

class RegistrationVerification(Base):
    """Código de 6 dígitos enviado por email para confirmar o registo (fluxo tipo esqueci-password)."""
    __tablename__ = 'registration_verifications'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    language = Column(String(5), nullable=False, server_default='pt')
    referral_code = Column(String(20), nullable=True)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(String, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    user = relationship('User')

class SavingsGoal(Base):
    __tablename__ = 'savings_goals'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(100), nullable=False)
    goal_type = Column(String(20), nullable=False, server_default='expense')
    target_amount_cents = Column(Integer, nullable=False)
    current_amount_cents = Column(Integer, nullable=False, default=0)
    target_date = Column(Date, nullable=False)
    icon = Column(String(50), nullable=False, server_default='Target')
    color_hex = Column(String(7), nullable=False, server_default='#3B82F6')
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    workspace = relationship('Workspace', back_populates='savings_goals')

class TelegramPendingTransaction(Base):
    __tablename__ = 'telegram_pending_transactions'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id = Column(String, nullable=False, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey('categories.id', ondelete='SET NULL'), nullable=True)
    amount_cents = Column(Integer, nullable=False)
    description = Column(String(255), nullable=False)
    transaction_date = Column(Date, nullable=False)
    inference_source = Column(String(50), nullable=True)
    decision_reason = Column(String(255), nullable=True)
    needs_review = Column(Boolean, nullable=False, default=False)
    batch_id = Column(UUID(as_uuid=True), nullable=True, index=True)  # Agrupa várias linhas da mesma mensagem (lista)
    suggested_category_name = Column(String(100), nullable=True)  # Nome sugerido pela IA quando a categoria não existe
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    workspace = relationship('Workspace')
    category = relationship('Category')

class CategoryMappingCache(Base):
    """
    Cache de categorizações do Gemini para evitar chamadas repetidas.
    Guarda o mapeamento: descrição normalizada -> category_id
    Pode ser por workspace (privado) ou global (partilhado entre utilizadores)
    """
    __tablename__ = 'category_mapping_cache'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=True, index=True)  # NULL = cache global
    description_normalized = Column(String(255), nullable=False, index=True)  # Descrição normalizada (lowercase, sem acentos)
    category_name = Column(String(100), nullable=False)  # Nome da categoria (para cache global, não precisa de category_id específico)
    category_id = Column(UUID(as_uuid=True), ForeignKey('categories.id', ondelete='CASCADE'), nullable=True)  # NULL para cache global
    transaction_type = Column(String(10), nullable=False)  # 'expense' ou 'income'
    usage_count = Column(Integer, nullable=False, default=1)  # Quantas vezes foi usado
    is_global = Column(Boolean, nullable=False, default=False)  # True = cache global partilhado
    confidence = Column(Numeric(5, 4), nullable=False, default=1.0)
    promoted_to_global = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    workspace = relationship('Workspace')
    category = relationship('Category')
    
    __table_args__ = (
        UniqueConstraint('workspace_id', 'description_normalized', 'transaction_type', name='unique_workspace_mapping'),
    )


class TokenScore(Base):
    """
    Aprendizagem por token: token->categoria com count e score (por workspace).
    """
    __tablename__ = 'token_scores'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False, index=True)
    token = Column(String(100), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey('categories.id', ondelete='CASCADE'), nullable=False)
    category_name = Column(String(100), nullable=False)
    transaction_type = Column(String(10), nullable=False)
    count = Column(Integer, nullable=False, default=1)
    score = Column(Numeric(10, 4), nullable=False, default=1.0)
    last_updated = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('workspace_id', 'token', 'category_id', 'transaction_type', name='unique_token_score'),
    )


class GeminiEvent(Base):
    """
    Log de chamadas Gemini para métricas e circuit-breaker.
    """
    __tablename__ = 'gemini_events'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey('workspaces.id', ondelete='SET NULL'), nullable=True, index=True)
    request_description = Column(String(500), nullable=False)
    response_text = Column(String(200), nullable=True)
    status_code = Column(Integer, nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class MerchantRegistry(Base):
    """
    Registo de merchants e aliases para matching determinístico.
    """
    __tablename__ = 'merchant_registry'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alias = Column(String(120), nullable=False, index=True)
    canonical_name = Column(String(120), nullable=False)
    category_name = Column(String(100), nullable=False)
    transaction_type = Column(String(10), nullable=False)
    usage_count = Column(Integer, nullable=False, default=1)
    confidence = Column(Numeric(5, 4), nullable=False, default=1.0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class AffiliateReferral(Base):
    """
    Rastreia referências de afiliados - quando alguém se regista através de um link de afiliado
    """
    __tablename__ = 'affiliate_referrals'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    referred_user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    referral_code = Column(String(20), nullable=False, index=True)  # Código usado no signup
    has_subscribed = Column(Boolean, nullable=False, default=False)  # Se o utilizador referido subscreveu Pro
    subscription_date = Column(DateTime(timezone=True), nullable=True)  # Data da subscrição Pro
    subscription_canceled_at = Column(DateTime(timezone=True), nullable=True)  # Data de cancelamento/reembolso
    ip_address = Column(String(50), nullable=True)  # Para prevenir fraudes
    user_agent = Column(String(500), nullable=True)  # Para prevenir fraudes
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    referrer = relationship('User', foreign_keys=[referrer_id], back_populates='referrals')
    referred_user = relationship('User', foreign_keys=[referred_user_id])

class AffiliateCommission(Base):
    """
    Comissões mensais dos afiliados - calculadas no fim de cada mês
    """
    __tablename__ = 'affiliate_commissions'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    affiliate_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    month = Column(Date, nullable=False)  # Primeiro dia do mês (YYYY-MM-01)
    total_revenue_cents = Column(Integer, nullable=False, default=0)  # Receita total gerada pelo afiliado
    commission_percentage = Column(Numeric(5, 2), nullable=False)  # Percentagem de comissão (ex: 20.00)
    commission_amount_cents = Column(Integer, nullable=False, default=0)  # Valor da comissão em cêntimos
    referrals_count = Column(Integer, nullable=False, default=0)  # Número de referências
    conversions_count = Column(Integer, nullable=False, default=0)  # Número de conversões (subscrições Pro)
    is_paid = Column(Boolean, nullable=False, default=False)  # Se já foi pago
    paid_at = Column(DateTime(timezone=True), nullable=True)
    payment_reference = Column(String(100), nullable=True)  # Referência do pagamento
    # Campos Stripe Connect
    stripe_transfer_id = Column(String(255), nullable=True, index=True)
    transfer_status = Column(String(50), nullable=True)  # 'created', 'reversed', 'failed'
    payout_error_message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    affiliate = relationship('User', back_populates='commissions')
    
    __table_args__ = (
        UniqueConstraint('affiliate_id', 'month', name='unique_affiliate_month'),
    )


class AffiliateInvoiceManualTransfer(Base):
    """
    Registo de Transfer manual por invoice (1ª invoice sem split).
    Evita pagamento duplo: só fazemos um Transfer por invoice_id.
    """
    __tablename__ = 'affiliate_invoice_manual_transfers'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(String(255), unique=True, nullable=False, index=True)  # Stripe invoice id (in_xxx)
    transfer_id = Column(String(255), nullable=False, index=True)  # Stripe transfer id (tr_xxx)
    affiliate_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AffiliateCommissionInvoice(Base):
    """
    Invoices já creditadas em AffiliateCommission (idempotência).
    Evita duplicar comissão se o webhook invoice.paid for reenviado.
    """
    __tablename__ = 'affiliate_commission_invoices'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(String(255), unique=True, nullable=False, index=True)  # Stripe invoice id (in_xxx)
    affiliate_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    month = Column(Date, nullable=False)  # Mês da comissão (YYYY-MM-01)
    base_amount_cents = Column(Integer, nullable=False)
    commission_cents = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AffiliateChargeRefundTracking(Base):
    """
    Por charge: base já revertida e se já decrementámos conversions_count.
    Refund parcial múltiplo: amount_refunded é acumulado; só revertemos o delta.
    """
    __tablename__ = 'affiliate_charge_refund_tracking'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    charge_id = Column(String(255), unique=True, nullable=False, index=True)  # Stripe charge id (ch_xxx)
    base_refunded_reversed_cents = Column(Integer, nullable=False, default=0)  # Base já revertido na BD
    conversions_decremented = Column(Boolean, nullable=False, default=False)  # Só decrementar 1x por charge
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class AdminProjectExpense(Base):
    """
    Despesas do projeto e manutenção (apenas admins).
    """
    __tablename__ = 'admin_project_expenses'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    description = Column(String(255), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    expense_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    created_by = relationship('User', foreign_keys=[created_by_id])


class AdminErrorLog(Base):
    """
    Erros críticos registados pelo handler global (dashboard de saúde).
    """
    __tablename__ = 'admin_error_logs'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    path = Column(String(500), nullable=False)
    message = Column(Text, nullable=False)
    exc_type = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())