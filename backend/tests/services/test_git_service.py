"""Git操作サービスのテスト"""
import asyncio
import os
import shutil
import tempfile
from pathlib import Path

import pytest

from app.services.git_service import GitService


class TestGitService:
    """GitServiceのテストクラス"""

    @pytest.fixture
    async def temp_git_repo(self):
        """テスト用の一時的なGitリポジトリを作成"""
        # 一時ディレクトリを作成
        temp_dir = tempfile.mkdtemp()
        repo_path = Path(temp_dir) / "test_repo"
        repo_path.mkdir()

        # Gitリポジトリを初期化
        process = await asyncio.create_subprocess_exec(
            "git", "init",
            cwd=str(repo_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()

        # Git設定を追加
        await asyncio.create_subprocess_exec(
            "git", "config", "user.name", "Test User",
            cwd=str(repo_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await asyncio.create_subprocess_exec(
            "git", "config", "user.email", "test@example.com",
            cwd=str(repo_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        # mainブランチを作成するため、初期コミットを作成
        test_file = repo_path / "README.md"
        test_file.write_text("# Test Repository\n")

        await asyncio.create_subprocess_exec(
            "git", "add", "README.md",
            cwd=str(repo_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await asyncio.create_subprocess_exec(
            "git", "commit", "-m", "Initial commit",
            cwd=str(repo_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        # mainブランチを作成
        await asyncio.create_subprocess_exec(
            "git", "branch", "-M", "main",
            cwd=str(repo_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        yield repo_path

        # クリーンアップ
        shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.fixture
    def git_service(self, temp_git_repo):
        """GitServiceインスタンスを作成"""
        return GitService(repo_path=str(temp_git_repo))

    @pytest.mark.asyncio
    async def test_create_worktree_success(self, git_service, temp_git_repo):
        """worktree作成が成功すること"""
        session_name = "test-session"
        branch_name = "feature/test-branch"

        worktree_path = await git_service.create_worktree(session_name, branch_name)

        # worktreeパスが正しいこと
        expected_path = temp_git_repo / ".worktrees" / session_name
        assert worktree_path == str(expected_path)

        # worktreeディレクトリが存在すること
        assert expected_path.exists()

        # ブランチが作成されていること
        process = await asyncio.create_subprocess_exec(
            "git", "branch", "--list", branch_name,
            cwd=str(temp_git_repo),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await process.communicate()
        assert branch_name in stdout.decode()

    @pytest.mark.asyncio
    async def test_delete_worktree_success(self, git_service, temp_git_repo):
        """worktree削除が成功すること"""
        session_name = "test-session"
        branch_name = "feature/test-branch"

        # worktreeを作成
        await git_service.create_worktree(session_name, branch_name)

        # worktreeを削除
        await git_service.delete_worktree(session_name, branch_name)

        # worktreeディレクトリが削除されていること
        worktree_path = temp_git_repo / ".worktrees" / session_name
        assert not worktree_path.exists()

        # ブランチが削除されていること
        process = await asyncio.create_subprocess_exec(
            "git", "branch", "--list", branch_name,
            cwd=str(temp_git_repo),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await process.communicate()
        assert branch_name not in stdout.decode()

    @pytest.mark.asyncio
    async def test_get_diff_with_changes(self, git_service, temp_git_repo):
        """変更があった場合のdiff取得が成功すること"""
        session_name = "test-session"
        branch_name = "feature/test-branch"

        # worktreeを作成
        worktree_path = await git_service.create_worktree(session_name, branch_name)

        # worktree内でファイルを追加
        new_file = Path(worktree_path) / "new_file.txt"
        new_file.write_text("New content\n")

        # ファイルを変更
        readme_file = Path(worktree_path) / "README.md"
        readme_file.write_text("# Updated Repository\n")

        # ファイルをステージング
        process = await asyncio.create_subprocess_exec(
            "git", "add", ".",
            cwd=worktree_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()

        # コミット
        process = await asyncio.create_subprocess_exec(
            "git", "commit", "-m", "Add and modify files",
            cwd=worktree_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()

        # diffを取得
        diff_result = await git_service.get_diff(session_name)

        # 結果を検証
        assert "added_files" in diff_result
        assert "modified_files" in diff_result
        assert "deleted_files" in diff_result
        assert "diff_content" in diff_result

        # 追加されたファイルが含まれていること
        assert "new_file.txt" in diff_result["added_files"]

        # 変更されたファイルが含まれていること
        assert "README.md" in diff_result["modified_files"]

        # diff内容が含まれていること
        assert len(diff_result["diff_content"]) > 0

    @pytest.mark.asyncio
    async def test_get_diff_no_changes(self, git_service, temp_git_repo):
        """変更がない場合のdiff取得が成功すること"""
        session_name = "test-session"
        branch_name = "feature/test-branch"

        # worktreeを作成
        await git_service.create_worktree(session_name, branch_name)

        # diffを取得
        diff_result = await git_service.get_diff(session_name)

        # 変更がないことを確認
        assert len(diff_result["added_files"]) == 0
        assert len(diff_result["modified_files"]) == 0
        assert len(diff_result["deleted_files"]) == 0
        assert diff_result["diff_content"] == ""

    @pytest.mark.asyncio
    async def test_rebase_from_main_success(self, git_service, temp_git_repo):
        """mainブランチからのrebaseが成功すること"""
        session_name = "test-session"
        branch_name = "feature/test-branch"

        # worktreeを作成
        worktree_path = await git_service.create_worktree(session_name, branch_name)

        # mainブランチに変更を追加
        main_file = temp_git_repo / "main_file.txt"
        main_file.write_text("Main branch content\n")

        process = await asyncio.create_subprocess_exec(
            "git", "add", "main_file.txt",
            cwd=str(temp_git_repo),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        process = await asyncio.create_subprocess_exec(
            "git", "commit", "-m", "Add main file",
            cwd=str(temp_git_repo),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()

        # worktreeでrebaseを実行
        result = await git_service.rebase_from_main(session_name)

        # rebaseが成功したことを確認
        assert result["success"] is True
        assert "conflicts" not in result or len(result["conflicts"]) == 0

    @pytest.mark.asyncio
    async def test_rebase_from_main_with_conflict(self, git_service, temp_git_repo):
        """mainブランチからのrebase時にコンフリクトが検出されること"""
        session_name = "test-session"
        branch_name = "feature/test-branch"

        # worktreeを作成
        worktree_path = await git_service.create_worktree(session_name, branch_name)

        # worktreeでREADMEを変更
        readme_file = Path(worktree_path) / "README.md"
        readme_file.write_text("# Feature Branch Change\n")

        process = await asyncio.create_subprocess_exec(
            "git", "add", "README.md",
            cwd=worktree_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        process = await asyncio.create_subprocess_exec(
            "git", "commit", "-m", "Update README in feature",
            cwd=worktree_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()

        # mainブランチで同じファイルを変更
        main_readme = temp_git_repo / "README.md"
        main_readme.write_text("# Main Branch Change\n")

        process = await asyncio.create_subprocess_exec(
            "git", "add", "README.md",
            cwd=str(temp_git_repo),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        process = await asyncio.create_subprocess_exec(
            "git", "commit", "-m", "Update README in main",
            cwd=str(temp_git_repo),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()

        # worktreeでrebaseを実行
        result = await git_service.rebase_from_main(session_name)

        # コンフリクトが検出されること
        assert result["success"] is False
        assert "conflicts" in result
        assert len(result["conflicts"]) > 0

    @pytest.mark.asyncio
    async def test_squash_merge_success(self, git_service, temp_git_repo):
        """squash mergeが成功すること"""
        session_name = "test-session"
        branch_name = "feature/test-branch"

        # worktreeを作成
        worktree_path = await git_service.create_worktree(session_name, branch_name)

        # worktreeで複数のコミットを作成
        for i in range(3):
            file_path = Path(worktree_path) / f"file_{i}.txt"
            file_path.write_text(f"Content {i}\n")

            process = await asyncio.create_subprocess_exec(
                "git", "add", f"file_{i}.txt",
                cwd=worktree_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()
            process = await asyncio.create_subprocess_exec(
                "git", "commit", "-m", f"Add file {i}",
                cwd=worktree_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()

        # squash mergeを実行
        commit_message = "Squashed commit message"
        result = await git_service.squash_merge(branch_name, commit_message)

        # mergeが成功したことを確認
        assert result["success"] is True

        # mainブランチにマージされていることを確認
        process = await asyncio.create_subprocess_exec(
            "git", "log", "--oneline", "-1",
            cwd=str(temp_git_repo),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await process.communicate()
        assert commit_message in stdout.decode()

        # ファイルがmainブランチに存在することを確認
        for i in range(3):
            assert (temp_git_repo / f"file_{i}.txt").exists()

    @pytest.mark.asyncio
    async def test_create_worktree_with_existing_directory(self, git_service, temp_git_repo):
        """既存のworktreeディレクトリがある場合にエラーが発生すること"""
        session_name = "test-session"
        branch_name = "feature/test-branch"

        # 最初のworktreeを作成
        await git_service.create_worktree(session_name, branch_name)

        # 同じsession_nameで再度作成を試みる
        with pytest.raises(Exception):
            await git_service.create_worktree(session_name, "feature/another-branch")

    @pytest.mark.asyncio
    async def test_delete_nonexistent_worktree(self, git_service, temp_git_repo):
        """存在しないworktreeを削除しようとした場合にエラーが発生すること"""
        session_name = "nonexistent-session"
        branch_name = "feature/nonexistent-branch"

        # 存在しないworktreeを削除
        with pytest.raises(Exception):
            await git_service.delete_worktree(session_name, branch_name)

    @pytest.mark.asyncio
    async def test_get_git_status_clean(self, git_service, temp_git_repo):
        """クリーンなworktreeのGit状態取得が成功すること"""
        session_name = "test-session"
        branch_name = "feature/test-branch"

        # worktreeを作成
        await git_service.create_worktree(session_name, branch_name)

        # Git状態を取得
        status = await git_service.get_git_status(session_name)

        # クリーンな状態であることを確認
        assert status["has_uncommitted_changes"] is False
        assert status["changed_files_count"] == 0

    @pytest.mark.asyncio
    async def test_get_git_status_with_changes(self, git_service, temp_git_repo):
        """変更があるworktreeのGit状態取得が成功すること"""
        session_name = "test-session"
        branch_name = "feature/test-branch"

        # worktreeを作成
        worktree_path = await git_service.create_worktree(session_name, branch_name)

        # 新しいファイルを追加（ステージングなし）
        new_file1 = Path(worktree_path) / "new_file1.txt"
        new_file1.write_text("New content 1\n")

        # ファイルを変更（ステージングなし）
        readme_file = Path(worktree_path) / "README.md"
        readme_file.write_text("# Updated Repository\n")

        # Git状態を取得
        status = await git_service.get_git_status(session_name)

        # 変更があることを確認
        assert status["has_uncommitted_changes"] is True
        assert status["changed_files_count"] == 2

    @pytest.mark.asyncio
    async def test_get_git_status_with_staged_changes(self, git_service, temp_git_repo):
        """ステージングされた変更があるworktreeのGit状態取得が成功すること"""
        session_name = "test-session"
        branch_name = "feature/test-branch"

        # worktreeを作成
        worktree_path = await git_service.create_worktree(session_name, branch_name)

        # 新しいファイルを追加してステージング
        new_file = Path(worktree_path) / "new_file.txt"
        new_file.write_text("New content\n")

        process = await asyncio.create_subprocess_exec(
            "git", "add", "new_file.txt",
            cwd=worktree_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()

        # Git状態を取得
        status = await git_service.get_git_status(session_name)

        # 変更があることを確認
        assert status["has_uncommitted_changes"] is True
        assert status["changed_files_count"] == 1

    @pytest.mark.asyncio
    async def test_get_git_status_nonexistent_worktree(self, git_service, temp_git_repo):
        """存在しないworktreeのGit状態取得がエラーになること"""
        session_name = "nonexistent-session"

        # 存在しないworktreeのGit状態を取得
        with pytest.raises(RuntimeError):
            await git_service.get_git_status(session_name)
