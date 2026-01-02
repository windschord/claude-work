"""認証API"""
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Cookie, Depends, Form, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.auth_session import AuthSession

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login(
    response: Response,
    token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """ログインエンドポイント

    Args:
        response: FastAPIのResponse
        token: 認証トークン
        db: データベースセッション

    Returns:
        ログイン成功メッセージ

    Raises:
        HTTPException: トークンが無効な場合
    """
    # トークンの検証
    if not _verify_token(token, settings.auth_token):
        raise HTTPException(status_code=401, detail="Invalid token")

    # セッションIDを生成
    session_id = str(uuid.uuid4())

    # セッションをデータベースに保存
    token_hash = _hash_token(session_id)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.session_expires_hours)

    auth_session = AuthSession(
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(auth_session)
    await db.commit()

    # セッションクッキーを設定
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_id,
        httponly=True,
        max_age=settings.session_expires_hours * 3600,
        samesite="lax",
    )

    return {"message": "Login successful"}


@router.post("/logout")
async def logout(
    response: Response,
    session_id: str | None = Cookie(None, alias=settings.session_cookie_name),
    db: AsyncSession = Depends(get_db),
):
    """ログアウトエンドポイント

    Args:
        response: FastAPIのResponse
        session_id: セッションID（クッキーから取得）
        db: データベースセッション

    Returns:
        ログアウト成功メッセージ
    """
    # セッションをデータベースから削除
    if session_id:
        # セッションIDに対応するハッシュを検索して削除
        stmt = select(AuthSession)
        result = await db.execute(stmt)
        sessions = result.scalars().all()

        for session in sessions:
            if _verify_token_hash(session_id, session.token_hash):
                await db.delete(session)
                await db.commit()
                break

    # セッションクッキーを削除
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        samesite="lax",
    )

    return {"message": "Logout successful"}


def _verify_token(provided_token: str, expected_token: str) -> bool:
    """トークンを検証する

    Args:
        provided_token: 提供されたトークン
        expected_token: 期待されるトークン

    Returns:
        トークンが一致する場合True
    """
    return provided_token == expected_token


def _hash_token(token: str) -> str:
    """トークンをハッシュ化する

    Args:
        token: ハッシュ化するトークン

    Returns:
        ハッシュ化されたトークン
    """
    return bcrypt.hashpw(token.encode(), bcrypt.gensalt()).decode()


def _verify_token_hash(token: str, token_hash: str) -> bool:
    """トークンとハッシュを検証する

    Args:
        token: 検証するトークン
        token_hash: トークンのハッシュ

    Returns:
        トークンとハッシュが一致する場合True
    """
    try:
        return bcrypt.checkpw(token.encode(), token_hash.encode())
    except Exception:
        return False
