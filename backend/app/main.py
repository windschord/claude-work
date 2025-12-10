"""FastAPIアプリケーション"""
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, projects
from app.config import settings
from app.logging_config import configure_logging, get_logger
from app.middleware.auth import verify_session
from app.models.auth_session import AuthSession


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

