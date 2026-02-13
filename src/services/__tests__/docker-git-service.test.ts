import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DockerGitService } from '../docker-git-service';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

vi.mock('child_process');
vi.mock('util', () => ({
  promisify: vi.fn((fn) => fn),
}));

vi.mock('fs/promises');

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/services/config-service', () => ({
  getConfigService: vi.fn(() => ({
    getGitCloneTimeoutMs: vi.fn(() => 300000),
    getDebugModeKeepVolumes: vi.fn(() => false),
  })),
}));

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

describe('DockerGitService', () => {
  let dockerGitService: DockerGitService;

  beforeEach(() => {
    vi.clearAllMocks();
    dockerGitService = new DockerGitService();

    // fs.access のモック（認証ディレクトリの存在確認）
    vi.mocked(fs.access).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createVolume', () => {
    it('Dockerボリュームを作成できる', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' } as any);

      const volumeName = await dockerGitService.createVolume('test-project-123');

      expect(volumeName).toBe('claude-repo-test-project-123');
      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        ['volume', 'create', 'claude-repo-test-project-123'],
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it('ボリューム作成失敗時はGitOperationErrorをスローする', async () => {
      mockExecFile.mockRejectedValue(new Error('Docker error'));

      await expect(dockerGitService.createVolume('test-project-123')).rejects.toThrow(
        'Failed to create Docker volume'
      );
    });
  });

  describe('deleteVolume', () => {
    it('Dockerボリュームを削除できる', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' } as any);

      await dockerGitService.deleteVolume('claude-repo-test-project-123');

      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        ['volume', 'rm', 'claude-repo-test-project-123'],
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it('デバッグモード時はボリュームを保持する', async () => {
      const { getConfigService } = await import('@/services/config-service');
      vi.mocked(getConfigService).mockReturnValue({
        getGitCloneTimeoutMs: vi.fn(() => 300000),
        getDebugModeKeepVolumes: vi.fn(() => true),
      } as any);

      const debugDockerService = new DockerGitService();
      await debugDockerService.deleteVolume('claude-repo-test-project-123');

      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('ボリューム削除失敗時はエラーをスローする', async () => {
      mockExecFile.mockRejectedValue(new Error('Docker error'));

      await expect(dockerGitService.deleteVolume('claude-repo-test-project-123')).rejects.toThrow(
        'Failed to delete Docker volume'
      );
    });
  });

  describe('cloneRepository', () => {
    it('リポジトリをDockerボリュームにcloneできる', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' } as any);

      const result = await dockerGitService.cloneRepository({
        url: 'git@github.com:user/repo.git',
        projectId: 'test-project-123',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('claude-repo-test-project-123');

      // ボリューム作成を確認
      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        ['volume', 'create', 'claude-repo-test-project-123'],
        expect.any(Object)
      );

      // git cloneを確認
      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          'run',
          '--rm',
          '-v', 'claude-repo-test-project-123:/repo',
          'alpine/git',
          'clone',
          'git@github.com:user/repo.git',
          '/repo',
        ]),
        expect.objectContaining({ timeout: 300000 })
      );
    });

    it('clone失敗時はボリュームをクリーンアップする', async () => {
      mockExecFile
        .mockResolvedValueOnce({ stdout: '', stderr: '' } as any) // volume create成功
        .mockRejectedValueOnce(new Error('Clone failed')); // git clone失敗

      await expect(
        dockerGitService.cloneRepository({
          url: 'git@github.com:user/repo.git',
          projectId: 'test-project-123',
        })
      ).rejects.toThrow('Failed to clone repository in Docker environment');

      // ボリューム削除を確認
      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        ['volume', 'rm', 'claude-repo-test-project-123'],
        expect.any(Object)
      );
    });

    it('認証情報をマウントする', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' } as any);
      process.env.SSH_AUTH_SOCK = '/tmp/ssh-agent.sock';

      await dockerGitService.cloneRepository({
        url: 'git@github.com:user/repo.git',
        projectId: 'test-project-123',
      });

      // SSH Agent転送を確認
      const cloneCall = mockExecFile.mock.calls.find(
        (call) => call[0] === 'docker' && call[1].includes('clone')
      );
      expect(cloneCall![1]).toContain('-e');
      expect(cloneCall![1]).toContain('SSH_AUTH_SOCK=/ssh-agent');

      delete process.env.SSH_AUTH_SOCK;
    });
  });

  describe('createWorktree', () => {
    it('worktreeを作成できる', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' } as any);

      const result = await dockerGitService.createWorktree({
        projectId: 'test-project-123',
        sessionName: 'test-session',
        branchName: 'session/test-session',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('test-session');

      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          'run',
          '--rm',
          '-v', 'claude-repo-test-project-123:/repo',
          'alpine/git',
          '-C', '/repo',
          'worktree', 'add',
          '/repo/.worktrees/test-session',
          '-b', 'session/test-session',
        ]),
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it('worktree作成失敗時はGitOperationErrorをスローする', async () => {
      mockExecFile.mockRejectedValue(new Error('Worktree error'));

      await expect(
        dockerGitService.createWorktree({
          projectId: 'test-project-123',
          sessionName: 'test-session',
          branchName: 'session/test-session',
        })
      ).rejects.toThrow('Failed to create worktree in Docker environment');
    });
  });

  describe('deleteWorktree', () => {
    it('worktreeを削除できる', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' } as any);

      const result = await dockerGitService.deleteWorktree('test-project-123', 'test-session');

      expect(result.success).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          'run',
          '--rm',
          '-v', 'claude-repo-test-project-123:/repo',
          'alpine/git',
          '-C', '/repo',
          'worktree', 'remove',
          '.worktrees/test-session',
        ]),
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it('worktree削除失敗時もエラーを返す', async () => {
      mockExecFile.mockRejectedValue(new Error('Worktree error'));

      const result = await dockerGitService.deleteWorktree('test-project-123', 'test-session');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('deleteRepository', () => {
    it('リポジトリ（Dockerボリューム）を削除できる', async () => {
      mockExecFile.mockResolvedValue({ stdout: '', stderr: '' } as any);

      const result = await dockerGitService.deleteRepository('test-project-123');

      expect(result.success).toBe(true);
      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        ['volume', 'rm', 'claude-repo-test-project-123'],
        expect.any(Object)
      );
    });

    it('リポジトリ削除失敗時もエラーを返す', async () => {
      mockExecFile.mockRejectedValue(new Error('Docker error'));

      const result = await dockerGitService.deleteRepository('test-project-123');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
