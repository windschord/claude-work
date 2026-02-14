import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { join } from 'path';

// vi.hoistedでモック関数を先に初期化
const {
  mockCloneRepository,
  mockCloneRepositoryWithPAT,
  mockDeleteVolume,
  mockDecryptToken,
  mockGetById,
  mockMkdtempSync,
  mockMkdirSync,
  mockRmSync,
  mockExistsSync,
  mockRealpathSync,
  mockExecSync,
} = vi.hoisted(() => ({
  mockCloneRepository: vi.fn(),
  mockCloneRepositoryWithPAT: vi.fn(),
  mockDeleteVolume: vi.fn(),
  mockDecryptToken: vi.fn(),
  mockGetById: vi.fn(),
  mockMkdtempSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockRmSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockRealpathSync: vi.fn((p: string) => p), // そのまま返す
  mockExecSync: vi.fn(),
}));

// fsモジュールのモック
vi.mock('fs', () => {
  const mockFs = {
    mkdtempSync: mockMkdtempSync,
    mkdirSync: mockMkdirSync,
    rmSync: mockRmSync,
    existsSync: mockExistsSync,
    realpathSync: mockRealpathSync,
  };
  return {
    default: mockFs,
    ...mockFs,
  };
});

// child_processモジュールのモック
vi.mock('child_process', () => {
  const mockCp = {
    execSync: mockExecSync,
  };
  return {
    default: mockCp,
    ...mockCp,
  };
});

// DockerGitServiceのモック
vi.mock('@/services/docker-git-service', () => ({
  DockerGitService: class MockDockerGitService {
    cloneRepository = mockCloneRepository;
    cloneRepositoryWithPAT = mockCloneRepositoryWithPAT;
    deleteVolume = mockDeleteVolume;
    createVolume = vi.fn();
    createWorktree = vi.fn();
    deleteWorktree = vi.fn();
    deleteRepository = vi.fn();
  },
}));

// GitHubPATServiceのモック
vi.mock('@/services/github-pat-service', () => ({
  GitHubPATService: class MockGitHubPATService {
    decryptToken = mockDecryptToken;
    getById = mockGetById;
    create = vi.fn();
    list = vi.fn();
    update = vi.fn();
    delete = vi.fn();
    toggleActive = vi.fn();
  },
  PATNotFoundError: class PATNotFoundError extends Error {
    constructor(id: string) {
      super(`PAT not found: ${id}`);
      this.name = 'PATNotFoundError';
    }
  },
  PATEncryptionError: class PATEncryptionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PATEncryptionError';
    }
  },
}));

