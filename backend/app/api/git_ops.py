"""Git操作API"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_session
from app.models.auth_session import AuthSession
from app.models.project import Project
from app.services.git_service import GitService
from app.services.session_service import SessionService

router = APIRouter(prefix="/api", tags=["git-ops"])


class DiffResponse(BaseModel):
    """diff取得レスポンス"""

    added_files: list[str]
    modified_files: list[str]
    deleted_files: list[str]
    diff_content: str


class RebaseResponse(BaseModel):
    """rebase実行レスポンス"""

    success: bool
    conflicts: list[str] | None = None


class MergeRequest(BaseModel):
    """merge実行リクエスト"""

    message: str


class MergeResponse(BaseModel):
    """merge実行レスポンス"""

    success: bool


class CommitInfo(BaseModel):
    """コミット情報"""

    hash: str
    message: str
    author_name: str
    author_email: str
    date: str


class CommitDiffResponse(BaseModel):
    """コミットのdiff取得レスポンス"""

    diff: str


class ResetResponse(BaseModel):
    """リセット実行レスポンス"""

    success: bool


@router.get("/sessions/{id}/diff", response_model=DiffResponse)
async def get_diff(
    id: uuid.UUID,
    auth_session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    mainブランチとのdiffを取得

    Args:
        id: セッションID
        auth_session: 認証セッション
        db: データベースセッション

    Returns:
        diff情報

    Raises:
        HTTPException: セッションが存在しない場合、またはdiff取得に失敗した場合
    """
    # セッションを取得
    session = await SessionService.get_session_by_id(db, id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    try:
        # プロジェクトを取得
        stmt = select(Project).where(Project.id == session.project_id)
        result = await db.execute(stmt)
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

        # GitServiceを初期化
        git_service = GitService(project.path)

        # diffを取得
        diff_result = await git_service.get_diff(session.name)

        return DiffResponse(
            added_files=diff_result["added_files"],
            modified_files=diff_result["modified_files"],
            deleted_files=diff_result["deleted_files"],
            diff_content=diff_result["diff_content"],
        )

    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/sessions/{id}/rebase", response_model=RebaseResponse)
async def rebase_from_main(
    id: uuid.UUID,
    auth_session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    mainブランチからrebaseを実行

    Args:
        id: セッションID
        auth_session: 認証セッション
        db: データベースセッション

    Returns:
        rebase結果

    Raises:
        HTTPException: セッションが存在しない場合、またはrebase実行に失敗した場合
    """
    # セッションを取得
    session = await SessionService.get_session_by_id(db, id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    try:
        # プロジェクトを取得
        stmt = select(Project).where(Project.id == session.project_id)
        result = await db.execute(stmt)
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

        # GitServiceを初期化
        git_service = GitService(project.path)

        # rebaseを実行
        rebase_result = await git_service.rebase_from_main(session.name)

        if not rebase_result["success"]:
            # コンフリクトが発生した場合は409を返す
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content=RebaseResponse(
                    success=False,
                    conflicts=rebase_result["conflicts"],
                ).model_dump(),
            )

        return RebaseResponse(success=True)

    except HTTPException:
        # HTTPExceptionはそのまま再スロー
        raise
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/sessions/{id}/merge", response_model=MergeResponse)
async def squash_merge(
    id: uuid.UUID,
    request: MergeRequest,
    auth_session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    squash mergeを実行

    Args:
        id: セッションID
        request: merge実行リクエスト
        auth_session: 認証セッション
        db: データベースセッション

    Returns:
        merge結果

    Raises:
        HTTPException: セッションが存在しない場合、またはmerge実行に失敗した場合
    """
    # セッションを取得
    session = await SessionService.get_session_by_id(db, id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    try:
        # プロジェクトを取得
        stmt = select(Project).where(Project.id == session.project_id)
        result = await db.execute(stmt)
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

        # GitServiceを初期化
        git_service = GitService(project.path)

        # ブランチ名を構築
        branch_name = f"session/{session.name}"

        # squash mergeを実行
        merge_result = await git_service.squash_merge(branch_name, request.message)

        return MergeResponse(success=merge_result["success"])

    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/sessions/{id}/commits", response_model=list[CommitInfo])
async def get_commits(
    id: uuid.UUID,
    limit: int = 20,
    auth_session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    コミット履歴を取得

    Args:
        id: セッションID
        limit: 取得するコミット数（デフォルト: 20）
        auth_session: 認証セッション
        db: データベースセッション

    Returns:
        コミット履歴

    Raises:
        HTTPException: セッションが存在しない場合、またはコミット履歴取得に失敗した場合
    """
    # セッションを取得
    session = await SessionService.get_session_by_id(db, id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    try:
        # プロジェクトを取得
        stmt = select(Project).where(Project.id == session.project_id)
        result = await db.execute(stmt)
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

        # GitServiceを初期化
        git_service = GitService(project.path)

        # コミット履歴を取得
        commits = await git_service.get_commit_history(session.name, limit)

        return [CommitInfo(**commit) for commit in commits]

    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/sessions/{id}/commits/{commit_hash}/diff", response_model=CommitDiffResponse)
async def get_commit_diff(
    id: uuid.UUID,
    commit_hash: str,
    auth_session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    コミットのdiffを取得

    Args:
        id: セッションID
        commit_hash: コミットハッシュ
        auth_session: 認証セッション
        db: データベースセッション

    Returns:
        コミットのdiff

    Raises:
        HTTPException: セッションが存在しない場合、またはdiff取得に失敗した場合
    """
    # セッションを取得
    session = await SessionService.get_session_by_id(db, id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    try:
        # プロジェクトを取得
        stmt = select(Project).where(Project.id == session.project_id)
        result = await db.execute(stmt)
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

        # GitServiceを初期化
        git_service = GitService(project.path)

        # コミットのdiffを取得
        diff = await git_service.get_commit_diff(session.name, commit_hash)

        return CommitDiffResponse(diff=diff)

    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/sessions/{id}/commits/{commit_hash}/reset", response_model=ResetResponse)
async def reset_to_commit(
    id: uuid.UUID,
    commit_hash: str,
    auth_session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    コミットへリセット

    Args:
        id: セッションID
        commit_hash: コミットハッシュ
        auth_session: 認証セッション
        db: データベースセッション

    Returns:
        リセット結果

    Raises:
        HTTPException: セッションが存在しない場合、またはリセットに失敗した場合
    """
    # セッションを取得
    session = await SessionService.get_session_by_id(db, id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    try:
        # プロジェクトを取得
        stmt = select(Project).where(Project.id == session.project_id)
        result = await db.execute(stmt)
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )

        # GitServiceを初期化
        git_service = GitService(project.path)

        # コミットへリセット
        reset_result = await git_service.reset_to_commit(session.name, commit_hash)

        return ResetResponse(success=reset_result["success"])

    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
