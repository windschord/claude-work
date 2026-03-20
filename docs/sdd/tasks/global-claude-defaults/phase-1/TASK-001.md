# TASK-001: ConfigService拡張（claude_defaults）

## 概要

AppConfig型にclaude_defaults設定を追加し、ConfigServiceにゲッターメソッドを追加する。

## 対象ファイル

- `src/services/config-service.ts` - 変更
- `src/services/__tests__/config-service.test.ts` - 変更

## TDD手順

### 1. テスト作成

```typescript
// src/services/__tests__/config-service.test.ts に追加

describe('claude_defaults', () => {
  it('should return default claude_defaults when not configured', async () => {
    const service = new ConfigService(testConfigPath);
    await service.load();
    const defaults = service.getClaudeDefaults();
    expect(defaults).toEqual({
      dangerouslySkipPermissions: false,
      worktree: true,
    });
  });

  it('should load claude_defaults from config file', async () => {
    // settings.json に claude_defaults を書き込み
    await writeConfig({
      claude_defaults: {
        dangerouslySkipPermissions: true,
        worktree: false,
      },
    });
    const service = new ConfigService(testConfigPath);
    await service.load();
    const defaults = service.getClaudeDefaults();
    expect(defaults).toEqual({
      dangerouslySkipPermissions: true,
      worktree: false,
    });
  });

  it('should save claude_defaults to config file', async () => {
    const service = new ConfigService(testConfigPath);
    await service.load();
    await service.save({
      claude_defaults: {
        dangerouslySkipPermissions: true,
        worktree: true,
      },
    });
    const config = service.getConfig();
    expect(config.claude_defaults).toEqual({
      dangerouslySkipPermissions: true,
      worktree: true,
    });
  });

  it('should merge partial claude_defaults with existing values', async () => {
    await writeConfig({
      claude_defaults: {
        dangerouslySkipPermissions: true,
        worktree: true,
      },
    });
    const service = new ConfigService(testConfigPath);
    await service.load();
    await service.save({
      claude_defaults: {
        dangerouslySkipPermissions: false,
      },
    });
    const defaults = service.getClaudeDefaults();
    expect(defaults.dangerouslySkipPermissions).toBe(false);
    expect(defaults.worktree).toBe(true); // 未指定のため前の値を保持
  });
});
```

### 2. テスト実行（失敗確認）

```bash
npx vitest run src/services/__tests__/config-service.test.ts
```

### 3. 実装

- `ClaudeDefaults`インターフェースを追加
- `AppConfig`にclaude_defaultsフィールドを追加
- `DEFAULT_CONFIG`にデフォルト値を追加
- `getClaudeDefaults()`メソッドを追加
- `load()`と`save()`でclaude_defaultsの読み書きを処理

### 4. テスト実行（成功確認）

```bash
npx vitest run src/services/__tests__/config-service.test.ts
```

## 受入条件

- [ ] ClaudeDefaults型が定義されている
- [ ] AppConfigにclaude_defaultsが追加されている
- [ ] デフォルト値: dangerouslySkipPermissions=false, worktree=true
- [ ] getClaudeDefaults()が正しい値を返す
- [ ] save()でclaude_defaultsが永続化される
- [ ] 部分更新が可能（未指定フィールドは既存値を保持）
- [ ] テストが全て通過する
