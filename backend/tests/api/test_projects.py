"""プロジェクトAPIのテスト"""
import pytest
from fastapi.testclient import TestClient


class TestProjectsList:
    """プロジェクト一覧取得のテスト"""

    def test_get_projects_without_authentication(self, client: TestClient):
        """認証なしでプロジェクト一覧取得が拒否される"""
        response = client.get("/api/projects")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    def test_get_projects_with_authentication(self, client: TestClient):
        """認証ありでプロジェクト一覧取得が成功する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト一覧取得
        response = client.get("/api/projects")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_projects_returns_empty_list_initially(self, client: TestClient):
        """初期状態ではプロジェクト一覧が空である"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト一覧取得
        response = client.get("/api/projects")
        assert response.status_code == 200
        assert response.json() == []


class TestProjectCreate:
    """プロジェクト追加のテスト"""

    def test_create_project_without_authentication(self, client: TestClient):
        """認証なしでプロジェクト追加が拒否される"""
        response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    def test_create_project_with_valid_git_repository(self, client: TestClient):
        """有効なGitリポジトリでプロジェクト追加が成功する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト追加
        response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["name"] == "claude-work"
        assert data["path"] == "/home/tsk/sync/git/claude-work"
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_project_with_invalid_path(self, client: TestClient):
        """無効なパスでプロジェクト追加が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト追加
        response = client.post(
            "/api/projects",
            json={"path": "/nonexistent/path"},
        )
        assert response.status_code == 400
        assert "detail" in response.json()

    def test_create_project_with_non_git_directory(self, client: TestClient):
        """Gitリポジトリでないディレクトリでプロジェクト追加が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト追加（/tmpはGitリポジトリではない）
        response = client.post(
            "/api/projects",
            json={"path": "/tmp"},
        )
        assert response.status_code == 400
        assert "detail" in response.json()
        assert "git repository" in response.json()["detail"].lower()


class TestProjectUpdate:
    """プロジェクト更新のテスト"""

    def test_update_project_without_authentication(self, client: TestClient):
        """認証なしでプロジェクト更新が拒否される"""
        response = client.put(
            "/api/projects/00000000-0000-0000-0000-000000000000",
            json={"name": "updated-name"},
        )
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    def test_update_project_name(self, client: TestClient):
        """プロジェクト名の更新が成功する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト追加
        create_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert create_response.status_code == 201
        project_id = create_response.json()["id"]

        # プロジェクト更新
        response = client.put(
            f"/api/projects/{project_id}",
            json={"name": "updated-name"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == project_id
        assert data["name"] == "updated-name"
        assert data["path"] == "/home/tsk/sync/git/claude-work"

    def test_update_nonexistent_project(self, client: TestClient):
        """存在しないプロジェクトの更新が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト更新
        response = client.put(
            "/api/projects/00000000-0000-0000-0000-000000000000",
            json={"name": "updated-name"},
        )
        assert response.status_code == 404
        assert "detail" in response.json()


class TestProjectDelete:
    """プロジェクト削除のテスト"""

    def test_delete_project_without_authentication(self, client: TestClient):
        """認証なしでプロジェクト削除が拒否される"""
        response = client.delete("/api/projects/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    def test_delete_project(self, client: TestClient):
        """プロジェクト削除が成功する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト追加
        create_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert create_response.status_code == 201
        project_id = create_response.json()["id"]

        # プロジェクト削除
        response = client.delete(f"/api/projects/{project_id}")
        assert response.status_code == 204

        # プロジェクトが削除されたことを確認
        get_response = client.get("/api/projects")
        assert get_response.status_code == 200
        assert len(get_response.json()) == 0

    def test_delete_nonexistent_project(self, client: TestClient):
        """存在しないプロジェクトの削除が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト削除
        response = client.delete("/api/projects/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404
        assert "detail" in response.json()

