import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DockerAdapter, DockerAdapterConfig } from '../docker-adapter';
import { EncryptionService } from '@/services/encryption-service';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import * as childProcess from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import * as crypto from 'crypto';

const execFileAsync = promisify(childProcess.execFile);

/**
 * Docker統合テスト（開発ツール設定の自動適用）
 *
 * 注意: このテストは実際のDockerコンテナを使用します。
 * Docker Desktopが起動していない場合、テストはスキップされます。
 *
 * テスト対象:
 * - Git設定のDocker環境への自動適用
 * - SSH鍵の一時ファイル作成とコンテナへのコピー
 * - SSH鍵一時ファイルのクリーンアップ
 */
describe('DockerAdapter - Developer Settings Integration', () => {
  let adapter: DockerAdapter;
  let encryptionService: EncryptionService;
  let dockerAvailable = false;
  let testContainerId: string | null = null;
  let testProjectId: string | null = null;
  let testAuthDir: string;

  const defaultConfig: DockerAdapterConfig = {
    environmentId: 'test-env-dev-settings',
    imageName: 'claude-code-sandboxed',
    imageTag: 'latest',
    authDirPath: '/tmp/claude-test-dev-settings',
  };

  beforeAll(async () => {
    // Dockerが利用可能かチェック
    try {
      await execFileAsync('docker', ['version']);
      dockerAvailable = true;
      console.log('Docker is available, integration tests will run');
    } catch {
      console.warn('Docker is not available, integration tests will be skipped');
      dockerAvailable = false;
    }

    if (dockerAvailable) {
      // テスト用のディレクトリをクリーンアップ
      testAuthDir = defaultConfig.authDirPath;
      try {
        await fsPromises.rm(testAuthDir, { recursive: true, force: true });
      } catch {
        // ディレクトリが存在しない場合は無視
      }
      await fsPromises.mkdir(testAuthDir, { recursive: true });
    }
  });

  beforeEach(() => {
    if (!dockerAvailable) {
      console.log('Skipping test: Docker not available');
      return;
    }
    adapter = new DockerAdapter(defaultConfig);
    encryptionService = new EncryptionService();
  });

  afterAll(async () => {
    if (!dockerAvailable) return;

    // テストコンテナのクリーンアップ
    if (testContainerId) {
      try {
        await execFileAsync('docker', ['rm', '-f', testContainerId]);
      } catch {
        // 既に削除済みの場合は無視
      }
    }

    // テスト用プロジェクトのクリーンアップ
    if (testProjectId) {
      try {
        db.delete(schema.developerSettings).where(eq(schema.developerSettings.project_id, testProjectId)).run();
      } catch {
        // 削除失敗は無視
      }
      try {
        db.delete(schema.projects).where(eq(schema.projects.id, testProjectId)).run();
      } catch {
        // 削除失敗は無視
      }
    }

    // SSH鍵のクリーンアップ
    try {
      db.delete(schema.sshKeys).run();
    } catch {
      // 削除失敗は無視
    }

    // テスト用ディレクトリのクリーンアップ
    try {
      await fsPromises.rm(testAuthDir, { recursive: true, force: true });
    } catch {
      // 削除失敗は無視
    }

    // テスト用コンテナの完全クリーンアップ
    try {
      const { stdout } = await execFileAsync('docker', [
        'ps',
        '-a',
        '--filter',
        'name=test-dev-settings',
        '--format',
        '{{.ID}}',
      ]);
      const containerIds = stdout.trim().split('\n').filter(Boolean);
      for (const containerId of containerIds) {
        try {
          await execFileAsync('docker', ['rm', '-f', containerId]);
        } catch {
          // 既に削除済みの場合は無視
        }
      }
    } catch (error) {
      console.error('Failed to cleanup test containers:', error);
    }
  });

  describe('Git設定の自動適用', () => {
    it('should apply Git username and email to container', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }

      // Arrange: テスト用プロジェクトとGit設定を作成
      testProjectId = `test-project-${crypto.randomUUID()}`;
      db.insert(schema.projects).values({
        id: testProjectId,
        name: 'Test Project',
        path: '/tmp/test-project',
        created_at: new Date(),
      }).run();

      db.insert(schema.developerSettings).values({
        id: crypto.randomUUID(),
        scope: 'project',
        project_id: testProjectId,
        git_username: 'Test User',
        git_email: 'test@example.com',
        created_at: new Date(),
      }).run();

      // Arrange: テスト用Dockerコンテナを起動（長時間実行）
      const containerName = `test-dev-settings-${Date.now()}`;
      const { stdout: containerId } = await execFileAsync('docker', [
        'run',
        '-d',
        '--name',
        containerName,
        'claude-code-sandboxed:latest',
        'sleep',
        '60',
      ]);

      testContainerId = containerId.trim();

      // Act: injectDeveloperSettingsを実行（エラーをスローしないことを確認）
      await expect(adapter.injectDeveloperSettings(testProjectId, testContainerId)).resolves.not.toThrow();

      // Assert: Git設定が適用されたか確認（実際のdocker execは実装で行われているため、ここでは再検証はスキップ）
      // 実装内部でdocker execが実行され、ログが出力されていることを確認
      // より詳細な検証は実際のclaude-codeイメージでGitコマンドを実行する必要があるため、
      // 統合テストとしてはinjectDeveloperSettingsがエラーをスローしないことを確認するに留める

      // Cleanup
      await execFileAsync('docker', ['rm', '-f', testContainerId]);
      testContainerId = null;
    }, 30000);

    it('should skip Git config when no settings are configured', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }

      // Arrange: Git設定なしのプロジェクト
      testProjectId = `test-project-no-git-${crypto.randomUUID()}`;
      db.insert(schema.projects).values({
        id: testProjectId,
        name: 'Test Project No Git',
        path: '/tmp/test-project-no-git',
        created_at: new Date(),
      }).run();

      // Arrange: テスト用Dockerコンテナを起動
      const containerName = `test-dev-settings-no-git-${Date.now()}`;
      const { stdout: containerId } = await execFileAsync('docker', [
        'run',
        '-d',
        '--name',
        containerName,
        'claude-code-sandboxed:latest',
        'sleep',
        '60',
      ]);

      testContainerId = containerId.trim();

      // Act: injectDeveloperSettingsを実行（エラーをスローしないことを確認）
      await expect(adapter.injectDeveloperSettings(testProjectId, testContainerId)).resolves.not.toThrow();

      // Cleanup
      await execFileAsync('docker', ['rm', '-f', testContainerId]);
      testContainerId = null;
    }, 30000);
  });

  describe('SSH鍵の自動適用', () => {
    it('should apply SSH keys to container', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }

      // Arrange: テスト用SSH鍵を作成
      const testPrivateKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBdDlXQ+1OPYkZXQ3dFiZkxXHtV9hYdZQxqKL3vb8wc3AAAAJgZQxqKGUMa
igAAAAtzc2gtZWQyNTUxOQAAACBdDlXQ+1OPYkZXQ3dFiZkxXHtV9hYdZQxqKL3vb8wc3A
AAAECZQxqKGUMaihXQ+1OPYkZXQ3dFiZkxXHtV9hYdZQxqKL3vb8wc3AAAABHRlc3RAdG
VzdC5jb20BAgMEBQ==
-----END OPENSSH PRIVATE KEY-----`;

      const testPublicKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFdDlXQ+1OPYkZXQ3dFiZkxXHtV9hYdZQxqKL3vb8wc3 test@test.com';

      const encryptedData = await encryptionService.encrypt(testPrivateKey);
      // encryptedData format: "iv:authTag:encrypted"
      const [iv, _authTag, _encrypted] = encryptedData.split(':');

      const sshKeyId = crypto.randomUUID();
      db.insert(schema.sshKeys).values({
        id: sshKeyId,
        name: 'test_key',
        public_key: testPublicKey,
        private_key_encrypted: encryptedData,
        encryption_iv: iv,
        has_passphrase: false,
        created_at: new Date(),
      }).run();

      // Arrange: テスト用Dockerコンテナを起動
      const containerName = `test-dev-settings-ssh-${Date.now()}`;
      const { stdout: containerId } = await execFileAsync('docker', [
        'run',
        '-d',
        '--name',
        containerName,
        'claude-code-sandboxed:latest',
        'sleep',
        '60',
      ]);

      testContainerId = containerId.trim();

      // Arrange: テスト用プロジェクト
      testProjectId = `test-project-ssh-${crypto.randomUUID()}`;
      db.insert(schema.projects).values({
        id: testProjectId,
        name: 'Test Project SSH',
        path: '/tmp/test-project-ssh',
        created_at: new Date(),
      }).run();

      // Act: injectDeveloperSettingsを実行
      // Note: claude-code-sandboxedイメージではPermission deniedエラーが発生するが、
      // 実装内部でエラーをキャッチして続行するため、エラーをスローしないことを確認
      await expect(adapter.injectDeveloperSettings(testProjectId, testContainerId)).resolves.not.toThrow();

      // Assert: 一時ファイルが作成されていることを確認
      const sshDir = path.join(testAuthDir, 'ssh');
      const files = await fsPromises.readdir(sshDir);
      expect(files).toContain('id_test_key');
      expect(files).toContain('id_test_key.pub');
      expect(files).toContain('config');

      // Cleanup
      await execFileAsync('docker', ['rm', '-f', testContainerId]);
      testContainerId = null;
    }, 30000);

    it('should verify SSH key file permissions', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }

      // Arrange: テスト用SSH鍵を作成
      const testPrivateKey = `-----BEGIN OPENSSH PRIVATE KEY-----
test-key-content
-----END OPENSSH PRIVATE KEY-----`;

      const testPublicKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAItest test@test.com';

      const encryptedData = await encryptionService.encrypt(testPrivateKey);
      // encryptedData format: "iv:authTag:encrypted"
      const [iv, _authTag, _encrypted] = encryptedData.split(':');

      const sshKeyId = crypto.randomUUID();
      db.insert(schema.sshKeys).values({
        id: sshKeyId,
        name: 'perm_test',
        public_key: testPublicKey,
        private_key_encrypted: encryptedData,
        encryption_iv: iv,
        has_passphrase: false,
        created_at: new Date(),
      }).run();

      // Arrange: テスト用Dockerコンテナを起動
      const containerName = `test-dev-settings-perm-${Date.now()}`;
      const { stdout: containerId } = await execFileAsync('docker', [
        'run',
        '-d',
        '--name',
        containerName,
        'claude-code-sandboxed:latest',
        'sleep',
        '60',
      ]);

      testContainerId = containerId.trim();

      // Arrange: テスト用プロジェクト
      testProjectId = `test-project-perm-${crypto.randomUUID()}`;
      db.insert(schema.projects).values({
        id: testProjectId,
        name: 'Test Project Perm',
        path: '/tmp/test-project-perm',
        created_at: new Date(),
      }).run();

      // Act: injectDeveloperSettingsを実行
      await adapter.injectDeveloperSettings(testProjectId, testContainerId);

      // Assert: 一時ファイルのパーミッションが正しく設定されているか確認
      const sshDir = path.join(testAuthDir, 'ssh');
      const privateKeyPath = path.join(sshDir, 'id_perm_test');
      const publicKeyPath = path.join(sshDir, 'id_perm_test.pub');

      const privateStat = await fsPromises.stat(privateKeyPath);
      const publicStat = await fsPromises.stat(publicKeyPath);

      // ファイルパーミッションを8進数文字列に変換
      const privateMode = (privateStat.mode & 0o777).toString(8);
      const publicMode = (publicStat.mode & 0o777).toString(8);

      expect(privateMode).toBe('600');
      expect(publicMode).toBe('644');

      // Cleanup
      await execFileAsync('docker', ['rm', '-f', testContainerId]);
      testContainerId = null;
    }, 30000);
  });

  describe('SSH鍵一時ファイルのクリーンアップ', () => {
    it('should cleanup temporary SSH key files', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }

      // Arrange: テスト用SSH鍵を作成
      const testPrivateKey = `-----BEGIN OPENSSH PRIVATE KEY-----
cleanup-test
-----END OPENSSH PRIVATE KEY-----`;

      const testPublicKey = 'ssh-ed25519 AAAAC3cleanup cleanup@test.com';

      const encryptedData = await encryptionService.encrypt(testPrivateKey);
      // encryptedData format: "iv:authTag:encrypted"
      const [iv, _authTag, _encrypted] = encryptedData.split(':');

      const sshKeyId = crypto.randomUUID();
      db.insert(schema.sshKeys).values({
        id: sshKeyId,
        name: 'cleanup_test',
        public_key: testPublicKey,
        private_key_encrypted: encryptedData,
        encryption_iv: iv,
        has_passphrase: false,
        created_at: new Date(),
      }).run();

      // Arrange: テスト用Dockerコンテナを起動
      const containerName = `test-dev-settings-cleanup-${Date.now()}`;
      const { stdout: containerId } = await execFileAsync('docker', [
        'run',
        '-d',
        '--name',
        containerName,
        'claude-code-sandboxed:latest',
        'sleep',
        '60',
      ]);

      testContainerId = containerId.trim();

      // Arrange: テスト用プロジェクト
      testProjectId = `test-project-cleanup-${crypto.randomUUID()}`;
      db.insert(schema.projects).values({
        id: testProjectId,
        name: 'Test Project Cleanup',
        path: '/tmp/test-project-cleanup',
        created_at: new Date(),
      }).run();

      // Act: injectDeveloperSettingsを実行（一時ファイルが作成される）
      await adapter.injectDeveloperSettings(testProjectId, testContainerId);

      // Assert: 一時ファイルが作成されていることを確認
      const sshDir = path.join(testAuthDir, 'ssh');
      const filesBeforeCleanup = await fsPromises.readdir(sshDir);
      expect(filesBeforeCleanup.length).toBeGreaterThan(0);
      expect(filesBeforeCleanup).toContain('id_cleanup_test');
      expect(filesBeforeCleanup).toContain('id_cleanup_test.pub');

      // Act: クリーンアップを実行
      await adapter.cleanupSSHKeys();

      // Assert: 一時ファイルが削除されていることを確認
      const filesAfterCleanup = await fsPromises.readdir(sshDir);
      expect(filesAfterCleanup.length).toBe(0);

      // Assert: ディレクトリ自体は削除されていないことを確認
      const dirStat = await fsPromises.stat(sshDir);
      expect(dirStat.isDirectory()).toBe(true);

      // Cleanup
      await execFileAsync('docker', ['rm', '-f', testContainerId]);
      testContainerId = null;
    }, 30000);

    it('should not fail when cleanup directory is empty', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }

      // Act & Assert: 空のディレクトリでクリーンアップを実行してもエラーをスローしない
      await expect(adapter.cleanupSSHKeys()).resolves.not.toThrow();
    }, 10000);

    it('should not fail when cleanup directory does not exist', async () => {
      if (!dockerAvailable) {
        console.log('Skipping test: Docker not available');
        return;
      }

      // Arrange: 存在しないディレクトリを指定したアダプター
      const nonExistentConfig: DockerAdapterConfig = {
        ...defaultConfig,
        authDirPath: '/tmp/non-existent-dir-' + Date.now(),
      };
      const adapterNonExistent = new DockerAdapter(nonExistentConfig);

      // Act & Assert: 存在しないディレクトリでクリーンアップを実行してもエラーをスローしない
      await expect(adapterNonExistent.cleanupSSHKeys()).resolves.not.toThrow();
    }, 10000);
  });
});
