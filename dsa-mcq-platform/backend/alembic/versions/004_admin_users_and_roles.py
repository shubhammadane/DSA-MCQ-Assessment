"""admin_users_and_roles

Revision ID: 004_admin_users_and_roles
Revises: 003_college_examination_system
Create Date: 2026-10-10 01:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '004_admin_users_and_roles'
down_revision = '003_college_examination_system'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    try:
        inspector = sa.inspect(conn)
        existing_tables = inspector.get_table_names()
        table_exists = 'admin_users' in existing_tables
    except Exception:
        table_exists = False

    if not table_exists:
        op.create_table(
            'admin_users',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('username', sa.String(), nullable=False),
            sa.Column('hashed_password', sa.String(), nullable=False),
            sa.Column('full_name', sa.String(), nullable=False),
            sa.Column('email', sa.String(), nullable=True),
            sa.Column('role', sa.String(), server_default='hod', nullable=False),
            sa.Column('department_id', sa.Integer(), nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_admin_users_id'), 'admin_users', ['id'], unique=False)
        op.create_index(op.f('ix_admin_users_username'), 'admin_users', ['username'], unique=True)
        op.create_index(op.f('ix_admin_users_role'), 'admin_users', ['role'], unique=False)
        op.create_index(op.f('ix_admin_users_department_id'), 'admin_users', ['department_id'], unique=False)
        op.create_index(op.f('ix_admin_users_is_active'), 'admin_users', ['is_active'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    try:
        inspector = sa.inspect(conn)
        existing_tables = inspector.get_table_names()
        if 'admin_users' in existing_tables:
            op.drop_table('admin_users')
    except Exception:
        op.drop_table('admin_users')
