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
        assert isinstance(data, list)
        assert len(data) == 1
        session = data[0]
        assert "id" in session
        assert session["name"] == "test-session"
        assert session["project_id"] == project_id
        assert session["status"] == "running"
        assert session["worktree_path"] == "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        assert "created_at" in session
        assert "updated_at" in session

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
        sessions = create_response.json()
        assert isinstance(sessions, list)
        assert len(sessions) == 1
        session_id = sessions[0]["id"]

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
        sessions = create_response.json()
        assert isinstance(sessions, list)
        assert len(sessions) == 1
        session_id = sessions[0]["id"]

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
        sessions = create_response.json()
        assert isinstance(sessions, list)
        assert len(sessions) == 1
        session_id = sessions[0]["id"]

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


class TestBulkSessionCreate:
    """複数セッション作成のテスト"""

    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_create_multiple_sessions_success(
        self,
        mock_process_manager_class,
        mock_git_service_class,
        client: TestClient,
    ):
        """複数セッションの一括作成が成功する"""
        # モックの設定
        mock_git_service = AsyncMock()
        mock_git_service.create_worktree.side_effect = lambda name, branch: f"/home/tsk/sync/git/claude-work/.worktrees/{name}"
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

        # 複数セッション作成（count=3）
        response = client.post(
            f"/api/projects/{project_id}/sessions",
            json={"name": "test-session", "message": "test message", "count": 3},
        )
        assert response.status_code == 201
        data = response.json()

        # レスポンスが配列であることを確認
        assert isinstance(data, list)
        assert len(data) == 3

        # 各セッションの内容を確認
        for i, session in enumerate(data, start=1):
            assert "id" in session
            assert session["name"] == f"test-session-{i}"
            assert session["project_id"] == project_id
            assert session["status"] == "running"
            assert session["worktree_path"] == f"/home/tsk/sync/git/claude-work/.worktrees/test-session-{i}"
            assert "created_at" in session
            assert "updated_at" in session

        # GitServiceとProcessManagerが3回呼ばれたことを確認
        assert mock_git_service.create_worktree.call_count == 3
        assert mock_process_manager.start_claude_code.call_count == 3

    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_create_single_session_with_count_1(
        self,
        mock_process_manager_class,
        mock_git_service_class,
        client: TestClient,
    ):
        """count=1の場合は単一セッションとして作成される"""
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

        # セッション作成（count=1）
        response = client.post(
            f"/api/projects/{project_id}/sessions",
            json={"name": "test-session", "message": "test message", "count": 1},
        )
        assert response.status_code == 201
        data = response.json()

        # レスポンスが配列であることを確認
        assert isinstance(data, list)
        assert len(data) == 1

        # セッション名に番号が付かないことを確認
        session = data[0]
        assert session["name"] == "test-session"
        assert session["worktree_path"] == "/home/tsk/sync/git/claude-work/.worktrees/test-session"

    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_create_sessions_without_count(
        self,
        mock_process_manager_class,
        mock_git_service_class,
        client: TestClient,
    ):
        """countを指定しない場合は単一セッションとして作成される"""
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

        # セッション作成（countなし）
        response = client.post(
            f"/api/projects/{project_id}/sessions",
            json={"name": "test-session", "message": "test message"},
        )
        assert response.status_code == 201
        data = response.json()

        # レスポンスが配列であることを確認
        assert isinstance(data, list)
        assert len(data) == 1

        # セッション名に番号が付かないことを確認
        session = data[0]
        assert session["name"] == "test-session"

    def test_create_sessions_with_invalid_count(self, client: TestClient):
        """不正なcount値でセッション作成が失敗する"""
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

        # count=0でセッション作成
        response = client.post(
            f"/api/projects/{project_id}/sessions",
            json={"name": "test-session", "message": "test message", "count": 0},
        )
        assert response.status_code == 422

        # count=11でセッション作成（上限超過）
        response = client.post(
            f"/api/projects/{project_id}/sessions",
            json={"name": "test-session", "message": "test message", "count": 11},
        )
        assert response.status_code == 422
