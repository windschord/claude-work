"""スクリプト実行サービス"""
import asyncio
import logging
import time
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class ScriptRunner:
    """スクリプト実行を管理するクラス"""

    def __init__(self):
        """ScriptRunnerの初期化"""
        self.process: Optional[asyncio.subprocess.Process] = None
        self.is_running = False

    async def run_script(
        self,
        worktree_path: str,
        command: str,
        timeout: int = 300,  # デフォルト5分
        on_output: Optional[Callable[[str], None]] = None,
    ) -> dict[str, Any]:
        """
        スクリプトを実行する

        Args:
            worktree_path: worktreeのパス
            command: 実行するコマンド
            timeout: タイムアウト（秒）
            on_output: 出力を受信したときに呼ばれるコールバック

        Returns:
            実行結果を含む辞書:
            - success: bool - 成功したかどうか
            - output: str - 標準出力と標準エラー出力
            - exit_code: int - 終了コード
            - execution_time: float - 実行時間（秒）
        """
        if self.is_running:
            raise RuntimeError("Script is already running")

        logger.info(f"Running script in {worktree_path}: {command}")

        start_time = time.time()
        output_lines: list[str] = []

        try:
            # プロセスを起動
            self.process = await asyncio.create_subprocess_shell(
                command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=worktree_path,
            )

            self.is_running = True

            # 出力読み取りタスクを作成
            async def read_output():
                """標準出力と標準エラー出力を読み取る"""
                if not self.process:
                    return

                async def read_stream(stream, stream_name: str):
                    """ストリームから出力を読み取る"""
                    if not stream:
                        return

                    while True:
                        line = await stream.readline()
                        if not line:
                            break

                        line_str = line.decode().rstrip()
                        if line_str:
                            output_lines.append(line_str)
                            logger.debug(f"{stream_name}: {line_str}")

                            if on_output:
                                on_output(line_str)

                # 標準出力と標準エラー出力を並行して読み取る
                await asyncio.gather(
                    read_stream(self.process.stdout, "stdout"),
                    read_stream(self.process.stderr, "stderr"),
                )

            # 出力読み取りとプロセス完了を待つ（タイムアウト付き）
            try:
                await asyncio.wait_for(
                    asyncio.gather(
                        read_output(),
                        self.process.wait(),
                    ),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                logger.warning(f"Script execution timed out after {timeout} seconds")

                # プロセスを強制終了
                if self.process:
                    self.process.terminate()
                    try:
                        await asyncio.wait_for(self.process.wait(), timeout=5)
                    except asyncio.TimeoutError:
                        self.process.kill()
                        await self.process.wait()

                execution_time = time.time() - start_time

                return {
                    "success": False,
                    "output": "\n".join(output_lines) + f"\n\nスクリプトがタイムアウトしました（{timeout}秒）",
                    "exit_code": -1,
                    "execution_time": execution_time,
                }

            # 実行結果を取得
            exit_code = self.process.returncode or 0
            execution_time = time.time() - start_time

            logger.info(f"Script completed with exit code {exit_code} in {execution_time:.2f}s")

            return {
                "success": exit_code == 0,
                "output": "\n".join(output_lines),
                "exit_code": exit_code,
                "execution_time": execution_time,
            }

        except Exception as e:
            logger.error(f"Error running script: {e}")
            execution_time = time.time() - start_time

            return {
                "success": False,
                "output": "\n".join(output_lines) + f"\n\nエラー: {str(e)}",
                "exit_code": -1,
                "execution_time": execution_time,
            }

        finally:
            self.is_running = False
            self.process = None

    async def stop(self) -> None:
        """実行中のスクリプトを停止する"""
        if not self.process or not self.is_running:
            return

        logger.info("Stopping script execution")

        try:
            # プロセスを終了
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=5)
            except asyncio.TimeoutError:
                # 強制終了
                self.process.kill()
                await self.process.wait()

            logger.info("Script execution stopped")

        except Exception as e:
            logger.error(f"Error stopping script: {e}")

        finally:
            self.is_running = False
            self.process = None
