import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks
const { mockExistsSync, mockMkdirSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockMkdirSync: vi.fn(),
}));

// fsをモック
vi.mock('fs', () => {
  const mockExports = {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

import path from 'path';
import { getDataDir, getReposDir, getEnvironmentsDir, ensureDataDirs } from '../data-dir';

describe('data-dir', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getDataDir', () => {
    it('DATA_DIR設定時にそのパス(resolve済み)が返される', () => {
      process.env.DATA_DIR = '/opt/claude-work/data';

      const result = getDataDir();

      expect(result).toBe(path.resolve('/opt/claude-work/data'));
    });

    it('DATA_DIR未設定時にprocess.cwd()/dataが返される', () => {
      delete process.env.DATA_DIR;

      const result = getDataDir();

      expect(result).toBe(path.resolve(process.cwd(), 'data'));
    });

    it('DATA_DIRに相対パスを指定した場合にresolveされる', () => {
      process.env.DATA_DIR = './my-data';

      const result = getDataDir();

      expect(result).toBe(path.resolve('./my-data'));
    });
  });

  describe('getReposDir', () => {
    it('getDataDir()/repos が返される', () => {
      process.env.DATA_DIR = '/opt/claude-work/data';

      const result = getReposDir();

      expect(result).toBe(path.join(path.resolve('/opt/claude-work/data'), 'repos'));
    });
  });

  describe('getEnvironmentsDir', () => {
    it('getDataDir()/environments が返される', () => {
      process.env.DATA_DIR = '/opt/claude-work/data';

      const result = getEnvironmentsDir();

      expect(result).toBe(path.join(path.resolve('/opt/claude-work/data'), 'environments'));
    });
  });

  describe('ensureDataDirs', () => {
    it('3ディレクトリが作成される', () => {
      process.env.DATA_DIR = '/opt/claude-work/data';
      mockExistsSync.mockReturnValue(false);

      ensureDataDirs();

      expect(mockMkdirSync).toHaveBeenCalledTimes(3);
      expect(mockMkdirSync).toHaveBeenCalledWith(
        path.resolve('/opt/claude-work/data'),
        { recursive: true }
      );
      expect(mockMkdirSync).toHaveBeenCalledWith(
        path.join(path.resolve('/opt/claude-work/data'), 'repos'),
        { recursive: true }
      );
      expect(mockMkdirSync).toHaveBeenCalledWith(
        path.join(path.resolve('/opt/claude-work/data'), 'environments'),
        { recursive: true }
      );
    });

    it('既にディレクトリが存在する場合はエラーにならない', () => {
      process.env.DATA_DIR = '/opt/claude-work/data';
      mockExistsSync.mockReturnValue(true);

      expect(() => ensureDataDirs()).not.toThrow();

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });
  });
});
