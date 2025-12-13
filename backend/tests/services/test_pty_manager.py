"""PTYManagerのテスト"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

from app.services.pty_manager import PTYManager


class TestPTYManager:
    """PTYManagerのテストクラス"""

    @pytest.fixture
    def worktree_path(self, tmp_path):
        """作業ディレクトリのフィクスチャ"""
        return str(tmp_path)

    @pytest.fixture
    def pty_manager(self, worktree_path):
        """PTYManagerのフィクスチャ"""
        return PTYManager(worktree_path)

    @pytest.mark.asyncio
    async def test_start(self, pty_manager, worktree_path):
        """PTYプロセスが起動できることをテスト"""
        with patch("app.services.pty_manager.ptyprocess.PtyProcess.spawn") as mock_spawn:
            # モックプロセスの設定
            mock_process = MagicMock()
            mock_process.isalive.return_value = True
            mock_spawn.return_value = mock_process

            # プロセス起動
            await pty_manager.start()

            # プロセスが正しいコマンドで起動されたことを確認
            mock_spawn.assert_called_once()
            args = mock_spawn.call_args
            assert args[0][0] == ["bash"]
            assert args[1]["cwd"] == worktree_path
            assert "TERM" in args[1]["env"]
            assert args[1]["env"]["TERM"] == "xterm-256color"

            # プロセスが保持されていることを確認
            assert pty_manager.process is not None

    @pytest.mark.asyncio
    async def test_write(self, pty_manager):
        """PTYへのデータ送信をテスト"""
        # モックプロセスの設定
        mock_process = MagicMock()
        mock_process.write = Mock()
        mock_process.isalive.return_value = True

        pty_manager.process = mock_process

        # データ送信
        test_data = "ls -la\n"
        await pty_manager.write(test_data)

        # 正しいデータが送信されたことを確認
        mock_process.write.assert_called_once_with(test_data.encode())

    @pytest.mark.asyncio
    async def test_write_when_process_not_running(self, pty_manager):
        """プロセスが起動していない場合のデータ送信をテスト"""
        # プロセスが起動していない状態
        pty_manager.process = None

        # 例外が発生することを確認
        with pytest.raises(RuntimeError, match="PTY process is not running"):
            await pty_manager.write("test")

    @pytest.mark.asyncio
    async def test_read(self, pty_manager):
        """PTYからのデータ読み取りをテスト"""
        # モックプロセスの設定
        mock_process = MagicMock()
        test_output = b"test output\n"
        mock_process.read.return_value = test_output
        mock_process.isalive.return_value = True

        pty_manager.process = mock_process

        # データ読み取り
        output = await pty_manager.read(size=1024)

        # 正しいデータが読み取られたことを確認
        assert output == test_output.decode()
        mock_process.read.assert_called_once_with(1024)

    @pytest.mark.asyncio
    async def test_read_when_process_not_alive(self, pty_manager):
        """プロセスが終了している場合のデータ読み取りをテスト"""
        # プロセスが終了している状態
        mock_process = MagicMock()
        mock_process.isalive.return_value = False

        pty_manager.process = mock_process

        # 空文字列が返されることを確認
        output = await pty_manager.read()
        assert output == ""

    @pytest.mark.asyncio
    async def test_read_timeout(self, pty_manager):
        """タイムアウト時の読み取りをテスト"""
        # モックプロセスの設定
        mock_process = MagicMock()

        def read_with_timeout(size):
            import time

            time.sleep(2)  # タイムアウトを引き起こす
            return b""

        mock_process.read.side_effect = read_with_timeout
        mock_process.isalive.return_value = True

        pty_manager.process = mock_process

        # タイムアウトで空文字列が返されることを確認
        output = await pty_manager.read(size=1024, timeout=0.1)
        assert output == ""

    @pytest.mark.asyncio
    async def test_resize(self, pty_manager):
        """ターミナルサイズ変更をテスト"""
        # モックプロセスの設定
        mock_process = MagicMock()
        mock_process.setwinsize = Mock()
        mock_process.isalive.return_value = True

        pty_manager.process = mock_process

        # サイズ変更
        rows, cols = 30, 100
        await pty_manager.resize(rows, cols)

        # setwinsizeが呼ばれたことを確認
        mock_process.setwinsize.assert_called_once_with(rows, cols)

    @pytest.mark.asyncio
    async def test_resize_when_process_not_running(self, pty_manager):
        """プロセスが起動していない場合のサイズ変更をテスト"""
        # プロセスが起動していない状態
        pty_manager.process = None

        # 例外が発生することを確認
        with pytest.raises(RuntimeError, match="PTY process is not running"):
            await pty_manager.resize(30, 100)

    @pytest.mark.asyncio
    async def test_stop(self, pty_manager):
        """プロセス停止をテスト"""
        # モックプロセスの設定
        mock_process = MagicMock()
        mock_process.terminate = Mock()
        mock_process.wait = Mock()
        mock_process.isalive.return_value = True

        pty_manager.process = mock_process

        # プロセス停止
        await pty_manager.stop()

        # terminateが呼ばれたことを確認
        mock_process.terminate.assert_called_once()

    @pytest.mark.asyncio
    async def test_stop_force_kill(self, pty_manager):
        """強制終了をテスト"""
        # モックプロセスの設定
        mock_process = MagicMock()
        mock_process.terminate = Mock()
        mock_process.wait = Mock()
        mock_process.isalive.side_effect = [True, True, False]  # 最初の2回はalive、3回目でdead
        mock_process.kill = Mock()

        pty_manager.process = mock_process

        # プロセス停止（強制終了が必要）
        await pty_manager.stop(timeout=0.1)

        # terminateとkillが呼ばれたことを確認
        mock_process.terminate.assert_called_once()
        mock_process.kill.assert_called_once()

    @pytest.mark.asyncio
    async def test_stop_when_already_stopped(self, pty_manager):
        """既に停止している場合のstopをテスト"""
        # プロセスが起動していない状態
        pty_manager.process = None

        # 例外が発生しないことを確認
        await pty_manager.stop()

    @pytest.mark.asyncio
    async def test_is_alive(self, pty_manager):
        """プロセスの生存確認をテスト"""
        # プロセスが起動していない状態
        assert pty_manager.is_alive() is False

        # プロセスが起動している状態
        mock_process = MagicMock()
        mock_process.isalive.return_value = True
        pty_manager.process = mock_process

        assert pty_manager.is_alive() is True

        # プロセスが終了した状態
        mock_process.isalive.return_value = False
        assert pty_manager.is_alive() is False
