import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DockerAdapter, DockerAdapterConfig } from '../docker-adapter';
import * as path from 'path';
import * as fsPromises from 'fs/promises';

// Mock DockerClient
const { mockDockerClient } = vi.hoisted(() => ({
  mockDockerClient: {
    inspectContainer: vi.fn(),
    getContainer: vi.fn(),
    run: vi.fn(),
  }
}));

vi.mock('../../docker-client', () => ({
  DockerClient: {
    getInstance: () => mockDockerClient,
  },
}));

// Mock DeveloperSettingsService
const { mockGetEffectiveSettings } = vi.hoisted(() => ({
  mockGetEffectiveSettings: vi.fn(),
}));

vi.mock('@/services/developer-settings-service', () => ({
  DeveloperSettingsService: vi.fn().mockImplementation(function() {
    return {
      getEffectiveSettings: mockGetEffectiveSettings,
    };
  }),
}));

// Mock EncryptionService
const { mockDecrypt } = vi.hoisted(() => ({
  mockDecrypt: vi.fn(),
}));

vi.mock('@/services/encryption-service', () => ({
  EncryptionService: vi.fn().mockImplementation(function() {
    return {
      decrypt: mockDecrypt,
    };
  }),
}));

// Mock database
const { mockDbSelect, mockDbDelete } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbDelete: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mockDbSelect,
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: vi.fn()
        }))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        run: vi.fn()
      }))
    })),
    delete: mockDbDelete,
  },
  schema: {
    sessions: {},
    sshKeys: {},
    projects: {},
    developerSettings: {},
  },
}));

vi.mock('node-pty', () => ({
  spawn: vi.fn(),
}));

// Mock tar-fs to prevent real file streaming race conditions
vi.mock('tar-fs', () => ({
  default: {
    pack: vi.fn().mockReturnValue({ pipe: vi.fn(), destroy: vi.fn() }),
  },
  pack: vi.fn().mockReturnValue({ pipe: vi.fn(), destroy: vi.fn() }),
}));

/**
 * Docker統合テスト（開発ツール設定の自動適用）
 *
 * DockerClient をモックして、以下をテスト:
 * - Git設定のDocker環境への自動適用
 * - SSH鍵の一時ファイル作成とコンテナへのコピー
 * - SSH鍵一時ファイルのクリーンアップ
 */
