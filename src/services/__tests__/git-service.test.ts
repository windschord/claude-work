import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GitService } from '../git-service';
import { logger } from '../../lib/logger';
import { mkdtempSync, rmSync, writeFileSync, chmodSync, renameSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync, spawnSync } from 'child_process';

describe('GitService', () => {
  let testRepoPath: string;
  let gitService: GitService;

  beforeAll(() => {
    testRepoPath = mkdtempSync(join(tmpdir(), 'git-service-test-'));
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

  describe('createWorktree', () => {
    it('should create worktree at .worktrees/sessionName', () => {
      const sessionName = 'test-session-1';
      const branchName = 'test-branch-1';

      const worktreePath = gitService.createWorktree(sessionName, branchName);

      expect(worktreePath).toBe(join(testRepoPath, '.worktrees', sessionName));

      const worktrees = execSync('git worktree list', { cwd: testRepoPath }).toString();
      expect(worktrees).toContain(sessionName);
      expect(worktrees).toContain(branchName);
    });

    it('should throw error if branch already exists', () => {
      const sessionName = 'test-session-2';
      const branchName = 'test-branch-2';

      gitService.createWorktree(sessionName, branchName);

      expect(() => {
        gitService.createWorktree('test-session-3', branchName);
      }).toThrow();
    });
  });

  describe('deleteWorktree', () => {
    it('should delete worktree', () => {
      const sessionName = 'test-session-delete';
      const branchName = 'test-branch-delete';

      gitService.createWorktree(sessionName, branchName);
      gitService.deleteWorktree(sessionName);

      const worktrees = execSync('git worktree list', { cwd: testRepoPath }).toString();
      expect(worktrees).not.toContain(sessionName);
    });

    it('should not throw if worktree does not exist', () => {
      expect(() => {
        gitService.deleteWorktree('non-existent-session');
      }).not.toThrow();
    });
  });

  describe('getDiff', () => {
    it('should return added/modified/deleted files', () => {
      const sessionName = 'test-session-diff';
      const branchName = 'test-branch-diff';
      const worktreePath = gitService.createWorktree(sessionName, branchName);

      writeFileSync(join(worktreePath, 'new-file.txt'), 'new content');
      writeFileSync(join(worktreePath, 'README.md'), 'modified content');

      execSync('git add .', { cwd: worktreePath });
      execSync('git commit -m "test changes"', { cwd: worktreePath });

      const diff = gitService.getDiff(sessionName);

      expect(diff.added).toContain('new-file.txt');
      expect(diff.modified).toContain('README.md');
      expect(diff.deleted).toEqual([]);
    });
  });

  describe('rebaseFromMain', () => {
    it('should rebase worktree branch onto main', () => {
      const sessionName = 'test-session-rebase';
      const branchName = 'test-branch-rebase';
      const worktreePath = gitService.createWorktree(sessionName, branchName);

      writeFileSync(join(worktreePath, 'branch-file.txt'), 'branch content');
      execSync('git add . && git commit -m "branch commit"', { cwd: worktreePath, shell: true });

      writeFileSync(join(testRepoPath, 'main-file.txt'), 'main content');
      execSync('git add . && git commit -m "main commit"', { cwd: testRepoPath, shell: true });

      const result = gitService.rebaseFromMain(sessionName);

      expect(result.success).toBe(true);
      expect(result.conflicts).toBeUndefined();

      const log = execSync('git log --oneline', { cwd: worktreePath }).toString();
      expect(log).toContain('main commit');
      expect(log).toContain('branch commit');
    });

    it('should detect conflicts', () => {
      const sessionName = 'test-session-conflict';
      const branchName = 'test-branch-conflict';
      const worktreePath = gitService.createWorktree(sessionName, branchName);

      writeFileSync(join(worktreePath, 'conflict.txt'), 'branch content');
      execSync('git add . && git commit -m "branch commit"', { cwd: worktreePath, shell: true });

      writeFileSync(join(testRepoPath, 'conflict.txt'), 'main content');
      execSync('git add . && git commit -m "main commit"', { cwd: testRepoPath, shell: true });

      const result = gitService.rebaseFromMain(sessionName);

      expect(result.success).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts).toContain('conflict.txt');
    });
  });

  describe('squashMerge', () => {
    it('should squash merge into main with commit message', () => {
      const sessionName = 'test-session-squash';
      const branchName = 'test-branch-squash';
      const worktreePath = gitService.createWorktree(sessionName, branchName);

      writeFileSync(join(worktreePath, 'feature.txt'), 'feature content');
      execSync('git add . && git commit -m "feature commit 1"', { cwd: worktreePath, shell: true });

      writeFileSync(join(worktreePath, 'feature2.txt'), 'feature content 2');
      execSync('git add . && git commit -m "feature commit 2"', { cwd: worktreePath, shell: true });

      const commitMessage = 'Squashed feature commits';
      const result = gitService.squashMerge(sessionName, commitMessage);

      expect(result.success).toBe(true);
      expect(result.conflicts).toBeUndefined();

      const log = execSync('git log --oneline -1', { cwd: testRepoPath }).toString();
      expect(log).toContain(commitMessage);

      const status = execSync('git status', { cwd: testRepoPath }).toString();
      expect(status).toContain('nothing to commit');
    });
  });

  describe('ensureWorktreeDirectoryWritable', () => {
    it('should throw when .worktrees directory is not writable', () => {
      // .worktreesディレクトリの権限を制限
      const worktreesDir = join(testRepoPath, '.worktrees');
      chmodSync(worktreesDir, 0o444);
      try {
        expect(() => {
          gitService.createWorktree('test-perm-check', 'test-branch-perm');
        }).toThrow(/No write permission to .worktrees directory/);
      } finally {
        // 権限を復元
        chmodSync(worktreesDir, 0o755);
      }
    });

    it('should throw when .git directory is not writable', () => {
      const gitDir = join(testRepoPath, '.git');
      chmodSync(gitDir, 0o444);
      try {
        expect(() => {
          gitService.createWorktree('test-git-perm', 'test-branch-git-perm');
        }).toThrow(/No write permission to git directory/);
      } finally {
        chmodSync(gitDir, 0o755);
      }
    });

    it('should create .worktrees directory if it does not exist', () => {
      const worktreesDir = join(testRepoPath, '.worktrees');
      // 既存の.worktreesを一時的にリネーム
      const tempDir = join(testRepoPath, '.worktrees-backup');
      renameSync(worktreesDir, tempDir);
      try {
        // createWorktreeは.worktreesを作成してからworktreeを作成する
        const worktreePath = gitService.createWorktree('test-auto-create', 'test-branch-auto-create');
        expect(existsSync(worktreePath)).toBe(true);
      } finally {
        // クリーンアップ - 作成されたworktreeを削除してから復元
        if (existsSync(worktreesDir)) {
          // 作成されたworktreeをgitから削除
          spawnSync('git', ['worktree', 'remove', join(worktreesDir, 'test-auto-create'), '--force'], {
            cwd: testRepoPath, encoding: 'utf-8'
          });
          // .worktreesが残っていれば削除
          if (existsSync(worktreesDir)) {
            rmSync(worktreesDir, { recursive: true });
          }
        }
        renameSync(tempDir, worktreesDir);
      }
    });
  });
});
