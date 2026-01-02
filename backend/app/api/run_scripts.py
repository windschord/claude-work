"""ランスクリプトAPI"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_session
from app.models.auth_session import AuthSession
from app.models.project import Project
from app.models.run_script import RunScript
from app.models.session import Session
from app.services.script_runner import ScriptRunner

router = APIRouter(prefix="/api/projects/{project_id}/run-scripts", tags=["run_scripts"])


class RunScriptCreateRequest(BaseModel):
    """ランスクリプト作成リクエスト"""

    name: str
    command: str


class RunScriptUpdateRequest(BaseModel):
    """ランスクリプト更新リクエスト"""

    name: str
    command: str


class RunScriptResponse(BaseModel):
    """ランスクリプトレスポンス"""

    id: int
    project_id: str
    name: str
    command: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[RunScriptResponse])
async def get_run_scripts(
    project_id: str,
    session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    ランスクリプト一覧を取得

    Args:
        project_id: プロジェクトID
        session: 認証セッション
        db: データベースセッション

    Returns:
        ランスクリプトのリスト

    Raises:
        HTTPException: プロジェクトが見つからない場合
    """
    # プロジェクトの存在確認
    try:
        project_uuid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project_id format",
        )

    result = await db.execute(select(Project).where(Project.id == project_uuid))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # ランスクリプト一覧を取得
    result = await db.execute(
        select(RunScript).where(RunScript.project_id == str(project_uuid)).order_by(RunScript.id)
    )
    run_scripts = result.scalars().all()

    return [
        RunScriptResponse(
            id=script.id,
            project_id=script.project_id,
            name=script.name,
            command=script.command,
            created_at=script.created_at.isoformat(),
            updated_at=script.updated_at.isoformat(),
        )
        for script in run_scripts
    ]


@router.post("", response_model=RunScriptResponse, status_code=status.HTTP_201_CREATED)
async def create_run_script(
    project_id: str,
    request: RunScriptCreateRequest,
    session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    ランスクリプトを作成

    Args:
        project_id: プロジェクトID
        request: ランスクリプト作成リクエスト
        session: 認証セッション
        db: データベースセッション

    Returns:
        作成されたランスクリプト

    Raises:
        HTTPException: プロジェクトが見つからない場合
    """
    # プロジェクトの存在確認
    try:
        project_uuid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project_id format",
        )

    result = await db.execute(select(Project).where(Project.id == project_uuid))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # ランスクリプトを作成
    run_script = RunScript(
        project_id=str(project_uuid),
        name=request.name,
        command=request.command,
    )

    db.add(run_script)
    await db.commit()
    await db.refresh(run_script)

    return RunScriptResponse(
        id=run_script.id,
        project_id=run_script.project_id,
        name=run_script.name,
        command=run_script.command,
        created_at=run_script.created_at.isoformat(),
        updated_at=run_script.updated_at.isoformat(),
    )


@router.put("/{script_id}", response_model=RunScriptResponse)
async def update_run_script(
    project_id: str,
    script_id: int,
    request: RunScriptUpdateRequest,
    session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    ランスクリプトを更新

    Args:
        project_id: プロジェクトID
        script_id: ランスクリプトID
        request: ランスクリプト更新リクエスト
        session: 認証セッション
        db: データベースセッション

    Returns:
        更新されたランスクリプト

    Raises:
        HTTPException: プロジェクトまたはランスクリプトが見つからない場合
    """
    # プロジェクトの存在確認
    try:
        project_uuid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project_id format",
        )

    result = await db.execute(select(Project).where(Project.id == project_uuid))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # ランスクリプトを取得
    result = await db.execute(
        select(RunScript).where(
            RunScript.id == script_id,
            RunScript.project_id == str(project_uuid),
        )
    )
    run_script = result.scalar_one_or_none()

    if not run_script:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run script not found",
        )

    # ランスクリプトを更新
    run_script.name = request.name
    run_script.command = request.command

    await db.commit()
    await db.refresh(run_script)

    return RunScriptResponse(
        id=run_script.id,
        project_id=run_script.project_id,
        name=run_script.name,
        command=run_script.command,
        created_at=run_script.created_at.isoformat(),
        updated_at=run_script.updated_at.isoformat(),
    )


@router.delete("/{script_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_run_script(
    project_id: str,
    script_id: int,
    session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    ランスクリプトを削除

    Args:
        project_id: プロジェクトID
        script_id: ランスクリプトID
        session: 認証セッション
        db: データベースセッション

    Raises:
        HTTPException: プロジェクトまたはランスクリプトが見つからない場合
    """
    # プロジェクトの存在確認
    try:
        project_uuid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project_id format",
        )

    result = await db.execute(select(Project).where(Project.id == project_uuid))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # ランスクリプトを取得
    result = await db.execute(
        select(RunScript).where(
            RunScript.id == script_id,
            RunScript.project_id == str(project_uuid),
        )
    )
    run_script = result.scalar_one_or_none()

    if not run_script:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run script not found",
        )

    # ランスクリプトを削除
    await db.delete(run_script)
    await db.commit()


# スクリプト実行用のルーター（セッションベース）
execution_router = APIRouter(tags=["run_scripts"])


class ScriptExecutionResult(BaseModel):
    """スクリプト実行結果"""

    success: bool
    output: str
    exit_code: int
    execution_time: float


@execution_router.post("/api/execute-script/{target_session_id}/{script_id}", response_model=ScriptExecutionResult)
async def execute_run_script(
    target_session_id: str,
    script_id: int,
    auth_session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    セッションのworktree内でランスクリプトを実行

    Args:
        target_session_id: セッションID
        script_id: ランスクリプトID
        auth_session: 認証セッション
        db: データベースセッション

    Returns:
        スクリプト実行結果

    Raises:
        HTTPException: セッションまたはスクリプトが見つからない場合
    """
    # セッションの存在確認
    try:
        session_uuid = uuid.UUID(target_session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session_id format",
        )

    result = await db.execute(select(Session).where(Session.id == session_uuid))
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # ランスクリプトの存在確認
    result = await db.execute(
        select(RunScript).where(
            RunScript.id == script_id,
            RunScript.project_id == session.project_id,
        )
    )
    run_script = result.scalar_one_or_none()

    if not run_script:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run script not found",
        )

    # スクリプトを実行
    script_runner = ScriptRunner()
    execution_result = await script_runner.run_script(
        worktree_path=session.worktree_path,
        command=run_script.command,
    )

    return ScriptExecutionResult(
        success=execution_result["success"],
        output=execution_result["output"],
        exit_code=execution_result["exit_code"],
        execution_time=execution_result["execution_time"],
    )
