import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GitService } from '../git-service';
import { logger } from '../../lib/logger';
import * as fs from 'fs';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs';
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
      const branchName = `session/${sessionName}`;

      const worktreePath = gitService.createWorktree(sessionName);

      expect(worktreePath).toBe(join(testRepoPath, '.worktrees', sessionName));

      const worktrees = execSync('git worktree list', { cwd: testRepoPath }).toString();
      expect(worktrees).toContain(sessionName);
      expect(worktrees).toContain(branchName);
    });

    it('should throw error if worktree already exists', () => {
      const sessionName = 'test-session-2';

      gitService.createWorktree(sessionName);

      // 同じセッション名で再作成を試みるとブランチが既に存在するためエラー
      expect(() => {
        gitService.createWorktree(sessionName);
      }).toThrow();
    });
  });

  describe('deleteWorktree', () => {
    it('should delete worktree', () => {
      const sessionName = 'test-session-delete';

      gitService.createWorktree(sessionName);
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
      const worktreePath = gitService.createWorktree(sessionName);

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
      const worktreePath = gitService.createWorktree(sessionName);

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
      const worktreePath = gitService.createWorktree(sessionName);

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
      const worktreePath = gitService.createWorktree(sessionName);

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
    // rootユーザーはchmod制限を無視するためスキップ
    it.skipIf(process.getuid?.() === 0)('should throw when .worktrees directory is not writable', () => {
      const worktreesDir = join(testRepoPath, '.worktrees');

      fs.chmodSync(worktreesDir, 0o444);

      try {
        expect(() => {
          gitService.createWorktree('test-perm-check');
        }).toThrow(/No write permission to .worktrees directory/);
      } finally {
        fs.chmodSync(worktreesDir, 0o755);
      }
    });

    // rootユーザーはchmod制限を無視するためスキップ
    it.skipIf(process.getuid?.() === 0)('should throw when .git directory is not writable', () => {
      const gitDir = join(testRepoPath, '.git');

      fs.chmodSync(gitDir, 0o444);

      try {
        expect(() => {
          gitService.createWorktree('test-git-perm');
        }).toThrow(/No write permission to git directory/);
      } finally {
        fs.chmodSync(gitDir, 0o755);
      }
    });

    it('should create .worktrees directory if it does not exist', () => {
      // このテストは実際にworktreeを作成するため、既存の統合テストスタイルを維持
      // .worktreesを一時的にリネームして不在をシミュレート
      const worktreesDir = join(testRepoPath, '.worktrees');
      const tempDir = join(testRepoPath, '.worktrees-backup');

      if (!fs.existsSync(worktreesDir)) {
        fs.mkdirSync(worktreesDir, { recursive: true });
      }
      fs.renameSync(worktreesDir, tempDir);
      try {
        const worktreePath = gitService.createWorktree('test-auto-create');
        expect(existsSync(worktreePath)).toBe(true);
      } finally {
        // クリーンアップ
        const autoCreateDir = join(testRepoPath, '.worktrees', 'test-auto-create');
        if (existsSync(autoCreateDir)) {
          spawnSync('git', ['worktree', 'remove', autoCreateDir, '--force'], {
            cwd: testRepoPath, encoding: 'utf-8'
          });
        }
        if (existsSync(worktreesDir)) {
          rmSync(worktreesDir, { recursive: true });
        }
        fs.renameSync(tempDir, worktreesDir);
      }
    });
  });
});
