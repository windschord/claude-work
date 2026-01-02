"""Alembic環境設定（非同期対応）"""
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Alembic Config オブジェクト
config = context.config

# Python ロギング設定
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# モデルのMetaDataをインポート
from app.models import Base  # noqa: E402

target_metadata = Base.metadata

# アプリケーション設定からデータベースURLを取得
from app.config import settings  # noqa: E402

# データベースURLを設定（同期版に変換してofflineモードで使用）
if config.get_main_option("sqlalchemy.url") is None:
    # aiosqliteをsqliteに変換（offline mode用）
    sync_url = settings.database_url.replace("sqlite+aiosqlite:", "sqlite:")
    config.set_main_option("sqlalchemy.url", sync_url)


def run_migrations_offline() -> None:
    """オフラインモードでマイグレーションを実行

    EngineなしでURLのみで設定を行う。
    DBAPIすら必要ない。
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """実際のマイグレーション実行"""
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """非同期エンジンを使用してマイグレーションを実行"""
    configuration = config.get_section(config.config_ini_section, {})
    # データベースURLを非同期版に設定
    configuration["sqlalchemy.url"] = settings.database_url

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """オンラインモードでマイグレーションを実行

    非同期エンジンを作成して接続する。
    """
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
