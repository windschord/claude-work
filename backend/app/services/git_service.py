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

    async def get_commit_history(self, session_name: str, limit: int = 20) -> List[Dict[str, str]]:
        """
        コミット履歴を取得

        Args:
            session_name: セッション名
            limit: 取得するコミット数（デフォルト: 20）

        Returns:
            コミット情報のリスト
            各コミットは以下のフィールドを持つ:
            - hash: コミットハッシュ
            - message: コミットメッセージ
            - author_name: 作者名
            - author_email: 作者メールアドレス
            - date: コミット日時（ISO 8601形式）

        Raises:
            RuntimeError: worktreeが存在しない場合、またはコミット履歴取得に失敗した場合
        """
        worktree_path = self.repo_path / ".worktrees" / session_name

        if not worktree_path.exists():
            raise RuntimeError(f"Worktree does not exist: {worktree_path}")

        # git log --format="%H|%s|%an|%ae|%ai" -n {limit}
        stdout, _, _ = await self._run_command(
            "git", "log", f"--format=%H|%s|%an|%ae|%ai", f"-n{limit}",
            cwd=str(worktree_path)
        )

        commits: List[Dict[str, str]] = []
        for line in stdout.strip().split("\n"):
            if not line:
                continue

            parts = line.split("|", 4)
            if len(parts) != 5:
                continue

            hash_value, message, author_name, author_email, date = parts
            commits.append({
                "hash": hash_value,
                "message": message,
                "author_name": author_name,
                "author_email": author_email,
                "date": date,
            })

        return commits

    async def get_commit_diff(self, session_name: str, commit_hash: str) -> str:
        """
        コミットのdiffを取得

        Args:
            session_name: セッション名
            commit_hash: コミットハッシュ

        Returns:
            コミットのdiff（統計情報）

        Raises:
            RuntimeError: worktreeが存在しない場合、またはdiff取得に失敗した場合
        """
        worktree_path = self.repo_path / ".worktrees" / session_name

        if not worktree_path.exists():
            raise RuntimeError(f"Worktree does not exist: {worktree_path}")

        # git show {commit_hash} --stat
        stdout, _, _ = await self._run_command(
            "git", "show", commit_hash, "--stat",
            cwd=str(worktree_path)
        )

        return stdout

    async def reset_to_commit(self, session_name: str, commit_hash: str) -> Dict[str, any]:
        """
        コミットへリセット

        Args:
            session_name: セッション名
            commit_hash: コミットハッシュ

        Returns:
            リセット結果を含む辞書
            - success: リセットが成功したかどうか

        Raises:
            RuntimeError: worktreeが存在しない場合、またはリセットに失敗した場合
        """
        worktree_path = self.repo_path / ".worktrees" / session_name

        if not worktree_path.exists():
            raise RuntimeError(f"Worktree does not exist: {worktree_path}")

        # git reset --hard {commit_hash}
        await self._run_command(
            "git", "reset", "--hard", commit_hash,
            cwd=str(worktree_path)
        )

        return {"success": True}

    async def get_git_status(self, session_name: str) -> Dict[str, any]:
        """
        worktreeのGit状態を取得

        Args:
            session_name: セッション名

        Returns:
            Git状態を含む辞書
            - has_uncommitted_changes: 未コミット変更があるかどうか
            - changed_files_count: 変更されたファイル数

        Raises:
            RuntimeError: worktreeが存在しない場合
        """
        worktree_path = self.repo_path / ".worktrees" / session_name

        if not worktree_path.exists():
            raise RuntimeError(f"Worktree does not exist: {worktree_path}")

        # git status --porcelain で変更ファイルを取得
        stdout, _, _ = await self._run_command(
            "git", "status", "--porcelain",
            cwd=str(worktree_path)
        )

        # 出力が空ならクリーン、そうでなければ変更あり
        lines = [line for line in stdout.strip().split("\n") if line]
        has_changes = len(lines) > 0
        changed_count = len(lines)

        return {
            "has_uncommitted_changes": has_changes,
            "changed_files_count": changed_count,
        }
