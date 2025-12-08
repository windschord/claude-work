"""ヘルスチェックエンドポイントのテスト"""
import pytest


def test_health_endpoint_returns_200(client):
    """ヘルスチェックエンドポイントが200を返すことを確認"""
    response = client.get("/health")
    assert response.status_code == 200


def test_health_endpoint_returns_ok_status(client):
    """ヘルスチェックエンドポイントがokステータスを返すことを確認"""
    response = client.get("/health")
    data = response.json()
    assert data["status"] == "ok"


def test_cors_headers_are_present(client):
    """CORSヘッダーが設定されていることを確認"""
    response = client.options("/health", headers={"Origin": "http://localhost:3000"})
    assert "access-control-allow-origin" in response.headers
