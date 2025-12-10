"""プロジェクトAPI"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_session
from app.models.auth_session import AuthSession
from app.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreateRequest(BaseModel):
    """プロジェクト作成リクエスト"""

    path: str


class ProjectUpdateRequest(BaseModel):
    """プロジェクト更新リクエスト"""

    name: str


class ProjectResponse(BaseModel):
    """プロジェクトレスポンス"""

    id: str
    name: str
    path: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


@router.get("", response_model=list[ProjectResponse])
async def get_projects(
    session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    プロジェクト一覧を取得

    Args:
        session: 認証セッション
        db: データベースセッション

    Returns:
        プロジェクトのリスト
    """
    projects = await ProjectService.get_all_projects(db)
    return [
        ProjectResponse(
            id=str(project.id),
            name=project.name,
            path=project.path,
            created_at=project.created_at.isoformat(),
            updated_at=project.updated_at.isoformat(),
        )
        for project in projects
    ]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    request: ProjectCreateRequest,
    session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    プロジェクトを作成

    Args:
        request: プロジェクト作成リクエスト
        session: 認証セッション
        db: データベースセッション

    Returns:
        作成されたプロジェクト

    Raises:
        HTTPException: プロジェクト作成に失敗した場合
    """
    try:
        project = await ProjectService.create_project(db, request.path)
        return ProjectResponse(
            id=str(project.id),
            name=project.name,
            path=project.path,
            created_at=project.created_at.isoformat(),
            updated_at=project.updated_at.isoformat(),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    request: ProjectUpdateRequest,
    session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    プロジェクトを更新

    Args:
        project_id: プロジェクトID
        request: プロジェクト更新リクエスト
        session: 認証セッション
        db: データベースセッション

    Returns:
        更新されたプロジェクト

    Raises:
        HTTPException: プロジェクトが存在しない場合
    """
    project = await ProjectService.update_project(
        db,
        project_id,
        name=request.name,
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        path=project.path,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    session: AuthSession = Depends(verify_session),
    db: AsyncSession = Depends(get_db),
):
    """
    プロジェクトを削除

    Args:
        project_id: プロジェクトID
        session: 認証セッション
        db: データベースセッション

    Returns:
        レスポンスなし（204 No Content）

    Raises:
        HTTPException: プロジェクトが存在しない場合
    """
    success = await ProjectService.delete_project(db, project_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)

