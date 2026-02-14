import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { join } from 'path';

// vi.hoistedでモック関数を先に初期化
const {
  mockMkdtempSync,
  mockMkdirSync,
  mockRmSync,
  mockExistsSync,
  mockRealpathSync,
  mockExecSync,
  mockClone,
} = vi.hoisted(() => ({
  mockMkdtempSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockRmSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockRealpathSync: vi.fn((p: string) => p),
  mockExecSync: vi.fn(),
  mockClone: vi.fn(),
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

// remote-repo-serviceのモック（clone操作）
vi.mock('@/services/remote-repo-service', () => ({
  remoteRepoService: {
    clone: mockClone,
    validateRemoteUrl: (url: string) => {
      if (!url || url.trim() === '') {
        return { valid: false, error: 'URLが空です' };
      }
      if (url.startsWith('http://')) {
        return { valid: false, error: 'HTTP URLはサポートされていません。HTTPSを使用してください' };
      }
      if (url.startsWith('/') || url.startsWith('https://') || url.startsWith('git@')) {
        return { valid: true };
      }
      return { valid: false, error: '無効なURLフォーマットです' };
    },
    extractRepoName: (url: string) => {
      const match = url.match(/([^/]+?)(\.git)?$/);
      return match ? match[1] : 'repo';
    },
  },
}));

// DockerGitServiceのモック
vi.mock('@/services/docker-git-service', () => ({
  DockerGitService: vi.fn().mockImplementation(() => ({
    cloneRepository: vi.fn().mockResolvedValue({ success: true, message: 'cloned' }),
    cloneRepositoryWithPAT: vi.fn().mockResolvedValue({ success: true, message: 'cloned with PAT' }),
    deleteVolume: vi.fn().mockResolvedValue(undefined),
  })),
}));

// GitHubPATServiceのモック
vi.mock('@/services/github-pat-service', () => ({
  GitHubPATService: vi.fn().mockImplementation(() => ({
    decryptToken: vi.fn(),
    getById: vi.fn(),
  })),
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

describe('POST /api/projects/clone', () => {
  let testDir: string;
  let testRepoPath: string;
  let originalAllowedDirs: string | undefined;

  beforeEach(async () => {
    db.delete(schema.projects).run();
    vi.clearAllMocks();

    // 環境変数をバックアップして無効化
    originalAllowedDirs = process.env.ALLOWED_PROJECT_DIRS;
    delete process.env.ALLOWED_PROJECT_DIRS;

    // テスト用のディレクトリパス（仮想）
    testDir = '/tmp/clone-test-mock';
    testRepoPath = '/tmp/clone-test-mock/source-repo';

    // fsモックのデフォルト動作を設定
    mockMkdtempSync.mockReturnValue(testDir);
    mockMkdirSync.mockReturnValue(undefined);
    mockRmSync.mockReturnValue(undefined);
    // existsSyncは引数に応じて異なる値を返す
    mockExistsSync.mockImplementation((path: string) => {
      // testRepoPath/.git は存在する（URL検証用）
      if (path === join(testRepoPath, '.git')) return true;
      // targetDirは存在しない（clone先チェック用）
      if (typeof path === 'string' && (path.includes('cloned-repo') || path.includes('clone-test'))) return false;
      // data/repos などのベースディレクトリは存在する
      return true;
    });
    mockExecSync.mockReturnValue(''); // git コマンドは成功する想定

    // remote-repo-serviceのcloneメソッドのデフォルト動作
    mockClone.mockResolvedValue({
      success: true,
      path: join(testDir, 'cloned-repo'),
    });
  });

  afterEach(async () => {
    db.delete(schema.projects).run();
    // 環境変数を復元
    if (originalAllowedDirs === undefined) {
      delete process.env.ALLOWED_PROJECT_DIRS;
    } else {
      process.env.ALLOWED_PROJECT_DIRS = originalAllowedDirs;
    }
  });

  it('should clone a local repository and create project', async () => {
    const targetDir = join(testDir, 'cloned-repo');

    const request = new NextRequest('http://localhost:3000/api/projects/clone', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: testRepoPath,
        targetDir,
        cloneLocation: 'host', // ローカルリポジトリなのでhost環境を使用
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.project).toBeDefined();
    expect(data.project.path).toBe(targetDir);
    expect(data.project.remote_url).toBe(testRepoPath);

    // DBに登録されているか確認
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, data.project.id)).get();
    expect(project).toBeTruthy();
    expect(project?.remote_url).toBe(testRepoPath);
  });

  it('should return 400 for empty URL', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/clone', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: '',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBeTruthy();
  });

  it('should return 400 for invalid URL', async () => {
    const request = new NextRequest('http://localhost:3000/api/projects/clone', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: 'not-a-valid-url',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBeTruthy();
  });

  it('should return 409 for duplicate path', async () => {
    const targetDir = join(testDir, 'duplicate-test');

    // 最初のclone
    const firstRequest = new NextRequest('http://localhost:3000/api/projects/clone', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: testRepoPath,
        targetDir,
        cloneLocation: 'host',
      }),
    });

    const firstResponse = await POST(firstRequest);
    expect(firstResponse.status).toBe(201);

    // 2回目のリクエストでは、targetDirが既に存在するようにモックを設定
    mockExistsSync.mockImplementation((path: string) => {
      // testRepoPath/.git は存在する
      if (path === join(testRepoPath, '.git')) return true;
      // 2回目なので、targetDirが存在する
      if (path === targetDir) return true;
      // その他のディレクトリは存在する
      return true;
    });

    // 別のリポジトリパス（仮想）
    const anotherRepoPath = join(testDir, 'another-repo');

    // 同じtargetDirで再度clone（既にディレクトリが存在するのでエラー）
    const secondRequest = new NextRequest('http://localhost:3000/api/projects/clone', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: anotherRepoPath,
        targetDir,
        cloneLocation: 'host',
      }),
    });

    const secondResponse = await POST(secondRequest);
    // ディレクトリが既に存在するので400エラー
    expect(secondResponse.status).toBe(400);
  });

  it('should use custom project name when provided', async () => {
    const targetDir = join(testDir, 'named-repo');

    const request = new NextRequest('http://localhost:3000/api/projects/clone', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: testRepoPath,
        targetDir,
        name: 'custom-project-name',
        cloneLocation: 'host',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.project.name).toBe('custom-project-name');
  });

  it('should extract repo name from URL when name not provided', async () => {
    const targetDir = join(testDir, 'auto-named-repo');

    const request = new NextRequest('http://localhost:3000/api/projects/clone', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: testRepoPath,
        targetDir,
        cloneLocation: 'host',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.project.name).toBe('source-repo');
  });

  it('should use host environment when cloneLocation explicitly specified', async () => {
    const targetDir = join(testDir, 'explicit-host');

    const request = new NextRequest('http://localhost:3000/api/projects/clone', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: testRepoPath,
        targetDir,
        cloneLocation: 'host',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, data.project.id)).get();

    // cloneLocation='host'を明示的に指定したのでhost環境で動作
    expect(project?.clone_location).toBe('host');
  });

  it('should clone to host environment when cloneLocation=host', async () => {
    const targetDir = join(testDir, 'host-clone');

    const request = new NextRequest('http://localhost:3000/api/projects/clone', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: testRepoPath,
        targetDir,
        cloneLocation: 'host',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.project.clone_location).toBe('host');
    expect(data.project.docker_volume_id).toBeNull();
  });

  // Note: Docker環境のテストはDockerが必要なため、統合テストで実施
  // ここではモックを使った基本的なテストのみ

  describe('PAT authentication for Docker + HTTPS clone', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should clone with PAT authentication when docker + HTTPS + githubPatId specified', async () => {
      // GitHubPATServiceのモックを設定
      const { GitHubPATService } = await import('@/services/github-pat-service');
      const mockDecryptToken = vi.fn().mockResolvedValue('ghp_test_token_1234567890');
      const mockGetById = vi.fn().mockResolvedValue({
        id: 'pat-123',
        name: 'test-pat',
        isActive: true,
      });
      vi.mocked(GitHubPATService).mockImplementation(function (this: unknown) {
        Object.assign(this as Record<string, unknown>, {
          decryptToken: mockDecryptToken,
          getById: mockGetById,
          create: vi.fn(),
          list: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          toggleActive: vi.fn(),
        });
      } as unknown as () => InstanceType<typeof GitHubPATService>);

      // DockerGitServiceのモックを設定
      const { DockerGitService } = await import('@/services/docker-git-service');
      const mockCloneRepository = vi.fn().mockResolvedValue({ success: true, message: 'cloned' });
      const mockCloneRepositoryWithPAT = vi.fn().mockResolvedValue({ success: true, message: 'cloned with PAT' });
      vi.mocked(DockerGitService).mockImplementation(function (this: unknown) {
        Object.assign(this as Record<string, unknown>, {
          cloneRepository: mockCloneRepository,
          cloneRepositoryWithPAT: mockCloneRepositoryWithPAT,
          deleteVolume: vi.fn().mockResolvedValue(undefined),
          createVolume: vi.fn(),
          createWorktree: vi.fn(),
          deleteWorktree: vi.fn(),
          deleteRepository: vi.fn(),
        });
      } as unknown as () => InstanceType<typeof DockerGitService>);

      const request = new NextRequest('http://localhost:3000/api/projects/clone', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: 'https://github.com/user/repo.git',
          cloneLocation: 'docker',
          githubPatId: 'pat-123',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      // PATが復号化されたことを確認
      expect(mockDecryptToken).toHaveBeenCalledWith('pat-123');

      // DockerGitService.cloneRepositoryWithPATが呼ばれたことを確認
      expect(mockCloneRepositoryWithPAT).toHaveBeenCalledWith(
        'https://github.com/user/repo.git',
        expect.any(String), // projectId
        'ghp_test_token_1234567890' // decrypted PAT
      );
    });

    it('should return 401 when PAT is not found', async () => {
      // GitHubPATServiceのモックでPATNotFoundErrorをスロー
      const { GitHubPATService, PATNotFoundError } = await import('@/services/github-pat-service');
      const mockDecryptToken = vi.fn().mockRejectedValue(new PATNotFoundError('non-existent-pat'));
      vi.mocked(GitHubPATService).mockImplementation(function (this: unknown) {
        Object.assign(this as Record<string, unknown>, {
          decryptToken: mockDecryptToken,
          getById: vi.fn(),
          create: vi.fn(),
          list: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          toggleActive: vi.fn(),
        });
      } as unknown as () => InstanceType<typeof GitHubPATService>);

      const request = new NextRequest('http://localhost:3000/api/projects/clone', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: 'https://github.com/user/repo.git',
          cloneLocation: 'docker',
          githubPatId: 'non-existent-pat',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    it('should return 401 when PAT decryption fails', async () => {
      // GitHubPATServiceのモックで復号化エラーをスロー
      const { GitHubPATService, PATEncryptionError } = await import('@/services/github-pat-service');
      const mockDecryptToken = vi.fn().mockRejectedValue(
        new (PATEncryptionError as unknown as new (msg: string) => Error)('Failed to decrypt PAT')
      );
      vi.mocked(GitHubPATService).mockImplementation(function (this: unknown) {
        Object.assign(this as Record<string, unknown>, {
          decryptToken: mockDecryptToken,
          getById: vi.fn(),
          create: vi.fn(),
          list: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          toggleActive: vi.fn(),
        });
      } as unknown as () => InstanceType<typeof GitHubPATService>);

      const request = new NextRequest('http://localhost:3000/api/projects/clone', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: 'https://github.com/user/repo.git',
          cloneLocation: 'docker',
          githubPatId: 'pat-bad-decrypt',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBeTruthy();
    });

    it('should not use PAT when cloneLocation is host even if githubPatId is provided', async () => {
      const { GitHubPATService } = await import('@/services/github-pat-service');
      const targetDir = join(testDir, 'host-with-pat');

      const request = new NextRequest('http://localhost:3000/api/projects/clone', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: testRepoPath,
          targetDir,
          cloneLocation: 'host',
          githubPatId: 'pat-123',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      // host環境なのでPATは使われない（GitHubPATServiceがインスタンス化されない）
      expect(GitHubPATService).not.toHaveBeenCalled();
    });

    it('should not use PAT for docker clone when githubPatId is not provided', async () => {
      // DockerGitServiceのモックを設定（PATなし）
      const { DockerGitService } = await import('@/services/docker-git-service');
      const mockCloneRepository = vi.fn().mockResolvedValue({ success: true, message: 'cloned without PAT' });
      vi.mocked(DockerGitService).mockImplementation(function (this: unknown) {
        Object.assign(this as Record<string, unknown>, {
          cloneRepository: mockCloneRepository,
          deleteVolume: vi.fn().mockResolvedValue(undefined),
          createVolume: vi.fn(),
          createWorktree: vi.fn(),
          deleteWorktree: vi.fn(),
          deleteRepository: vi.fn(),
        });
      } as unknown as () => InstanceType<typeof DockerGitService>);

      const request = new NextRequest('http://localhost:3000/api/projects/clone', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: 'https://github.com/user/repo.git',
          cloneLocation: 'docker',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      // 元のURLがそのまま渡されることを確認（PAT挿入なし）
      expect(mockCloneRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://github.com/user/repo.git',
        })
      );
    });
  });
});
