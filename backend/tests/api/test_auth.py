"""認証APIのテスト"""
import pytest
from fastapi.testclient import TestClient


class TestLogin:
    """ログインエンドポイントのテスト"""

    def test_login_success_with_correct_token(self, client: TestClient):
        """正しいトークンでログインが成功する"""
        response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert response.status_code == 200
        assert response.json() == {"message": "Login successful"}
        # セッションクッキーが設定されていることを確認
        assert "session_id" in response.cookies

    def test_login_failure_with_incorrect_token(self, client: TestClient):
        """誤ったトークンでログインが失敗する"""
        response = client.post(
            "/api/auth/login",
            data={"token": "wrong_token"},
        )
        assert response.status_code == 401
        assert response.json() == {"detail": "Invalid token"}
        # セッションクッキーが設定されていないことを確認
        assert "session_id" not in response.cookies

    def test_login_failure_without_token(self, client: TestClient):
        """トークンなしでログインが失敗する"""
        response = client.post("/api/auth/login", data={})
        assert response.status_code == 422  # Validation error


class TestLogout:
    """ログアウトエンドポイントのテスト"""

    def test_logout_success(self, client: TestClient):
        """ログアウトが成功する"""
        # まずログインする
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200
        session_cookie = login_response.cookies.get("session_id")
        assert session_cookie is not None

        # ログアウトする
        logout_response = client.post("/api/auth/logout")
        assert logout_response.status_code == 200
        assert logout_response.json() == {"message": "Logout successful"}


class TestProtectedEndpoint:
    """認証が必要なエンドポイントのテスト"""

    def test_access_denied_without_authentication(self, client: TestClient):
        """認証なしでprotected endpointへのアクセスが拒否される"""
        response = client.get("/api/protected")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    def test_access_granted_with_authentication(self, client: TestClient):
        """認証ありでprotected endpointへのアクセスが許可される"""
        # まずログインする
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # 認証が必要なエンドポイントにアクセス
        response = client.get("/api/protected")
        assert response.status_code == 200
        assert "message" in response.json()

    def test_access_denied_after_logout(self, client: TestClient):
        """ログアウト後はprotected endpointへのアクセスが拒否される"""
        # まずログインする
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # ログアウトする
        logout_response = client.post("/api/auth/logout")
        assert logout_response.status_code == 200

        # 認証が必要なエンドポイントにアクセス
        response = client.get("/api/protected")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}
