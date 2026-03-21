# TASK-003: ClaudeDefaultsResolverサービス新規作成

## 概要

4層カスケード方式で設定を解決するClaudeDefaultsResolverサービスを新規作成する。

## 依存: TASK-001

## 対象ファイル

- `src/services/claude-defaults-resolver.ts` - **新規作成**
- `src/services/__tests__/claude-defaults-resolver.test.ts` - **新規作成**

## TDD手順

### 1. テスト作成

```typescript
// src/services/__tests__/claude-defaults-resolver.test.ts

describe('ClaudeDefaultsResolver', () => {
  describe('resolve', () => {
    const defaultAppDefaults = {
      dangerouslySkipPermissions: false,
      worktree: true,
    };

    it('should use app defaults when no overrides exist', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {},  // envConfig
        'DOCKER',
        {},  // projectOptions
        null // sessionOptions
      );
      expect(result.dangerouslySkipPermissions).toBe(false);
      expect(result.worktree).toBe(true);
    });

    it('should apply environment override over app defaults', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {
          claude_defaults_override: {
            dangerouslySkipPermissions: true,
          },
        },
        'DOCKER',
        {},
        null
      );
      expect(result.dangerouslySkipPermissions).toBe(true);
      expect(result.worktree).toBe(true); // 継承
    });

    it('should treat "inherit" as using app defaults', () => {
      const result = ClaudeDefaultsResolver.resolve(
        { dangerouslySkipPermissions: true, worktree: true },
        {
          claude_defaults_override: {
            dangerouslySkipPermissions: 'inherit',
          },
        },
        'DOCKER',
        {},
        null
      );
      expect(result.dangerouslySkipPermissions).toBe(true); // app default
    });

    it('should apply project options over environment override', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {
          claude_defaults_override: {
            dangerouslySkipPermissions: true,
          },
        },
        'DOCKER',
        { dangerouslySkipPermissions: false },
        null
      );
      expect(result.dangerouslySkipPermissions).toBe(false); // project overrides
    });

    it('should apply session options over project options', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {},
        'DOCKER',
        { dangerouslySkipPermissions: false },
        { dangerouslySkipPermissions: true }
      );
      expect(result.dangerouslySkipPermissions).toBe(true); // session overrides
    });

    it('should force dangerouslySkipPermissions to false for HOST environment', () => {
      const result = ClaudeDefaultsResolver.resolve(
        { dangerouslySkipPermissions: true, worktree: true },
        {
          claude_defaults_override: {
            dangerouslySkipPermissions: true,
          },
        },
        'HOST',
        { dangerouslySkipPermissions: true },
        { dangerouslySkipPermissions: true }
      );
      expect(result.dangerouslySkipPermissions).toBe(false); // forced false
    });

    it('should fall back to legacy skipPermissions in env config', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        { skipPermissions: true }, // legacy field
        'DOCKER',
        {},
        null
      );
      expect(result.dangerouslySkipPermissions).toBe(true);
    });

    it('should prefer claude_defaults_override over legacy skipPermissions', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {
          skipPermissions: true,
          claude_defaults_override: {
            dangerouslySkipPermissions: false,
          },
        },
        'DOCKER',
        {},
        null
      );
      expect(result.dangerouslySkipPermissions).toBe(false);
    });

    it('should merge non-cascade fields from project and session', () => {
      const result = ClaudeDefaultsResolver.resolve(
        defaultAppDefaults,
        {},
        'DOCKER',
        { model: 'claude-3-5-sonnet' },
        { allowedTools: 'bash' }
      );
      expect(result.model).toBe('claude-3-5-sonnet');
      expect(result.allowedTools).toBe('bash');
    });

    it('should default worktree to true when undefined at all levels', () => {
      const result = ClaudeDefaultsResolver.resolve(
        { dangerouslySkipPermissions: false }, // worktree undefined
        {},
        'DOCKER',
        {},
        null
      );
      expect(result.worktree).toBe(true); // default
    });
  });
});
```

### 2. テスト実行（失敗確認）

```bash
npx vitest run src/services/__tests__/claude-defaults-resolver.test.ts
```

### 3. 実装

- `ClaudeDefaultsResolver.resolve()`静的メソッド
- 4層カスケード解決ロジック
- HOST環境でのskipPermissions強制false
- 旧skipPermissionsフィールドの後方互換

### 4. テスト実行（成功確認）

## 受入条件

- [ ] 4層カスケード解決が正しく動作する
- [ ] 'inherit'がアプリ共通設定の継承として扱われる
- [ ] undefinedもアプリ共通設定の継承として扱われる
- [ ] HOST環境でdangerouslySkipPermissionsが強制false
- [ ] 旧skipPermissionsフィールドとの後方互換
- [ ] worktreeのデフォルト値がtrue
- [ ] テストが全て通過する
