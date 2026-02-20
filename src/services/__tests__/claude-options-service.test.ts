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

  describe('validateClaudeCodeOptions', () => {
    it('should accept valid options', () => {
      const result = ClaudeOptionsService.validateClaudeCodeOptions({
        model: 'claude-sonnet-4-5-20250929',
        allowedTools: 'Bash,Read',
      });
      expect(result).toEqual({
        model: 'claude-sonnet-4-5-20250929',
        allowedTools: 'Bash,Read',
      });
    });

    it('should reject options with unknown keys', () => {
      const result = ClaudeOptionsService.validateClaudeCodeOptions({
        model: 'test',
        unknownKey: 'value',
      });
      expect(result).toBeNull();
    });

    it('should reject options with non-string values', () => {
      const result = ClaudeOptionsService.validateClaudeCodeOptions({
        model: 123,
      });
      expect(result).toBeNull();
    });

    it('should reject non-object values', () => {
      expect(ClaudeOptionsService.validateClaudeCodeOptions(null)).toBeNull();
      expect(ClaudeOptionsService.validateClaudeCodeOptions([])).toBeNull();
      expect(ClaudeOptionsService.validateClaudeCodeOptions('string')).toBeNull();
    });
  });

  describe('dangerouslySkipPermissions', () => {
    describe('buildCliArgs', () => {
      it('should add --dangerously-skip-permissions when true', () => {
        const options: ClaudeCodeOptions = { dangerouslySkipPermissions: true };
        expect(ClaudeOptionsService.buildCliArgs(options)).toEqual(['--dangerously-skip-permissions']);
      });

      it('should not add flag when false', () => {
        const options: ClaudeCodeOptions = { dangerouslySkipPermissions: false };
        expect(ClaudeOptionsService.buildCliArgs(options)).toEqual([]);
      });

      it('should not add flag when undefined', () => {
        const options: ClaudeCodeOptions = { model: 'test' };
        expect(ClaudeOptionsService.buildCliArgs(options)).toEqual(['--model', 'test']);
      });

      it('should combine with other options', () => {
        const options: ClaudeCodeOptions = {
          model: 'claude-sonnet-4-5-20250929',
          dangerouslySkipPermissions: true,
        };
        const args = ClaudeOptionsService.buildCliArgs(options);
        expect(args).toContain('--dangerously-skip-permissions');
        expect(args).toContain('--model');
        expect(args).toContain('claude-sonnet-4-5-20250929');
      });
    });

    describe('validateClaudeCodeOptions', () => {
      it('should accept boolean dangerouslySkipPermissions', () => {
        const result = ClaudeOptionsService.validateClaudeCodeOptions({
          dangerouslySkipPermissions: true,
        });
        expect(result).toEqual({ dangerouslySkipPermissions: true });
      });

      it('should accept false value', () => {
        const result = ClaudeOptionsService.validateClaudeCodeOptions({
          dangerouslySkipPermissions: false,
        });
        expect(result).toEqual({ dangerouslySkipPermissions: false });
      });

      it('should reject string value for dangerouslySkipPermissions', () => {
        const result = ClaudeOptionsService.validateClaudeCodeOptions({
          dangerouslySkipPermissions: 'true',
        });
        expect(result).toBeNull();
      });

      it('should accept mixed string and boolean fields', () => {
        const result = ClaudeOptionsService.validateClaudeCodeOptions({
          model: 'test',
          dangerouslySkipPermissions: true,
        });
        expect(result).toEqual({ model: 'test', dangerouslySkipPermissions: true });
      });
    });

    describe('getUnknownKeys', () => {
      it('should not report dangerouslySkipPermissions as unknown', () => {
        const unknownKeys = ClaudeOptionsService.getUnknownKeys({
          dangerouslySkipPermissions: true,
        });
        expect(unknownKeys).toEqual([]);
      });
    });

    describe('parseOptions', () => {
      it('should parse boolean dangerouslySkipPermissions from JSON', () => {
        const result = ClaudeOptionsService.parseOptions('{"dangerouslySkipPermissions":true}');
        expect(result).toEqual({ dangerouslySkipPermissions: true });
      });

      it('should parse false value from JSON', () => {
        const result = ClaudeOptionsService.parseOptions('{"dangerouslySkipPermissions":false}');
        expect(result).toEqual({ dangerouslySkipPermissions: false });
      });

      it('should ignore string value for dangerouslySkipPermissions in JSON', () => {
        const result = ClaudeOptionsService.parseOptions('{"dangerouslySkipPermissions":"true"}');
        expect(result).toEqual({});
      });

      it('should parse mixed string and boolean fields from JSON', () => {
        const result = ClaudeOptionsService.parseOptions('{"model":"test","dangerouslySkipPermissions":true}');
        expect(result).toEqual({ model: 'test', dangerouslySkipPermissions: true });
      });
    });

    describe('mergeOptions', () => {
      it('should preserve project dangerouslySkipPermissions when session is null', () => {
        const project: ClaudeCodeOptions = { dangerouslySkipPermissions: true };
        expect(ClaudeOptionsService.mergeOptions(project, null)).toEqual({
          dangerouslySkipPermissions: true,
        });
      });

      it('should override project with session dangerouslySkipPermissions', () => {
        const project: ClaudeCodeOptions = { dangerouslySkipPermissions: true };
        const session: ClaudeCodeOptions = { dangerouslySkipPermissions: false };
        expect(ClaudeOptionsService.mergeOptions(project, session)).toEqual({
          dangerouslySkipPermissions: false,
        });
      });

      it('should keep project value when session does not specify', () => {
        const project: ClaudeCodeOptions = { model: 'test', dangerouslySkipPermissions: true };
        const session: ClaudeCodeOptions = { model: 'override' };
        expect(ClaudeOptionsService.mergeOptions(project, session)).toEqual({
          model: 'override',
          dangerouslySkipPermissions: true,
        });
      });
    });
  });

  describe('getUnknownKeys', () => {
    it('should return unknown keys', () => {
      const unknownKeys = ClaudeOptionsService.getUnknownKeys({
        model: 'test',
        unknownKey: 'value',
        anotherBad: 'value2',
      });
      expect(unknownKeys).toEqual(['unknownKey', 'anotherBad']);
    });

    it('should return empty array for valid options', () => {
      const unknownKeys = ClaudeOptionsService.getUnknownKeys({
        model: 'test',
        allowedTools: 'Bash',
      });
      expect(unknownKeys).toEqual([]);
    });

    it('should return empty array for non-object values', () => {
      expect(ClaudeOptionsService.getUnknownKeys(null)).toEqual([]);
      expect(ClaudeOptionsService.getUnknownKeys([])).toEqual([]);
      expect(ClaudeOptionsService.getUnknownKeys('string')).toEqual([]);
    });
  });
});
