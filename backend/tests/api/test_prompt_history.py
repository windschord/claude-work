"""プロンプト履歴APIのテスト"""
import pytest
from fastapi.testclient import TestClient


class TestPromptHistoryList:
    """プロンプト履歴一覧取得のテスト"""

    def test_get_prompt_history_without_authentication(self, client: TestClient):
        """認証なしでプロンプト履歴一覧取得が拒否される"""
        response = client.get("/api/projects/00000000-0000-0000-0000-000000000000/prompt-history")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    def test_get_prompt_history_with_authentication(self, client: TestClient):
        """認証ありでプロンプト履歴一覧取得が成功する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        create_project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert create_project_response.status_code == 201
        project_id = create_project_response.json()["id"]

        # プロンプト履歴一覧取得
        response = client.get(f"/api/projects/{project_id}/prompt-history")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_prompt_history_returns_empty_list_initially(self, client: TestClient):
        """初期状態ではプロンプト履歴一覧が空である"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        create_project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert create_project_response.status_code == 201
        project_id = create_project_response.json()["id"]

        # プロンプト履歴一覧取得
        response = client.get(f"/api/projects/{project_id}/prompt-history")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_prompt_history_returns_limit_20(self, client: TestClient):
        """プロンプト履歴一覧取得は最大20件を返す"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        create_project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert create_project_response.status_code == 201
        project_id = create_project_response.json()["id"]

        # 25件のプロンプト履歴を作成
        for i in range(25):
            response = client.post(
                f"/api/projects/{project_id}/prompt-history",
                json={"prompt_text": f"Test prompt {i}"},
            )
            assert response.status_code == 201

        # プロンプト履歴一覧取得
        response = client.get(f"/api/projects/{project_id}/prompt-history")
        assert response.status_code == 200
        assert len(response.json()) == 20

    def test_get_prompt_history_returns_latest_first(self, client: TestClient):
        """プロンプト履歴一覧取得は最新のものが先に返される"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        create_project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert create_project_response.status_code == 201
        project_id = create_project_response.json()["id"]

        # 3件のプロンプト履歴を作成
        for i in range(3):
            response = client.post(
                f"/api/projects/{project_id}/prompt-history",
                json={"prompt_text": f"Test prompt {i}"},
            )
            assert response.status_code == 201

        # プロンプト履歴一覧取得
        response = client.get(f"/api/projects/{project_id}/prompt-history")
        assert response.status_code == 200
        history = response.json()
        assert len(history) == 3
        assert history[0]["prompt_text"] == "Test prompt 2"
        assert history[1]["prompt_text"] == "Test prompt 1"
        assert history[2]["prompt_text"] == "Test prompt 0"


class TestPromptHistoryCreate:
    """プロンプト履歴保存のテスト"""

    def test_create_prompt_history_without_authentication(self, client: TestClient):
        """認証なしでプロンプト履歴保存が拒否される"""
        response = client.post(
            "/api/projects/00000000-0000-0000-0000-000000000000/prompt-history",
            json={"prompt_text": "Test prompt"},
        )
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    def test_create_prompt_history_with_valid_data(self, client: TestClient):
        """有効なデータでプロンプト履歴保存が成功する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        create_project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert create_project_response.status_code == 201
        project_id = create_project_response.json()["id"]

        # プロンプト履歴保存
        response = client.post(
            f"/api/projects/{project_id}/prompt-history",
            json={"prompt_text": "Test prompt"},
        )
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["project_id"] == project_id
        assert data["prompt_text"] == "Test prompt"
        assert "created_at" in data

    def test_create_prompt_history_with_empty_text(self, client: TestClient):
        """空のプロンプトテキストでプロンプト履歴保存が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        create_project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert create_project_response.status_code == 201
        project_id = create_project_response.json()["id"]

        # プロンプト履歴保存
        response = client.post(
            f"/api/projects/{project_id}/prompt-history",
            json={"prompt_text": ""},
        )
        assert response.status_code == 422

    def test_create_prompt_history_with_nonexistent_project(self, client: TestClient):
        """存在しないプロジェクトでプロンプト履歴保存が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロンプト履歴保存
        response = client.post(
            "/api/projects/00000000-0000-0000-0000-000000000000/prompt-history",
            json={"prompt_text": "Test prompt"},
        )
        assert response.status_code == 404
        assert "detail" in response.json()


class TestPromptHistoryDelete:
    """プロンプト履歴削除のテスト"""

    def test_delete_prompt_history_without_authentication(self, client: TestClient):
        """認証なしでプロンプト履歴削除が拒否される"""
        response = client.delete(
            "/api/projects/00000000-0000-0000-0000-000000000000/prompt-history/1"
        )
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    def test_delete_prompt_history(self, client: TestClient):
        """プロンプト履歴削除が成功する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        create_project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert create_project_response.status_code == 201
        project_id = create_project_response.json()["id"]

        # プロンプト履歴保存
        create_response = client.post(
            f"/api/projects/{project_id}/prompt-history",
            json={"prompt_text": "Test prompt"},
        )
        assert create_response.status_code == 201
        history_id = create_response.json()["id"]

        # プロンプト履歴削除
        response = client.delete(f"/api/projects/{project_id}/prompt-history/{history_id}")
        assert response.status_code == 204

        # プロンプト履歴が削除されたことを確認
        get_response = client.get(f"/api/projects/{project_id}/prompt-history")
        assert get_response.status_code == 200
        assert len(get_response.json()) == 0

    def test_delete_nonexistent_prompt_history(self, client: TestClient):
        """存在しないプロンプト履歴の削除が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        create_project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert create_project_response.status_code == 201
        project_id = create_project_response.json()["id"]

        # プロンプト履歴削除
        response = client.delete(f"/api/projects/{project_id}/prompt-history/999999")
        assert response.status_code == 404
        assert "detail" in response.json()
