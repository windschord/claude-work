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
        session_id = create_response.json()[0]["id"]

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
        session_id = create_response.json()[0]["id"]

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
        session_id = create_response.json()[0]["id"]

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
        session_id = create_response.json()[0]["id"]

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
        session_id = create_response.json()[0]["id"]

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
        session_id = create_response.json()[0]["id"]

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
        session_id = create_response.json()[0]["id"]

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
        session_id = create_response.json()[0]["id"]

        # merge実行（メッセージなし）
        response = client.post(
            f"/api/sessions/{session_id}/merge",
            json={},
        )
        assert response.status_code == 422


class TestCommitHistoryEndpoint:
    """コミット履歴取得エンドポイントのテスト"""

    def test_get_commits_without_authentication(self, client: TestClient):
        """認証なしでコミット履歴取得が拒否される"""
        response = client.get("/api/sessions/00000000-0000-0000-0000-000000000000/commits")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_get_commits_success(
        self,
        mock_process_manager_class,
        mock_session_git_service_class,
        mock_git_ops_git_service_class,
        client: TestClient,
    ):
        """コミット履歴取得が成功する"""
        # セッション作成用のモック設定
        mock_session_git_service = AsyncMock()
        mock_session_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_session_git_service_class.return_value = mock_session_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # Git操作API用のモック設定
        mock_git_ops_git_service = AsyncMock()
        mock_git_ops_git_service.get_commit_history.return_value = [
            {
                "hash": "abc123def456",
                "message": "First commit",
                "author_name": "Test User",
                "author_email": "test@example.com",
                "date": "2025-12-12T10:00:00+09:00",
            },
            {
                "hash": "def456ghi789",
                "message": "Second commit",
                "author_name": "Test User",
                "author_email": "test@example.com",
                "date": "2025-12-12T11:00:00+09:00",
            },
        ]
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
        session_id = create_response.json()[0]["id"]

        # コミット履歴取得
        response = client.get(f"/api/sessions/{session_id}/commits")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["hash"] == "abc123def456"
        assert data[0]["message"] == "First commit"
        assert data[0]["author_name"] == "Test User"
        assert data[0]["author_email"] == "test@example.com"
        assert data[0]["date"] == "2025-12-12T10:00:00+09:00"

        # GitServiceのget_commit_historyが呼ばれたことを確認
        # デフォルトのlimit=20で呼ばれる
        calls = mock_git_ops_git_service.get_commit_history.call_args_list
        assert len(calls) == 1
        assert calls[0][0][0] == "test-session"  # session_name

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_get_commits_with_limit(
        self,
        mock_process_manager_class,
        mock_session_git_service_class,
        mock_git_ops_git_service_class,
        client: TestClient,
    ):
        """limitパラメータ指定でコミット履歴取得が成功する"""
        # セッション作成用のモック設定
        mock_session_git_service = AsyncMock()
        mock_session_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_session_git_service_class.return_value = mock_session_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # Git操作API用のモック設定
        mock_git_ops_git_service = AsyncMock()
        mock_git_ops_git_service.get_commit_history.return_value = [
            {
                "hash": "abc123def456",
                "message": "First commit",
                "author_name": "Test User",
                "author_email": "test@example.com",
                "date": "2025-12-12T10:00:00+09:00",
            },
        ]
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
        session_id = create_response.json()[0]["id"]

        # コミット履歴取得（limit=5）
        response = client.get(f"/api/sessions/{session_id}/commits?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

        # GitServiceのget_commit_historyがlimit=5で呼ばれたことを確認
        calls = mock_git_ops_git_service.get_commit_history.call_args_list
        assert len(calls) == 1
        assert calls[0][0][0] == "test-session"  # session_name
        assert calls[0][0][1] == 5  # limit

    def test_get_commits_for_nonexistent_session(self, client: TestClient):
        """存在しないセッションのコミット履歴取得が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # コミット履歴取得
        response = client.get("/api/sessions/00000000-0000-0000-0000-000000000000/commits")
        assert response.status_code == 404
        assert "detail" in response.json()

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_get_commits_git_error(
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
        mock_git_ops_git_service.get_commit_history.side_effect = RuntimeError("Git error")
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
        session_id = create_response.json()[0]["id"]

        # コミット履歴取得
        response = client.get(f"/api/sessions/{session_id}/commits")
        assert response.status_code == 500
        assert "detail" in response.json()


class TestCommitDiffEndpoint:
    """コミットのdiff取得エンドポイントのテスト"""

    def test_get_commit_diff_without_authentication(self, client: TestClient):
        """認証なしでコミットのdiff取得が拒否される"""
        response = client.get("/api/sessions/00000000-0000-0000-0000-000000000000/commits/abc123/diff")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_get_commit_diff_success(
        self,
        mock_process_manager_class,
        mock_session_git_service_class,
        mock_git_ops_git_service_class,
        client: TestClient,
    ):
        """コミットのdiff取得が成功する"""
        # セッション作成用のモック設定
        mock_session_git_service = AsyncMock()
        mock_session_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_session_git_service_class.return_value = mock_session_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # Git操作API用のモック設定
        mock_git_ops_git_service = AsyncMock()
        mock_git_ops_git_service.get_commit_diff.return_value = "commit diff here"
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
        session_id = create_response.json()[0]["id"]

        # コミットのdiff取得
        response = client.get(f"/api/sessions/{session_id}/commits/abc123def456/diff")
        assert response.status_code == 200
        data = response.json()
        assert data["diff"] == "commit diff here"

        # GitServiceのget_commit_diffが呼ばれたことを確認
        mock_git_ops_git_service.get_commit_diff.assert_called_once_with("test-session", "abc123def456")

    def test_get_commit_diff_for_nonexistent_session(self, client: TestClient):
        """存在しないセッションのコミットdiff取得が失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # コミットのdiff取得
        response = client.get("/api/sessions/00000000-0000-0000-0000-000000000000/commits/abc123/diff")
        assert response.status_code == 404
        assert "detail" in response.json()

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_get_commit_diff_git_error(
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
        mock_git_ops_git_service.get_commit_diff.side_effect = RuntimeError("Git error")
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
        session_id = create_response.json()[0]["id"]

        # コミットのdiff取得
        response = client.get(f"/api/sessions/{session_id}/commits/abc123/diff")
        assert response.status_code == 500
        assert "detail" in response.json()


class TestResetToCommitEndpoint:
    """コミットへのリセットエンドポイントのテスト"""

    def test_reset_without_authentication(self, client: TestClient):
        """認証なしでリセットが拒否される"""
        response = client.post("/api/sessions/00000000-0000-0000-0000-000000000000/commits/abc123/reset")
        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_reset_success(
        self,
        mock_process_manager_class,
        mock_session_git_service_class,
        mock_git_ops_git_service_class,
        client: TestClient,
    ):
        """コミットへのリセットが成功する"""
        # セッション作成用のモック設定
        mock_session_git_service = AsyncMock()
        mock_session_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
        mock_session_git_service_class.return_value = mock_session_git_service

        mock_process_manager = AsyncMock()
        mock_process_manager_class.return_value = mock_process_manager

        # Git操作API用のモック設定
        mock_git_ops_git_service = AsyncMock()
        mock_git_ops_git_service.reset_to_commit.return_value = {"success": True}
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
        session_id = create_response.json()[0]["id"]

        # コミットへのリセット
        response = client.post(f"/api/sessions/{session_id}/commits/abc123def456/reset")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # GitServiceのreset_to_commitが呼ばれたことを確認
        mock_git_ops_git_service.reset_to_commit.assert_called_once_with("test-session", "abc123def456")

    def test_reset_for_nonexistent_session(self, client: TestClient):
        """存在しないセッションのリセットが失敗する"""
        # ログイン
        login_response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert login_response.status_code == 200

        # コミットへのリセット
        response = client.post("/api/sessions/00000000-0000-0000-0000-000000000000/commits/abc123/reset")
        assert response.status_code == 404
        assert "detail" in response.json()

    @patch("app.api.git_ops.GitService")
    @patch("app.services.session_service.GitService")
    @patch("app.services.session_service.ProcessManager")
    def test_reset_git_error(
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
        mock_git_ops_git_service.reset_to_commit.side_effect = RuntimeError("Git error")
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
        session_id = create_response.json()[0]["id"]

        # コミットへのリセット
        response = client.post(f"/api/sessions/{session_id}/commits/abc123/reset")
        assert response.status_code == 500
        assert "detail" in response.json()
