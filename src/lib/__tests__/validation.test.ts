import { describe, it, expect } from 'vitest';
import {
  validateProjectName,
  validateRepositoryUrl,
  validateCloneLocation,
  validateTimeoutMinutes,
  validatePATFormat,
  validatePATName,
} from '../validation';
import type { ValidationResult } from '../validation';

describe('validation', () => {
  describe('validateProjectName', () => {
    it('有効なプロジェクト名を受け入れる', () => {
      expect(() => validateProjectName('my-project')).not.toThrow();
      expect(() => validateProjectName('project_123')).not.toThrow();
      expect(() => validateProjectName('ABC-123')).not.toThrow();
    });

    it('空のプロジェクト名を拒否する', () => {
      expect(() => validateProjectName('')).toThrow('Project name is required');
    });

    it('長すぎるプロジェクト名を拒否する', () => {
      const longName = 'a'.repeat(256);
      expect(() => validateProjectName(longName)).toThrow('must be 255 characters or less');
    });

    it('パストラバーサルを拒否する', () => {
      expect(() => validateProjectName('../etc/passwd')).toThrow('path traversal detected');
      expect(() => validateProjectName('/absolute/path')).toThrow('path traversal detected');
    });

    it('無効な文字を拒否する', () => {
      expect(() => validateProjectName('project name')).toThrow('only alphanumeric characters');
      expect(() => validateProjectName('project@name')).toThrow('only alphanumeric characters');
    });
  });

  describe('validateRepositoryUrl', () => {
    it('HTTPS URLを受け入れる', () => {
      expect(() => validateRepositoryUrl('https://github.com/user/repo.git')).not.toThrow();
    });

    it('SSH URLを受け入れる', () => {
      expect(() => validateRepositoryUrl('git@github.com:user/repo.git')).not.toThrow();
    });

    it('空のURLを拒否する', () => {
      expect(() => validateRepositoryUrl('')).toThrow('Repository URL is required');
    });

    it('ローカルパスを拒否する', () => {
      expect(() => validateRepositoryUrl('file:///path/to/repo')).toThrow('local paths are not allowed');
      expect(() => validateRepositoryUrl('/path/to/repo')).toThrow('local paths are not allowed');
    });

    it('無効な形式のURLを拒否する', () => {
      expect(() => validateRepositoryUrl('http://github.com/user/repo')).toThrow('must be HTTPS or SSH format');
      expect(() => validateRepositoryUrl('ftp://github.com/user/repo')).toThrow('must be HTTPS or SSH format');
    });
  });

  describe('validateCloneLocation', () => {
    it('未指定の場合はdockerをデフォルトとして返す', () => {
      expect(validateCloneLocation()).toBe('docker');
      expect(validateCloneLocation(undefined)).toBe('docker');
    });

    it('hostを受け入れる', () => {
      expect(validateCloneLocation('host')).toBe('host');
    });

    it('dockerを受け入れる', () => {
      expect(validateCloneLocation('docker')).toBe('docker');
    });

    it('無効な値を拒否する', () => {
      expect(() => validateCloneLocation('invalid' as any)).toThrow("must be 'host' or 'docker'");
      expect(() => validateCloneLocation('local' as any)).toThrow("must be 'host' or 'docker'");
    });
  });

  describe('validateTimeoutMinutes', () => {
    it('有効な範囲の値を受け入れる', () => {
      expect(() => validateTimeoutMinutes(1)).not.toThrow();
      expect(() => validateTimeoutMinutes(15)).not.toThrow();
      expect(() => validateTimeoutMinutes(30)).not.toThrow();
    });

    it('整数でない値を拒否する', () => {
      expect(() => validateTimeoutMinutes(5.5)).toThrow('Timeout must be an integer');
      expect(() => validateTimeoutMinutes(NaN)).toThrow('Timeout must be an integer');
    });

    it('範囲外の値を拒否する', () => {
      expect(() => validateTimeoutMinutes(0)).toThrow('Timeout must be between 1 and 30 minutes');
      expect(() => validateTimeoutMinutes(31)).toThrow('Timeout must be between 1 and 30 minutes');
      expect(() => validateTimeoutMinutes(-5)).toThrow('Timeout must be between 1 and 30 minutes');
    });
  });

  describe('validatePATFormat', () => {
    it('Classic PAT (ghp_) を有効と判定する', () => {
      const token = 'ghp_' + 'a'.repeat(36);
      const result: ValidationResult = validatePATFormat(token);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('Fine-grained PAT (github_pat_) を有効と判定する', () => {
      const token = 'github_pat_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6';
      const result: ValidationResult = validatePATFormat(token);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('空文字列を無効と判定する', () => {
      const result = validatePATFormat('');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('不正なプレフィックスを無効と判定する', () => {
      const result = validatePATFormat('gho_' + 'a'.repeat(36));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PAT must start with "ghp_" (Classic) or "github_pat_" (Fine-grained)');
    });

    it('40文字未満のトークンを無効と判定する', () => {
      const result = validatePATFormat('ghp_short');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PAT must be at least 40 characters');
    });

    it('英数字とアンダースコア以外の文字を含むトークンを無効と判定する', () => {
      const token = 'ghp_' + 'a'.repeat(30) + '!@#$%^';
      const result = validatePATFormat(token);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PAT must contain only alphanumeric characters and underscores');
    });

    it('複数のエラーを同時に返す', () => {
      const result = validatePATFormat('bad!');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validatePATName', () => {
    it('有効なPAT名を受け入れる', () => {
      const result: ValidationResult = validatePATName('My GitHub PAT');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('1文字のPAT名を受け入れる', () => {
      const result = validatePATName('a');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('50文字のPAT名を受け入れる', () => {
      const result = validatePATName('a'.repeat(50));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('空文字列を無効と判定する', () => {
      const result = validatePATName('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PAT name is required');
    });

    it('51文字以上のPAT名を無効と判定する', () => {
      const result = validatePATName('a'.repeat(51));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PAT name must be 50 characters or less');
    });

    it('空白のみのPAT名を無効と判定する', () => {
      const result = validatePATName('   ');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PAT name is required');
    });
  });
});
