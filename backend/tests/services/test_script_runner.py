"""ScriptRunnerのテスト"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

from app.services.script_runner import ScriptRunner


class TestScriptRunner:
    """ScriptRunnerのテストクラス"""

    @pytest.fixture
    def script_runner(self):
        """ScriptRunnerのフィクスチャ"""
        return ScriptRunner()

    @pytest.mark.asyncio
    async def test_run_script_success(self, script_runner):
        """スクリプトが正常に実行されることをテスト"""
        with patch("app.services.script_runner.asyncio.create_subprocess_shell") as mock_create_subprocess:
            # モックプロセスの設定
            mock_process = AsyncMock()
            mock_process.stdout = AsyncMock()
            mock_process.stderr = AsyncMock()
            mock_process.returncode = 0

            # 出力をシミュレート
            output_lines = [
                b"line 1\n",
                b"line 2\n",
                b"line 3\n",
            ]

            async def mock_readline_stdout():
                for line in output_lines:
                    yield line
                yield b""  # EOF

            mock_process.stdout.readline = AsyncMock()
            mock_process.stdout.readline.side_effect = [line for line in output_lines] + [b""]
            mock_process.stderr.readline = AsyncMock(return_value=b"")
            mock_process.wait = AsyncMock(return_value=0)

            mock_create_subprocess.return_value = mock_process

            # スクリプト実行
            result = await script_runner.run_script(
                worktree_path="/test/worktree",
                command="echo 'hello'"
            )

            # 結果を確認
            assert result["success"] is True
            assert result["exit_code"] == 0
            assert "line 1" in result["output"]
            assert "line 2" in result["output"]
            assert "line 3" in result["output"]
            assert result["execution_time"] > 0

            # プロセスが正しいコマンドで起動されたことを確認
            mock_create_subprocess.assert_called_once()
            call_kwargs = mock_create_subprocess.call_args[1]
            assert call_kwargs["cwd"] == "/test/worktree"

    @pytest.mark.asyncio
    async def test_run_script_failure(self, script_runner):
        """スクリプトが失敗した場合のテスト"""
        with patch("app.services.script_runner.asyncio.create_subprocess_shell") as mock_create_subprocess:
            # モックプロセスの設定（終了コード1）
            mock_process = AsyncMock()
            mock_process.stdout = AsyncMock()
            mock_process.stderr = AsyncMock()
            mock_process.returncode = 1

            # エラー出力をシミュレート
            mock_process.stdout.readline = AsyncMock(return_value=b"")
            mock_process.stderr.readline = AsyncMock()
            mock_process.stderr.readline.side_effect = [b"error message\n", b""]
            mock_process.wait = AsyncMock(return_value=1)

            mock_create_subprocess.return_value = mock_process

            # スクリプト実行
            result = await script_runner.run_script(
                worktree_path="/test/worktree",
                command="exit 1"
            )

            # 結果を確認
            assert result["success"] is False
            assert result["exit_code"] == 1
            assert "error message" in result["output"]

    @pytest.mark.asyncio
    async def test_run_script_timeout(self, script_runner):
        """スクリプトがタイムアウトすることをテスト"""
        with patch("app.services.script_runner.asyncio.create_subprocess_shell") as mock_create_subprocess:
            # モックプロセスの設定（タイムアウトをシミュレート）
            mock_process = AsyncMock()
            mock_process.stdout = AsyncMock()
            mock_process.stderr = AsyncMock()
            mock_process.terminate = Mock()
            mock_process.kill = Mock()

            # waitでタイムアウトをシミュレート
            async def mock_wait_timeout():
                await asyncio.sleep(10)  # タイムアウトより長い時間

            mock_process.wait = AsyncMock(side_effect=mock_wait_timeout)
            mock_process.stdout.readline = AsyncMock(return_value=b"")
            mock_process.stderr.readline = AsyncMock(return_value=b"")

            mock_create_subprocess.return_value = mock_process

            # スクリプト実行（タイムアウト1秒）
            result = await script_runner.run_script(
                worktree_path="/test/worktree",
                command="sleep 100",
                timeout=1
            )

            # 結果を確認
            assert result["success"] is False
            assert "timeout" in result["output"].lower() or "タイムアウト" in result["output"]

            # プロセスが終了処理されたことを確認
            assert mock_process.terminate.called or mock_process.kill.called

    @pytest.mark.asyncio
    async def test_run_script_with_callback(self, script_runner):
        """コールバック付きスクリプト実行をテスト"""
        callback = Mock()

        with patch("app.services.script_runner.asyncio.create_subprocess_shell") as mock_create_subprocess:
            # モックプロセスの設定
            mock_process = AsyncMock()
            mock_process.stdout = AsyncMock()
            mock_process.stderr = AsyncMock()
            mock_process.returncode = 0

            # 出力をシミュレート
            mock_process.stdout.readline = AsyncMock()
            mock_process.stdout.readline.side_effect = [b"output line\n", b""]
            mock_process.stderr.readline = AsyncMock(return_value=b"")
            mock_process.wait = AsyncMock(return_value=0)

            mock_create_subprocess.return_value = mock_process

            # スクリプト実行
            result = await script_runner.run_script(
                worktree_path="/test/worktree",
                command="echo 'test'",
                on_output=callback
            )

            # コールバックが呼ばれたことを確認
            assert callback.called
            # コールバックに出力が渡されたことを確認
            assert any("output line" in str(call_args) for call_args in callback.call_args_list)

    @pytest.mark.asyncio
    async def test_stop_script(self, script_runner):
        """スクリプトを停止できることをテスト"""
        with patch("app.services.script_runner.asyncio.create_subprocess_shell") as mock_create_subprocess:
            # モックプロセスの設定
            mock_process = AsyncMock()
            mock_process.stdout = AsyncMock()
            mock_process.stderr = AsyncMock()
            mock_process.terminate = Mock()
            mock_process.kill = Mock()

            # 長時間実行をシミュレート
            async def long_running():
                await asyncio.sleep(100)

            mock_process.wait = AsyncMock(side_effect=long_running)
            mock_process.stdout.readline = AsyncMock(return_value=b"")
            mock_process.stderr.readline = AsyncMock(return_value=b"")

            mock_create_subprocess.return_value = mock_process

            # スクリプトをバックグラウンドで実行
            task = asyncio.create_task(
                script_runner.run_script(
                    worktree_path="/test/worktree",
                    command="sleep 100"
                )
            )

            # 少し待ってから停止
            await asyncio.sleep(0.1)
            await script_runner.stop()

            # タスクが完了するまで待つ（タイムアウト付き）
            try:
                await asyncio.wait_for(task, timeout=1.0)
            except asyncio.TimeoutError:
                task.cancel()

            # プロセスが終了処理されたことを確認
            assert mock_process.terminate.called or mock_process.kill.called
