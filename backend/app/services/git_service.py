"""Git操作サービス"""
import asyncio
from pathlib import Path
from typing import Dict, List


class GitService:
    """Git操作を行うサービスクラス"""

    def __init__(self, repo_path: str, timeout: int = 30):
        """
        GitServiceを初期化

        Args:
            repo_path: Gitリポジトリのパス
            timeout: コマンド実行のタイムアウト秒数（デフォルト: 30秒）
        """
        self.repo_path = Path(repo_path)
        self.timeout = timeout

    async def _run_command(
        self,
        *args: str,
        cwd: str | None = None,
        check: bool = True
    ) -> tuple[str, str, int]:
        """
        Gitコマンドを実行

        Args:
            *args: コマンド引数
            cwd: 作業ディレクトリ（Noneの場合はrepo_path）
            check: 終了コードが0以外の場合に例外を発生させるか

        Returns:
            (stdout, stderr, returncode)のタプル

        Raises:
            RuntimeError: コマンド実行に失敗した場合（checkがTrueの場合）
        """
        if cwd is None:
            cwd = str(self.repo_path)

        process = await asyncio.create_subprocess_exec(
            *args,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(),
                timeout=self.timeout
            )
            stdout = stdout_bytes.decode("utf-8")
            stderr = stderr_bytes.decode("utf-8")
            returncode = process.returncode or 0

            if check and returncode != 0:
                raise RuntimeError(
                    f"Command failed: {' '.join(args)}\n"
                    f"stdout: {stdout}\n"
                    f"stderr: {stderr}"
                )

            return stdout, stderr, returncode

        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise RuntimeError(
                f"Command timed out after {self.timeout}s: {' '.join(args)}"
            )

    async def create_worktree(self, session_name: str, branch_name: str) -> str:
        """
        worktreeを作成（ブランチも自動作成）

        Args:
            session_name: セッション名
            branch_name: 作成するブランチ名

        Returns:
            作成されたworktreeのパス

        Raises:
            RuntimeError: worktree作成に失敗した場合
        """
        worktree_path = self.repo_path / ".worktrees" / session_name

        # worktreeディレクトリが既に存在する場合はエラー
        if worktree_path.exists():
            raise RuntimeError(f"Worktree already exists: {worktree_path}")

        # .worktreesディレクトリを作成
        worktree_path.parent.mkdir(parents=True, exist_ok=True)

        # worktreeを作成
        await self._run_command(
            "git", "worktree", "add", "-b", branch_name, str(worktree_path)
        )

        return str(worktree_path)

    async def delete_worktree(self, session_name: str, branch_name: str) -> None:
        """
        worktreeを削除

        Args:
            session_name: セッション名
            branch_name: 削除するブランチ名

        Raises:
            RuntimeError: worktree削除に失敗した場合
        """
        worktree_path = self.repo_path / ".worktrees" / session_name

        # worktreeディレクトリが存在しない場合はエラー
        if not worktree_path.exists():
            raise RuntimeError(f"Worktree does not exist: {worktree_path}")

        # worktreeを削除
        await self._run_command("git", "worktree", "remove", str(worktree_path))

        # ブランチを削除
        await self._run_command("git", "branch", "-D", branch_name)

    async def get_diff(self, session_name: str) -> Dict[str, any]:
        """
        mainブランチとのdiffを取得

        Args:
            session_name: セッション名

        Returns:
            diff情報を含む辞書
            - added_files: 追加されたファイルのリスト
            - modified_files: 変更されたファイルのリスト
            - deleted_files: 削除されたファイルのリスト
            - diff_content: diff全体の内容

        Raises:
            RuntimeError: diff取得に失敗した場合
        """
        worktree_path = self.repo_path / ".worktrees" / session_name

        if not worktree_path.exists():
            raise RuntimeError(f"Worktree does not exist: {worktree_path}")

        # ファイルステータスを取得
        name_status_output, _, _ = await self._run_command(
            "git", "diff", "main...HEAD", "--name-status",
            cwd=str(worktree_path)
        )

        # ファイルを分類
        added_files: List[str] = []
        modified_files: List[str] = []
        deleted_files: List[str] = []

        for line in name_status_output.strip().split("\n"):
            if not line:
                continue

            parts = line.split("\t", 1)
            if len(parts) != 2:
                continue

            status, filepath = parts
            if status == "A":
                added_files.append(filepath)
            elif status == "M":
                modified_files.append(filepath)
            elif status == "D":
                deleted_files.append(filepath)

        # diff全体を取得
        diff_content, _, _ = await self._run_command(
            "git", "diff", "main...HEAD",
            cwd=str(worktree_path)
        )

        return {
            "added_files": added_files,
            "modified_files": modified_files,
            "deleted_files": deleted_files,
            "diff_content": diff_content,
        }

    async def rebase_from_main(self, session_name: str) -> Dict[str, any]:
        """
        mainブランチからrebaseを実行

        Args:
            session_name: セッション名

        Returns:
            rebase結果を含む辞書
            - success: rebaseが成功したかどうか
            - conflicts: コンフリクトが発生したファイルのリスト（失敗時のみ）

        Raises:
            RuntimeError: worktreeが存在しない場合
        """
        worktree_path = self.repo_path / ".worktrees" / session_name

        if not worktree_path.exists():
            raise RuntimeError(f"Worktree does not exist: {worktree_path}")

        # rebaseを実行
        _, stderr, returncode = await self._run_command(
            "git", "rebase", "main",
            cwd=str(worktree_path),
            check=False
        )

        if returncode == 0:
            return {"success": True}

        # コンフリクトが発生した場合
        conflicts: List[str] = []

        # コンフリクトファイルを取得
        stdout, _, _ = await self._run_command(
            "git", "diff", "--name-only", "--diff-filter=U",
            cwd=str(worktree_path),
            check=False
        )

        conflicts = [f for f in stdout.strip().split("\n") if f]

        # rebaseを中止
        await self._run_command(
            "git", "rebase", "--abort",
            cwd=str(worktree_path),
            check=False
        )

        return {
            "success": False,
            "conflicts": conflicts,
        }

    async def squash_merge(self, branch_name: str, commit_message: str) -> Dict[str, any]:
        """
        squash mergeを実行

        Args:
            branch_name: マージするブランチ名
            commit_message: コミットメッセージ

        Returns:
            merge結果を含む辞書
            - success: mergeが成功したかどうか

        Raises:
            RuntimeError: merge実行に失敗した場合
        """
        # mainブランチにチェックアウト
        await self._run_command("git", "checkout", "main")

        # squash mergeを実行
        await self._run_command("git", "merge", "--squash", branch_name)

        # コミット
        await self._run_command("git", "commit", "-m", commit_message)

        return {"success": True}
