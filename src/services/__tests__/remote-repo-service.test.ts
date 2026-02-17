import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
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

  beforeAll(() => {
    // テスト用の一時ディレクトリを作成
    testDir = mkdtempSync(join(tmpdir(), 'remote-repo-test-'));

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
      const result = await service.clone({
        url: 'git@github.com:nonexistent/nonexistent-repo-12345.git',
        targetDir: join(testDir, 'should-not-exist-2'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
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
  });
});
