"""データベースモデルのテスト"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.auth_session import AuthSession
from app.models.base import Base
from app.models.message import Message, MessageRole
from app.models.project import Project
from app.models.session import Session, SessionStatus


# テスト用のインメモリデータベース
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def engine():
    """テスト用エンジンを作成"""
    engine = create_async_engine(TEST_DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def session(engine):
    """テスト用セッションを作成"""
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session


class TestProjectModel:
    """Projectモデルのテスト"""

    async def test_create_project(self, session: AsyncSession):
        """プロジェクトを作成できること"""
        project = Project(
            name="Test Project",
            path="/path/to/project",
        )
        session.add(project)
        await session.commit()

        # 取得して確認
        result = await session.execute(select(Project))
        saved_project = result.scalars().first()

        assert saved_project is not None
        assert saved_project.name == "Test Project"
        assert saved_project.path == "/path/to/project"
        assert isinstance(saved_project.id, uuid.UUID)
        assert isinstance(saved_project.created_at, datetime)
        assert isinstance(saved_project.updated_at, datetime)

    async def test_project_id_is_uuid(self, session: AsyncSession):
        """プロジェクトIDがUUIDであること"""
        project = Project(name="Test", path="/test")
        session.add(project)
        await session.commit()

        assert isinstance(project.id, uuid.UUID)


class TestSessionModel:
    """Sessionモデルのテスト"""

    async def test_create_session(self, session: AsyncSession):
        """セッションを作成できること"""
        # まずプロジェクトを作成
        project = Project(name="Test Project", path="/test")
        session.add(project)
        await session.commit()

        # セッションを作成
        test_session = Session(
            project_id=project.id,
            name="Test Session",
            status=SessionStatus.INITIALIZING,
        )
        session.add(test_session)
        await session.commit()

        # 取得して確認
        result = await session.execute(select(Session))
        saved_session = result.scalars().first()

        assert saved_session is not None
        assert saved_session.name == "Test Session"
        assert saved_session.project_id == project.id
        assert saved_session.status == SessionStatus.INITIALIZING
        assert saved_session.worktree_path is None
        assert isinstance(saved_session.id, uuid.UUID)
        assert isinstance(saved_session.created_at, datetime)
        assert isinstance(saved_session.updated_at, datetime)

    async def test_session_with_worktree(self, session: AsyncSession):
        """worktree_pathを持つセッションを作成できること"""
        project = Project(name="Test", path="/test")
        session.add(project)
        await session.commit()

        test_session = Session(
            project_id=project.id,
            name="Test",
            status=SessionStatus.RUNNING,
            worktree_path="/path/to/worktree",
        )
        session.add(test_session)
        await session.commit()

        result = await session.execute(select(Session))
        saved = result.scalars().first()

        assert saved.worktree_path == "/path/to/worktree"

    async def test_session_status_enum(self, session: AsyncSession):
        """セッションステータスがEnumであること"""
        project = Project(name="Test", path="/test")
        session.add(project)
        await session.commit()

        for status in SessionStatus:
            test_session = Session(
                project_id=project.id,
                name=f"Test {status.value}",
                status=status,
            )
            session.add(test_session)

        await session.commit()

        result = await session.execute(select(Session))
        sessions = result.scalars().all()

        assert len(sessions) == len(SessionStatus)
        statuses = {s.status for s in sessions}
        assert statuses == set(SessionStatus)


class TestMessageModel:
    """Messageモデルのテスト"""

    async def test_create_message(self, session: AsyncSession):
        """メッセージを作成できること"""
        # プロジェクトとセッションを作成
        project = Project(name="Test", path="/test")
        session.add(project)
        await session.commit()

        test_session = Session(
            project_id=project.id,
            name="Test Session",
            status=SessionStatus.RUNNING,
        )
        session.add(test_session)
        await session.commit()

        # メッセージを作成
        message = Message(
            session_id=test_session.id,
            role=MessageRole.USER,
            content="Hello, Claude!",
        )
        session.add(message)
        await session.commit()

        # 取得して確認
        result = await session.execute(select(Message))
        saved_message = result.scalars().first()

        assert saved_message is not None
        assert saved_message.session_id == test_session.id
        assert saved_message.role == MessageRole.USER
        assert saved_message.content == "Hello, Claude!"
        assert isinstance(saved_message.id, uuid.UUID)
        assert isinstance(saved_message.created_at, datetime)

    async def test_message_role_enum(self, session: AsyncSession):
        """メッセージロールがEnumであること"""
        project = Project(name="Test", path="/test")
        session.add(project)
        await session.commit()

        test_session = Session(
            project_id=project.id,
            name="Test",
            status=SessionStatus.RUNNING,
        )
        session.add(test_session)
        await session.commit()

        for role in MessageRole:
            message = Message(
                session_id=test_session.id,
                role=role,
                content=f"Test message for {role.value}",
            )
            session.add(message)

        await session.commit()

        result = await session.execute(select(Message))
        messages = result.scalars().all()

        assert len(messages) == len(MessageRole)
        roles = {m.role for m in messages}
        assert roles == set(MessageRole)


class TestAuthSessionModel:
    """AuthSessionモデルのテスト"""

    async def test_create_auth_session(self, session: AsyncSession):
        """認証セッションを作成できること"""
        expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

        auth_session = AuthSession(
            token_hash="test_hash_12345",
            expires_at=expires_at,
        )
        session.add(auth_session)
        await session.commit()

        # 取得して確認
        result = await session.execute(select(AuthSession))
        saved = result.scalars().first()

        assert saved is not None
        assert saved.token_hash == "test_hash_12345"
        assert isinstance(saved.id, uuid.UUID)
        assert isinstance(saved.created_at, datetime)
        assert saved.expires_at.replace(microsecond=0) == expires_at.replace(microsecond=0)

    async def test_auth_session_expiration(self, session: AsyncSession):
        """認証セッションの有効期限を設定できること"""
        now = datetime.now(timezone.utc)
        future = now + timedelta(days=7)

        auth = AuthSession(
            token_hash="hash123",
            expires_at=future,
        )
        session.add(auth)
        await session.commit()

        result = await session.execute(select(AuthSession))
        saved = result.scalars().first()

        # マイクロ秒を除いて比較
        assert saved.expires_at.replace(microsecond=0) == future.replace(microsecond=0)
