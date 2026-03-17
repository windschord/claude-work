import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// node-pty ネイティブモジュールの依存チェーンを防ぐためにアダプターファクトリをモック化
vi.mock('../adapter-factory', () => ({
  AdapterFactory: {
    getAdapter: vi.fn(),
  },
}));

// getReposDirをモック化してテスト用の一時ディレクトリを返すようにする
let mockReposDir = '';
vi.mock('@/lib/data-dir', () => ({
  getReposDir: () => mockReposDir,
}));

import { RemoteRepoService } from '../remote-repo-service';
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { AdapterFactory } from '../adapter-factory';

describe('RemoteRepoService', () => {
  let service: RemoteRepoService;
  let testDir: string;
  let testRepoPath: string;
  let originalAllowLocalRepoUrl: string | undefined;

  beforeAll(() => {
    // NOTE: このテストはローカルgitリポジトリを直接使用する統合的なアプローチを採用しています。
    // ネットワーク通信は不要で、ローカルファイルシステム上でのgit操作のみを検証します。
    // Docker経由の操作（environmentId指定時）はAdapterFactoryをvi.mockでモック化しています。

    // 元の値を退避
    originalAllowLocalRepoUrl = process.env.ALLOW_LOCAL_REPO_URL;
    // ローカルリポジトリURLをテストで使用するため環境変数を設定
    process.env.ALLOW_LOCAL_REPO_URL = 'true';

    // テスト用の一時ディレクトリを作成
    testDir = mkdtempSync(join(tmpdir(), 'remote-repo-test-'));
    // getReposDirのモックをtestDirに設定（isWithinBaseチェック用）
    mockReposDir = testDir;

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
    // develop ブランチを作成
    execSync('git checkout -b develop', { cwd: testRepoPath });
    execSync('echo "develop" > develop.md && git add . && git commit -m "develop commit"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git checkout main', { cwd: testRepoPath });
  });

  beforeEach(() => {
    service = new RemoteRepoService();
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
    if (originalAllowLocalRepoUrl === undefined) {
      delete process.env.ALLOW_LOCAL_REPO_URL;
    } else {
      process.env.ALLOW_LOCAL_REPO_URL = originalAllowLocalRepoUrl;
    }
  });

  describe('validateRemoteUrl', () => {
    it('should accept valid SSH URL (git@)', () => {
      const result = service.validateRemoteUrl('git@github.com:user/repo.git');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid SSH URL without .git suffix', () => {
      const result = service.validateRemoteUrl('git@github.com:user/repo');
      expect(result.valid).toBe(true);
    });

    it('should accept valid HTTPS URL', () => {
      const result = service.validateRemoteUrl('https://github.com/user/repo.git');
      expect(result.valid).toBe(true);
    });

    it('should accept valid HTTPS URL without .git suffix', () => {
      const result = service.validateRemoteUrl('https://github.com/user/repo');
      expect(result.valid).toBe(true);
    });

    it('should accept GitLab SSH URL', () => {
      const result = service.validateRemoteUrl('git@gitlab.com:group/project.git');
      expect(result.valid).toBe(true);
    });

    it('should accept self-hosted Git URL', () => {
      const result = service.validateRemoteUrl('git@git.example.com:org/repo.git');
      expect(result.valid).toBe(true);
    });

    it('should reject empty URL', () => {
      const result = service.validateRemoteUrl('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid URL format', () => {
      const result = service.validateRemoteUrl('not-a-valid-url');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject file:// URLs', () => {
      const result = service.validateRemoteUrl('file:///path/to/repo');
      expect(result.valid).toBe(false);
    });

    it('should reject HTTP (non-HTTPS) URLs', () => {
      const result = service.validateRemoteUrl('http://github.com/user/repo.git');
      expect(result.valid).toBe(false);
    });

    it('should reject local paths when ALLOW_LOCAL_REPO_URL is not set', () => {
      const originalValue = process.env.ALLOW_LOCAL_REPO_URL;
      delete process.env.ALLOW_LOCAL_REPO_URL;
      try {
        const result = service.validateRemoteUrl(testRepoPath);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('ローカルリポジトリURLは許可されていません');
      } finally {
        process.env.ALLOW_LOCAL_REPO_URL = originalValue;
      }
    });

    it('should accept local paths when ALLOW_LOCAL_REPO_URL is true', () => {
      const result = service.validateRemoteUrl(testRepoPath);
      expect(result.valid).toBe(true);
    });
  });

  describe('extractRepoName', () => {
    it('should extract repo name from SSH URL with .git suffix', () => {
      const name = service.extractRepoName('git@github.com:user/my-repo.git');
      expect(name).toBe('my-repo');
    });

    it('should extract repo name from SSH URL without .git suffix', () => {
      const name = service.extractRepoName('git@github.com:user/my-repo');
      expect(name).toBe('my-repo');
    });

    it('should extract repo name from HTTPS URL with .git suffix', () => {
      const name = service.extractRepoName('https://github.com/user/my-repo.git');
      expect(name).toBe('my-repo');
    });

    it('should extract repo name from HTTPS URL without .git suffix', () => {
      const name = service.extractRepoName('https://github.com/user/my-repo');
      expect(name).toBe('my-repo');
    });

    it('should handle nested paths (GitLab groups)', () => {
      const name = service.extractRepoName('git@gitlab.com:group/subgroup/repo.git');
      expect(name).toBe('repo');
    });

    it('should handle trailing slashes', () => {
      const name = service.extractRepoName('https://github.com/user/my-repo/');
      expect(name).toBe('my-repo');
    });
  });

  describe('clone', () => {
    it('should clone a local repository to target directory', async () => {
      const targetDir = join(testDir, 'cloned-repo');

      const result = await service.clone({
        url: testRepoPath,
        targetDir,
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe(targetDir);
      expect(existsSync(join(targetDir, '.git'))).toBe(true);
      expect(existsSync(join(targetDir, 'README.md'))).toBe(true);
    });

    it('should use auto-generated directory name when targetDir not specified', async () => {
      const baseDir = join(testDir, 'repos');
      mkdirSync(baseDir, { recursive: true });

      const result = await service.clone({
        url: testRepoPath,
        baseDir,
      });

      expect(result.success).toBe(true);
      expect(result.path).toContain('source-repo');
      expect(existsSync(result.path)).toBe(true);
    });

    it('should return error for invalid URL', async () => {
      const result = await service.clone({
        url: 'invalid-url',
        targetDir: join(testDir, 'should-not-exist'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error when clone fails (non-existent repo)', async () => {
      // ネットワーク接続不要で即座に失敗するURL（localhostへの接続拒否）を使用
      // git@github.com:... のSSH URLはローカルでSSHタイムアウトが発生するため使用しない
      const result = await service.clone({
        url: 'https://127.0.0.1/nonexistent/repo.git',
        targetDir: join(testDir, 'should-not-exist-2'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject relative targetDir', async () => {
      const result = await service.clone({
        url: 'git@github.com:user/repo.git',
        targetDir: 'relative/path',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('絶対パス');
    });

    it('should handle directory name conflicts with suffix', async () => {
      const baseDir = join(testDir, 'repos-conflict');
      mkdirSync(baseDir, { recursive: true });

      // 最初のclone
      const result1 = await service.clone({
        url: testRepoPath,
        baseDir,
      });
      expect(result1.success).toBe(true);

      // 同じリポジトリを再度clone（サフィックスが付くはず）
      const result2 = await service.clone({
        url: testRepoPath,
        baseDir,
      });
      expect(result2.success).toBe(true);
      expect(result2.path).not.toBe(result1.path);
      expect(result2.path).toContain('source-repo-');
    });
  });

  describe('pull', () => {
    it('should pull changes from remote', async () => {
      // cloneしたリポジトリを用意
      const clonedPath = join(testDir, 'pull-test');
      await service.clone({ url: testRepoPath, targetDir: clonedPath });

      // リモート（source-repo）に変更を加える
      execSync('echo "new content" > new-file.md && git add . && git commit -m "new commit"', {
        cwd: testRepoPath,
        shell: true,
      });

      // pullを実行
      const result = await service.pull(clonedPath);

      expect(result.success).toBe(true);
      expect(existsSync(join(clonedPath, 'new-file.md'))).toBe(true);
    });

    it('should return success with updated=false when already up to date', async () => {
      const clonedPath = join(testDir, 'pull-test-uptodate');
      await service.clone({ url: testRepoPath, targetDir: clonedPath });

      const result = await service.pull(clonedPath);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
    });

    it('should fail for non-git directory', async () => {
      const nonGitDir = join(testDir, 'non-git');
      mkdirSync(nonGitDir, { recursive: true });

      const result = await service.pull(nonGitDir);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getBranches', () => {
    it('should return local branches', async () => {
      const clonedPath = join(testDir, 'branches-test');
      await service.clone({ url: testRepoPath, targetDir: clonedPath });

      const branches = await service.getBranches(clonedPath);

      expect(branches.length).toBeGreaterThan(0);

      const mainBranch = branches.find((b) => b.name === 'main');
      expect(mainBranch).toBeDefined();
      expect(mainBranch?.isDefault).toBe(true);
    });

    it('should include remote branches', async () => {
      const clonedPath = join(testDir, 'branches-test-remote');
      await service.clone({ url: testRepoPath, targetDir: clonedPath });

      // fetch all remote branches
      execSync('git fetch --all', { cwd: clonedPath });

      const branches = await service.getBranches(clonedPath);

      const remoteBranches = branches.filter((b) => b.isRemote);
      expect(remoteBranches.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-git directory', async () => {
      const nonGitDir = join(testDir, 'non-git-branches');
      mkdirSync(nonGitDir, { recursive: true });

      const branches = await service.getBranches(nonGitDir);

      expect(branches).toEqual([]);
    });
  });

  describe('getDefaultBranch', () => {
    it('should return default branch name', async () => {
      const clonedPath = join(testDir, 'default-branch-test');
      await service.clone({ url: testRepoPath, targetDir: clonedPath });

      const defaultBranch = await service.getDefaultBranch(clonedPath);

      expect(defaultBranch).toBe('main');
    });

    it('should return "main" as fallback for local repos without remote', async () => {
      // リモートなしのローカルリポジトリ
      const localOnly = join(testDir, 'local-only');
      mkdirSync(localOnly);
      execSync('git init', { cwd: localOnly });
      execSync('git config user.name "Test"', { cwd: localOnly });
      execSync('git config user.email "test@example.com"', { cwd: localOnly });
      execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
        cwd: localOnly,
        shell: true,
      });
      execSync('git branch -M main', { cwd: localOnly });

      const defaultBranch = await service.getDefaultBranch(localOnly);

      expect(defaultBranch).toBe('main');
    });
  });

  describe('validateRemoteUrl edge cases', () => {
    it('should reject whitespace-only URL', () => {
      const result = service.validateRemoteUrl('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('URLが空です');
    });

    it('should reject file:// URL with specific error message', () => {
      const result = service.validateRemoteUrl('file:///tmp/repo');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('file:// URLはサポートされていません');
    });

    it('should reject http:// URL with specific error message', () => {
      const result = service.validateRemoteUrl('http://github.com/user/repo');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('HTTP URLはサポートされていません。HTTPSを使用してください');
    });

    it('should reject invalid SSH URL format', () => {
      const result = service.validateRemoteUrl('git@');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('無効なSSH URLフォーマットです');
    });

    it('should reject invalid HTTPS URL format', () => {
      const result = service.validateRemoteUrl('https://');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('無効なHTTPS URLフォーマットです');
    });

    it('should return generic error for unrecognized URL', () => {
      const result = service.validateRemoteUrl('ftp://server/repo');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('有効なGitリポジトリURLを入力してください');
    });

    it('should reject local path with path traversal', () => {
      const result = service.validateRemoteUrl('/tmp/../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('パスにパストラバーサルが含まれています');
    });

    it('should reject local path that is not a git repo', () => {
      const result = service.validateRemoteUrl('/tmp');
      expect(result.valid).toBe(false);
    });

    it('should accept HTTPS URL with port', () => {
      const result = service.validateRemoteUrl('https://git.example.com:8443/user/repo.git');
      expect(result.valid).toBe(true);
    });
  });

  describe('extractRepoName edge cases', () => {
    it('should handle URL with multiple trailing slashes', () => {
      const name = service.extractRepoName('https://github.com/user/repo///');
      expect(name).toBe('repo');
    });

    it('should handle local path', () => {
      const name = service.extractRepoName('/path/to/repo');
      expect(name).toBe('repo');
    });

    it('should handle .git suffix on local path', () => {
      const name = service.extractRepoName('/path/to/repo.git');
      expect(name).toBe('repo');
    });
  });

  describe('clone edge cases', () => {
    it('should use custom name when provided', async () => {
      const baseDir = join(testDir, 'repos-custom-name');
      mkdirSync(baseDir, { recursive: true });

      const result = await service.clone({
        url: testRepoPath,
        baseDir,
        name: 'custom-name',
      });

      expect(result.success).toBe(true);
      expect(result.path).toContain('custom-name');
    });

    it('should return error when targetDir exists', async () => {
      const existingDir = join(testDir, 'existing-dir');
      mkdirSync(existingDir, { recursive: true });

      const result = await service.clone({
        url: testRepoPath,
        targetDir: existingDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('既に存在します');
    });

    it('should reject unsafe repo name', async () => {
      const baseDir = join(testDir, 'repos-unsafe');
      mkdirSync(baseDir, { recursive: true });

      const result = await service.clone({
        url: testRepoPath,
        baseDir,
        name: '../escape',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('不正なリポジトリ名');
    });

    it('should create base dir if not exists', async () => {
      const newBaseDir = join(testDir, 'repos-auto-create', 'nested');

      const result = await service.clone({
        url: testRepoPath,
        baseDir: newBaseDir,
      });

      expect(result.success).toBe(true);
      expect(existsSync(newBaseDir)).toBe(true);
    });
  });

  describe('pull edge cases', () => {
    it('should reject relative repoPath', async () => {
      const result = await service.pull('relative/path');

      expect(result.success).toBe(false);
      expect(result.error).toContain('絶対パス');
    });
  });

  describe('getBranches edge cases', () => {
    it('should return empty array for relative path', async () => {
      const branches = await service.getBranches('relative/path');
      expect(branches).toEqual([]);
    });
  });

  describe('getDefaultBranch edge cases', () => {
    it('should return "main" for relative path', async () => {
      const branch = await service.getDefaultBranch('relative/path');
      expect(branch).toBe('main');
    });
  });

  // DockerAdapter統合テスト
  describe('DockerAdapter Integration', () => {
    let mockEnvironmentService: any;
    let mockAdapter: any;
    let mockEnvironment: any;

    beforeEach(() => {
      // 前のテストのスパイをクリア
      vi.clearAllMocks();
      vi.restoreAllMocks();

      mockAdapter = {
        gitClone: vi.fn(),
        gitPull: vi.fn(),
        gitGetBranches: vi.fn(),
      };
      mockEnvironment = {
        id: 'docker-env-1',
        name: 'Docker Environment',
        type: 'DOCKER',
      };
      mockEnvironmentService = {
        findById: vi.fn().mockResolvedValue(mockEnvironment),
      };
      vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(mockAdapter);
    });

    describe('clone with environmentId', () => {
      it('should use DockerAdapter when environmentId is provided', async () => {
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        mockAdapter.gitClone.mockResolvedValue({
          success: true,
          path: '/path/to/repo',
        });

        const result = await serviceWithAdapter.clone({
          url: 'git@github.com:user/repo.git',
          targetDir: '/tmp/test-clone',
          environmentId: 'docker-env-1',
        });

        expect(result.success).toBe(true);
        expect(mockEnvironmentService.findById).toHaveBeenCalledWith('docker-env-1');
        expect(AdapterFactory.getAdapter).toHaveBeenCalledWith(mockEnvironment);
        expect(mockAdapter.gitClone).toHaveBeenCalled();
      });

      it('should use host execution when environmentId is not provided', async () => {
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.clone({
          url: testRepoPath,
          targetDir: join(testDir, 'host-clone'),
        });

        expect(result.success).toBe(true);
        expect(mockEnvironmentService.findById).not.toHaveBeenCalled();
        expect(AdapterFactory.getAdapter).not.toHaveBeenCalled();
        expect(mockAdapter.gitClone).not.toHaveBeenCalled();
      });

      it('should handle DockerAdapter clone failure', async () => {
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        mockAdapter.gitClone.mockResolvedValue({
          success: false,
          error: 'Clone failed',
        });

        const result = await serviceWithAdapter.clone({
          url: 'git@github.com:user/repo.git',
          targetDir: '/tmp/test-clone-fail',
          environmentId: 'docker-env-1',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Clone failed');
      });
    });

    describe('pull with environmentId', () => {
      it('should use DockerAdapter when environmentId is provided', async () => {
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        mockAdapter.gitPull.mockResolvedValue({
          success: true,
          updated: true,
          message: 'Updated',
        });

        const result = await serviceWithAdapter.pull('/path/to/repo', 'docker-env-1');

        expect(result.success).toBe(true);
        expect(result.updated).toBe(true);
        expect(mockEnvironmentService.findById).toHaveBeenCalledWith('docker-env-1');
        expect(AdapterFactory.getAdapter).toHaveBeenCalledWith(mockEnvironment);
        expect(mockAdapter.gitPull).toHaveBeenCalledWith('/path/to/repo');
      });

      it('should use host execution when environmentId is not provided', async () => {
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);
        const clonedPath = join(testDir, 'pull-test-adapter');
        await serviceWithAdapter.clone({ url: testRepoPath, targetDir: clonedPath });

        const result = await serviceWithAdapter.pull(clonedPath);

        expect(result.success).toBe(true);
        expect(mockEnvironmentService.findById).not.toHaveBeenCalled();
        expect(AdapterFactory.getAdapter).not.toHaveBeenCalled();
        expect(mockAdapter.gitPull).not.toHaveBeenCalled();
      });
    });

    describe('getBranches with environmentId', () => {
      it('should use DockerAdapter when environmentId is provided', async () => {
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const mockBranches = [
          { name: 'main', isDefault: true, isRemote: false },
          { name: 'develop', isDefault: false, isRemote: false },
        ];
        mockAdapter.gitGetBranches.mockResolvedValue(mockBranches);

        const result = await serviceWithAdapter.getBranches('/path/to/repo', 'docker-env-1');

        expect(result).toHaveLength(2);
        expect(result[0].name).toBe('main');
        expect(mockEnvironmentService.findById).toHaveBeenCalledWith('docker-env-1');
        expect(AdapterFactory.getAdapter).toHaveBeenCalledWith(mockEnvironment);
        expect(mockAdapter.gitGetBranches).toHaveBeenCalledWith('/path/to/repo');
      });

      it('should use host execution when environmentId is not provided', async () => {
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);
        const clonedPath = join(testDir, 'branches-test-adapter');
        await serviceWithAdapter.clone({ url: testRepoPath, targetDir: clonedPath });

        const result = await serviceWithAdapter.getBranches(clonedPath);

        expect(result.length).toBeGreaterThan(0);
        expect(mockEnvironmentService.findById).not.toHaveBeenCalled();
        expect(AdapterFactory.getAdapter).not.toHaveBeenCalled();
        expect(mockAdapter.gitGetBranches).not.toHaveBeenCalled();
      });
    });

    describe('clone with environmentId error cases', () => {
      it('should return error when environment not found', async () => {
        mockEnvironmentService.findById.mockResolvedValue(null);
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.clone({
          url: 'git@github.com:user/repo.git',
          targetDir: '/tmp/test',
          environmentId: 'nonexistent',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('nonexistent');
        expect(result.error).toContain('見つかりません');
      });

      it('should return error when adapter has no gitClone', async () => {
        const adapterWithoutGit = { };
        vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(adapterWithoutGit as any);
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.clone({
          url: 'git@github.com:user/repo.git',
          targetDir: '/tmp/test',
          environmentId: 'docker-env-1',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Docker環境でのみサポート');
      });

      it('should return error for relative targetDir in Docker mode', async () => {
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);
        mockAdapter.gitClone.mockResolvedValue({ success: true, path: '/tmp/test' });

        const result = await serviceWithAdapter.clone({
          url: 'git@github.com:user/repo.git',
          targetDir: 'relative/path',
          environmentId: 'docker-env-1',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('絶対パス');
      });

      it('should handle adapter exception', async () => {
        mockEnvironmentService.findById.mockRejectedValue(new Error('DB error'));
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.clone({
          url: 'git@github.com:user/repo.git',
          targetDir: '/tmp/test',
          environmentId: 'docker-env-1',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('DB error');
      });

      it('should handle non-Error exception', async () => {
        mockEnvironmentService.findById.mockRejectedValue('string error');
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.clone({
          url: 'git@github.com:user/repo.git',
          targetDir: '/tmp/test',
          environmentId: 'docker-env-1',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown error');
      });

      it('should use auto-generated name in Docker mode when targetDir not specified', async () => {
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);
        mockAdapter.gitClone.mockResolvedValue({ success: true, path: '/repos/repo' });

        const result = await serviceWithAdapter.clone({
          url: 'git@github.com:user/my-repo.git',
          environmentId: 'docker-env-1',
        });

        expect(result.success).toBe(true);
        expect(mockAdapter.gitClone).toHaveBeenCalled();
      });

      it('should reject existing directory in Docker mode with targetDir', async () => {
        const existingDir = join(testDir, 'docker-existing-dir');
        mkdirSync(existingDir, { recursive: true });

        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.clone({
          url: 'git@github.com:user/repo.git',
          targetDir: existingDir,
          environmentId: 'docker-env-1',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('既に存在します');
      });
    });

    describe('pull with environmentId error cases', () => {
      it('should return error when environment not found', async () => {
        mockEnvironmentService.findById.mockResolvedValue(null);
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.pull('/path/to/repo', 'nonexistent');

        expect(result.success).toBe(false);
        expect(result.error).toContain('nonexistent');
      });

      it('should return error when adapter has no gitPull', async () => {
        const adapterWithoutGit = {};
        vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(adapterWithoutGit as any);
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.pull('/path/to/repo', 'docker-env-1');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Docker環境でのみサポート');
      });

      it('should handle adapter exception in pull', async () => {
        mockEnvironmentService.findById.mockRejectedValue(new Error('pull error'));
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.pull('/path/to/repo', 'docker-env-1');

        expect(result.success).toBe(false);
        expect(result.error).toBe('pull error');
      });

      it('should handle non-Error exception in pull', async () => {
        mockEnvironmentService.findById.mockRejectedValue(42);
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.pull('/path/to/repo', 'docker-env-1');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown error');
      });
    });

    describe('getBranches with environmentId error cases', () => {
      it('should return empty array when environment not found', async () => {
        mockEnvironmentService.findById.mockResolvedValue(null);
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.getBranches('/path/to/repo', 'nonexistent');

        expect(result).toEqual([]);
      });

      it('should return empty array when adapter has no gitGetBranches', async () => {
        const adapterWithoutGit = {};
        vi.spyOn(AdapterFactory, 'getAdapter').mockReturnValue(adapterWithoutGit as any);
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.getBranches('/path/to/repo', 'docker-env-1');

        expect(result).toEqual([]);
      });

      it('should return empty array on adapter exception', async () => {
        mockEnvironmentService.findById.mockRejectedValue(new Error('error'));
        const serviceWithAdapter = new RemoteRepoService(mockEnvironmentService);

        const result = await serviceWithAdapter.getBranches('/path/to/repo', 'docker-env-1');

        expect(result).toEqual([]);
      });
    });
  });

  describe('singleton', () => {
    it('remoteRepoServiceがエクスポートされている', async () => {
      const mod = await import('../remote-repo-service');
      expect(mod.remoteRepoService).toBeInstanceOf(RemoteRepoService);
    });
  });
});
