import { describe, it, expect } from 'vitest';
import { ClaudeOptionsService } from '../claude-options-service';
import type { ClaudeCodeOptions, CustomEnvVars } from '../claude-options-service';

describe('ClaudeOptionsService', () => {
  describe('mergeOptions', () => {
    it('should return project options when session options is null', () => {
      const project: ClaudeCodeOptions = { model: 'claude-sonnet-4-5-20250929', permissionMode: 'plan' };
      expect(ClaudeOptionsService.mergeOptions(project, null)).toEqual({
        model: 'claude-sonnet-4-5-20250929',
        permissionMode: 'plan',
      });
    });

    it('should override project options with session options', () => {
      const project: ClaudeCodeOptions = { model: 'claude-sonnet-4-5-20250929', permissionMode: 'plan' };
      const session: ClaudeCodeOptions = { model: 'claude-opus-4-6' };
      expect(ClaudeOptionsService.mergeOptions(project, session)).toEqual({
        model: 'claude-opus-4-6',
        permissionMode: 'plan',
      });
    });

    it('should clear a field when session sets empty string', () => {
      const project: ClaudeCodeOptions = { model: 'claude-sonnet-4-5-20250929', permissionMode: 'plan' };
      const session: ClaudeCodeOptions = { model: '' };
      expect(ClaudeOptionsService.mergeOptions(project, session)).toEqual({
        permissionMode: 'plan',
      });
    });

    it('should return empty object when both are empty', () => {
      expect(ClaudeOptionsService.mergeOptions({}, null)).toEqual({});
    });
  });

  describe('mergeEnvVars', () => {
    it('should return project env vars when session is null', () => {
      const project: CustomEnvVars = { FOO: 'bar', BAZ: 'qux' };
      expect(ClaudeOptionsService.mergeEnvVars(project, null)).toEqual({ FOO: 'bar', BAZ: 'qux' });
    });

    it('should merge session env vars over project', () => {
      const project: CustomEnvVars = { FOO: 'bar', BAZ: 'qux' };
      const session: CustomEnvVars = { FOO: 'override', NEW: 'value' };
      expect(ClaudeOptionsService.mergeEnvVars(project, session)).toEqual({
        FOO: 'override',
        BAZ: 'qux',
        NEW: 'value',
      });
    });
  });

  describe('buildCliArgs', () => {
    it('should build args for all options', () => {
      const options: ClaudeCodeOptions = {
        model: 'claude-sonnet-4-5-20250929',
        allowedTools: 'Bash,Read',
        permissionMode: 'plan',
        additionalFlags: '--verbose --debug',
      };
      expect(ClaudeOptionsService.buildCliArgs(options)).toEqual([
        '--model', 'claude-sonnet-4-5-20250929',
        '--allowedTools', 'Bash,Read',
        '--permission-mode', 'plan',
        '--verbose', '--debug',
      ]);
    });

    it('should return empty array for empty options', () => {
      expect(ClaudeOptionsService.buildCliArgs({})).toEqual([]);
    });

    it('should strip control characters from additionalFlags', () => {
      const options: ClaudeCodeOptions = { additionalFlags: '--flag\n--other\r' };
      expect(ClaudeOptionsService.buildCliArgs(options)).toEqual(['--flag', '--other']);
    });
  });

  describe('buildEnv', () => {
    it('should merge custom vars into base env', () => {
      const base = { PATH: '/usr/bin', HOME: '/home/user' };
      const custom: CustomEnvVars = { MY_VAR: 'value' };
      expect(ClaudeOptionsService.buildEnv(base, custom)).toEqual({
        PATH: '/usr/bin',
        HOME: '/home/user',
        MY_VAR: 'value',
      });
    });

    it('should allow overriding base env vars', () => {
      const base = { PATH: '/usr/bin' };
      const custom: CustomEnvVars = { PATH: '/custom/path' };
      expect(ClaudeOptionsService.buildEnv(base, custom)).toEqual({
        PATH: '/custom/path',
      });
    });

    it('should skip invalid keys', () => {
      const base = { PATH: '/usr/bin' };
      const custom: CustomEnvVars = { '123INVALID': 'bad', VALID_KEY: 'good' };
      expect(ClaudeOptionsService.buildEnv(base, custom)).toEqual({
        PATH: '/usr/bin',
        VALID_KEY: 'good',
      });
    });
  });

  describe('validateEnvVarKey', () => {
    it('should accept valid keys (uppercase only)', () => {
      expect(ClaudeOptionsService.validateEnvVarKey('MY_VAR')).toBe(true);
      expect(ClaudeOptionsService.validateEnvVarKey('_PRIVATE')).toBe(true);
      expect(ClaudeOptionsService.validateEnvVarKey('ANTHROPIC_API_KEY')).toBe(true);
      expect(ClaudeOptionsService.validateEnvVarKey('A')).toBe(true);
    });

    it('should reject invalid keys', () => {
      expect(ClaudeOptionsService.validateEnvVarKey('')).toBe(false);
      expect(ClaudeOptionsService.validateEnvVarKey('123')).toBe(false);
      expect(ClaudeOptionsService.validateEnvVarKey('my-var')).toBe(false);
      expect(ClaudeOptionsService.validateEnvVarKey('has space')).toBe(false);
      expect(ClaudeOptionsService.validateEnvVarKey('lowercase')).toBe(false);
    });
  });

  describe('parseOptions', () => {
    it('should parse valid JSON', () => {
      expect(ClaudeOptionsService.parseOptions('{"model":"test"}')).toEqual({ model: 'test' });
    });

    it('should return empty for null/undefined', () => {
      expect(ClaudeOptionsService.parseOptions(null)).toEqual({});
      expect(ClaudeOptionsService.parseOptions(undefined)).toEqual({});
    });

    it('should return empty for invalid JSON', () => {
      expect(ClaudeOptionsService.parseOptions('invalid')).toEqual({});
    });
  });

  describe('parseEnvVars', () => {
    it('should parse valid JSON', () => {
      expect(ClaudeOptionsService.parseEnvVars('{"FOO":"bar"}')).toEqual({ FOO: 'bar' });
    });

    it('should return empty for null/undefined', () => {
      expect(ClaudeOptionsService.parseEnvVars(null)).toEqual({});
      expect(ClaudeOptionsService.parseEnvVars(undefined)).toEqual({});
    });

    it('should return empty for invalid JSON', () => {
      expect(ClaudeOptionsService.parseEnvVars('invalid')).toEqual({});
    });

    it('should return empty for array', () => {
      expect(ClaudeOptionsService.parseEnvVars('["a","b"]')).toEqual({});
    });

    it('should filter out non-string values', () => {
      expect(ClaudeOptionsService.parseEnvVars('{"FOO":"bar","NUM":123}')).toEqual({ FOO: 'bar' });
    });
  });

  describe('parseOptions - edge cases', () => {
    it('should return empty for array JSON', () => {
      expect(ClaudeOptionsService.parseOptions('["a","b"]')).toEqual({});
    });

    it('should return empty for null JSON', () => {
      expect(ClaudeOptionsService.parseOptions('null')).toEqual({});
    });

    it('should return empty for primitive JSON', () => {
      expect(ClaudeOptionsService.parseOptions('"string"')).toEqual({});
      expect(ClaudeOptionsService.parseOptions('42')).toEqual({});
    });

    it('should filter out non-string values from options', () => {
      expect(ClaudeOptionsService.parseOptions('{"model":"test","additionalFlags":123}')).toEqual({
        model: 'test',
      });
    });

    it('should keep only known string fields', () => {
      expect(ClaudeOptionsService.parseOptions('{"model":"test","unknown":"ignored"}')).toEqual({
        model: 'test',
      });
    });
  });

  describe('buildEnv - type safety', () => {
    it('should skip non-string values in customVars', () => {
      const base = { PATH: '/usr/bin' };
      // force non-string values via type assertion
      const custom = { VALID: 'ok', NUM: 123 as unknown as string };
      expect(ClaudeOptionsService.buildEnv(base, custom)).toEqual({
        PATH: '/usr/bin',
        VALID: 'ok',
      });
    });
  });

  describe('validateEnvVarKey - uppercase only', () => {
    it('should reject lowercase keys', () => {
      expect(ClaudeOptionsService.validateEnvVarKey('lowercase')).toBe(false);
      expect(ClaudeOptionsService.validateEnvVarKey('mixedCase')).toBe(false);
    });

    it('should accept uppercase keys', () => {
      expect(ClaudeOptionsService.validateEnvVarKey('UPPER_CASE')).toBe(true);
      expect(ClaudeOptionsService.validateEnvVarKey('_LEADING')).toBe(true);
    });
  });
});
