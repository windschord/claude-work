"""プロンプト履歴API"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, field_validator
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_session
from app.models.auth_session import AuthSession
from app.models.project import Project
from app.models.prompt_history import PromptHistory

router = APIRouter(
    prefix="/api/projects/{project_id}/prompt-history",
    tags=["prompt-history"],
)


class PromptHistoryCreateRequest(BaseModel):
    """プロンプト履歴作成リクエスト"""

    prompt_text: str

    @field_validator("prompt_text")
    @classmethod
    def validate_prompt_text(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("prompt_text must not be empty")
        return v


class PromptHistoryResponse(BaseModel):
    """プロンプト履歴レスポンス"""

    id: int
    project_id: str
    prompt_text: str
    created_at: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[PromptHistoryResponse])
async def get_prompt_history(
    project_id: uuid.UUID,
    session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    プロンプト履歴一覧を取得（最新20件）

    Args:
        project_id: プロジェクトID
        session: 認証セッション
        db: データベースセッション

    Returns:
        プロンプト履歴のリスト（最新20件）
    """
    # プロジェクトの存在確認
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # プロンプト履歴を取得（最新20件）
    result = await db.execute(
        select(PromptHistory)
        .where(PromptHistory.project_id == project_id)
        .order_by(desc(PromptHistory.created_at))
        .limit(20)
    )
    history_list = result.scalars().all()

    return [
        PromptHistoryResponse(
            id=history.id,
            project_id=str(history.project_id),
            prompt_text=history.prompt_text,
            created_at=history.created_at.isoformat(),
        )
        for history in history_list
    ]


@router.post("", response_model=PromptHistoryResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt_history(
    project_id: uuid.UUID,
    request: PromptHistoryCreateRequest,
    session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    プロンプト履歴を保存

    Args:
        project_id: プロジェクトID
        request: プロンプト履歴作成リクエスト
        session: 認証セッション
        db: データベースセッション

    Returns:
        作成されたプロンプト履歴

    Raises:
        HTTPException: プロジェクトが存在しない場合
    """
    # プロジェクトの存在確認
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # プロンプト履歴を作成
    prompt_history = PromptHistory(
        project_id=project_id,
        prompt_text=request.prompt_text,
    )
    db.add(prompt_history)
    await db.commit()
    await db.refresh(prompt_history)

    return PromptHistoryResponse(
        id=prompt_history.id,
        project_id=str(prompt_history.project_id),
        prompt_text=prompt_history.prompt_text,
        created_at=prompt_history.created_at.isoformat(),
    )


@router.delete("/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt_history(
    project_id: uuid.UUID,
    history_id: int,
    session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    プロンプト履歴を削除

    Args:
        project_id: プロジェクトID
        history_id: プロンプト履歴ID
        session: 認証セッション
        db: データベースセッション

    Returns:
        レスポンスなし（204 No Content）

    Raises:
        HTTPException: プロンプト履歴が存在しない場合
    """
    # プロンプト履歴を取得
    result = await db.execute(
        select(PromptHistory).where(
            PromptHistory.id == history_id,
            PromptHistory.project_id == project_id,
        )
    )
    prompt_history = result.scalar_one_or_none()
    if not prompt_history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt history not found",
        )

    # プロンプト履歴を削除
    await db.delete(prompt_history)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
