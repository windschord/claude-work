"""Git操作APIのテスト"""
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


class TestDiffEndpoint:
    """diff取得エンドポイントのテスト"""

    def test_get_diff_without_authentication(self, client: TestClient):
        """認証なしでdiff取得が拒否される"""
        response = client.get("/api/sessions/00000000-0000-0000-0000-000000000000/diff")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_get_diff_success(
        self,
        mock_process_manager_class,
        mock_session_git_service_class,
        mock_git_ops_git_service_class,
        client: TestClient,
    ):
        """diff取得が成功する"""
        # セッション作成用のモック設定
        mock_session_git_service = AsyncMock()
        mock_session_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_session_git_service_class.return_value = mock_session_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # Git操作API用のモック設定
        mock_git_ops_git_service = AsyncMock()
        mock_git_ops_git_service.get_diff.return_value = {
            "added_files": ["file1.py"],
            "modified_files": ["file2.py"],
            "deleted_files": ["file3.py"],
            "diff_content": "diff content here",
        }
        mock_git_ops_git_service_class.return_value = mock_git_ops_git_service

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

        # diff取得
        response = client.get(f"/api/sessions/{session_id}/diff")
        assert response.status_code == 200
        data = response.json()
        assert data["added_files"] == ["file1.py"]
        assert data["modified_files"] == ["file2.py"]
        assert data["deleted_files"] == ["file3.py"]
        assert data["diff_content"] == "diff content here"

        # GitServiceのget_diffが呼ばれたことを確認
        mock_git_ops_git_service.get_diff.assert_called_once_with("test-session")

    def test_get_diff_for_nonexistent_session(self, client: TestClient):
        """存在しないセッションのdiff取得が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # diff取得
        response = client.get("/api/sessions/00000000-0000-0000-0000-000000000000/diff")
        assert response.status_code == 404
        assert "detail" in response.json()

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_get_diff_git_error(
        self,
        mock_process_manager_class,
        mock_session_git_service_class,
        mock_git_ops_git_service_class,
        client: TestClient,
    ):
        """GitServiceでエラーが発生した場合"""
        # セッション作成用のモック設定
        mock_session_git_service = AsyncMock()
        mock_session_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_session_git_service_class.return_value = mock_session_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # Git操作API用のモック設定
        mock_git_ops_git_service = AsyncMock()
        mock_git_ops_git_service.get_diff.side_effect = RuntimeError("Git error")
        mock_git_ops_git_service_class.return_value = mock_git_ops_git_service

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

        # diff取得
        response = client.get(f"/api/sessions/{session_id}/diff")
        assert response.status_code == 500
        assert "detail" in response.json()


class TestRebaseEndpoint:
    """rebase実行エンドポイントのテスト"""

    def test_rebase_without_authentication(self, client: TestClient):
        """認証なしでrebase実行が拒否される"""
        response = client.post("/api/sessions/00000000-0000-0000-0000-000000000000/rebase")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_rebase_success(
        self,
        mock_process_manager_class,
        mock_session_git_service_class,
        mock_git_ops_git_service_class,
        client: TestClient,
    ):
        """rebase実行が成功する"""
        # セッション作成用のモック設定
        mock_session_git_service = AsyncMock()
        mock_session_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_session_git_service_class.return_value = mock_session_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # Git操作API用のモック設定
        mock_git_ops_git_service = AsyncMock()
        mock_git_ops_git_service.rebase_from_main.return_value = {"success": True}
        mock_git_ops_git_service_class.return_value = mock_git_ops_git_service

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

        # rebase実行
        response = client.post(f"/api/sessions/{session_id}/rebase")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # GitServiceのrebase_from_mainが呼ばれたことを確認
        mock_git_ops_git_service.rebase_from_main.assert_called_once_with("test-session")

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_rebase_conflict(
        self,
        mock_process_manager_class,
        mock_session_git_service_class,
        mock_git_ops_git_service_class,
        client: TestClient,
    ):
        """rebase時にコンフリクトが発生する"""
        # セッション作成用のモック設定
        mock_session_git_service = AsyncMock()
        mock_session_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_session_git_service_class.return_value = mock_session_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # Git操作API用のモック設定
        mock_git_ops_git_service = AsyncMock()
        mock_git_ops_git_service.rebase_from_main.return_value = {
            "success": False,
            "conflicts": ["file1.py", "file2.py"],
        }
        mock_git_ops_git_service_class.return_value = mock_git_ops_git_service

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

        # rebase実行
        response = client.post(f"/api/sessions/{session_id}/rebase")
        assert response.status_code == 409
        data = response.json()
        assert data["success"] is False
        assert data["conflicts"] == ["file1.py", "file2.py"]

    def test_rebase_for_nonexistent_session(self, client: TestClient):
        """存在しないセッションのrebase実行が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # rebase実行
        response = client.post("/api/sessions/00000000-0000-0000-0000-000000000000/rebase")
        assert response.status_code == 404
        assert "detail" in response.json()

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_rebase_git_error(
        self,
        mock_process_manager_class,
        mock_session_git_service_class,
        mock_git_ops_git_service_class,
        client: TestClient,
    ):
        """GitServiceでエラーが発生した場合"""
        # セッション作成用のモック設定
        mock_session_git_service = AsyncMock()
        mock_session_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_session_git_service_class.return_value = mock_session_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # Git操作API用のモック設定
        mock_git_ops_git_service = AsyncMock()
        mock_git_ops_git_service.rebase_from_main.side_effect = RuntimeError("Git error")
        mock_git_ops_git_service_class.return_value = mock_git_ops_git_service

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

        # rebase実行
        response = client.post(f"/api/sessions/{session_id}/rebase")
        assert response.status_code == 500
        assert "detail" in response.json()


