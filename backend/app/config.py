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


settings = Settings()
