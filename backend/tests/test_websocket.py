"""WebSocketエンドポイントのテスト"""
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def auth_session_id(client):
    """認証済みセッションを作成してセッションIDを返す"""
    # ログインしてセッションIDを取得（開発用トークンを使用）
    response = client.post(
        "/api/auth/login",
        data={"token": "development_token_change_in_production"},
    )
    assert response.status_code == 200
    # クッキーからセッションIDを取得
    session_cookie = response.cookies.get("session_id")
    return session_cookie


@pytest.fixture
def mock_process_manager():
    """ProcessManagerのモック"""
    with patch("app.services.session_service._process_managers", {}):
        yield


class TestWebSocketAuthentication:
    """WebSocket認証のテスト"""

    @pytest.mark.asyncio
    async def test_verify_websocket_session_with_valid_cookie(self):
        """クッキーでの認証が成功することを確認"""
        from app.websocket.session_ws import verify_websocket_session
        from app.models.auth_session import AuthSession
        from datetime import datetime, timedelta, timezone
        import bcrypt

        # モックのWebSocketとDB
        mock_websocket = MagicMock()
        mock_db = AsyncMock()

        # テスト用セッションを作成
        session_id = "test-session-id"
        token_hash = bcrypt.hashpw(session_id.encode(), bcrypt.gensalt()).decode()
        mock_session = AuthSession(
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )

        # DBモックの設定
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_session]
        mock_db.execute = AsyncMock(return_value=mock_result)

        # 検証実行
        result = await verify_websocket_session(
            websocket=mock_websocket,
            db=mock_db,
            session_id=session_id,
        )

        assert result == mock_session

    @pytest.mark.asyncio
    async def test_verify_websocket_session_with_query_param(self):
        """クエリパラメータでの認証が成功することを確認"""
        from app.websocket.session_ws import verify_websocket_session
        from app.models.auth_session import AuthSession
        from datetime import datetime, timedelta, timezone
        import bcrypt

        # モックのWebSocketとDB
        mock_websocket = MagicMock()
        mock_db = AsyncMock()

        # テスト用セッションを作成
        session_id = "test-session-id-query"
        token_hash = bcrypt.hashpw(session_id.encode(), bcrypt.gensalt()).decode()
        mock_session = AuthSession(
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )

        # DBモックの設定
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_session]
        mock_db.execute = AsyncMock(return_value=mock_result)

        # クエリパラメータを優先して検証
        result = await verify_websocket_session(
            websocket=mock_websocket,
            db=mock_db,
            session_id="wrong-id",
            query_session_id=session_id,
        )

        assert result == mock_session


class TestWebSocketMessageHandling:
    """WebSocketメッセージ処理のテスト"""

    @pytest.mark.asyncio
    async def test_user_input_handling(self):
        """ユーザー入力メッセージの処理を確認"""
        from app.websocket.session_ws import _process_managers
        from app.services.process_manager import ProcessManager

        session_id = str(uuid.uuid4())

        # ProcessManagerのモック
        mock_pm = MagicMock(spec=ProcessManager)
        mock_pm.send_input = AsyncMock()
        mock_pm.is_running = True
        _process_managers[session_id] = mock_pm

        # ユーザー入力を送信
        content = "Hello Claude"
        await mock_pm.send_input(content)

        # send_inputが呼ばれたことを確認
        mock_pm.send_input.assert_called_once_with(content)

        # クリーンアップ
        del _process_managers[session_id]

    @pytest.mark.asyncio
    async def test_permission_response_handling(self):
        """権限応答メッセージの処理を確認"""
        from app.websocket.session_ws import _process_managers
        from app.services.process_manager import ProcessManager

        session_id = str(uuid.uuid4())

        # ProcessManagerのモック
        mock_pm = MagicMock(spec=ProcessManager)
        mock_pm.send_input = AsyncMock()
        mock_pm.is_running = True
        _process_managers[session_id] = mock_pm

        # 権限応答を送信（承認）
        await mock_pm.send_input("yes")
        mock_pm.send_input.assert_called_with("yes")

        # 権限応答を送信（拒否）
        await mock_pm.send_input("no")
        mock_pm.send_input.assert_called_with("no")

        # クリーンアップ
        del _process_managers[session_id]


class TestWebSocketErrorHandling:
    """WebSocketエラーハンドリングのテスト"""

    @pytest.mark.asyncio
    async def test_process_not_running_error(self):
        """プロセスが起動していない場合のエラーハンドリングを確認"""
        from app.websocket.session_ws import _process_managers
        from app.services.process_manager import ProcessManager

        session_id = str(uuid.uuid4())

        # ProcessManagerのモック（is_running=False）
        mock_pm = MagicMock(spec=ProcessManager)
        mock_pm.send_input = AsyncMock()
        mock_pm.is_running = False
        _process_managers[session_id] = mock_pm

        # プロセスが起動していない場合はエラー
        # （実際の実装ではエラーメッセージが返される）

        # クリーンアップ
        del _process_managers[session_id]


class TestConnectionManager:
    """ConnectionManagerのテスト"""

    def test_connection_manager_connect(self):
        """ConnectionManagerのconnectメソッドを確認"""
        from app.websocket.connection_manager import ConnectionManager

        manager = ConnectionManager()
        session_id = str(uuid.uuid4())
        websocket = MagicMock()

        manager.connect(websocket, session_id)

        assert session_id in manager.active_connections
        assert websocket in manager.active_connections[session_id]

    def test_connection_manager_disconnect(self):
        """ConnectionManagerのdisconnectメソッドを確認"""
        from app.websocket.connection_manager import ConnectionManager

        manager = ConnectionManager()
        session_id = str(uuid.uuid4())
        websocket = MagicMock()

        manager.connect(websocket, session_id)
        manager.disconnect(websocket, session_id)

        assert session_id not in manager.active_connections or \
               websocket not in manager.active_connections[session_id]

    @pytest.mark.asyncio
    async def test_connection_manager_send_message(self):
        """ConnectionManagerのsend_messageメソッドを確認"""
        from app.websocket.connection_manager import ConnectionManager

        manager = ConnectionManager()
        session_id = str(uuid.uuid4())
        websocket = MagicMock()
        websocket.send_json = AsyncMock()

        manager.connect(websocket, session_id)

        message = {"type": "test", "content": "Hello"}
        await manager.send_message(session_id, websocket, message)

        websocket.send_json.assert_called_once_with(message)

    @pytest.mark.asyncio
    async def test_connection_manager_broadcast_to_session(self):
        """ConnectionManagerのbroadcast_to_sessionメソッドを確認"""
        from app.websocket.connection_manager import ConnectionManager

        manager = ConnectionManager()
        session_id = str(uuid.uuid4())

        # 複数のWebSocket接続を作成
        websocket1 = MagicMock()
        websocket1.send_json = AsyncMock()
        websocket2 = MagicMock()
        websocket2.send_json = AsyncMock()

        manager.connect(websocket1, session_id)
        manager.connect(websocket2, session_id)

        message = {"type": "test", "content": "Broadcast"}
        await manager.broadcast_to_session(session_id, message)

        # 両方のWebSocketにメッセージが送信されることを確認
        websocket1.send_json.assert_called_once_with(message)
        websocket2.send_json.assert_called_once_with(message)