describe('DockerAdapter - Developer Settings Integration', () => {
  let adapter: DockerAdapter;
  let testAuthDir: string;

  const defaultConfig: DockerAdapterConfig = {
    environmentId: 'test-env-dev-settings',
    imageName: 'ghcr.io/windschord/claude-work-sandbox',
    imageTag: 'latest',
    authDirPath: '/tmp/claude-test-dev-settings-' + process.pid + '/test-env-dev-settings',
  };

  // Helper to create mock container with exec support
  function createMockContainer() {
    const mockExec = {
      start: vi.fn().mockResolvedValue(undefined),
    };
    const mockContainer = {
      exec: vi.fn().mockResolvedValue(mockExec),
      stop: vi.fn().mockResolvedValue(undefined),
      putArchive: vi.fn().mockResolvedValue(undefined),
    };
    return mockContainer;
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    testAuthDir = defaultConfig.authDirPath;
    // Clean up and create test directory
    try {
      await fsPromises.rm(testAuthDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    await fsPromises.mkdir(testAuthDir, { recursive: true });

    adapter = new DockerAdapter(defaultConfig);

    // Default mock: no SSH keys in DB
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(undefined),
          all: vi.fn().mockReturnValue([]),
        }),
        all: vi.fn().mockReturnValue([]),
      }),
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();

    // Clean up test directory
    try {
      await fsPromises.rm(testAuthDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Git設定の自動適用', () => {
    it('should apply Git username and email to container', async () => {
      // Arrange: Mock DeveloperSettingsService to return Git settings
      mockGetEffectiveSettings.mockResolvedValue({
        git_username: 'Test User',
        git_email: 'test@example.com',
      });

      // Arrange: Mock DockerClient.getContainer for exec calls
      const mockContainer = createMockContainer();
      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      // Act: injectDeveloperSettings should not throw
      await expect(adapter.injectDeveloperSettings('test-project-1', 'test-container-1')).resolves.not.toThrow();

      // Assert: getContainer was called with the container ID
      expect(mockDockerClient.getContainer).toHaveBeenCalledWith('test-container-1');

      // Assert: exec was called for git config user.name and user.email
      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['git', 'config', '--global', 'user.name', 'Test User'],
          User: 'node',
        })
      );
      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['git', 'config', '--global', 'user.email', 'test@example.com'],
          User: 'node',
        })
      );
    });

    it('should skip Git config when no settings are configured', async () => {
      // Arrange: Mock DeveloperSettingsService to return empty settings
      mockGetEffectiveSettings.mockResolvedValue({});

      // Act: injectDeveloperSettings should not throw
      await expect(adapter.injectDeveloperSettings('test-project-no-git', 'test-container-2')).resolves.not.toThrow();

      // Assert: getContainer was NOT called for git config (no settings to apply)
      // Note: getContainer might still be called for SSH key operations,
      // but exec should not be called for git config commands
      const gitConfigCalls = mockDockerClient.getContainer.mock.calls;
      // If no SSH keys either, getContainer should not be called at all
      // (since we mock DB to return empty SSH keys)
      expect(gitConfigCalls.length).toBe(0);
    });
  });

  describe('SSH鍵の自動適用', () => {
    it('should apply SSH keys to container', async () => {
      // Arrange: Mock DeveloperSettingsService (no git settings)
      mockGetEffectiveSettings.mockResolvedValue({});

      // Arrange: Mock DB to return SSH keys
      const testPrivateKey = '-----BEGIN OPENSSH PRIVATE KEY-----\ntest-content\n-----END OPENSSH PRIVATE KEY-----';
      const testPublicKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAItest test@test.com';

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(undefined),
            all: vi.fn().mockReturnValue([]),
          }),
          // getAllSSHKeys calls db.select().from(schema.sshKeys).all()
          all: vi.fn().mockReturnValue([
            {
              id: 'ssh-key-1',
              name: 'test_key',
              public_key: testPublicKey,
              private_key_encrypted: 'encrypted-data',
              encryption_iv: 'test-iv',
              has_passphrase: false,
            },
          ]),
        }),
      });

      // Arrange: Mock decryption
      mockDecrypt.mockResolvedValue(testPrivateKey);

      // Arrange: Mock DockerClient.getContainer for exec + putArchive calls
      const mockContainer = createMockContainer();
      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      // Act: injectDeveloperSettings
      await expect(adapter.injectDeveloperSettings('test-project-ssh', 'test-container-3')).resolves.not.toThrow();

      // Assert: SSH key files were created in the temp directory
      const sshDir = path.join(testAuthDir, 'ssh');
      const files = await fsPromises.readdir(sshDir);
      expect(files).toContain('id_test_key');
      expect(files).toContain('id_test_key.pub');
      expect(files).toContain('config');

      // Assert: container.exec was called for mkdir, chmod, and chown
      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['mkdir', '-p', '/home/node/.ssh'],
        })
      );
      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['chmod', '700', '/home/node/.ssh'],
        })
      );
      expect(mockContainer.exec).toHaveBeenCalledWith(
        expect.objectContaining({
          Cmd: ['chown', '-R', 'node:node', '/home/node/.ssh'],
          User: 'root',
        })
      );

      // Assert: putArchive was called
      expect(mockContainer.putArchive).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          path: '/home/node/.ssh',
        })
      );
    });

    it('should verify SSH key file permissions', async () => {
      // Arrange: Mock DeveloperSettingsService (no git settings)
      mockGetEffectiveSettings.mockResolvedValue({});

      // Arrange: Mock DB to return SSH keys
      const testPrivateKey = '-----BEGIN OPENSSH PRIVATE KEY-----\ntest-key-content\n-----END OPENSSH PRIVATE KEY-----';
      const testPublicKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAItest test@test.com';

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(undefined),
            all: vi.fn().mockReturnValue([]),
          }),
          all: vi.fn().mockReturnValue([
            {
              id: 'ssh-key-2',
              name: 'perm_test',
              public_key: testPublicKey,
              private_key_encrypted: 'encrypted-data',
              encryption_iv: 'test-iv',
              has_passphrase: false,
            },
          ]),
        }),
      });

      // Arrange: Mock decryption
      mockDecrypt.mockResolvedValue(testPrivateKey);

      // Arrange: Mock DockerClient.getContainer
      const mockContainer = createMockContainer();
      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      // Act: injectDeveloperSettings
      await adapter.injectDeveloperSettings('test-project-perm', 'test-container-4');

      // Assert: File permissions are correct
      const sshDir = path.join(testAuthDir, 'ssh');
      const privateKeyPath = path.join(sshDir, 'id_perm_test');
      const publicKeyPath = path.join(sshDir, 'id_perm_test.pub');

      const privateStat = await fsPromises.stat(privateKeyPath);
      const publicStat = await fsPromises.stat(publicKeyPath);

      // Convert file permissions to octal string
      const privateMode = (privateStat.mode & 0o777).toString(8);
      const publicMode = (publicStat.mode & 0o777).toString(8);

      expect(privateMode).toBe('600');
      expect(publicMode).toBe('644');
    });
  });

  describe('SSH鍵一時ファイルのクリーンアップ', () => {
    it('should cleanup temporary SSH key files', async () => {
      // Arrange: Mock DeveloperSettingsService (no git settings)
      mockGetEffectiveSettings.mockResolvedValue({});

      // Arrange: Mock DB to return SSH keys
      const testPrivateKey = '-----BEGIN OPENSSH PRIVATE KEY-----\ncleanup-test\n-----END OPENSSH PRIVATE KEY-----';
      const testPublicKey = 'ssh-ed25519 AAAAC3cleanup cleanup@test.com';

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(undefined),
            all: vi.fn().mockReturnValue([]),
          }),
          all: vi.fn().mockReturnValue([
            {
              id: 'ssh-key-3',
              name: 'cleanup_test',
              public_key: testPublicKey,
              private_key_encrypted: 'encrypted-data',
              encryption_iv: 'test-iv',
              has_passphrase: false,
            },
          ]),
        }),
      });

      // Arrange: Mock decryption
      mockDecrypt.mockResolvedValue(testPrivateKey);

      // Arrange: Mock DockerClient.getContainer
      const mockContainer = createMockContainer();
      mockDockerClient.getContainer.mockReturnValue(mockContainer);

      // Act: injectDeveloperSettings to create temp files
      await adapter.injectDeveloperSettings('test-project-cleanup', 'test-container-5');

      // Assert: Temp files were created
      const sshDir = path.join(testAuthDir, 'ssh');
      const filesBeforeCleanup = await fsPromises.readdir(sshDir);
      expect(filesBeforeCleanup.length).toBeGreaterThan(0);
      expect(filesBeforeCleanup).toContain('id_cleanup_test');
      expect(filesBeforeCleanup).toContain('id_cleanup_test.pub');

      // Act: Cleanup
      await adapter.cleanupSSHKeys();

      // Assert: Temp files were deleted
      const filesAfterCleanup = await fsPromises.readdir(sshDir);
      expect(filesAfterCleanup.length).toBe(0);

      // Assert: Directory itself still exists
      const dirStat = await fsPromises.stat(sshDir);
      expect(dirStat.isDirectory()).toBe(true);
    });

    it('should not fail when cleanup directory is empty', async () => {
      // Act & Assert: Cleanup on empty directory should not throw
      // First create the ssh directory (cleanupSSHKeys expects it may exist)
      const sshDir = path.join(testAuthDir, 'ssh');
      await fsPromises.mkdir(sshDir, { recursive: true });

      await expect(adapter.cleanupSSHKeys()).resolves.not.toThrow();
    });

    it('should not fail when cleanup directory does not exist', async () => {
      // Arrange: Adapter with non-existent directory
      const nonExistentConfig: DockerAdapterConfig = {
        ...defaultConfig,
        authDirPath: '/tmp/non-existent-dir-' + Date.now() + '/test-env-dev-settings',
      };
      const adapterNonExistent = new DockerAdapter(nonExistentConfig);

      // Act & Assert: Cleanup on non-existent directory should not throw
      await expect(adapterNonExistent.cleanupSSHKeys()).resolves.not.toThrow();
    });
  });
});
