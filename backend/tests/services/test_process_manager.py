"""ProcessManagerのテスト"""
import asyncio
import json
from typing import Callable
from unittest.mock import AsyncMock, MagicMock, Mock, call, patch

import pytest

from app.services.process_manager import ProcessManager


class TestProcessManager:
    """ProcessManagerのテストクラス"""

    @pytest.fixture
    def on_output_callback(self):
        """出力コールバックのフィクスチャ"""
        return Mock()

    @pytest.fixture
    def on_permission_request_callback(self):
        """権限確認リクエストコールバックのフィクスチャ"""
        return Mock()

    @pytest.fixture
    def on_process_exit_callback(self):
        """プロセス終了コールバックのフィクスチャ"""
        return Mock()

    @pytest.fixture
    def process_manager(
        self, on_output_callback, on_permission_request_callback, on_process_exit_callback
    ):
        """ProcessManagerのフィクスチャ"""
        return ProcessManager(
            on_output=on_output_callback,
            on_permission_request=on_permission_request_callback,
            on_process_exit=on_process_exit_callback,
        )

    @pytest.mark.asyncio
    async def test_start_claude_code(self, process_manager):
        """Claude Codeプロセスが起動できることをテスト"""
        with patch("app.services.process_manager.asyncio.create_subprocess_exec") as mock_create_subprocess:
            # モックプロセスの設定
            mock_process = AsyncMock()
            mock_process.stdout = AsyncMock()
            mock_process.stderr = AsyncMock()
            mock_process.stdin = MagicMock()
            mock_process.returncode = None
            mock_create_subprocess.return_value = mock_process

            # プロセス起動
            await process_manager.start_claude_code(
                working_dir="/test/dir", message="test message"
            )

            # プロセスが正しいコマンドで起動されたことを確認
            mock_create_subprocess.assert_called_once()
            args = mock_create_subprocess.call_args[0]
            assert args[0] == "claude"
            assert "--print" in args
            assert "test message" in args

            # プロセスが保持されていることを確認
            assert process_manager.process is not None

    @pytest.mark.asyncio
    async def test_send_input(self, process_manager):
        """プロセスへの入力送信をテスト"""
        # モックプロセスの設定
        mock_stdin = MagicMock()
        mock_stdin.write = Mock()
        mock_stdin.drain = AsyncMock()

        mock_process = MagicMock()
        mock_process.stdin = mock_stdin
        mock_process.returncode = None

        process_manager.process = mock_process
        process_manager.is_running = True

        # 入力送信
        test_input = "test input"
        await process_manager.send_input(test_input)

        # 正しいデータが送信されたことを確認
        mock_stdin.write.assert_called_once()
        written_data = mock_stdin.write.call_args[0][0]
        assert test_input in written_data.decode()
        mock_stdin.drain.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_send_input_when_process_not_running(self, process_manager):
        """プロセスが起動していない場合の入力送信をテスト"""
        # プロセスが起動していない状態
        process_manager.process = None

        # 例外が発生することを確認
        with pytest.raises(RuntimeError, match="Process is not running"):
            await process_manager.send_input("test")

    @pytest.mark.asyncio
    async def test_stop(self, process_manager):
        """プロセス停止をテスト"""
        # モックプロセスの設定
        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.terminate = Mock()
        mock_process.wait = AsyncMock()

        process_manager.process = mock_process
        process_manager.is_running = True

        # プロセス停止
        await process_manager.stop()

        # terminateが呼ばれたことを確認
        mock_process.terminate.assert_called_once()
        mock_process.wait.assert_awaited_once()
        assert process_manager.is_running is False

    @pytest.mark.asyncio
    async def test_read_output(self, process_manager, on_output_callback):
        """出力読み取りをテスト"""
        # モックのstdout
        test_outputs = [
            b'{"type": "message", "role": "assistant", "content": "Hello"}\n',
            b'{"type": "status", "status": "completed"}\n',
            b"",  # EOF
        ]

        mock_stdout = AsyncMock()
        mock_stdout.readline = AsyncMock(side_effect=test_outputs)

        mock_process = MagicMock()
        mock_process.stdout = mock_stdout
        mock_process.returncode = None

        process_manager.process = mock_process
        process_manager.is_running = True

        # 出力読み取りタスクを実行
        read_task = asyncio.create_task(process_manager._read_stdout())

        # タスクの完了を待つ
        await read_task

        # コールバックが呼ばれたことを確認
        assert on_output_callback.call_count == 2

        # 最初の呼び出しを確認
        first_call_data = on_output_callback.call_args_list[0][0][0]
        assert first_call_data["type"] == "message"
        assert first_call_data["content"] == "Hello"

    @pytest.mark.asyncio
    async def test_permission_request_detection(
        self, process_manager, on_permission_request_callback
    ):
        """権限確認リクエストの検出をテスト"""
        # モックのstdout
        permission_request = {
            "type": "permission_request",
            "tool": "bash",
            "command": "ls -la",
            "request_id": "req-123",
        }
        test_outputs = [
            json.dumps(permission_request).encode() + b"\n",
            b"",  # EOF
        ]

        mock_stdout = AsyncMock()
        mock_stdout.readline = AsyncMock(side_effect=test_outputs)

        mock_process = MagicMock()
        mock_process.stdout = mock_stdout
        mock_process.returncode = None

        process_manager.process = mock_process
        process_manager.is_running = True

        # 出力読み取りタスクを実行
        read_task = asyncio.create_task(process_manager._read_stdout())
        await read_task

        # 権限確認コールバックが呼ばれたことを確認
        on_permission_request_callback.assert_called_once()
        call_data = on_permission_request_callback.call_args[0][0]
        assert call_data["type"] == "permission_request"
        assert call_data["tool"] == "bash"
        assert call_data["command"] == "ls -la"

    @pytest.mark.asyncio
    async def test_process_exit_detection(
        self, process_manager, on_process_exit_callback
    ):
        """プロセス終了検知をテスト"""
        # モックプロセスの設定
        mock_stdout = AsyncMock()
        mock_stdout.readline = AsyncMock(return_value=b"")  # EOF

        mock_stderr = AsyncMock()
        mock_stderr.readline = AsyncMock(return_value=b"")  # EOF

        mock_process = MagicMock()
        mock_process.stdout = mock_stdout
        mock_process.stderr = mock_stderr
        mock_process.wait = AsyncMock()
        mock_process.returncode = 0

        process_manager.process = mock_process
        process_manager.is_running = True

        # 出力読み取りタスクを実行
        stdout_task = asyncio.create_task(process_manager._read_stdout())
        stderr_task = asyncio.create_task(process_manager._read_stderr())

        await asyncio.gather(stdout_task, stderr_task)

        # プロセス終了コールバックが呼ばれることを確認
        # （実際には_monitor_process内で呼ばれる）
        assert process_manager.is_running is False

    @pytest.mark.asyncio
    async def test_error_output_handling(self, process_manager, on_output_callback):
        """エラー出力の処理をテスト"""
        # モックのstderr
        test_errors = [
            b"Error: something went wrong\n",
            b"",  # EOF
        ]

        mock_stderr = AsyncMock()
        mock_stderr.readline = AsyncMock(side_effect=test_errors)

        mock_process = MagicMock()
        mock_process.stderr = mock_stderr
        mock_process.returncode = None

        process_manager.process = mock_process
        process_manager.is_running = True

        # エラー出力読み取りタスクを実行
        read_task = asyncio.create_task(process_manager._read_stderr())
        await read_task

        # エラー出力がコールバックに渡されたことを確認
        on_output_callback.assert_called()
        call_data = on_output_callback.call_args[0][0]
        assert "Error: something went wrong" in str(call_data)

    @pytest.mark.asyncio
    async def test_invalid_json_handling(self, process_manager, on_output_callback):
        """不正なJSON出力の処理をテスト"""
        # モックのstdout
        test_outputs = [
            b"invalid json\n",
            b"",  # EOF
        ]

        mock_stdout = AsyncMock()
        mock_stdout.readline = AsyncMock(side_effect=test_outputs)

        mock_process = MagicMock()
        mock_process.stdout = mock_stdout
        mock_process.returncode = None

        process_manager.process = mock_process
        process_manager.is_running = True

        # 出力読み取りタスクを実行
        read_task = asyncio.create_task(process_manager._read_stdout())
        await read_task

        # 不正なJSONもコールバックに渡されることを確認
        on_output_callback.assert_called()
