import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GitService } from '../git-service';
import { logger } from '../../lib/logger';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * ByPathメソッドのテスト
 *
 * Claude Code --worktreeモード（branch_name === ''）では、
 * worktree_pathがプロジェクトルートを指すため、
 * sessionNameベースのパス構築（.worktrees/<name>）が使えない。
 * ByPathメソッドはworktreeパスを直接受け取ることでこの問題を解決する。
 */

/**
 * テスト用ヘルパー: git worktreeを直接作成
 */
function createTestWorktree(repoPath: string, sessionName: string): string {
  const branchName = `session/${sessionName}`;
  const worktreePath = join(repoPath, '.worktrees', sessionName);
  execSync(`git worktree add -b "${branchName}" "${worktreePath}"`, {
    cwd: repoPath,
    encoding: 'utf-8',
  });
  return worktreePath;
}

describe('GitService ByPath methods', () => {
  let testRepoPath: string;
  let gitService: GitService;

  beforeAll(() => {
    testRepoPath = mkdtempSync(join(tmpdir(), 'git-service-bypath-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', { cwd: testRepoPath, shell: true });
    execSync('git branch -M main', { cwd: testRepoPath });

    gitService = new GitService(testRepoPath, logger);
  });

  afterAll(() => {
    rmSync(testRepoPath, { recursive: true, force: true });
  });

  describe('getDiffByPath', () => {
    it('should return diff using worktree path directly', () => {
      const sessionName = 'test-bypath-diff';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'new-file.txt'), 'new content');
      writeFileSync(join(worktreePath, 'README.md'), 'modified content');

      execSync('git add .', { cwd: worktreePath });
      execSync('git commit -m "test changes"', { cwd: worktreePath });

      const diff = gitService.getDiffByPath(worktreePath);

      expect(diff.added).toContain('new-file.txt');
      expect(diff.modified).toContain('README.md');
      expect(diff.deleted).toEqual([]);
    });

    it('should produce same result as getDiff', () => {
      const sessionName = 'test-bypath-diff-compare';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'compare-file.txt'), 'compare content');
      execSync('git add . && git commit -m "compare commit"', { cwd: worktreePath, shell: true });

      const diffByName = gitService.getDiff(sessionName);
      const diffByPath = gitService.getDiffByPath(worktreePath);

      expect(diffByPath).toEqual(diffByName);
    });
  });

  describe('getDiffDetailsByPath', () => {
    it('should return detailed diff using worktree path directly', () => {
      const sessionName = 'test-bypath-diffdetails';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'detail-file.txt'), 'detail content');
      execSync('git add . && git commit -m "detail commit"', { cwd: worktreePath, shell: true });

      const diff = gitService.getDiffDetailsByPath(worktreePath);

      expect(diff.files).toHaveLength(1);
      expect(diff.files[0].path).toBe('detail-file.txt');
      expect(diff.files[0].status).toBe('added');
      expect(diff.totalAdditions).toBeGreaterThan(0);
    });

    it('should produce same result as getDiffDetails', () => {
      const sessionName = 'test-bypath-diffdetails-compare';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'compare-detail.txt'), 'compare detail');
      execSync('git add . && git commit -m "compare detail commit"', { cwd: worktreePath, shell: true });

      const detailsByName = gitService.getDiffDetails(sessionName);
      const detailsByPath = gitService.getDiffDetailsByPath(worktreePath);

      expect(detailsByPath).toEqual(detailsByName);
    });
  });

  describe('getCommitsByPath', () => {
    it('should return commits using worktree path directly', () => {
      const sessionName = 'test-bypath-commits';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'commit-file.txt'), 'commit content');
      execSync('git add . && git commit -m "commit message"', { cwd: worktreePath, shell: true });

      const commits = gitService.getCommitsByPath(worktreePath);

      expect(commits).toHaveLength(1);
      expect(commits[0].message).toBe('commit message');
      expect(commits[0].files_changed).toBe(1);
    });

    it('should produce same result as getCommits', () => {
      const sessionName = 'test-bypath-commits-compare';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'compare-commit.txt'), 'compare commit');
      execSync('git add . && git commit -m "compare commit msg"', { cwd: worktreePath, shell: true });

      const commitsByName = gitService.getCommits(sessionName);
      const commitsByPath = gitService.getCommitsByPath(worktreePath);

      expect(commitsByPath).toEqual(commitsByName);
    });
  });

  describe('rebaseFromMainByPath', () => {
    it('should rebase using worktree path directly', () => {
      const sessionName = 'test-bypath-rebase';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'rebase-branch.txt'), 'branch content');
      execSync('git add . && git commit -m "branch commit"', { cwd: worktreePath, shell: true });

      writeFileSync(join(testRepoPath, 'rebase-main.txt'), 'main content');
      execSync('git add . && git commit -m "main commit"', { cwd: testRepoPath, shell: true });

      const result = gitService.rebaseFromMainByPath(worktreePath);

      expect(result.success).toBe(true);
      expect(result.conflicts).toBeUndefined();

      const log = execSync('git log --oneline', { cwd: worktreePath }).toString();
      expect(log).toContain('main commit');
      expect(log).toContain('branch commit');
    });

    it('should detect conflicts', () => {
      const sessionName = 'test-bypath-conflict';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'bypath-conflict.txt'), 'branch content');
      execSync('git add . && git commit -m "branch commit"', { cwd: worktreePath, shell: true });

      writeFileSync(join(testRepoPath, 'bypath-conflict.txt'), 'main content');
      execSync('git add . && git commit -m "main commit"', { cwd: testRepoPath, shell: true });

      const result = gitService.rebaseFromMainByPath(worktreePath);

      expect(result.success).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts).toContain('bypath-conflict.txt');
    });
  });

  describe('resetByPath', () => {
    it('should reset using worktree path directly', () => {
      const sessionName = 'test-bypath-reset';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      writeFileSync(join(worktreePath, 'reset-file.txt'), 'reset content');
      execSync('git add . && git commit -m "reset commit"', { cwd: worktreePath, shell: true });

      // 最初のコミットハッシュを取得
      const firstHash = execSync('git rev-parse HEAD~1', {
        cwd: worktreePath,
        encoding: 'utf-8',
      }).trim();

      const result = gitService.resetByPath(worktreePath, firstHash);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // reset後、追加したファイルが消えていることを確認
      const currentHash = execSync('git rev-parse HEAD', {
        cwd: worktreePath,
        encoding: 'utf-8',
      }).trim();
      expect(currentHash).toBe(firstHash);
    });

    it('should fail with invalid commit hash', () => {
      const sessionName = 'test-bypath-reset-fail';
      const worktreePath = createTestWorktree(testRepoPath, sessionName);

      const result = gitService.resetByPath(worktreePath, 'invalid_nonexistent_hash');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('ByPath methods work with project root path (--worktree mode simulation)', () => {
    it('should work with project root as worktreePath when on a branch', () => {
      // --worktreeモードでは worktree_path がプロジェクトルートを指す
      // ブランチを作成してプロジェクトルートでの操作をシミュレート
      const branchName = 'test-worktree-mode-sim';

      // テスト用のブランチを作成してworktreeとして追加
      const simWorktreePath = join(testRepoPath, '.worktrees', branchName);
      execSync(`git worktree add -b "${branchName}" "${simWorktreePath}"`, {
        cwd: testRepoPath,
        encoding: 'utf-8',
      });

      writeFileSync(join(simWorktreePath, 'worktree-mode-file.txt'), 'worktree mode content');
      execSync('git add . && git commit -m "worktree mode commit"', {
        cwd: simWorktreePath,
        shell: true,
      });

      // ByPathメソッドでworktreeパスを直接指定
      const diff = gitService.getDiffByPath(simWorktreePath);
      expect(diff.added).toContain('worktree-mode-file.txt');

      const commits = gitService.getCommitsByPath(simWorktreePath);
      expect(commits).toHaveLength(1);
      expect(commits[0].message).toBe('worktree mode commit');

      const diffDetails = gitService.getDiffDetailsByPath(simWorktreePath);
      expect(diffDetails.files).toHaveLength(1);
      expect(diffDetails.files[0].path).toBe('worktree-mode-file.txt');
    });
  });
});
