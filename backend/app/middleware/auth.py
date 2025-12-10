"""認証ミドルウェア"""
from datetime import datetime, timezone

import bcrypt
from fastapi import Cookie, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.auth_session import AuthSession


async def verify_session(
    session_id: str | None = Cookie(None, alias=settings.session_cookie_name),
    db: AsyncSession = Depends(get_db),
) -> AuthSession:
    """セッションを検証する

    Args:
        session_id: セッションID（クッキーから取得）
        db: データベースセッション

    Returns:
        有効な認証セッション

    Raises:
        HTTPException: セッションが無効な場合
    """
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # データベースからセッションを検索
    # bcryptでハッシュ化されているため、全セッションを取得して検証
    stmt = select(AuthSession).where(
        AuthSession.expires_at > datetime.now(timezone.utc)
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()

    # セッションIDとハッシュを照合
    for session in sessions:
        if _verify_token_hash(session_id, session.token_hash):
            return session

    # 有効なセッションが見つからない場合
    raise HTTPException(status_code=401, detail="Not authenticated")


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
