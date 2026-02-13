import { describe, it, expect } from 'vitest';
import {
  validateProjectName,
  validateRepositoryUrl,
  validateCloneLocation,
  validateTimeoutMinutes,
} from '../validation';

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
});
