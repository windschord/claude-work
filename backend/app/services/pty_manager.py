"""PTYプロセス管理サービス"""
import asyncio
import os
from typing import Optional

import ptyprocess

from app.logging_config import get_logger

logger = get_logger(__name__)


class PTYManager:
    """PTYプロセスを管理するクラス"""

    def __init__(self, worktree_path: str):
        """
        PTYManagerの初期化

        Args:
            worktree_path: 作業ディレクトリのパス
        """
        self.worktree_path = worktree_path
        self.process: Optional[ptyprocess.PtyProcess] = None
        self._executor = None

    async def start(self) -> None:
        """
        PTYプロセスを起動する

        Raises:
            RuntimeError: プロセスが既に起動している場合
        """
        if self.process is not None and self.process.isalive():
            logger.warning("pty_already_running", worktree_path=self.worktree_path)
            raise RuntimeError("PTY process is already running")

        logger.info("starting_pty", worktree_path=self.worktree_path)

        # asyncioのrun_in_executorを使用してブロッキング操作を非同期化
        loop = asyncio.get_event_loop()

        def spawn_pty():
            return ptyprocess.PtyProcess.spawn(
                ["bash"],
                cwd=self.worktree_path,
                env={"TERM": "xterm-256color", "PATH": os.environ.get("PATH", "")},
            )

        self.process = await loop.run_in_executor(self._executor, spawn_pty)

        logger.info("pty_started", pid=self.process.pid)

    async def write(self, data: str) -> None:
        """
        PTYにデータを送信する

        Args:
            data: 送信するデータ

        Raises:
            RuntimeError: プロセスが起動していない場合
        """
        if self.process is None or not self.process.isalive():
            logger.error("pty_not_running_write")
            raise RuntimeError("PTY process is not running")

        logger.debug("pty_write", data_length=len(data))

        # ブロッキング操作を非同期化
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(self._executor, self.process.write, data.encode())

    async def read(self, size: int = 1024, timeout: float = 1.0) -> str:
        """
        PTYからデータを読み取る

        Args:
            size: 読み取るバイト数
            timeout: タイムアウト秒数

        Returns:
            読み取ったデータ（文字列）
        """
        if self.process is None or not self.process.isalive():
            logger.debug("pty_not_alive_read")
            return ""

        try:
            # ブロッキング操作を非同期化し、タイムアウトを設定
            loop = asyncio.get_event_loop()
            data = await asyncio.wait_for(
                loop.run_in_executor(self._executor, self.process.read, size),
                timeout=timeout,
            )
            logger.debug("pty_read", data_length=len(data))
            return data.decode("utf-8", errors="replace")
        except asyncio.TimeoutError:
            logger.debug("pty_read_timeout")
            return ""
        except Exception as e:
            logger.error("pty_read_error", error=str(e))
            return ""

    async def resize(self, rows: int, cols: int) -> None:
        """
        ターミナルサイズを変更する

        Args:
            rows: 行数
            cols: 列数

        Raises:
            RuntimeError: プロセスが起動していない場合
        """
        if self.process is None or not self.process.isalive():
            logger.error("pty_not_running_resize")
            raise RuntimeError("PTY process is not running")

        logger.debug("pty_resize", rows=rows, cols=cols)

        # ブロッキング操作を非同期化
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(self._executor, self.process.setwinsize, rows, cols)

    async def stop(self, timeout: float = 3.0) -> None:
        """
        PTYプロセスを停止する

        Args:
            timeout: 終了待機のタイムアウト秒数
        """
        if self.process is None:
            logger.debug("pty_already_stopped")
            return

        if not self.process.isalive():
            logger.debug("pty_already_dead")
            self.process = None
            return

        logger.info("stopping_pty", pid=self.process.pid)

        # まずterminateを試す
        self.process.terminate()

        # タイムアウト付きで終了を待つ
        loop = asyncio.get_event_loop()
        try:
            # terminateがうまくいくか、タイムアウトまで待つ
            await asyncio.sleep(timeout)
            if self.process.isalive():
                # まだ生きていたら強制終了
                logger.warning("pty_terminate_timeout_killing")
                self.process.kill()
                await loop.run_in_executor(self._executor, self._wait_for_process)
                logger.info("pty_killed")
            else:
                logger.info("pty_terminated")
        except Exception as e:
            logger.error("pty_stop_error", error=str(e))

        self.process = None

    def _wait_for_process(self) -> None:
        """プロセスの終了を待つ（ブロッキング）"""
        if self.process is not None:
            self.process.wait()

    def is_alive(self) -> bool:
        """
        プロセスが生きているかを確認する

        Returns:
            プロセスが生きている場合True
        """
        return self.process is not None and self.process.isalive()
