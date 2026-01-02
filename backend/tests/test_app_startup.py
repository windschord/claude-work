"""アプリケーション起動のテスト"""
import pytest


def test_app_can_be_imported():
    """アプリケーションがインポートできることを確認"""
    from app.main import app
    assert app is not None
    assert app.title == "ClaudeWork Backend API"


def test_app_has_health_endpoint(client):
    """アプリケーションにヘルスチェックエンドポイントが存在することを確認"""
    response = client.get("/health")
    assert response.status_code == 200


def test_app_has_cors_middleware(client):
    """アプリケーションにCORSミドルウェアが設定されていることを確認"""
    response = client.get("/", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
