import { describe, it, expect } from 'vitest';
import { sanitizePath, isWithinBase, isSafePathComponent } from '../path-safety';
import path from 'path';

describe('path-safety', () => {
  describe('sanitizePath', () => {
    it('should resolve relative paths to absolute paths', () => {
      const result = sanitizePath('some/relative/path');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should normalize paths with redundant separators', () => {
      const result = sanitizePath('/foo//bar///baz');
      expect(result).toBe('/foo/bar/baz');
    });

    it('should resolve . in paths', () => {
      const result = sanitizePath('/foo/./bar');
      expect(result).toBe('/foo/bar');
    });

    it('should resolve .. in paths', () => {
      const result = sanitizePath('/foo/bar/../baz');
      expect(result).toBe('/foo/baz');
    });

    it('should remove null bytes from paths', () => {
      const result = sanitizePath('/foo/\0bar/\0baz');
      expect(result).toBe('/foo/bar/baz');
      expect(result).not.toContain('\0');
    });

    it('should handle empty string', () => {
      const result = sanitizePath('');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should handle path with only null bytes', () => {
      const result = sanitizePath('\0\0\0');
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).not.toContain('\0');
    });
  });

  describe('isWithinBase', () => {
    it('should return true when target is the same as base', () => {
      expect(isWithinBase('/foo/bar', '/foo/bar')).toBe(true);
    });

    it('should return true when target is a subdirectory of base', () => {
      expect(isWithinBase('/foo/bar/baz', '/foo/bar')).toBe(true);
    });

    it('should return true for deeply nested subdirectories', () => {
      expect(isWithinBase('/foo/bar/baz/qux/quux', '/foo/bar')).toBe(true);
    });

    it('should return false when target is outside base (parent)', () => {
      expect(isWithinBase('/foo', '/foo/bar')).toBe(false);
    });

    it('should return false when target is a sibling of base', () => {
      expect(isWithinBase('/foo/baz', '/foo/bar')).toBe(false);
    });

    it('should return false for path traversal attempts', () => {
      expect(isWithinBase('/foo/bar/../../etc/passwd', '/foo/bar')).toBe(false);
    });

    it('should return false when target uses .. to escape base', () => {
      expect(isWithinBase('/foo/bar/../baz', '/foo/bar')).toBe(false);
    });

    it('should handle paths with null bytes', () => {
      expect(isWithinBase('/foo/bar/\0baz', '/foo/bar')).toBe(true);
    });

    it('should handle unnormalized paths', () => {
      expect(isWithinBase('/foo/bar/./baz', '/foo/bar')).toBe(true);
    });

    it('should return false for completely unrelated paths', () => {
      expect(isWithinBase('/tmp/something', '/foo/bar')).toBe(false);
    });

    it('should return false when relative path starts with ..', () => {
      expect(isWithinBase('/foo', '/foo/bar')).toBe(false);
    });

    it('should handle base with trailing content that is prefix of target', () => {
      // /foo/bar-extra should NOT be within /foo/bar
      expect(isWithinBase('/foo/bar-extra', '/foo/bar')).toBe(false);
    });
  });

  describe('isSafePathComponent', () => {
    it('should return true for safe names', () => {
      expect(isSafePathComponent('my-project')).toBe(true);
    });

    it('should return true for names with dots', () => {
      expect(isSafePathComponent('file.txt')).toBe(true);
    });

    it('should return true for names with spaces', () => {
      expect(isSafePathComponent('my project')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isSafePathComponent('')).toBe(false);
    });

    it('should return false for null byte containing names', () => {
      expect(isSafePathComponent('foo\0bar')).toBe(false);
    });

    it('should return false for names with forward slash', () => {
      expect(isSafePathComponent('foo/bar')).toBe(false);
    });

    it('should return false for names with backslash', () => {
      expect(isSafePathComponent('foo\\bar')).toBe(false);
    });

    it('should return false for double dot (parent directory)', () => {
      expect(isSafePathComponent('..')).toBe(false);
    });

    it('should return false for single dot (current directory)', () => {
      expect(isSafePathComponent('.')).toBe(false);
    });

    it('should return true for names starting with dot (hidden files)', () => {
      expect(isSafePathComponent('.gitignore')).toBe(true);
    });

    it('should return true for names containing .. within text', () => {
      expect(isSafePathComponent('foo..bar')).toBe(true);
    });

    it('should return false for names with only a null byte', () => {
      expect(isSafePathComponent('\0')).toBe(false);
    });
  });
});
