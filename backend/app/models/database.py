from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Date, CheckConstraint, UniqueConstraint
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
    login_count = Column(Integer, nullable=False, default=0)
    last_login = Column(DateTime(timezone=True), nullable=True)
    subscription_status = Column(String(50), nullable=False, default='none')
    stripe_customer_id = Column(String(255), unique=True, nullable=True)
    stripe_subscription_id = Column(String(255), unique=True, nullable=True)
    telegram_auto_confirm = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    workspaces = relationship('Workspace', back_populates='owner', cascade='all, delete-orphan')

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
    amount_cents = Column(Integer, nullable=False)
    description = Column(String(255), nullable=True)
    transaction_date = Column(Date, nullable=False, index=True)
    is_installment = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint('amount_cents <> 0'),
    )
    
    workspace = relationship('Workspace', back_populates='transactions')
    category = relationship('Category', back_populates='transactions')
    installment_group = relationship('InstallmentGroup', back_populates='transactions')
    
    __table_args__ = (
        CheckConstraint('amount_cents <> 0'),
        # Índices compostos para queries frequentes
        # Nota: SQLAlchemy cria índices automaticamente para ForeignKeys, mas adicionamos índices compostos
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
    workspace_id = Column(UUID(as_uuid=True), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey('categories.id', ondelete='SET NULL'), nullable=True)
    description = Column(String(255), nullable=False)
    amount_cents = Column(Integer, nullable=False)
    day_of_month = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    process_automatically = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    workspace = relationship('Workspace', back_populates='recurring_transactions')
    category = relationship('Category')

class PasswordReset(Base):
    __tablename__ = 'password_resets'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, index=True)
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
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    workspace = relationship('Workspace')
    category = relationship('Category')
    
    __table_args__ = (
        UniqueConstraint('workspace_id', 'description_normalized', 'transaction_type', name='unique_workspace_mapping'),
    )

