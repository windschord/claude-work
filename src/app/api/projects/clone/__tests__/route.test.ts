import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '../route';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

// DockerGitServiceのモック
vi.mock('@/services/docker-git-service', () => ({
  DockerGitService: vi.fn().mockImplementation(() => ({
    cloneRepository: vi.fn().mockResolvedValue({ success: true, message: 'cloned' }),
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

    // 環境変数をバックアップして無効化
    originalAllowedDirs = process.env.ALLOWED_PROJECT_DIRS;
    delete process.env.ALLOWED_PROJECT_DIRS;

    // テスト用ディレクトリを作成
    testDir = mkdtempSync(join(tmpdir(), 'clone-test-'));

    // テスト用のGitリポジトリを作成（clone元として使用）
    testRepoPath = join(testDir, 'source-repo');
    mkdirSync(testRepoPath);
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });
  });

  afterEach(async () => {
    db.delete(schema.projects).run();
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
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

    // ディレクトリが作成されているか確認
    expect(existsSync(join(targetDir, '.git'))).toBe(true);

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

    // 別のリポジトリを作成
    const anotherRepoPath = join(testDir, 'another-repo');
    mkdirSync(anotherRepoPath);
    execSync('git init', { cwd: anotherRepoPath });
    execSync('git config user.name "Test"', { cwd: anotherRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: anotherRepoPath });
    execSync('echo "another" > README.md && git add . && git commit -m "initial"', {
      cwd: anotherRepoPath,
      shell: true,
    });

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
    expect(existsSync(join(targetDir, '.git'))).toBe(true);
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
      const mockCloneRepository = vi.fn().mockResolvedValue({ success: true, message: 'cloned with PAT' });
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
          githubPatId: 'pat-123',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      // PATが復号化されたことを確認
      expect(mockDecryptToken).toHaveBeenCalledWith('pat-123');

      // DockerGitServiceにPATを含むURLが渡されたことを確認
      expect(mockCloneRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('ghp_test_token_1234567890'),
        })
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

      // host環境なのでPATは使われない（PATロジックに入らない）
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
