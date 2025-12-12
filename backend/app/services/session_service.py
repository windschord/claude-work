"""セッション管理サービス"""
import uuid
from typing import Dict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.session import Session, SessionStatus
from app.services.git_service import GitService
from app.services.process_manager import ProcessManager


# プロセスマネージャーを保持する辞書（session_id -> ProcessManager）
_process_managers: Dict[str, ProcessManager] = {}


class SessionService:
    """セッション管理を行うサービスクラス"""

    @staticmethod
    async def get_sessions_by_project(
        db: AsyncSession,
        project_id: uuid.UUID,
    ) -> list[Session]:
        """
        プロジェクトのセッション一覧を取得

        Args:
            db: データベースセッション
            project_id: プロジェクトID

        Returns:
            セッションのリスト

        Raises:
            ValueError: プロジェクトが存在しない場合
        """
        # プロジェクトが存在するか確認
        stmt_project = select(Project).where(Project.id == project_id)
        result_project = await db.execute(stmt_project)
        project = result_project.scalar_one_or_none()
        if not project:
            raise ValueError("Project not found")

        # セッション一覧を取得
        stmt = (
            select(Session)
            .where(Session.project_id == project_id)
            .order_by(Session.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_session_by_id(
        db: AsyncSession,
        session_id: uuid.UUID,
    ) -> Session | None:
        """
        IDでセッションを取得

        Args:
            db: データベースセッション
            session_id: セッションID

        Returns:
            セッション、存在しない場合はNone
        """
        stmt = select(Session).where(Session.id == session_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_session(
        db: AsyncSession,
        project_id: uuid.UUID,
        name: str,
        message: str,
        model: str | None = None,
    ) -> Session:
        """
        セッションを作成

        Args:
            db: データベースセッション
            project_id: プロジェクトID
            name: セッション名
            message: Claude Codeに送信するメッセージ
            model: 使用するモデル（指定されない場合はプロジェクトのdefault_modelを使用）

        Returns:
            作成されたセッション

        Raises:
            ValueError: プロジェクトが存在しない場合
            RuntimeError: worktree作成やプロセス起動に失敗した場合
        """
        # プロジェクトが存在するか確認
        stmt_project = select(Project).where(Project.id == project_id)
        result_project = await db.execute(stmt_project)
        project = result_project.scalar_one_or_none()
        if not project:
            raise ValueError("Project not found")

        # モデルが指定されていない場合はプロジェクトのdefault_modelを使用
        session_model = model or project.default_model

        # セッションを作成
        session = Session(
            project_id=project_id,
            name=name,
            status=SessionStatus.INITIALIZING,
            model=session_model,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        try:
            # GitServiceを初期化
            git_service = GitService(project.path)

            # worktreeを作成
            branch_name = f"session/{name}"
            worktree_path = await git_service.create_worktree(name, branch_name)

            # セッションのworktree_pathを更新
            session.worktree_path = worktree_path
            await db.commit()
            await db.refresh(session)

            # ProcessManagerを初期化
            process_manager = ProcessManager()

            # Claude Codeプロセスを起動（モデル指定）
            await process_manager.start_claude_code(
                working_dir=worktree_path,
                message=message,
                model=session_model,
            )

            # プロセスマネージャーを保持
            _process_managers[str(session.id)] = process_manager

            # セッションのステータスをRUNNINGに更新
            session.status = SessionStatus.RUNNING
            await db.commit()
            await db.refresh(session)

            return session

        except Exception as e:
            # エラーが発生した場合はセッションのステータスをERRORに更新
            session.status = SessionStatus.ERROR
            await db.commit()
            raise RuntimeError(f"Failed to create session: {e}")

    @staticmethod
    async def stop_session(
        db: AsyncSession,
        session_id: uuid.UUID,
    ) -> Session | None:
        """
        セッションを停止

        Args:
            db: データベースセッション
            session_id: セッションID

        Returns:
            停止されたセッション、存在しない場合はNone

        Raises:
            RuntimeError: プロセス停止に失敗した場合
        """
        # セッションを取得
        session = await SessionService.get_session_by_id(db, session_id)
        if not session:
            return None

        try:
            # プロセスマネージャーを取得
            process_manager = _process_managers.get(str(session_id))
            if process_manager:
                # プロセスを停止
                await process_manager.stop()
                # プロセスマネージャーを削除
                del _process_managers[str(session_id)]

            # セッションのステータスをCOMPLETEDに更新
            session.status = SessionStatus.COMPLETED
            await db.commit()
            await db.refresh(session)

            return session

        except Exception as e:
            raise RuntimeError(f"Failed to stop session: {e}")

    @staticmethod
    async def delete_session(
        db: AsyncSession,
        session_id: uuid.UUID,
    ) -> bool:
        """
        セッションを削除

        Args:
            db: データベースセッション
            session_id: セッションID

        Returns:
            削除に成功した場合True、セッションが存在しない場合False

        Raises:
            RuntimeError: プロセス停止やworktree削除に失敗した場合
        """
        # セッションを取得
        session = await SessionService.get_session_by_id(db, session_id)
        if not session:
            return False

        try:
            # プロセスマネージャーを取得
            process_manager = _process_managers.get(str(session_id))
            if process_manager:
                # プロセスを停止
                await process_manager.stop()
                # プロセスマネージャーを削除
                del _process_managers[str(session_id)]

            # worktreeを削除
            if session.worktree_path:
                # プロジェクトを取得
                stmt_project = select(Project).where(Project.id == session.project_id)
                result_project = await db.execute(stmt_project)
                project = result_project.scalar_one_or_none()

                if project:
                    # GitServiceを初期化
                    git_service = GitService(project.path)

                    # worktreeを削除
                    branch_name = f"session/{session.name}"
                    await git_service.delete_worktree(session.name, branch_name)

            # セッションを削除
            await db.delete(session)
            await db.commit()

            return True

        except Exception as e:
            raise RuntimeError(f"Failed to delete session: {e}")
