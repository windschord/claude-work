/**
 * FilesystemService のテスト
 * タスク1.1: ディレクトリ一覧取得、Gitリポジトリ判定、パス検証
 * タスク1.2: ブランチ取得機能
 */

import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import * as path from 'path';

// fs/promisesをモック
const mockStat = vi.fn();
const mockReaddir = vi.fn();
const mockAccess = vi.fn();

vi.mock('fs/promises', () => ({
  stat: (...args: unknown[]) => mockStat(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  access: (...args: unknown[]) => mockAccess(...args),
}));

// モック設定後にインポート
import { FilesystemService, AccessDeniedError, NotFoundError, ExecFunction } from '../filesystem-service';

describe('FilesystemService', () => {
  let service: FilesystemService;
  const mockHomedir = '/home/testuser';

  beforeEach(() => {
    // 依存性注入でhomedirを設定
    service = new FilesystemService({ homedir: mockHomedir });
    vi.clearAllMocks();
  });

  describe('isPathAllowed', () => {
    it('should return true for paths inside home directory', () => {
      expect(service.isPathAllowed('/home/testuser/projects')).toBe(true);
      expect(service.isPathAllowed('/home/testuser')).toBe(true);
      expect(service.isPathAllowed('/home/testuser/a/b/c')).toBe(true);
    });

    it('should return false for paths outside home directory', () => {
      expect(service.isPathAllowed('/etc/passwd')).toBe(false);
      expect(service.isPathAllowed('/root')).toBe(false);
      expect(service.isPathAllowed('/home/otheruser')).toBe(false);
    });

    it('should handle path traversal attempts', () => {
      expect(service.isPathAllowed('/home/testuser/../otheruser')).toBe(false);
      expect(service.isPathAllowed('/home/testuser/projects/../../..')).toBe(false);
    });
  });

  describe('listDirectory', () => {
    it('should return directory entries for valid path', async () => {
      const mockEntries = [
        { name: 'project1', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
        { name: 'file.txt', isDirectory: () => false, isFile: () => true, isSymbolicLink: () => false },
        { name: '.hidden', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
      ];

      mockReaddir.mockResolvedValue(mockEntries);
      mockStat.mockResolvedValue({ isDirectory: () => true });
      // .git check - only .hidden has .git
      mockAccess.mockImplementation(async (p: string) => {
        if (p.includes('.hidden/.git')) {
          return undefined;
        }
        throw { code: 'ENOENT' };
      });

      const result = await service.listDirectory('/home/testuser/projects');

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        name: 'project1',
        type: 'directory',
        isHidden: false,
        isGitRepository: false,
      });
      expect(result[1]).toMatchObject({
        name: 'file.txt',
        type: 'file',
        isHidden: false,
      });
      expect(result[2]).toMatchObject({
        name: '.hidden',
        type: 'directory',
        isHidden: true,
        isGitRepository: true,
      });
    });

    it('should throw AccessDeniedError for paths outside home directory', async () => {
      await expect(service.listDirectory('/etc')).rejects.toThrow(AccessDeniedError);
      await expect(service.listDirectory('/root')).rejects.toThrow(AccessDeniedError);
    });

    it('should throw NotFoundError for non-existent paths', async () => {
      mockStat.mockRejectedValue({ code: 'ENOENT' });

      await expect(service.listDirectory('/home/testuser/nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should use home directory when no path is provided', async () => {
      mockReaddir.mockResolvedValue([]);
      mockStat.mockResolvedValue({ isDirectory: () => true });

      await service.listDirectory();

      expect(mockReaddir).toHaveBeenCalledWith(mockHomedir, { withFileTypes: true });
    });

    it('should detect git repositories', async () => {
      const mockEntries = [
        { name: 'git-repo', isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false },
      ];

      mockReaddir.mockResolvedValue(mockEntries);
      mockStat.mockResolvedValue({ isDirectory: () => true });
      // .git directory exists
      mockAccess.mockResolvedValue(undefined);

      const result = await service.listDirectory('/home/testuser/projects');

      expect(result[0].isGitRepository).toBe(true);
    });
  });

  describe('isGitRepository', () => {
    it('should return true when .git directory exists', async () => {
      mockAccess.mockResolvedValue(undefined);

      const result = await service.isGitRepository('/home/testuser/my-repo');

      expect(result).toBe(true);
      expect(mockAccess).toHaveBeenCalledWith(
        path.join('/home/testuser/my-repo', '.git')
      );
    });

    it('should return false when .git directory does not exist', async () => {
      mockAccess.mockRejectedValue({ code: 'ENOENT' });

      const result = await service.isGitRepository('/home/testuser/not-a-repo');

      expect(result).toBe(false);
    });

    it('should throw AccessDeniedError for paths outside home directory', async () => {
      await expect(service.isGitRepository('/etc')).rejects.toThrow(AccessDeniedError);
    });
  });

  describe('getParentPath', () => {
    it('should return parent path', () => {
      expect(service.getParentPath('/home/testuser/projects/myapp')).toBe('/home/testuser/projects');
    });

    it('should return null for home directory', () => {
      expect(service.getParentPath('/home/testuser')).toBeNull();
    });

    it('should return null for paths that would go outside home directory', () => {
      expect(service.getParentPath('/home/testuser')).toBeNull();
    });
  });

  describe('validatePath', () => {
    it('should reject paths with null bytes', () => {
      expect(() => service.validatePath('/home/testuser/file\0.txt')).toThrow();
    });

    it('should reject paths that are too long', () => {
      const longPath = '/home/testuser/' + 'a'.repeat(5000);
      expect(() => service.validatePath(longPath)).toThrow();
    });

    it('should accept valid paths', () => {
      expect(() => service.validatePath('/home/testuser/projects')).not.toThrow();
      expect(() => service.validatePath('/home/testuser/my-project_v2.0')).not.toThrow();
    });
  });

  describe('getGitBranches', () => {
    it('should return list of branches', async () => {
      const mockExecFn = vi.fn().mockResolvedValue({
        stdout: '  main\n  feature/test\n* develop\n',
        stderr: '',
      });
      const serviceWithExec = new FilesystemService({
        homedir: mockHomedir,
        execFn: mockExecFn,
      });
      mockAccess.mockResolvedValue(undefined); // .git exists

      const result = await serviceWithExec.getGitBranches('/home/testuser/my-repo');

      expect(result).toEqual(['main', 'feature/test', 'develop']);
    });

    it('should throw error for non-git repository', async () => {
      mockAccess.mockRejectedValue({ code: 'ENOENT' }); // .git does not exist

      await expect(service.getGitBranches('/home/testuser/not-a-repo')).rejects.toThrow('Not a git repository');
    });

    it('should throw AccessDeniedError for paths outside home directory', async () => {
      await expect(service.getGitBranches('/etc')).rejects.toThrow(AccessDeniedError);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      const mockExecFn = vi.fn().mockResolvedValue({
        stdout: 'develop\n',
        stderr: '',
      });
      const serviceWithExec = new FilesystemService({
        homedir: mockHomedir,
        execFn: mockExecFn,
      });
      mockAccess.mockResolvedValue(undefined); // .git exists

      const result = await serviceWithExec.getCurrentBranch('/home/testuser/my-repo');

      expect(result).toBe('develop');
    });

    it('should throw error for non-git repository', async () => {
      mockAccess.mockRejectedValue({ code: 'ENOENT' }); // .git does not exist

      await expect(service.getCurrentBranch('/home/testuser/not-a-repo')).rejects.toThrow('Not a git repository');
    });

    it('should throw AccessDeniedError for paths outside home directory', async () => {
      await expect(service.getCurrentBranch('/etc')).rejects.toThrow(AccessDeniedError);
    });
  });
});
