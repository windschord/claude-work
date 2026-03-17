import { describe, it, expect } from 'vitest';
import { GitOperationError } from '../git-operations';

describe('git-operations', () => {
  describe('GitOperationError', () => {
    it('should create error with all properties', () => {
      const cause = new Error('original error');
      const error = new GitOperationError(
        'Clone failed',
        'host',
        'clone',
        true,
        cause
      );

      expect(error.message).toBe('Clone failed');
      expect(error.environment).toBe('host');
      expect(error.operation).toBe('clone');
      expect(error.recoverable).toBe(true);
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('GitOperationError');
    });

    it('should be an instance of Error', () => {
      const error = new GitOperationError('test', 'docker', 'worktree', false);
      expect(error).toBeInstanceOf(Error);
    });

    it('should work with docker environment', () => {
      const error = new GitOperationError('Volume error', 'docker', 'volume', false);
      expect(error.environment).toBe('docker');
      expect(error.operation).toBe('volume');
      expect(error.recoverable).toBe(false);
    });

    it('should work without cause', () => {
      const error = new GitOperationError('test', 'host', 'clone', true);
      expect(error.cause).toBeUndefined();
    });

    it('should have correct name property', () => {
      const error = new GitOperationError('test', 'host', 'clone', true);
      expect(error.name).toBe('GitOperationError');
    });

    it('should support worktree operation type', () => {
      const error = new GitOperationError('Worktree failed', 'host', 'worktree', true);
      expect(error.operation).toBe('worktree');
    });
  });
});
