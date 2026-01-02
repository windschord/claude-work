"""セッションAPI"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_session
from app.models.auth_session import AuthSession
from app.models.project import Project
from app.services.git_service import GitService
from app.services.session_service import SessionService

router = APIRouter(prefix="/api", tags=["sessions"])


class SessionCreateRequest(BaseModel):
    """セッション作成リクエスト"""

    name: str
    message: str
    count: int | None = None
    model: str | None = None

    @field_validator('count')
    @classmethod
    def validate_count(cls, v):
        """countの値を検証"""
        if v is not None and (v < 1 or v > 10):
            raise ValueError("count must be between 1 and 10")
        return v


class SessionResponse(BaseModel):
    """セッションレスポンス"""

    id: str
    project_id: str
    name: str
    status: str
    model: str | None
    worktree_path: str | None
    created_at: str
    updated_at: str
    has_uncommitted_changes: bool = False
    changed_files_count: int = 0

    class Config:
        from_attributes = True


@router.get("/projects/{project_id}/sessions", response_model=list[SessionResponse])
async def get_sessions(
    project_id: uuid.UUID,
    auth_session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    プロジェクトのセッション一覧を取得

    Args:
        project_id: プロジェクトID
        session: 認証セッション
        db: データベースセッション

    Returns:
        セッションのリスト

    Raises:
        HTTPException: プロジェクトが存在しない場合
    """
    try:
        sessions = await SessionService.get_sessions_by_project(db, project_id)

        # プロジェクトを取得
        from sqlalchemy import select
        stmt = select(Project).where(Project.id == project_id)
        result = await db.execute(stmt)
        project = result.scalar_one_or_none()

        if not project:
            raise ValueError("Project not found")

        # GitServiceを初期化
        git_service = GitService(project.path)

        responses = []
        for s in sessions:
            # Git状態を取得
            has_uncommitted_changes = False
            changed_files_count = 0
            if s.worktree_path:
                try:
                    git_status = await git_service.get_git_status(s.name)
                    has_uncommitted_changes = git_status["has_uncommitted_changes"]
                    changed_files_count = git_status["changed_files_count"]
                except Exception:
                    # worktreeが存在しない場合などはデフォルト値を使用
                    pass

            responses.append(
                SessionResponse(
                    id=str(s.id),
                    project_id=str(s.project_id),
                    name=s.name,
                    status=s.status.value,
                    model=s.model,
                    worktree_path=s.worktree_path,
                    created_at=s.created_at.isoformat(),
                    updated_at=s.updated_at.isoformat(),
                    has_uncommitted_changes=has_uncommitted_changes,
                    changed_files_count=changed_files_count,
                )
            )

        return responses
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post(
    "/projects/{project_id}/sessions",
    response_model=list[SessionResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    project_id: uuid.UUID,
    request: SessionCreateRequest,
    auth_session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    セッションを作成（単一または複数）

    Args:
        project_id: プロジェクトID
        request: セッション作成リクエスト
        session: 認証セッション
        db: データベースセッション

    Returns:
        作成されたセッションのリスト

    Raises:
        HTTPException: プロジェクトが存在しない場合、またはセッション作成に失敗した場合
    """
    try:
        # countが指定されている場合は複数セッション作成
        count = request.count if request.count is not None else 1
        sessions = []

        # プロジェクトを取得してGitServiceを初期化
        from sqlalchemy import select
        stmt = select(Project).where(Project.id == project_id)
        result = await db.execute(stmt)
        project = result.scalar_one_or_none()

        if not project:
            raise ValueError("Project not found")

        git_service = GitService(project.path)

        for i in range(count):
            # セッション名を生成（count > 1の場合は番号を付与）
            session_name = f"{request.name}-{i + 1}" if count > 1 else request.name

            new_session = await SessionService.create_session(
                db,
                project_id,
                session_name,
                request.message,
                request.model,
            )

            # Git状態を取得
            has_uncommitted_changes = False
            changed_files_count = 0
            if new_session.worktree_path:
                try:
                    git_status = await git_service.get_git_status(new_session.name)
                    has_uncommitted_changes = git_status["has_uncommitted_changes"]
                    changed_files_count = git_status["changed_files_count"]
                except Exception:
                    pass

            sessions.append(
                SessionResponse(
                    id=str(new_session.id),
                    project_id=str(new_session.project_id),
                    name=new_session.name,
                    status=new_session.status.value,
                    model=new_session.model,
                    worktree_path=new_session.worktree_path,
                    created_at=new_session.created_at.isoformat(),
                    updated_at=new_session.updated_at.isoformat(),
                    has_uncommitted_changes=has_uncommitted_changes,
                    changed_files_count=changed_files_count,
                )
            )

        return sessions
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/sessions/{id}", response_model=SessionResponse)
async def get_session(
    id: uuid.UUID,
    auth_session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    セッション詳細を取得

    Args:
        id: セッションID
        auth_session: 認証セッション
        db: データベースセッション

    Returns:
        セッション詳細

    Raises:
        HTTPException: セッションが存在しない場合
    """
    session_obj = await SessionService.get_session_by_id(db, id)
    if not session_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # プロジェクトを取得
    from sqlalchemy import select
    stmt = select(Project).where(Project.id == session_obj.project_id)
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()

    # Git状態を取得
    has_uncommitted_changes = False
    changed_files_count = 0
    if project and session_obj.worktree_path:
        git_service = GitService(project.path)
        try:
            git_status = await git_service.get_git_status(session_obj.name)
            has_uncommitted_changes = git_status["has_uncommitted_changes"]
            changed_files_count = git_status["changed_files_count"]
        except Exception:
            pass

    return SessionResponse(
        id=str(session_obj.id),
        project_id=str(session_obj.project_id),
        name=session_obj.name,
        status=session_obj.status.value,
        model=session_obj.model,
        worktree_path=session_obj.worktree_path,
        created_at=session_obj.created_at.isoformat(),
        updated_at=session_obj.updated_at.isoformat(),
        has_uncommitted_changes=has_uncommitted_changes,
        changed_files_count=changed_files_count,
    )


@router.post("/sessions/{id}/stop", response_model=SessionResponse)
async def stop_session(
    id: uuid.UUID,
    auth_session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    セッションを停止

    Args:
        id: セッションID
        auth_session: 認証セッション
        db: データベースセッション

    Returns:
        停止されたセッション

    Raises:
        HTTPException: セッションが存在しない場合、またはセッション停止に失敗した場合
    """
    try:
        stopped_session = await SessionService.stop_session(db, id)
        if not stopped_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        # プロジェクトを取得
        from sqlalchemy import select
        stmt = select(Project).where(Project.id == stopped_session.project_id)
        result = await db.execute(stmt)
        project = result.scalar_one_or_none()

        # Git状態を取得
        has_uncommitted_changes = False
        changed_files_count = 0
        if project and stopped_session.worktree_path:
            git_service = GitService(project.path)
            try:
                git_status = await git_service.get_git_status(stopped_session.name)
                has_uncommitted_changes = git_status["has_uncommitted_changes"]
                changed_files_count = git_status["changed_files_count"]
            except Exception:
                pass

        return SessionResponse(
            id=str(stopped_session.id),
            project_id=str(stopped_session.project_id),
            name=stopped_session.name,
            status=stopped_session.status.value,
            model=stopped_session.model,
            worktree_path=stopped_session.worktree_path,
            created_at=stopped_session.created_at.isoformat(),
            updated_at=stopped_session.updated_at.isoformat(),
            has_uncommitted_changes=has_uncommitted_changes,
            changed_files_count=changed_files_count,
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.delete("/sessions/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    id: uuid.UUID,
    auth_session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    セッションを削除

    Args:
        id: セッションID
        auth_session: 認証セッション
        db: データベースセッション

    Returns:
        レスポンスなし（204 No Content）

    Raises:
        HTTPException: セッションが存在しない場合、またはセッション削除に失敗した場合
    """
    try:
        success = await SessionService.delete_session(db, id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found",
            )

        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
