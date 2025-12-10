"""Claude Codeプロセス管理サービス"""
import asyncio
import json
import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class ProcessManager:
    """Claude Codeプロセスを管理するクラス"""

    def __init__(
        self,
        on_output: Optional[Callable[[dict[str, Any]], None]] = None,
        on_permission_request: Optional[Callable[[dict[str, Any]], None]] = None,
        on_process_exit: Optional[Callable[[int], None]] = None,
    ):
        """
        ProcessManagerの初期化

        Args:
            on_output: 出力を受信したときに呼ばれるコールバック
            on_permission_request: 権限確認リクエストを受信したときに呼ばれるコールバック
            on_process_exit: プロセスが終了したときに呼ばれるコールバック
        """
        self.process: Optional[asyncio.subprocess.Process] = None
        self.is_running = False
        self.on_output = on_output
        self.on_permission_request = on_permission_request
        self.on_process_exit = on_process_exit
        self._tasks: list[asyncio.Task] = []

    async def start_claude_code(
        self, working_dir: str, message: str, additional_args: Optional[list[str]] = None
    ) -> None:
        """
        Claude Codeプロセスを起動する

        Args:
            working_dir: 作業ディレクトリ
            message: Claudeに送信するメッセージ
            additional_args: 追加のコマンドライン引数
        """
        if self.is_running:
            raise RuntimeError("Process is already running")

        # コマンドライン引数を構築
        args = ["claude", "--print"]
        if additional_args:
            args.extend(additional_args)
        args.append(message)

        logger.info(f"Starting Claude Code process: {' '.join(args)}")

        # プロセスを起動
        self.process = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=working_dir,
        )

        self.is_running = True

        # 出力読み取りタスクを開始
        stdout_task = asyncio.create_task(self._read_stdout())
        stderr_task = asyncio.create_task(self._read_stderr())
        monitor_task = asyncio.create_task(self._monitor_process())

        self._tasks = [stdout_task, stderr_task, monitor_task]

        logger.info("Claude Code process started")

    async def send_input(self, data: str) -> None:
        """
        プロセスに入力を送信する

        Args:
            data: 送信するデータ

        Raises:
            RuntimeError: プロセスが起動していない場合
        """
        if not self.process or not self.is_running:
            raise RuntimeError("Process is not running")

        if not self.process.stdin:
            raise RuntimeError("Process stdin is not available")

        logger.debug(f"Sending input to process: {data}")

        # データをエンコードして送信
        self.process.stdin.write(data.encode() + b"\n")
        await self.process.stdin.drain()

    async def stop(self) -> None:
        """プロセスを停止する"""
        if not self.process or not self.is_running:
            return

        logger.info("Stopping Claude Code process")

        # プロセスを終了
        self.process.terminate()
        await self.process.wait()

        self.is_running = False

        # タスクをキャンセル
        for task in self._tasks:
            if not task.done():
                task.cancel()

        # タスクの完了を待つ
        await asyncio.gather(*self._tasks, return_exceptions=True)

        logger.info("Claude Code process stopped")

    async def _read_stdout(self) -> None:
        """標準出力を読み取る"""
        if not self.process or not self.process.stdout:
            return

        try:
            while self.is_running:
                line = await self.process.stdout.readline()
                if not line:
                    break

                line_str = line.decode().strip()
                if not line_str:
                    continue

                logger.debug(f"Received stdout: {line_str}")

                # JSON形式のデータをパース
                try:
                    data = json.loads(line_str)

                    # 権限確認リクエストを検出
                    if data.get("type") == "permission_request":
                        if self.on_permission_request:
                            self.on_permission_request(data)
                    else:
                        # 通常の出力
                        if self.on_output:
                            self.on_output(data)
                except json.JSONDecodeError:
                    # JSON以外のデータもコールバックに渡す
                    if self.on_output:
                        self.on_output({"type": "raw", "content": line_str})

        except asyncio.CancelledError:
            logger.debug("stdout reading cancelled")
        except Exception as e:
            logger.error(f"Error reading stdout: {e}")
        finally:
            self.is_running = False

    async def _read_stderr(self) -> None:
        """標準エラー出力を読み取る"""
        if not self.process or not self.process.stderr:
            return

        try:
            while self.is_running:
                line = await self.process.stderr.readline()
                if not line:
                    break

                line_str = line.decode().strip()
                if not line_str:
                    continue

                logger.debug(f"Received stderr: {line_str}")

                # エラー出力もコールバックに渡す
                if self.on_output:
                    self.on_output({"type": "error", "content": line_str})

        except asyncio.CancelledError:
            logger.debug("stderr reading cancelled")
        except Exception as e:
            logger.error(f"Error reading stderr: {e}")
        finally:
            self.is_running = False

    async def _monitor_process(self) -> None:
        """プロセスの終了を監視する"""
        if not self.process:
            return

        try:
            # プロセスの終了を待つ
            await self.process.wait()

            logger.info(f"Process exited with code: {self.process.returncode}")

            # プロセス終了コールバックを呼ぶ
            if self.on_process_exit:
                self.on_process_exit(self.process.returncode or 0)

        except asyncio.CancelledError:
            logger.debug("process monitoring cancelled")
        except Exception as e:
            logger.error(f"Error monitoring process: {e}")
        finally:
            self.is_running = False
