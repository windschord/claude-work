"""設定のテスト"""
import pytest
from app.config import Settings


def test_settings_default_values():
    """設定のデフォルト値を確認"""
    settings = Settings()

    assert settings.app_name == "ClaudeWork Backend API"
    assert settings.debug is False
    assert settings.cors_origins == ["http://localhost:3000"]
    assert settings.log_level == "INFO"


def test_settings_can_be_overridden():
    """設定が環境変数で上書きできることを確認"""
    settings = Settings(
        app_name="Test App",
        debug=True,
        log_level="DEBUG",
    )

    assert settings.app_name == "Test App"
    assert settings.debug is True
    assert settings.log_level == "DEBUG"
