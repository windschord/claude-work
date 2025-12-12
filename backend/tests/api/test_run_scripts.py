"""ランスクリプトAPIのテスト"""
import uuid

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
