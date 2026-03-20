import { describe, it, expect } from 'vitest';
import { ClaudeDefaultsResolver } from '../claude-defaults-resolver';
import type { ClaudeDefaults } from '../config-service';

describe('ClaudeDefaultsResolver', () => {
  const defaultAppDefaults: Required<ClaudeDefaults> = {
    dangerouslySkipPermissions: false,
    worktree: true,
  };

  describe('dangerouslySkipPermissions解決', () => {
    it('アプリデフォルトが適用される', () => {
      const result = ClaudeDefaultsResolver.resolve(
        { ...defaultAppDefaults, dangerouslySkipPermissions: true },
        {},
        'DOCKER',
        {},
        null
      );
      expect(result.dangerouslySkipPermissions).toBe(true);
    });

    it('環境オーバーライドがアプリデフォルトを上書きする', () => {
      const result = ClaudeDefaultsResolver.resolve(
        { ...defaultAppDefaults, dangerouslySkipPermissions: false },
        { claude_defaults_override: { dangerouslySkipPermissions: true } },
        'DOCKER',
        {},
        null
      );
      expect(result.dangerouslySkipPermissions).toBe(true);
    });

    it('環境オーバーライドがinheritの場合はアプリデフォルトを継承', () => {
      const result = ClaudeDefaultsResolver.resolve(
        { ...defaultAppDefaults, dangerouslySkipPermissions: true },
        { claude_defaults_override: { dangerouslySkipPermissions: 'inherit' } },
        'DOCKER',
        {},
        null
      );
      expect(result.dangerouslySkipPermissions).toBe(true);
    });

    it('プロジェクトオプションが環境設定を上書きする', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        { claude_defaults_override: { dangerouslySkipPermissions: false } },
        'DOCKER',
        { dangerouslySkipPermissions: true },
        null
      );
      expect(result.dangerouslySkipPermissions).toBe(true);
    });

    it('セッションオプションがプロジェクト設定を上書きする', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {},
        'DOCKER',
        { dangerouslySkipPermissions: false },
        { dangerouslySkipPermissions: true }
      );
      expect(result.dangerouslySkipPermissions).toBe(true);
    });

    it('HOST環境では常にfalseに強制される', () => {
      const result = ClaudeDefaultsResolver.resolve(
        { ...defaultAppDefaults, dangerouslySkipPermissions: true },
        { claude_defaults_override: { dangerouslySkipPermissions: true } },
        'HOST',
        { dangerouslySkipPermissions: true },
        { dangerouslySkipPermissions: true }
      );
      expect(result.dangerouslySkipPermissions).toBe(false);
    });

    it('旧skipPermissionsフィールドの後方互換', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        { skipPermissions: true },
        'DOCKER',
        {},
        null
      );
      expect(result.dangerouslySkipPermissions).toBe(true);
    });

    it('claude_defaults_overrideが旧skipPermissionsより優先される', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {
          skipPermissions: true,
          claude_defaults_override: { dangerouslySkipPermissions: false },
        },
        'DOCKER',
        {},
        null
      );
      expect(result.dangerouslySkipPermissions).toBe(false);
    });
  });

  describe('worktree解決', () => {
    it('アプリデフォルトが適用される', () => {
      const result = ClaudeDefaultsResolver.resolve(
        { ...defaultAppDefaults, worktree: true },
        {},
        'DOCKER',
        {},
        null
      );
      expect(result.worktree).toBe(true);
    });

    it('環境オーバーライドがアプリデフォルトを上書きする', () => {
      const result = ClaudeDefaultsResolver.resolve(
        { ...defaultAppDefaults, worktree: true },
        { claude_defaults_override: { worktree: false } },
        'DOCKER',
        {},
        null
      );
      expect(result.worktree).toBe(false);
    });

    it('環境オーバーライドがinheritの場合はアプリデフォルトを継承', () => {
      const result = ClaudeDefaultsResolver.resolve(
        { ...defaultAppDefaults, worktree: false },
        { claude_defaults_override: { worktree: 'inherit' } },
        'DOCKER',
        {},
        null
      );
      expect(result.worktree).toBe(false);
    });

    it('プロジェクトオプションが環境設定を上書きする', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        { claude_defaults_override: { worktree: true } },
        'DOCKER',
        { worktree: false },
        null
      );
      expect(result.worktree).toBe(false);
    });

    it('セッションオプションがプロジェクト設定を上書きする', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {},
        'DOCKER',
        { worktree: true },
        { worktree: false }
      );
      expect(result.worktree).toBe(false);
    });

    it('worktreeが文字列の場合はそのまま伝播する', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {},
        'DOCKER',
        { worktree: 'my-worktree' },
        null
      );
      expect(result.worktree).toBe('my-worktree');
    });

    it('デフォルトworktreeはtrue', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {},
        'DOCKER',
        {},
        null
      );
      expect(result.worktree).toBe(true);
    });
  });

  describe('他のClaudeCodeOptionsフィールド', () => {
    it('model, allowedTools, permissionMode, additionalFlagsはプロジェクト/セッションからマージ', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {},
        'DOCKER',
        { model: 'claude-3-opus', allowedTools: 'tool1,tool2' },
        { permissionMode: 'plan', additionalFlags: '--verbose' }
      );
      expect(result.model).toBe('claude-3-opus');
      expect(result.allowedTools).toBe('tool1,tool2');
      expect(result.permissionMode).toBe('plan');
      expect(result.additionalFlags).toBe('--verbose');
    });

    it('セッションオプションがプロジェクトオプションを上書きする', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {},
        'DOCKER',
        { model: 'opus' },
        { model: 'sonnet' }
      );
      expect(result.model).toBe('sonnet');
    });

    it('セッションオプションがnullの場合はプロジェクトオプションを使用', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {},
        'DOCKER',
        { model: 'opus', additionalFlags: '--flag' },
        null
      );
      expect(result.model).toBe('opus');
      expect(result.additionalFlags).toBe('--flag');
    });
  });

  describe('undefinedフィールドの扱い', () => {
    it('環境設定がundefinedの場合はアプリデフォルトを継承', () => {
      const result = ClaudeDefaultsResolver.resolve(
        { ...defaultAppDefaults, dangerouslySkipPermissions: true },
        { claude_defaults_override: {} },
        'DOCKER',
        {},
        null
      );
      expect(result.dangerouslySkipPermissions).toBe(true);
    });

    it('空のプロジェクト/セッションオプションの場合は上位層の値を継承', () => {
      const result = ClaudeDefaultsResolver.resolve(
        { ...defaultAppDefaults, dangerouslySkipPermissions: true, worktree: false },
        {},
        'DOCKER',
        {},
        {}
      );
      expect(result.dangerouslySkipPermissions).toBe(true);
      expect(result.worktree).toBe(false);
    });
  });
});
