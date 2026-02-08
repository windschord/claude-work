import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GitService } from '../git-service';
import { logger } from '../../lib/logger';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

describe('GitService - getGitStatus', () => {
  let testRepoPath: string;
  let gitService: GitService;

  beforeAll(() => {
    testRepoPath = mkdtempSync(join(tmpdir(), 'git-service-status-test-'));
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

  describe('getGitStatus', () => {
    it('クリーン状態で"clean"を返す', () => {
      const sessionName = 'test-session-clean';
      const worktreePath = gitService.createWorktree(sessionName);

      const status = gitService.getGitStatus(worktreePath);

      expect(status).toBe('clean');
    });

    it('未コミット変更がある場合に"dirty"を返す', () => {
      const sessionName = 'test-session-dirty';
      const worktreePath = gitService.createWorktree(sessionName);

      // ファイルを変更
      writeFileSync(join(worktreePath, 'new-file.txt'), 'new content');

      const status = gitService.getGitStatus(worktreePath);

      expect(status).toBe('dirty');
    });

    it('ステージされた変更がある場合に"dirty"を返す', () => {
      const sessionName = 'test-session-staged';
      const worktreePath = gitService.createWorktree(sessionName);

      // ファイルを追加してステージ
      writeFileSync(join(worktreePath, 'staged-file.txt'), 'staged content');
      execSync('git add .', { cwd: worktreePath });

      const status = gitService.getGitStatus(worktreePath);

      expect(status).toBe('dirty');
    });

    it('既存ファイルを変更した場合に"dirty"を返す', () => {
      const sessionName = 'test-session-modified';
      const worktreePath = gitService.createWorktree(sessionName);

      // 既存ファイルを変更
      writeFileSync(join(worktreePath, 'README.md'), 'modified content');

      const status = gitService.getGitStatus(worktreePath);

      expect(status).toBe('dirty');
    });

    it('ファイルを削除した場合に"dirty"を返す', () => {
      const sessionName = 'test-session-deleted';
      const worktreePath = gitService.createWorktree(sessionName);

      // ファイルを削除
      execSync('git rm README.md', { cwd: worktreePath });

      const status = gitService.getGitStatus(worktreePath);

      expect(status).toBe('dirty');
    });

    it('変更をコミットした後は"clean"を返す', () => {
      const sessionName = 'test-session-committed';
      const worktreePath = gitService.createWorktree(sessionName);

      // ファイルを変更してコミット
      writeFileSync(join(worktreePath, 'committed-file.txt'), 'committed content');
      execSync('git add . && git commit -m "commit changes"', { cwd: worktreePath, shell: true });

      const status = gitService.getGitStatus(worktreePath);

      expect(status).toBe('clean');
    });
  });
});
