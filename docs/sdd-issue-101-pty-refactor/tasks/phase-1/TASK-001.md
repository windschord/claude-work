# TASK-001: BasePTYAdapterユニットテスト作成

> **サブエージェント実行指示**
> このドキュメントは、タスク実行エージェントがサブエージェントにそのまま渡すことを想定しています。
> 以下の内容に従って実装を完了してください。

---

## あなたのタスク

**BasePTYAdapterユニットテスト作成** を実装してください。

### 実装の目標

BasePTYAdapter抽象基底クラスの共通ロジック(spawnPTY, setupDataHandlers, setupErrorHandlers, cleanupPTY, extractClaudeSessionId)に対するユニットテストを作成する。テスト先行(TDD)で実装するため、実装コードは作成せず、テストのみを作成する。

### 作成/変更するファイル

| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `src/services/adapters/__tests__/base-adapter.test.ts` | BasePTYAdapterユニットテスト |

---

## 技術的コンテキスト

### 使用技術
- 言語: TypeScript
- テストフレームワーク: Vitest
- モックライブラリ: vi (Vitestビルトイン)
- PTYライブラリ: node-pty (モック化)

### 参照すべきファイル
以下のファイルを読み込んで、既存のテストパターンに従ってください:

- `@src/services/adapters/__tests__/docker-adapter.test.ts` - 既存のアダプターテストパターン
- `@src/services/environment-adapter.ts` - EnvironmentAdapterインターフェース定義

### 関連する設計書
- `@docs/sdd-issue-101-pty-refactor/design/components/base-adapter.md` - BasePTYAdapter設計

### 関連する要件
- `@docs/sdd-issue-101-pty-refactor/requirements/stories/US-004.md` - 共通PTYロジック抽出
- `@docs/sdd-issue-101-pty-refactor/requirements/nfr/maintainability.md` - NFR-MNT-002: テストカバレッジ80%以上

---

## 受入基準

以下のすべての基準を満たしたら、このタスクは完了です:

- [ ] `src/services/adapters/__tests__/base-adapter.test.ts` が作成されている
- [ ] spawnPTY()のテストケースが3つ以上ある
- [ ] setupDataHandlers()のテストケースが2つ以上ある
- [ ] setupErrorHandlers()のテストケースが2つ以上ある
- [ ] cleanupPTY()のテストケースが2つ以上ある
- [ ] extractClaudeSessionId()のテストケースが2つ以上ある
- [ ] `npm test` を実行してテストが失敗することを確認(実装がないため)
- [ ] `npm run lint` でエラーが0件である
- [ ] `npm run typecheck` でエラーが0件である

---

## 実装手順

### ステップ1: テストファイル作成

1. `src/services/adapters/__tests__/base-adapter.test.ts` を作成
2. 必要なimportを追加(vitest, node-ptyモック)
3. describe/itブロックを構造化

### ステップ2: spawnPTY()テスト作成

以下のテストケースを実装:
1. cols/rowsデフォルト値(80x24)が設定されること
2. 環境変数(TERM, COLORTERM)が正しく設定されること
3. pty.spawn()が正しい引数で呼び出されること

### ステップ3: setupDataHandlers()テスト作成

以下のテストケースを実装:
1. pty.onData()リスナーが登録されること
2. 'data' eventが発火されること

### ステップ4: setupErrorHandlers()テスト作成

以下のテストケースを実装:
1. pty.onExit()リスナーが登録されること
2. 'exit' eventが発火されること

### ステップ5: cleanupPTY()テスト作成

以下のテストケースを実装:
1. pty.kill()が呼び出されること
2. リスナーが削除されること

### ステップ6: extractClaudeSessionId()テスト作成

以下のテストケースを実装:
1. 正規表現マッチング成功時、SessionIDが抽出されること
2. 'claudeSessionId' eventが発火されること

### ステップ7: テスト実行とコミット

1. テストを実行: `npm test -- base-adapter.test.ts`
2. 失敗を確認(実装がないため、全テスト失敗が期待される)
3. コミット: `test: BasePTYAdapterユニットテスト追加 [TASK-001]`

---

## 実装の詳細仕様

### テスト構造

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IPty } from 'node-pty';

// BasePTYAdapterのモック実装(テスト用)
class TestPTYAdapter extends BasePTYAdapter {
  createSession() {}
  destroySession() {}
}

describe('BasePTYAdapter', () => {
  describe('spawnPTY', () => {
    it('should set default cols/rows to 80x24', () => {
      // テスト実装
    });

    it('should set TERM and COLORTERM environment variables', () => {
      // テスト実装
    });

    it('should call pty.spawn with correct arguments', () => {
      // テスト実装
    });
  });

  describe('setupDataHandlers', () => {
    it('should register pty.onData listener', () => {
      // テスト実装
    });

    it('should emit data event', () => {
      // テスト実装
    });
  });

  describe('setupErrorHandlers', () => {
    it('should register pty.onExit listener', () => {
      // テスト実装
    });

    it('should emit exit event', () => {
      // テスト実装
    });
  });

  describe('cleanupPTY', () => {
    it('should call pty.kill()', () => {
      // テスト実装
    });

    it('should remove listeners', () => {
      // テスト実装
    });
  });

  describe('extractClaudeSessionId', () => {
    it('should extract session ID from data', () => {
      // テスト実装
    });

    it('should emit claudeSessionId event', () => {
      // テスト実装
    });
  });
});
```

### node-ptyモック

```typescript
// node-ptyのモック
vi.mock('node-pty', () => ({
  spawn: vi.fn((command, args, options) => ({
    onData: vi.fn(),
    onExit: vi.fn(),
    kill: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
  })),
}));
```

---

## 注意事項

- **TDD原則**: 実装コードは作成しない。テストのみを作成する。
- **モックの完全性**: node-ptyをモック化し、実際のPTYプロセスを起動しない。
- **カバレッジ目標**: 各メソッドの主要な動作をカバーするテストを作成。
- **参照パターン**: 既存のdocker-adapter.test.tsを参考にテストパターンを踏襲。

---

## 推定工数
40分