import { POST } from '@/app/api/projects/clone/route';
import { db, schema } from '@/lib/db';

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/projects/clone', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Project Clone with PAT Integration', () => {
  let testDir: string;
  let testRepoPath: string;
  let originalAllowedDirs: string | undefined;

  beforeEach(() => {
    db.delete(schema.projects).run();
    vi.clearAllMocks();

    // 環境変数をバックアップして無効化
    originalAllowedDirs = process.env.ALLOWED_PROJECT_DIRS;
    delete process.env.ALLOWED_PROJECT_DIRS;

    // テスト用のディレクトリパス（仮想）
    testDir = '/tmp/clone-pat-test-mock';
    testRepoPath = '/tmp/clone-pat-test-mock/source-repo';

    // fsモックのデフォルト動作を設定
    mockMkdtempSync.mockReturnValue(testDir);
    mockMkdirSync.mockReturnValue(undefined);
    mockRmSync.mockReturnValue(undefined);
    // existsSyncは引数に応じて異なる値を返す
    mockExistsSync.mockImplementation((path: string) => {
      // testRepoPath/.git は存在する（URL検証用）
      if (path === join(testRepoPath, '.git')) return true;
      // targetDirは存在しない（clone先チェック用）
      if (typeof path === 'string' && (path.includes('host-clone') || path.includes('clone-pat-test'))) return false;
      // data/repos などのベースディレクトリは存在する
      return true;
    });
    mockExecSync.mockReturnValue(''); // git コマンドは成功する想定

    // DockerGitServiceのデフォルト動作
    mockCloneRepository.mockResolvedValue({ success: true, message: 'cloned' });
    mockDeleteVolume.mockResolvedValue(undefined);
  });

  afterEach(() => {
    db.delete(schema.projects).run();
    if (originalAllowedDirs === undefined) {
      delete process.env.ALLOWED_PROJECT_DIRS;
    } else {
      process.env.ALLOWED_PROJECT_DIRS = originalAllowedDirs;
    }
  });

  describe('Docker + HTTPS + PAT clone flow', () => {
    it('should clone HTTPS repository with PAT authentication', async () => {
      mockDecryptToken.mockResolvedValue('ghp_test_token_1234567890abcdef');
      mockCloneRepositoryWithPAT.mockResolvedValue({ success: true, message: 'cloned with PAT' });

      const request = createRequest({
        url: 'https://github.com/user/private-repo.git',
        cloneLocation: 'docker',
        githubPatId: 'pat-123',
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.project).toBeDefined();
      expect(data.project.clone_location).toBe('docker');
      expect(data.project.docker_volume_id).toBeDefined();

      // PATが復号化されたことを確認
      expect(mockDecryptToken).toHaveBeenCalledWith('pat-123');

      // cloneRepositoryWithPATが正しいパラメータで呼ばれたことを確認
      expect(mockCloneRepositoryWithPAT).toHaveBeenCalledWith(
        'https://github.com/user/private-repo.git',
        expect.any(String), // projectId
        'ghp_test_token_1234567890abcdef'
      );
    });

    it('should clone Docker repository without PAT when githubPatId is not provided', async () => {
      const request = createRequest({
        url: 'https://github.com/user/public-repo.git',
        cloneLocation: 'docker',
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      // PATサービスは呼び出されない
      expect(mockDecryptToken).not.toHaveBeenCalled();

      // 元のURLがそのまま使用される
      expect(mockCloneRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://github.com/user/public-repo.git',
        })
      );
    });

    it('should return 401 when PAT is not found', async () => {
      const { PATNotFoundError } = await import('@/services/github-pat-service');
      mockDecryptToken.mockRejectedValue(new PATNotFoundError('non-existent-pat'));

      const request = createRequest({
        url: 'https://github.com/user/repo.git',
        cloneLocation: 'docker',
        githubPatId: 'non-existent-pat',
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBeTruthy();
      expect(data.error).toContain('PAT not found');

      // clone操作は実行されない
      expect(mockCloneRepository).not.toHaveBeenCalled();
    });

    it('should return 401 when PAT decryption fails', async () => {
      const { PATEncryptionError } = await import('@/services/github-pat-service');
      mockDecryptToken.mockRejectedValue(new PATEncryptionError('Decryption failed'));

      const request = createRequest({
        url: 'https://github.com/user/repo.git',
        cloneLocation: 'docker',
        githubPatId: 'pat-bad-decrypt',
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBeTruthy();

      // clone操作は実行されない
      expect(mockCloneRepository).not.toHaveBeenCalled();
    });

    it('should cleanup project from DB when PAT authentication fails', async () => {
      const { PATNotFoundError } = await import('@/services/github-pat-service');
      mockDecryptToken.mockRejectedValue(new PATNotFoundError('invalid-pat'));

      const request = createRequest({
        url: 'https://github.com/user/repo.git',
        cloneLocation: 'docker',
        githubPatId: 'invalid-pat',
      });

      await POST(request);

      // PAT認証失敗後、DBにプロジェクトが残っていないことを確認
      const projects = db.select().from(schema.projects).all();
      expect(projects).toHaveLength(0);
    });

    it('should cleanup project and volume when Docker clone fails after PAT auth', async () => {
      mockDecryptToken.mockResolvedValue('ghp_valid_token_xxxxxx');
      mockCloneRepositoryWithPAT.mockResolvedValue({
        success: false,
        error: 'Repository not found',
      });

      const request = createRequest({
        url: 'https://github.com/user/nonexistent-repo.git',
        cloneLocation: 'docker',
        githubPatId: 'pat-valid',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Repository not found');

      // PATは正常に復号化された
      expect(mockDecryptToken).toHaveBeenCalledWith('pat-valid');

      // DBにプロジェクトが残っていないことを確認
      const projects = db.select().from(schema.projects).all();
      expect(projects).toHaveLength(0);
    });
  });

  // Host environment clone tests are covered in src/app/api/projects/clone/__tests__/route.test.ts
  // which uses real filesystem operations. This file focuses on Docker + PAT integration tests.

  describe('Error handling', () => {
    it('should return 400 for empty URL regardless of PAT', async () => {
      const request = createRequest({
        url: '',
        githubPatId: 'pat-123',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid URL regardless of PAT', async () => {
      const request = createRequest({
        url: 'not-a-valid-url',
        cloneLocation: 'docker',
        githubPatId: 'pat-123',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects/clone', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid-json',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeTruthy();
    });
  });
});
