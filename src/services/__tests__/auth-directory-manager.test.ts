import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

// ホイストされたモックを作成
const { mockMkdir, mockRm, mockAccess } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockRm: vi.fn(),
  mockAccess: vi.fn(),
}));

// fs/promisesモジュールをモック
vi.mock('fs/promises', async () => {
  return {
    mkdir: mockMkdir,
    rm: mockRm,
    access: mockAccess,
    default: {
      mkdir: mockMkdir,
      rm: mockRm,
      access: mockAccess,
    },
  };
});

// loggerをモック
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// テスト対象
import { AuthDirectoryManager, authDirectoryManager } from '../auth-directory-manager';

describe('AuthDirectoryManager', () => {
  let manager: AuthDirectoryManager;
  const testBaseDir = '/test/data/environments';

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new AuthDirectoryManager(testBaseDir);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('カスタムベースディレクトリを設定できる', () => {
      const customDir = '/custom/path/environments';
      const customManager = new AuthDirectoryManager(customDir);

      const envPath = customManager.getAuthDirPath('test-env');
      expect(envPath).toBe(path.join(customDir, 'test-env'));
    });

    it('ベースディレクトリ未指定時はデフォルトを使用', () => {
      const defaultManager = new AuthDirectoryManager();
      const envPath = defaultManager.getAuthDirPath('test-env');

      // デフォルトは process.cwd()/data/environments
      expect(envPath).toContain('data');
      expect(envPath).toContain('environments');
      expect(envPath).toContain('test-env');
    });
  });

  describe('getAuthDirPath', () => {
    it('環境IDから正しいパスを取得する', () => {
      const result = manager.getAuthDirPath('my-environment');

      expect(result).toBe(path.join(testBaseDir, 'my-environment'));
    });

    it('異なる環境IDで異なるパスを返す', () => {
      const path1 = manager.getAuthDirPath('env-1');
      const path2 = manager.getAuthDirPath('env-2');

      expect(path1).not.toBe(path2);
      expect(path1).toContain('env-1');
      expect(path2).toContain('env-2');
    });
  });

  describe('validateEnvironmentId', () => {
    it('パストラバーサル攻撃を防止する - ダブルドット', () => {
      expect(() => manager.getAuthDirPath('../../../etc/passwd')).toThrow();
    });

    it('パストラバーサル攻撃を防止する - スラッシュ', () => {
      expect(() => manager.getAuthDirPath('env/../../etc')).toThrow();
    });

    it('パストラバーサル攻撃を防止する - バックスラッシュ', () => {
      expect(() => manager.getAuthDirPath('env\\..\\..\\etc')).toThrow();
    });

    it('空の環境IDを拒否する', () => {
      expect(() => manager.getAuthDirPath('')).toThrow();
    });

    it('ドットのみの環境IDを拒否する', () => {
      expect(() => manager.getAuthDirPath('.')).toThrow();
      expect(() => manager.getAuthDirPath('..')).toThrow();
    });

    it('有効な環境ID（英数字、ハイフン、アンダースコア）を許可する', () => {
      expect(() => manager.getAuthDirPath('valid-env_123')).not.toThrow();
      expect(() => manager.getAuthDirPath('MyEnvironment')).not.toThrow();
      expect(() => manager.getAuthDirPath('test_env_001')).not.toThrow();
    });
  });

  describe('createAuthDirectory', () => {
    it('必要なサブディレクトリを作成する', async () => {
      mockMkdir.mockResolvedValue(undefined);

      const result = await manager.createAuthDirectory('test-env');
      const expectedEnvDir = path.join(testBaseDir, 'test-env');

      expect(result).toBe(expectedEnvDir);

      // claudeディレクトリの作成確認
      expect(mockMkdir).toHaveBeenCalledWith(
        path.join(expectedEnvDir, 'claude'),
        { recursive: true, mode: 0o700 }
      );

      // config/claudeディレクトリの作成確認
      expect(mockMkdir).toHaveBeenCalledWith(
        path.join(expectedEnvDir, 'config', 'claude'),
        { recursive: true, mode: 0o700 }
      );
    });

    it('パーミッション700でディレクトリを作成する', async () => {
      mockMkdir.mockResolvedValue(undefined);

      await manager.createAuthDirectory('secure-env');

      // 全てのmkdirコールでmode: 0o700が設定されていることを確認
      mockMkdir.mock.calls.forEach((call) => {
        expect(call[1]).toEqual({ recursive: true, mode: 0o700 });
      });
    });

    it('作成したディレクトリのパスを返す', async () => {
      mockMkdir.mockResolvedValue(undefined);

      const result = await manager.createAuthDirectory('new-env');

      expect(result).toBe(path.join(testBaseDir, 'new-env'));
    });

    it('無効な環境IDでエラーをスローする', async () => {
      await expect(manager.createAuthDirectory('../invalid')).rejects.toThrow();
    });
  });

  describe('deleteAuthDirectory', () => {
    it('ディレクトリを再帰的に削除する', async () => {
      mockRm.mockResolvedValue(undefined);

      await manager.deleteAuthDirectory('test-env');

      expect(mockRm).toHaveBeenCalledWith(
        path.join(testBaseDir, 'test-env'),
        { recursive: true, force: true }
      );
    });

    it('削除エラーをログに記録し、例外をスローしない', async () => {
      const error = new Error('Permission denied');
      mockRm.mockRejectedValue(error);

      // エラーがスローされないことを確認
      await expect(manager.deleteAuthDirectory('test-env')).resolves.not.toThrow();
    });

    it('無効な環境IDでエラーをスローする', async () => {
      await expect(manager.deleteAuthDirectory('../invalid')).rejects.toThrow();
    });
  });

  describe('exists', () => {
    it('ディレクトリが存在する場合はtrueを返す', async () => {
      mockAccess.mockResolvedValue(undefined);

      const result = await manager.exists('existing-env');

      expect(result).toBe(true);
      expect(mockAccess).toHaveBeenCalledWith(
        path.join(testBaseDir, 'existing-env')
      );
    });

    it('ディレクトリが存在しない場合はfalseを返す', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await manager.exists('non-existing-env');

      expect(result).toBe(false);
    });

    it('無効な環境IDでエラーをスローする', async () => {
      await expect(manager.exists('../invalid')).rejects.toThrow();
    });
  });

  describe('isAuthenticated', () => {
    it('認証ファイルが存在する場合はtrueを返す', async () => {
      mockAccess.mockResolvedValue(undefined);

      const result = await manager.isAuthenticated('auth-env');

      expect(result).toBe(true);
      expect(mockAccess).toHaveBeenCalledWith(
        path.join(testBaseDir, 'auth-env', 'claude', '.credentials.json')
      );
    });

    it('認証ファイルが存在しない場合はfalseを返す', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await manager.isAuthenticated('unauth-env');

      expect(result).toBe(false);
    });

    it('無効な環境IDでエラーをスローする', async () => {
      await expect(manager.isAuthenticated('../invalid')).rejects.toThrow();
    });
  });

  describe('シングルトンインスタンス', () => {
    it('authDirectoryManagerがエクスポートされている', () => {
      expect(authDirectoryManager).toBeDefined();
      expect(authDirectoryManager).toBeInstanceOf(AuthDirectoryManager);
    });
  });
});
