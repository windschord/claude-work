"""セッションAPI"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_session
from app.models.auth_session import AuthSession
from app.services.session_service import SessionService

router = APIRouter(prefix="/api", tags=["sessions"])


class SessionCreateRequest(BaseModel):
    """セッション作成リクエスト"""

    name: str
    message: str
    count: int | None = None

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
    worktree_path: str | None
    created_at: str
    updated_at: str

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
        return [
            SessionResponse(
                id=str(s.id),
                project_id=str(s.project_id),
                name=s.name,
                status=s.status.value,
                worktree_path=s.worktree_path,
                created_at=s.created_at.isoformat(),
                updated_at=s.updated_at.isoformat(),
            )
            for s in sessions
        ]
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

        for i in range(count):
            # セッション名を生成（count > 1の場合は番号を付与）
            session_name = f"{request.name}-{i + 1}" if count > 1 else request.name

            new_session = await SessionService.create_session(
                db,
                project_id,
                session_name,
                request.message,
            )
            sessions.append(
                SessionResponse(
                    id=str(new_session.id),
                    project_id=str(new_session.project_id),
                    name=new_session.name,
                    status=new_session.status.value,
                    worktree_path=new_session.worktree_path,
                    created_at=new_session.created_at.isoformat(),
                    updated_at=new_session.updated_at.isoformat(),
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

    return SessionResponse(
        id=str(session_obj.id),
        project_id=str(session_obj.project_id),
        name=session_obj.name,
        status=session_obj.status.value,
        worktree_path=session_obj.worktree_path,
        created_at=session_obj.created_at.isoformat(),
        updated_at=session_obj.updated_at.isoformat(),
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

        return SessionResponse(
            id=str(stopped_session.id),
            project_id=str(stopped_session.project_id),
            name=stopped_session.name,
            status=stopped_session.status.value,
            worktree_path=stopped_session.worktree_path,
            created_at=stopped_session.created_at.isoformat(),
            updated_at=stopped_session.updated_at.isoformat(),
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
