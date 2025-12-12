"""FastAPIアプリケーション"""
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Cookie, Depends, FastAPI, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import auth, git_ops, projects, sessions
from app.config import settings
from app.database import get_db
from app.logging_config import configure_logging, get_logger
from app.middleware.auth import verify_session
from app.models.auth_session import AuthSession
from app.websocket.session_ws import websocket_endpoint


@asynccontextmanager
async def lifespan(app: FastAPI):
    """アプリケーションライフサイクル管理"""
    # 起動時
    configure_logging(settings.log_level)
    logger = get_logger(__name__)
    logger.info("application_startup", app_name=settings.app_name)

    yield

    # 終了時
    logger.info("application_shutdown")


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターの登録
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(sessions.router)
app.include_router(git_ops.router)


@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {"message": settings.app_name}


@app.get("/health")
async def health():
    """ヘルスチェックエンドポイント"""
    logger = get_logger(__name__)
    logger.debug("health_check_called")
    return {"status": "ok"}


@app.get("/api/protected")
async def protected(session: AuthSession = Depends(verify_session)):
    """認証が必要なエンドポイント（テスト用）"""
    return {"message": "You are authenticated", "session_id": str(session.id)}


@app.websocket("/ws/sessions/{session_id}")
async def websocket_session(
    websocket: WebSocket,
    session_id: str,
    db: AsyncSession = Depends(get_db),
    auth_session_id: Optional[str] = Cookie(None, alias=settings.session_cookie_name),
    query_session_id: Optional[str] = Query(None, alias="session_id"),
):
    """セッション用WebSocketエンドポイント"""
    await websocket_endpoint(
        websocket=websocket,
        session_id=session_id,
        db=db,
        auth_session_id=auth_session_id,
        query_session_id=query_session_id,
    )

