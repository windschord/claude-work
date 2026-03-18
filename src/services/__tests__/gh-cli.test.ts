import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock
const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}));

vi.mock('child_process', () => {
  const mockExports = {
    execFileSync: mockExecFileSync,
  };
  return {
    ...mockExports,
    default: mockExports,
  };
});

import { isGhAvailable, createPR, getPRStatus, extractPRNumber } from '../gh-cli';

describe('gh-cli service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isGhAvailable', () => {
    it('should return true when gh is available', () => {
      mockExecFileSync.mockReturnValue('gh version 2.40.0');
      expect(isGhAvailable()).toBe(true);
      expect(mockExecFileSync).toHaveBeenCalledWith('gh', ['--version'], { stdio: 'pipe' });
    });

    it('should return false when gh is not available', () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('command not found');
      });
      expect(isGhAvailable()).toBe(false);
    });
  });

  describe('createPR', () => {
    it('should create PR with title and branch', () => {
      mockExecFileSync.mockReturnValue('https://github.com/owner/repo/pull/123\n');

      const result = createPR({
        title: 'Test PR',
        branchName: 'feature-branch',
        cwd: '/path/to/repo',
      });

      expect(result).toBe('https://github.com/owner/repo/pull/123');
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'gh',
        ['pr', 'create', '--title', 'Test PR', '--head', 'feature-branch'],
        expect.objectContaining({
          cwd: '/path/to/repo',
          encoding: 'utf-8',
        })
      );
    });

    it('should include body when provided', () => {
      mockExecFileSync.mockReturnValue('https://github.com/owner/repo/pull/456\n');

      createPR({
        title: 'Test PR',
        body: 'PR description',
        branchName: 'feature-branch',
        cwd: '/path/to/repo',
      });

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'gh',
        ['pr', 'create', '--title', 'Test PR', '--head', 'feature-branch', '--body', 'PR description'],
        expect.objectContaining({
          cwd: '/path/to/repo',
          encoding: 'utf-8',
        })
      );
    });

    it('should not include body when not provided', () => {
      mockExecFileSync.mockReturnValue('https://github.com/owner/repo/pull/456\n');

      createPR({
        title: 'Test PR',
        branchName: 'feature-branch',
        cwd: '/path/to/repo',
      });

      const args = mockExecFileSync.mock.calls[0][1];
      expect(args).not.toContain('--body');
    });

    it('should throw GH_NOT_INSTALLED error when gh is not installed', () => {
      const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      mockExecFileSync.mockImplementation(() => { throw enoentError; });

      expect(() => createPR({
        title: 'Test',
        branchName: 'branch',
        cwd: '/repo',
      })).toThrow('GitHub CLI (gh) is not installed');

      try {
        createPR({ title: 'Test', branchName: 'branch', cwd: '/repo' });
      } catch (e) {
        expect((e as NodeJS.ErrnoException).code).toBe('GH_NOT_INSTALLED');
      }
    });

    it('should rethrow other errors', () => {
      const genericError = new Error('Authentication failed');
      mockExecFileSync.mockImplementation(() => { throw genericError; });

      expect(() => createPR({
        title: 'Test',
        branchName: 'branch',
        cwd: '/repo',
      })).toThrow('Authentication failed');
    });

    it('should trim the result', () => {
      mockExecFileSync.mockReturnValue('  https://github.com/owner/repo/pull/789  \n');

      const result = createPR({
        title: 'Test',
        branchName: 'branch',
        cwd: '/repo',
      });

      expect(result).toBe('https://github.com/owner/repo/pull/789');
    });
  });

  describe('getPRStatus', () => {
    it('should return PR status', () => {
      mockExecFileSync.mockReturnValue(JSON.stringify({ state: 'open', merged: false }));

      const result = getPRStatus(123, '/path/to/repo');

      expect(result).toEqual({ state: 'open', merged: false });
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'gh',
        ['pr', 'view', '123', '--json', 'state,merged'],
        expect.objectContaining({
          cwd: '/path/to/repo',
          encoding: 'utf-8',
        })
      );
    });

    it('should return merged status', () => {
      mockExecFileSync.mockReturnValue(JSON.stringify({ state: 'merged', merged: true }));

      const result = getPRStatus(456, '/repo');
      expect(result.state).toBe('merged');
      expect(result.merged).toBe(true);
    });

    it('should convert PR number to string', () => {
      mockExecFileSync.mockReturnValue(JSON.stringify({ state: 'open', merged: false }));

      getPRStatus(789, '/repo');

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'gh',
        ['pr', 'view', '789', '--json', 'state,merged'],
        expect.objectContaining({
          cwd: '/repo',
          encoding: 'utf-8',
        })
      );
    });
  });

  describe('extractPRNumber', () => {
    it('should extract PR number from GitHub PR URL', () => {
      expect(extractPRNumber('https://github.com/owner/repo/pull/123')).toBe(123);
    });

    it('should extract PR number with trailing slash', () => {
      expect(extractPRNumber('https://github.com/owner/repo/pull/456/')).toBe(456);
    });

    it('should return null for URLs without PR number', () => {
      expect(extractPRNumber('https://github.com/owner/repo')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(extractPRNumber('')).toBeNull();
    });

    it('should return null for non-URL strings', () => {
      expect(extractPRNumber('not-a-url')).toBeNull();
    });

    it('should extract large PR numbers', () => {
      expect(extractPRNumber('https://github.com/owner/repo/pull/99999')).toBe(99999);
    });
  });
});
