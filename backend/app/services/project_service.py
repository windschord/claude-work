"""プロジェクト管理サービス"""
import asyncio
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project


class ProjectService:
    """プロジェクト管理を行うサービスクラス"""

    @staticmethod
    async def validate_git_repository(path: str) -> bool:
        """
        パスがGitリポジトリかどうかを検証

        Args:
            path: 検証するディレクトリパス

        Returns:
            Gitリポジトリの場合True、それ以外はFalse
        """
        path_obj = Path(path)

        # パスが存在するか確認
        if not path_obj.exists():
            return False

        # ディレクトリか確認
        if not path_obj.is_dir():
            return False

        # git rev-parse --git-dirコマンドを実行してGitリポジトリか確認
        try:
            process = await asyncio.create_subprocess_exec(
                "git",
                "rev-parse",
                "--git-dir",
                cwd=str(path_obj),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await process.communicate()
            return process.returncode == 0
        except Exception:
            return False

    @staticmethod
    def get_project_name_from_path(path: str) -> str:
        """
        パスからプロジェクト名を取得

        Args:
            path: プロジェクトパス

        Returns:
            プロジェクト名（ディレクトリ名）
        """
        return Path(path).name

    @staticmethod
    async def get_all_projects(db: AsyncSession) -> list[Project]:
        """
        全プロジェクトを取得

        Args:
            db: データベースセッション

        Returns:
            プロジェクトのリスト
        """
        stmt = select(Project).order_by(Project.created_at.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_project_by_id(
        db: AsyncSession,
        project_id: uuid.UUID,
    ) -> Project | None:
        """
        IDでプロジェクトを取得

        Args:
            db: データベースセッション
            project_id: プロジェクトID

        Returns:
            プロジェクト、存在しない場合はNone
        """
        stmt = select(Project).where(Project.id == project_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_project(
        db: AsyncSession,
        path: str,
        default_model: str | None = None,
    ) -> Project:
        """
        プロジェクトを作成

        Args:
            db: データベースセッション
            path: プロジェクトパス
            default_model: デフォルトモデル（指定されない場合はclaude-sonnet-4-20250514）

        Returns:
            作成されたプロジェクト

        Raises:
            ValueError: パスが無効な場合、またはGitリポジトリでない場合
        """
        # Gitリポジトリかどうか検証
        if not await ProjectService.validate_git_repository(path):
            raise ValueError("The specified path is not a valid Git repository")

        # プロジェクト名を取得
        name = ProjectService.get_project_name_from_path(path)

        # プロジェクトを作成
        project = Project(
            name=name,
            path=path,
            default_model=default_model or "claude-sonnet-4-20250514",
        )
        db.add(project)
        await db.commit()
        await db.refresh(project)
        return project

    @staticmethod
    async def update_project(
        db: AsyncSession,
        project_id: uuid.UUID,
        name: str | None = None,
        default_model: str | None = None,
    ) -> Project | None:
        """
        プロジェクトを更新

        Args:
            db: データベースセッション
            project_id: プロジェクトID
            name: 更新する名前（指定された場合のみ更新）
            default_model: 更新するデフォルトモデル（指定された場合のみ更新）

        Returns:
            更新されたプロジェクト、存在しない場合はNone
        """
        # プロジェクトを取得
        project = await ProjectService.get_project_by_id(db, project_id)
        if not project:
            return None

        # 名前を更新
        if name is not None:
            project.name = name

        # デフォルトモデルを更新
        if default_model is not None:
            project.default_model = default_model

        await db.commit()
        await db.refresh(project)
        return project

    @staticmethod
    async def delete_project(
        db: AsyncSession,
        project_id: uuid.UUID,
    ) -> bool:
        """
        プロジェクトを削除

        Args:
            db: データベースセッション
            project_id: プロジェクトID

        Returns:
            削除に成功した場合True、プロジェクトが存在しない場合False
        """
        # プロジェクトを取得
        project = await ProjectService.get_project_by_id(db, project_id)
        if not project:
            return False

        # プロジェクトを削除
        await db.delete(project)
        await db.commit()
        return True

