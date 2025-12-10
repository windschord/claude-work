"""アプリケーション設定"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """アプリケーション設定クラス"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # アプリケーション設定
    app_name: str = "ClaudeWork Backend API"
    debug: bool = False

    # CORS設定
    cors_origins: list[str] = ["http://localhost:3000"]

    # ログ設定
    log_level: str = "INFO"

    # データベース設定
    database_url: str = "sqlite+aiosqlite:////home/tsk/sync/git/claude-work/data/claudework.db"

    # 認証設定
    auth_token: str = "development_token_change_in_production"
    session_cookie_name: str = "session_id"
    session_expires_hours: int = 24


settings = Settings()
