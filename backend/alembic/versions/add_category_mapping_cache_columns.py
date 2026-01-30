"""Category mapping cache: category_name, is_global, nullable workspace_id/category_id

Revision ID: category_mapping_cache_cols
Revises: add_opening_balance_workspaces
Create Date: 2026-01-27

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'category_mapping_cache_cols'
down_revision: Union[str, None] = 'add_opening_balance_workspaces'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Schema já aplicado na BD do Render (script SQL).
    pass


def downgrade() -> None:
    pass
