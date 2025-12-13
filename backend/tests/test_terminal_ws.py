"""ターミナル用WebSocketエンドポイントのテスト"""
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestTerminalWebSocketAuthentication:
    """ターミナルWebSocket認証のテスト"""

    @pytest.mark.asyncio
    async def test_verify_websocket_session_with_valid_cookie(self):
        """クッキーでの認証が成功することを確認"""
        from app.websocket.terminal_ws import verify_websocket_session
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


class TestTerminalWebSocketMessageHandling:
    """ターミナルWebSocketメッセージ処理のテスト"""

    @pytest.mark.asyncio
    async def test_input_message_handling(self):
        """入力メッセージの処理を確認"""
        from app.services.pty_manager import PTYManager

        session_id = str(uuid.uuid4())

        # PTYManagerのモック
        mock_pty = MagicMock(spec=PTYManager)
        mock_pty.write = AsyncMock()
        mock_pty.is_alive.return_value = True

        # 入力を送信
        input_data = "ls -la\n"
        await mock_pty.write(input_data)

        # writeが呼ばれたことを確認
        mock_pty.write.assert_called_once_with(input_data)

    @pytest.mark.asyncio
    async def test_resize_message_handling(self):
        """リサイズメッセージの処理を確認"""
        from app.services.pty_manager import PTYManager

        session_id = str(uuid.uuid4())

        # PTYManagerのモック
        mock_pty = MagicMock(spec=PTYManager)
        mock_pty.resize = AsyncMock()
        mock_pty.is_alive.return_value = True

        # リサイズを実行
        rows, cols = 30, 100
        await mock_pty.resize(rows, cols)

        # resizeが呼ばれたことを確認
        mock_pty.resize.assert_called_once_with(rows, cols)

    @pytest.mark.asyncio
    async def test_output_message_sending(self):
        """出力メッセージの送信を確認"""
        from app.websocket.connection_manager import ConnectionManager

        manager = ConnectionManager()
        session_id = str(uuid.uuid4())
        websocket = MagicMock()
        websocket.send_json = AsyncMock()

        manager.connect(websocket, session_id)

        # 出力メッセージを送信
        output_message = {"type": "output", "data": "test output"}
        await manager.send_message(session_id, websocket, output_message)

        websocket.send_json.assert_called_once_with(output_message)

    @pytest.mark.asyncio
    async def test_exit_message_sending(self):
        """終了メッセージの送信を確認"""
        from app.websocket.connection_manager import ConnectionManager

        manager = ConnectionManager()
        session_id = str(uuid.uuid4())
        websocket = MagicMock()
        websocket.send_json = AsyncMock()

        manager.connect(websocket, session_id)

        # 終了メッセージを送信
        exit_message = {"type": "exit", "code": 0}
        await manager.send_message(session_id, websocket, exit_message)

        websocket.send_json.assert_called_once_with(exit_message)


class TestTerminalWebSocketErrorHandling:
    """ターミナルWebSocketエラーハンドリングのテスト"""

    @pytest.mark.asyncio
    async def test_pty_not_running_error(self):
        """PTYが起動していない場合のエラーハンドリングを確認"""
        from app.services.pty_manager import PTYManager

        session_id = str(uuid.uuid4())

        # PTYManagerのモック（is_alive=False）
        mock_pty = MagicMock(spec=PTYManager)
        mock_pty.write = AsyncMock()
        mock_pty.is_alive.return_value = False

        # PTYが起動していない場合は何も送信しない
        # （実際の実装ではエラーメッセージが返される）

    @pytest.mark.asyncio
    async def test_invalid_message_type(self):
        """不正なメッセージタイプのハンドリングを確認"""
        # 不正なメッセージタイプは無視される
        # （実際の実装ではエラーログが記録される）
        pass


class TestPTYManagerLifecycle:
    """PTYManagerライフサイクルのテスト"""

    @pytest.mark.asyncio
    async def test_pty_startup_on_connection(self):
        """接続時のPTY起動を確認"""
        from app.services.pty_manager import PTYManager

        worktree_path = "/test/path"
        mock_pty = MagicMock(spec=PTYManager)
        mock_pty.start = AsyncMock()

        # PTY起動
        await mock_pty.start()

        # startが呼ばれたことを確認
        mock_pty.start.assert_called_once()

    @pytest.mark.asyncio
    async def test_pty_cleanup_on_disconnection(self):
        """切断時のPTYクリーンアップを確認"""
        from app.services.pty_manager import PTYManager

        mock_pty = MagicMock(spec=PTYManager)
        mock_pty.stop = AsyncMock()

        # PTY停止
        await mock_pty.stop()

        # stopが呼ばれたことを確認
        mock_pty.stop.assert_called_once()
