"""ランスクリプトAPIのテスト"""
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


class TestRunScripts:
    """ランスクリプトAPIのテスト"""

    def _login(self, client: TestClient) -> None:
        """ログイン処理"""
        response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert response.status_code == 200

    def _create_project(self, client: TestClient, path: str = "/home/tsk/sync/git/claude-work") -> str:
        """テスト用プロジェクトを作成"""
        response = client.post(
            "/api/projects",
            json={"path": path},
        )
        assert response.status_code == 201
        return response.json()["id"]

    def test_get_run_scripts_without_authentication(self, client: TestClient):
        """認証なしでランスクリプト一覧取得が拒否される"""
        fake_uuid = str(uuid.uuid4())
        response = client.get(f"/api/projects/{fake_uuid}/run-scripts")
        assert response.status_code == 401

    def test_get_run_scripts_empty(self, client: TestClient):
        """ランスクリプトが存在しない場合、空のリストを返す"""
        self._login(client)
        project_id = self._create_project(client)

        response = client.get(f"/api/projects/{project_id}/run-scripts")

        assert response.status_code == 200
        assert response.json() == []

    def test_get_run_scripts_project_not_found(self, client: TestClient):
        """存在しないプロジェクトの場合、404エラーを返す"""
        self._login(client)
        fake_uuid = str(uuid.uuid4())

        response = client.get(f"/api/projects/{fake_uuid}/run-scripts")

        assert response.status_code == 404
        assert response.json()["detail"] == "Project not found"

    def test_create_run_script(self, client: TestClient):
        """ランスクリプトを作成できる"""
        self._login(client)
        project_id = self._create_project(client)

        response = client.post(
            f"/api/projects/{project_id}/run-scripts",
            json={
                "name": "Build",
                "command": "npm run build",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Build"
        assert data["command"] == "npm run build"
        assert data["project_id"] == project_id
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    def test_get_run_scripts(self, client: TestClient):
        """ランスクリプト一覧を取得できる"""
        self._login(client)
        project_id = self._create_project(client)

        # ランスクリプトを作成
        client.post(
            f"/api/projects/{project_id}/run-scripts",
            json={"name": "Build", "command": "npm run build"},
        )
        client.post(
            f"/api/projects/{project_id}/run-scripts",
            json={"name": "Test", "command": "npm test"},
        )

        response = client.get(f"/api/projects/{project_id}/run-scripts")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == "Build"
        assert data[0]["command"] == "npm run build"
        assert data[1]["name"] == "Test"
        assert data[1]["command"] == "npm test"

    def test_create_run_script_project_not_found(self, client: TestClient):
        """存在しないプロジェクトの場合、404エラーを返す"""
        self._login(client)
        fake_uuid = str(uuid.uuid4())

        response = client.post(
            f"/api/projects/{fake_uuid}/run-scripts",
            json={
                "name": "Build",
                "command": "npm run build",
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Project not found"

    def test_update_run_script(self, client: TestClient):
        """ランスクリプトを更新できる"""
        self._login(client)
        project_id = self._create_project(client)

        # ランスクリプトを作成
        create_response = client.post(
            f"/api/projects/{project_id}/run-scripts",
            json={"name": "Build", "command": "npm run build"},
        )
        script_id = create_response.json()["id"]

        # ランスクリプトを更新
        response = client.put(
            f"/api/projects/{project_id}/run-scripts/{script_id}",
            json={
                "name": "Build Updated",
                "command": "npm run build -- --production",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == script_id
        assert data["name"] == "Build Updated"
        assert data["command"] == "npm run build -- --production"

    def test_update_run_script_not_found(self, client: TestClient):
        """存在しないランスクリプトの場合、404エラーを返す"""
        self._login(client)
        project_id = self._create_project(client)

        response = client.put(
            f"/api/projects/{project_id}/run-scripts/99999",
            json={
                "name": "Build Updated",
                "command": "npm run build",
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Run script not found"

    def test_delete_run_script(self, client: TestClient):
        """ランスクリプトを削除できる"""
        self._login(client)
        project_id = self._create_project(client)

        # ランスクリプトを作成
        create_response = client.post(
            f"/api/projects/{project_id}/run-scripts",
            json={"name": "Build", "command": "npm run build"},
        )
        script_id = create_response.json()["id"]

        # ランスクリプトを削除
        response = client.delete(f"/api/projects/{project_id}/run-scripts/{script_id}")

        assert response.status_code == 204

        # 削除されたことを確認
        response = client.get(f"/api/projects/{project_id}/run-scripts")
        assert response.status_code == 200
        assert response.json() == []

    def test_delete_run_script_not_found(self, client: TestClient):
        """存在しないランスクリプトの場合、404エラーを返す"""
        self._login(client)
        project_id = self._create_project(client)

        response = client.delete(f"/api/projects/{project_id}/run-scripts/99999")

        assert response.status_code == 404
        assert response.json()["detail"] == "Run script not found"


class TestExecuteRunScript:
    """ランスクリプト実行APIのテスト"""

    def _login(self, client: TestClient) -> None:
        """ログイン処理"""
        response = client.post(
            "/api/auth/login",
            data={"token": "development_token_change_in_production"},
        )
        assert response.status_code == 200

    def _create_project(self, client: TestClient, path: str = "/home/tsk/sync/git/claude-work") -> str:
        """テスト用プロジェクトを作成"""
        response = client.post(
            "/api/projects",
            json={"path": path},
        )
        assert response.status_code == 201
        return response.json()["id"]

    def _create_session(self, client: TestClient, project_id: str) -> str:
        """テスト用セッションを作成"""
        with patch("app.services.session_service.GitService") as mock_git_service_class, \
             patch("app.services.session_service.ProcessManager") as mock_process_manager_class:

            mock_git_service = AsyncMock()
            mock_git_service.create_worktree.return_value = "/home/tsk/sync/git/claude-work/.worktrees/test-session"
            mock_git_service.get_git_status.return_value = {
                "has_changes": False,
                "files": [],
            }
            mock_git_service_class.return_value = mock_git_service

            mock_process_manager = AsyncMock()
            mock_process_manager.start_claude_code = AsyncMock()
            mock_process_manager_class.return_value = mock_process_manager

            response = client.post(
                f"/api/projects/{project_id}/sessions",
                json={"name": "test-session", "message": "test message"},
            )
            assert response.status_code == 201
            return response.json()["id"]

    def _create_run_script(self, client: TestClient, project_id: str) -> int:
        """テスト用ランスクリプトを作成"""
        response = client.post(
            f"/api/projects/{project_id}/run-scripts",
            json={
                "name": "Test Script",
                "command": "echo 'test'",
            },
        )
        assert response.status_code == 201
        return response.json()["id"]

    @patch("app.api.run_scripts.ScriptRunner")
    def test_execute_run_script_success(self, mock_script_runner_class, client: TestClient):
        """ランスクリプトを実行できる"""
        self._login(client)
        project_id = self._create_project(client)
        session_id = self._create_session(client, project_id)
        script_id = self._create_run_script(client, project_id)

        # ScriptRunnerのモック設定
        mock_script_runner = AsyncMock()
        mock_script_runner.run_script = AsyncMock(return_value={
            "success": True,
            "output": "test output\nline 2",
            "exit_code": 0,
            "execution_time": 1.23,
        })
        mock_script_runner_class.return_value = mock_script_runner

        # スクリプト実行
        response = client.post(f"/api/execute-script/{session_id}/{script_id}")

        # 結果を確認
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["output"] == "test output\nline 2"
        assert data["exit_code"] == 0
        assert data["execution_time"] == 1.23

        # ScriptRunnerが正しく呼ばれたことを確認
        mock_script_runner.run_script.assert_called_once()

    @patch("app.api.run_scripts.ScriptRunner")
    def test_execute_run_script_failure(self, mock_script_runner_class, client: TestClient):
        """スクリプト実行が失敗した場合の動作"""
        self._login(client)
        project_id = self._create_project(client)
        session_id = self._create_session(client, project_id)
        script_id = self._create_run_script(client, project_id)

        # ScriptRunnerのモック設定（失敗）
        mock_script_runner = AsyncMock()
        mock_script_runner.run_script = AsyncMock(return_value={
            "success": False,
            "output": "error message",
            "exit_code": 1,
            "execution_time": 0.5,
        })
        mock_script_runner_class.return_value = mock_script_runner

        # スクリプト実行
        response = client.post(f"/api/execute-script/{session_id}/{script_id}")

        # 結果を確認
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert data["exit_code"] == 1
        assert "error" in data["output"].lower()

    def test_execute_run_script_session_not_found(self, client: TestClient):
        """存在しないセッションの場合、404エラーを返す"""
        self._login(client)
        project_id = self._create_project(client)
        script_id = self._create_run_script(client, project_id)
        fake_session_id = str(uuid.uuid4())

        response = client.post(f"/api/execute-script/{fake_session_id}/{script_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Session not found"

    def test_execute_run_script_script_not_found(self, client: TestClient):
        """存在しないスクリプトの場合、404エラーを返す"""
        self._login(client)
        project_id = self._create_project(client)
        session_id = self._create_session(client, project_id)

        response = client.post(f"/api/execute-script/{session_id}/99999")

        assert response.status_code == 404
        assert response.json()["detail"] == "Run script not found"

    def test_execute_run_script_without_authentication(self, client: TestClient):
        """認証なしでスクリプト実行が拒否される"""
        response = client.post(f"/api/execute-script/{uuid.uuid4()}/1")
        assert response.status_code == 401

