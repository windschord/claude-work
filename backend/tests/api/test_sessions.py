"""セッションAPIのテスト"""
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


class TestSessionsList:
    """セッション一覧取得のテスト"""

    def test_get_sessions_without_authentication(self, client: TestClient):
        """認証なしでセッション一覧取得が拒否される"""
        response = client.get("/api/projects/00000000-0000-0000-0000-000000000000/sessions")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    def test_get_sessions_with_authentication(self, client: TestClient):
        """認証ありでセッション一覧取得が成功する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        # セッション一覧取得
        response = client.get(f"/api/projects/{project_id}/sessions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_sessions_returns_empty_list_initially(self, client: TestClient):
        """初期状態ではセッション一覧が空である"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        # セッション一覧取得
        response = client.get(f"/api/projects/{project_id}/sessions")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_sessions_for_nonexistent_project(self, client: TestClient):
        """存在しないプロジェクトのセッション一覧取得が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # セッション一覧取得
        response = client.get("/api/projects/00000000-0000-0000-0000-000000000000/sessions")
        assert response.status_code == 404
        assert "detail" in response.json()


class TestSessionCreate:
    """セッション作成のテスト"""

    def test_create_session_without_authentication(self, client: TestClient):
        """認証なしでセッション作成が拒否される"""
        response = client.post(
            "/api/projects/00000000-0000-0000-0000-000000000000/sessions",
            json={"name": "test-session", "message": "test message"},
        )
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_create_session_success(
        self,
        mock_process_manager_class,
        mock_git_service_class,
        client: TestClient,
    ):
        """セッション作成が成功する"""
        # モックの設定
        mock_git_service = AsyncMock()
        mock_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_git_service_class.return_value = mock_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        # セッション作成
        response = client.post(
            f"/api/projects/{project_id}/sessions",
            json={"name": "test-session", "message": "test message"},
        )
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["name"] == "test-session"
        assert data["project_id"] == project_id
        assert data["status"] == "running"
        assert data["worktree_path"] == "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        assert "created_at" in data
        assert "updated_at" in data

        # GitServiceとProcessManagerが呼ばれたことを確認
        mock_git_service.create_worktree.assert_called_once()
        mock_process_manager.start_claude_code.assert_called_once()

    def test_create_session_for_nonexistent_project(self, client: TestClient):
        """存在しないプロジェクトに対するセッション作成が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # セッション作成
        response = client.post(
            "/api/projects/00000000-0000-0000-0000-000000000000/sessions",
            json={"name": "test-session", "message": "test message"},
        )
        assert response.status_code == 404
        assert "detail" in response.json()

    @patch("app.services.session_service.GitService")
    def test_create_session_worktree_failure(
        self,
        mock_git_service_class,
        client: TestClient,
    ):
        """worktree作成失敗時にセッション作成が失敗する"""
        # モックの設定
        mock_git_service = AsyncMock()
        mock_git_service.create_worktree.side_effect = RuntimeError("Worktree creation failed")
        mock_git_service_class.return_value = mock_git_service

        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        # セッション作成
        response = client.post(
            f"/api/projects/{project_id}/sessions",
            json={"name": "test-session", "message": "test message"},
        )
        assert response.status_code == 500
        assert "detail" in response.json()


class TestSessionDetail:
    """セッション詳細取得のテスト"""

    def test_get_session_without_authentication(self, client: TestClient):
        """認証なしでセッション詳細取得が拒否される"""
        response = client.get("/api/sessions/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_get_session_detail(
        self,
        mock_process_manager_class,
        mock_git_service_class,
        client: TestClient,
    ):
        """セッション詳細取得が成功する"""
        # モックの設定
        mock_git_service = AsyncMock()
        mock_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_git_service_class.return_value = mock_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        # セッション作成
        create_response = client.post(
            f"/api/projects/{project_id}/sessions",
            json={"name": "test-session", "message": "test message"},
        )
        assert create_response.status_code == 201
        session_id = create_response.json()["id"]

        # セッション詳細取得
        response = client.get(f"/api/sessions/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == session_id
        assert data["name"] == "test-session"
        assert data["project_id"] == project_id

    def test_get_nonexistent_session(self, client: TestClient):
        """存在しないセッションの詳細取得が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # セッション詳細取得
        response = client.get("/api/sessions/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404
        assert "detail" in response.json()


class TestSessionStop:
    """セッション停止のテスト"""

    def test_stop_session_without_authentication(self, client: TestClient):
        """認証なしでセッション停止が拒否される"""
        response = client.post("/api/sessions/00000000-0000-0000-0000-000000000000/stop")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_stop_session_success(
        self,
        mock_process_manager_class,
        mock_git_service_class,
        client: TestClient,
    ):
        """セッション停止が成功する"""
        # モックの設定
        mock_git_service = AsyncMock()
        mock_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_git_service_class.return_value = mock_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        # セッション作成
        create_response = client.post(
            f"/api/projects/{project_id}/sessions",
            json={"name": "test-session", "message": "test message"},
        )
        assert create_response.status_code == 201
        session_id = create_response.json()["id"]

        # セッション停止
        response = client.post(f"/api/sessions/{session_id}/stop")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == session_id
        assert data["status"] == "completed"

        # ProcessManagerのstopが呼ばれたことを確認
        mock_process_manager.stop.assert_called_once()

    def test_stop_nonexistent_session(self, client: TestClient):
        """存在しないセッションの停止が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # セッション停止
        response = client.post("/api/sessions/00000000-0000-0000-0000-000000000000/stop")
        assert response.status_code == 404
        assert "detail" in response.json()


class TestSessionDelete:
    """セッション削除のテスト"""

    def test_delete_session_without_authentication(self, client: TestClient):
        """認証なしでセッション削除が拒否される"""
        response = client.delete("/api/sessions/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_delete_session_success(
        self,
        mock_process_manager_class,
        mock_git_service_class,
        client: TestClient,
    ):
        """セッション削除が成功する"""
        # モックの設定
        mock_git_service = AsyncMock()
        mock_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_git_service.delete_worktree.return_value = None
        mock_git_service_class.return_value = mock_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # プロジェクト作成
        project_response = client.post(
            "/api/projects",
            json={"path": "/home/tsk/sync/git/claude-work"},
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]

        # セッション作成
        create_response = client.post(
            f"/api/projects/{project_id}/sessions",
            json={"name": "test-session", "message": "test message"},
        )
        assert create_response.status_code == 201
        session_id = create_response.json()["id"]

        # セッション削除
        response = client.delete(f"/api/sessions/{session_id}")
        assert response.status_code == 204

        # セッションが削除されたことを確認
        get_response = client.get(f"/api/sessions/{session_id}")
        assert get_response.status_code == 404

        # ProcessManagerのstopとGitServiceのdelete_worktreeが呼ばれたことを確認
        mock_process_manager.stop.assert_called_once()
        mock_git_service.delete_worktree.assert_called_once()

    def test_delete_nonexistent_session(self, client: TestClient):
        """存在しないセッションの削除が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # セッション削除
        response = client.delete("/api/sessions/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404
        assert "detail" in response.json()