class TestMergeEndpoint:
    """squash merge実行エンドポイントのテスト"""

    def test_merge_without_authentication(self, client: TestClient):
        """認証なしでmerge実行が拒否される"""
        response = client.post(
            "/api/sessions/00000000-0000-0000-0000-000000000000/merge",
            json={"message": "commit message"},
        )
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_merge_success(
        self,
        mock_process_manager_class,
        mock_session_git_service_class,
        mock_git_ops_git_service_class,
        client: TestClient,
    ):
        """merge実行が成功する"""
        # セッション作成用のモック設定
        mock_session_git_service = AsyncMock()
        mock_session_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_session_git_service_class.return_value = mock_session_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # Git操作API用のモック設定
        mock_git_ops_git_service = AsyncMock()
        mock_git_ops_git_service.squash_merge.return_value = {"success": True}
        mock_git_ops_git_service_class.return_value = mock_git_ops_git_service

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

        # merge実行
        response = client.post(
            f"/api/sessions/{session_id}/merge",
            json={"message": "commit message"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # GitServiceのsquash_mergeが呼ばれたことを確認
        mock_git_ops_git_service.squash_merge.assert_called_once_with(
            "session/test-session",
            "commit message",
        )

    def test_merge_for_nonexistent_session(self, client: TestClient):
        """存在しないセッションのmerge実行が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # merge実行
        response = client.post(
            "/api/sessions/00000000-0000-0000-0000-000000000000/merge",
            json={"message": "commit message"},
        )
        assert response.status_code == 404
        assert "detail" in response.json()

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_merge_git_error(
        self,
        mock_process_manager_class,
        mock_session_git_service_class,
        mock_git_ops_git_service_class,
        client: TestClient,
    ):
        """GitServiceでエラーが発生した場合"""
        # セッション作成用のモック設定
        mock_session_git_service = AsyncMock()
        mock_session_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_session_git_service_class.return_value = mock_session_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # Git操作API用のモック設定
        mock_git_ops_git_service = AsyncMock()
        mock_git_ops_git_service.squash_merge.side_effect = RuntimeError("Git error")
        mock_git_ops_git_service_class.return_value = mock_git_ops_git_service

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

        # merge実行
        response = client.post(
            f"/api/sessions/{session_id}/merge",
            json={"message": "commit message"},
        )
        assert response.status_code == 500
        assert "detail" in response.json()

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_merge_without_message(
        self,
        mock_process_manager_class,
        mock_session_git_service_class,
        mock_git_ops_git_service_class,
        client: TestClient,
    ):
        """コミットメッセージなしでmerge実行が失敗する"""
        # セッション作成用のモック設定
        mock_session_git_service = AsyncMock()
        mock_session_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_session_git_service_class.return_value = mock_session_git_service

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

        # merge実行（メッセージなし）
        response = client.post(
            f"/api/sessions/{session_id}/merge",
            json={},
        )
        assert response.status_code == 422
