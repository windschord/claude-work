/**
 * WorktreeService テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WorktreeService,
  WorktreeCreateOptions,
  WorktreeInfo,
  ExecFunction,
} from '../worktree-service';

describe('WorktreeService', () => {
  describe('getWorktreeBaseDir', () => {
    it('デフォルトで ~/.claudework/worktrees/ を返す', () => {
      const result = WorktreeService.getWorktreeBaseDir();
      expect(result).toMatch(/\/\.claudework\/worktrees$/);
    });

    it('ホームディレクトリを指定した場合、そのパスをベースにする', () => {
      const result = WorktreeService.getWorktreeBaseDir('/home/testuser');
      expect(result).toBe('/home/testuser/.claudework/worktrees');
    });
  });

  describe('generateWorktreePath', () => {
    it('リポジトリ名とセッション名からパスを生成する', () => {
      const result = WorktreeService.generateWorktreePath('my-repo', 'my-session');
      expect(result).toMatch(/\/\.claudework\/worktrees\/my-repo-my-session$/);
    });

    it('ホームディレクトリを指定した場合、そのパスをベースにする', () => {
      const result = WorktreeService.generateWorktreePath(
        'my-repo',
        'my-session',
        '/home/testuser'
      );
      expect(result).toBe('/home/testuser/.claudework/worktrees/my-repo-my-session');
    });
  });

  describe('generateBranchName', () => {
    it('session/<name> 形式のブランチ名を生成する', () => {
      const result = WorktreeService.generateBranchName('my-session');
      expect(result).toBe('session/my-session');
    });

    it('スペースをハイフンに変換する', () => {
      const result = WorktreeService.generateBranchName('my session name');
      expect(result).toBe('session/my-session-name');
    });

    it('連続するスペースは1つのハイフンに変換する', () => {
      const result = WorktreeService.generateBranchName('my   session');
      expect(result).toBe('session/my-session');
    });

    it('先頭と末尾のスペースはトリムする', () => {
      const result = WorktreeService.generateBranchName('  my session  ');
      expect(result).toBe('session/my-session');
    });
  });

  describe('create', () => {
    let mockExecFn: ReturnType<typeof vi.fn<ExecFunction>>;
    let mockMkdirFn: ReturnType<typeof vi.fn>;
    let service: WorktreeService;

    beforeEach(() => {
      mockExecFn = vi.fn<ExecFunction>().mockResolvedValue({ stdout: '', stderr: '' });
      mockMkdirFn = vi.fn().mockResolvedValue(undefined);
      service = new WorktreeService({ execFn: mockExecFn, mkdirFn: mockMkdirFn });
    });

    it('git worktree add コマンドを実行する', async () => {
      const options: WorktreeCreateOptions = {
        repoPath: '/path/to/repo',
        worktreePath: '/path/to/worktree',
        branch: 'session/my-branch',
        parentBranch: 'main',
      };

      await service.create(options);

      expect(mockExecFn).toHaveBeenCalledWith(
        'git worktree add -b session/my-branch /path/to/worktree main',
        { cwd: '/path/to/repo' }
      );
    });

    it('mkdirFnが指定されている場合、ベースディレクトリを作成する', async () => {
      const mockMkdirFn = vi.fn().mockResolvedValue(undefined);
      const serviceWithMkdir = new WorktreeService({
        execFn: mockExecFn,
        mkdirFn: mockMkdirFn,
      });

      const options: WorktreeCreateOptions = {
        repoPath: '/path/to/repo',
        worktreePath: '/home/user/.claudework/worktrees/my-worktree',
        branch: 'session/my-branch',
        parentBranch: 'main',
      };

      await serviceWithMkdir.create(options);

      expect(mockMkdirFn).toHaveBeenCalledWith('/home/user/.claudework/worktrees', {
        recursive: true,
      });
    });

    it('コマンドが失敗した場合、エラーをスローする', async () => {
      mockExecFn.mockRejectedValue(new Error('git worktree add failed'));

      const options: WorktreeCreateOptions = {
        repoPath: '/path/to/repo',
        worktreePath: '/path/to/worktree',
        branch: 'session/my-branch',
        parentBranch: 'main',
      };

      await expect(service.create(options)).rejects.toThrow('git worktree add failed');
    });
  });

  describe('remove', () => {
    let mockExecFn: ReturnType<typeof vi.fn<ExecFunction>>;
    let mockRmFn: ReturnType<typeof vi.fn>;
    let mockExistsFn: ReturnType<typeof vi.fn>;
    let service: WorktreeService;

    beforeEach(() => {
      mockExecFn = vi.fn<ExecFunction>().mockResolvedValue({ stdout: '', stderr: '' });
      mockRmFn = vi.fn().mockResolvedValue(undefined);
      mockExistsFn = vi.fn().mockResolvedValue(false);
      service = new WorktreeService({
        execFn: mockExecFn,
        rmFn: mockRmFn,
        existsFn: mockExistsFn,
      });
    });

    it('git worktree remove コマンドを実行する', async () => {
      await service.remove('/path/to/worktree', '/path/to/repo');

      expect(mockExecFn).toHaveBeenCalledWith('git worktree remove /path/to/worktree', {
        cwd: '/path/to/repo',
      });
    });

    it('--force オプションを指定できる', async () => {
      await service.remove('/path/to/worktree', '/path/to/repo', { force: true });

      expect(mockExecFn).toHaveBeenCalledWith(
        'git worktree remove --force /path/to/worktree',
        { cwd: '/path/to/repo' }
      );
    });

    it('rmFnが指定されていて、worktree removeの後にディレクトリが残っている場合は削除する', async () => {
      const mockRmFn = vi.fn().mockResolvedValue(undefined);
      const mockExistsFn = vi.fn().mockResolvedValue(true);
      const serviceWithRm = new WorktreeService({
        execFn: mockExecFn,
        rmFn: mockRmFn,
        existsFn: mockExistsFn,
      });

      await serviceWithRm.remove('/path/to/worktree', '/path/to/repo');

      expect(mockExistsFn).toHaveBeenCalledWith('/path/to/worktree');
      expect(mockRmFn).toHaveBeenCalledWith('/path/to/worktree', {
        recursive: true,
        force: true,
      });
    });

    it('ディレクトリが存在しない場合はrmFnを呼ばない', async () => {
      const mockRmFn = vi.fn().mockResolvedValue(undefined);
      const mockExistsFn = vi.fn().mockResolvedValue(false);
      const serviceWithRm = new WorktreeService({
        execFn: mockExecFn,
        rmFn: mockRmFn,
        existsFn: mockExistsFn,
      });

      await serviceWithRm.remove('/path/to/worktree', '/path/to/repo');

      expect(mockExistsFn).toHaveBeenCalledWith('/path/to/worktree');
      expect(mockRmFn).not.toHaveBeenCalled();
    });

    it('コマンドが失敗した場合、エラーをスローする', async () => {
      mockExecFn.mockRejectedValue(new Error('git worktree remove failed'));

      await expect(service.remove('/path/to/worktree', '/path/to/repo')).rejects.toThrow(
        'git worktree remove failed'
      );
    });
  });

  describe('list', () => {
    let mockExecFn: ReturnType<typeof vi.fn<ExecFunction>>;
    let mockMkdirFn: ReturnType<typeof vi.fn>;
    let mockRmFn: ReturnType<typeof vi.fn>;
    let mockExistsFn: ReturnType<typeof vi.fn>;
    let service: WorktreeService;

    beforeEach(() => {
      mockExecFn = vi.fn<ExecFunction>();
      mockMkdirFn = vi.fn().mockResolvedValue(undefined);
      mockRmFn = vi.fn().mockResolvedValue(undefined);
      mockExistsFn = vi.fn().mockResolvedValue(false);
      service = new WorktreeService({
        execFn: mockExecFn,
        mkdirFn: mockMkdirFn,
        rmFn: mockRmFn,
        existsFn: mockExistsFn,
      });
    });

    it('git worktree list --porcelain を実行してパースする', async () => {
      const porcelainOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature/test
`;

      mockExecFn.mockResolvedValue({ stdout: porcelainOutput, stderr: '' });

      const result = await service.list('/path/to/main');

      expect(mockExecFn).toHaveBeenCalledWith('git worktree list --porcelain', {
        cwd: '/path/to/main',
      });

      expect(result).toEqual<WorktreeInfo[]>([
        { path: '/path/to/main', branch: 'main' },
        { path: '/path/to/feature', branch: 'feature/test' },
      ]);
    });

    it('detached HEAD の worktree を処理する', async () => {
      const porcelainOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/detached
HEAD def456
detached
`;

      mockExecFn.mockResolvedValue({ stdout: porcelainOutput, stderr: '' });

      const result = await service.list('/path/to/main');

      expect(result).toEqual<WorktreeInfo[]>([
        { path: '/path/to/main', branch: 'main' },
        { path: '/path/to/detached', branch: '' },
      ]);
    });

    it('空の出力の場合は空配列を返す', async () => {
      mockExecFn.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await service.list('/path/to/repo');

      expect(result).toEqual([]);
    });

    it('コマンドが失敗した場合、エラーをスローする', async () => {
      mockExecFn.mockRejectedValue(new Error('git worktree list failed'));

      await expect(service.list('/path/to/repo')).rejects.toThrow(
        'git worktree list failed'
      );
    });
  });
});
