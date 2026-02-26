import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initializeEnvironmentDetection,
  isRunningInDocker,
  isHostEnvironmentAllowed,
  _resetForTesting,
} from '../environment-detect';

// Hoisted mocks
const { mockExistsSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
}));

// fsをモック
vi.mock('fs', () => {
  const mockExports = {
    existsSync: mockExistsSync,
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

describe('Docker環境検出ユーティリティ', () => {
  beforeEach(() => {
    _resetForTesting();
    vi.stubEnv('RUNNING_IN_DOCKER', '');
    vi.stubEnv('ALLOW_HOST_ENVIRONMENT', '');
    delete process.env.RUNNING_IN_DOCKER;
    delete process.env.ALLOW_HOST_ENVIRONMENT;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isRunningInDocker', () => {
    it('/.dockerenv 存在時にDocker内と判定する', () => {
      mockExistsSync.mockReturnValue(true);

      const result = isRunningInDocker();

      expect(result).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith('/.dockerenv');
    });

    it('RUNNING_IN_DOCKER=true でDocker内と判定する', () => {
      mockExistsSync.mockReturnValue(false);
      process.env.RUNNING_IN_DOCKER = 'true';

      const result = isRunningInDocker();

      expect(result).toBe(true);
    });

    it('/.dockerenv が存在せず RUNNING_IN_DOCKER も未設定の場合、Docker外と判定する', () => {
      mockExistsSync.mockReturnValue(false);

      const result = isRunningInDocker();

      expect(result).toBe(false);
    });

    it('OR条件: dockerenvなしだがRUNNING_IN_DOCKER=trueの場合、Docker内と判定する', () => {
      mockExistsSync.mockReturnValue(false);
      process.env.RUNNING_IN_DOCKER = 'true';

      const result = isRunningInDocker();

      expect(result).toBe(true);
    });
  });

  describe('isHostEnvironmentAllowed', () => {
    it('Docker内でHOST環境がデフォルト不許可', () => {
      mockExistsSync.mockReturnValue(true);

      const result = isHostEnvironmentAllowed();

      expect(result).toBe(false);
    });

    it('Docker内で ALLOW_HOST_ENVIRONMENT=true の場合、HOST環境を許可する', () => {
      mockExistsSync.mockReturnValue(true);
      process.env.ALLOW_HOST_ENVIRONMENT = 'true';

      const result = isHostEnvironmentAllowed();

      expect(result).toBe(true);
    });

    it('非Docker環境ではHOSTが常に許可される', () => {
      mockExistsSync.mockReturnValue(false);

      const result = isHostEnvironmentAllowed();

      expect(result).toBe(true);
    });
  });

  describe('initializeEnvironmentDetection', () => {
    it('初回呼び出しでキャッシュされ、2回目以降はfsを再チェックしない', () => {
      mockExistsSync.mockReturnValue(true);

      initializeEnvironmentDetection();

      expect(mockExistsSync).toHaveBeenCalledTimes(1);

      // キャッシュ済みなので再度existsSyncは呼ばれない
      isRunningInDocker();
      isHostEnvironmentAllowed();

      expect(mockExistsSync).toHaveBeenCalledTimes(1);
    });
  });
});
