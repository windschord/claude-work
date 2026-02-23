import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DockerClient
const { mockDockerClient } = vi.hoisted(() => ({
  mockDockerClient: {
    createVolume: vi.fn(),
    removeVolume: vi.fn(),
    run: vi.fn(),
  }
}));

vi.mock('../docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

// fs/promisesをモック
vi.mock('fs/promises', async () => {
  const mockFs = {
    access: vi.fn().mockRejectedValue(new Error('not found')),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
  };
  return {
    ...mockFs,
    default: mockFs,
  };
});

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

import { DockerGitService } from '../docker-git-service';

describe('DockerGitService', () => {
  let dockerGitService: DockerGitService;

  beforeEach(() => {
    vi.clearAllMocks();
    dockerGitService = new DockerGitService();
    mockDockerClient.createVolume.mockResolvedValue({});
    mockDockerClient.removeVolume.mockResolvedValue({});
    mockDockerClient.run.mockResolvedValue({ StatusCode: 0 });
  });

  describe('基本機能', () => {
    it('DockerGitServiceインスタンスを作成できる', () => {
      expect(dockerGitService).toBeDefined();
      expect(dockerGitService).toBeInstanceOf(DockerGitService);
    });
  });

  describe('cloneRepositoryWithPAT', () => {
    it('PAT認証でリポジトリをcloneできる', async () => {
      const result = await dockerGitService.cloneRepositoryWithPAT(
        'https://github.com/user/repo.git',
        'test-project-id',
        'ghp_testPATtoken123'
      );

      expect(result.success).toBe(true);
      expect(mockDockerClient.createVolume).toHaveBeenCalledWith('claude-repo-test-project-id');
      
      expect(mockDockerClient.run).toHaveBeenCalledWith(
        expect.stringContaining('alpine/git'),
        expect.arrayContaining(['-c', expect.stringContaining('git clone')]),
        expect.any(Array),
        expect.objectContaining({
          Env: expect.arrayContaining([expect.stringContaining('GIT_PAT=')])
        })
      );
    });

    it('PAT認証失敗時にエラーがスローされる', async () => {
      mockDockerClient.run.mockResolvedValue({ StatusCode: 128 }); // Fail

      await expect(
        dockerGitService.cloneRepositoryWithPAT(
          'https://github.com/user/repo.git',
          'test-project-id',
          'ghp_invalidToken'
        )
      ).rejects.toThrow('Command failed');
      
      expect(mockDockerClient.removeVolume).toHaveBeenCalledWith('claude-repo-test-project-id');
    });

    it('HTTPS以外のURLではエラーがスローされる', async () => {
      await expect(
        dockerGitService.cloneRepositoryWithPAT(
          'git@github.com:user/repo.git',
          'test-project-id',
          'ghp_testPATtoken123'
        )
      ).rejects.toThrow('HTTPS');
    });
  });
});
