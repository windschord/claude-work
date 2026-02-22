# TASK-002: BasePTYAdapter実装

> **サブエージェント実行指示**
> このドキュメントは、タスク実行エージェントがサブエージェントにそのまま渡すことを想定しています。
> 以下の内容に従って実装を完了してください。

---

## あなたのタスク

**BasePTYAdapter実装** を実装してください。

### 実装の目標

HOST/DOCKER環境で共通のPTYロジックを提供する抽象基底クラスBasePTYAdapterを実装する。TASK-001で作成したテストが全て通過するように実装する。

### 作成/変更するファイル

| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `src/services/adapters/base-adapter.ts` | BasePTYAdapter抽象基底クラス |

---

## 技術的コンテキスト

### 使用技術
- 言語: TypeScript
- PTYライブラリ: node-pty
- イベント: EventEmitter

### 参照すべきファイル

- `@src/services/adapters/docker-adapter.ts` - 既存のDockerAdapter実装(cols/rows初期化パターン)
- `@src/services/claude-pty-manager.ts` - extractClaudeSessionId実装(行61-68)
- `@src/services/environment-adapter.ts` - EnvironmentAdapterインターフェース
- `@src/services/adapters/__tests__/base-adapter.test.ts` - TASK-001で作成したテスト

### 関連する設計書
- `@docs/sdd/design/components/base-adapter.md` - BasePTYAdapter設計

### 関連する要件
- `@docs/sdd/requirements/stories/US-004.md` - 共通PTYロジック抽出

---

## 受入基準

以下のすべての基準を満たしたら、このタスクは完了です:

- [ ] `src/services/adapters/base-adapter.ts` が作成されている
- [ ] BasePTYAdapter抽象クラスがEnvironmentAdapterインターフェースを実装している
- [ ] EventEmitterを継承している
- [ ] spawnPTY()が実装されている(protected)
- [ ] setupDataHandlers()が実装されている(protected)
- [ ] setupErrorHandlers()が実装されている(protected)
- [ ] cleanupPTY()が実装されている(protected)
- [ ] extractClaudeSessionId()が実装されている(protected)
- [ ] createSession()が抽象メソッドとして定義されている
- [ ] destroySession()が抽象メソッドとして定義されている
- [ ] `npm test` でTASK-001のテストが全て通過する
- [ ] `npm run lint` でエラーが0件である
- [ ] `npm run typecheck` でエラーが0件である

---

## 実装手順

### ステップ1: 基本構造作成

1. `src/services/adapters/base-adapter.ts` を作成
2. 必要なimportを追加(node-pty, EventEmitter, logger)
3. BasePTYAdapterクラス定義(abstract, extends EventEmitter, implements EnvironmentAdapter)

### ステップ2: spawnPTY()実装

```typescript
protected spawnPTY(command: string, args: string[], options: {
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
}): IPty {
  const { cols = 80, rows = 24, cwd, env = {} } = options;

  return pty.spawn(command, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      ...env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });
}
```

### ステップ3: setupDataHandlers()実装

```typescript
protected setupDataHandlers(pty: IPty, sessionId: string): void {
  pty.onData((data: string) => {
    this.emit('data', sessionId, data);

    // SessionID抽出を試みる
    const extracted = this.extractClaudeSessionId(data);
    if (extracted) {
      this.emit('claudeSessionId', sessionId, extracted);
    }
  });
}
```

### ステップ4: setupErrorHandlers()実装

```typescript
protected setupErrorHandlers(pty: IPty, sessionId: string): void {
  pty.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
    this.emit('exit', sessionId, { exitCode, signal });
  });
}
```

### ステップ5: cleanupPTY()実装

```typescript
protected async cleanupPTY(pty: IPty): Promise<void> {
  pty.kill();
  // リスナー削除は自動的に行われる
}
```

### ステップ6: extractClaudeSessionId()実装

ClaudePTYManagerから移動(claude-pty-manager.ts:61-68):

```typescript
protected extractClaudeSessionId(data: string): string | null {
  const match = data.match(/Session ID: ([a-f0-9-]{36})/);
  if (match) {
    return match[1];
  }
  return null;
}
```

### ステップ7: 抽象メソッド定義

```typescript
abstract createSession(
  sessionId: string,
  workingDir: string,
  initialPrompt?: string,
  options?: CreateSessionOptions
): void | Promise<void>;

abstract destroySession(sessionId: string): void;
```

### ステップ8: EnvironmentAdapterインターフェース実装

write(), resize(), restartSession()のデフォルト実装または抽象メソッド定義。

### ステップ9: テスト実行とコミット

1. テストを実行: `npm test -- base-adapter.test.ts`
2. 全テスト通過を確認
3. Lintとタイプチェック: `npm run lint && npm run typecheck`
4. コミット: `feat: BasePTYAdapter実装 [TASK-002]`

---

## 実装の詳細仕様

### クラス定義

```typescript
import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { logger } from '@/lib/logger';
import type { EnvironmentAdapter, CreateSessionOptions, PTYExitInfo } from '../environment-adapter';

export abstract class BasePTYAdapter extends EventEmitter implements EnvironmentAdapter {
  // 共通保護メソッド
  protected spawnPTY(...): IPty { /* 実装 */ }
  protected setupDataHandlers(...): void { /* 実装 */ }
  protected setupErrorHandlers(...): void { /* 実装 */ }
  protected cleanupPTY(...): Promise<void> { /* 実装 */ }
  protected extractClaudeSessionId(...): string | null { /* 実装 */ }

  // 抽象メソッド(継承先で実装)
  abstract createSession(...): void | Promise<void>;
  abstract destroySession(sessionId: string): void;

  // EnvironmentAdapterインターフェース実装
  write(sessionId: string, data: string): void {
    throw new Error('Not implemented in base class');
  }

  resize(sessionId: string, cols: number, rows: number): void {
    throw new Error('Not implemented in base class');
  }

  restartSession(sessionId: string): void {
    throw new Error('Not implemented in base class');
  }
}
```

---

## 注意事項

- **ClaudePTYManagerから移動**: extractClaudeSessionId()をそのまま移動
- **DockerAdapterから移動**: cols/rows初期化パターンをspawnPTY()に統合
- **ログ記録**: 各メソッドで適切なログを記録(logger.info, logger.warn)
- **抽象クラス**: createSession/destroySessionは継承先で実装
- **型安全性**: TypeScript strict modeでエラーが出ないこと

---

## 推定工数
40分

## ステータス

`DONE`

**完了サマリー**: base-adapter.ts(269行)を実装。EventEmitter継承、EnvironmentAdapter実装の抽象クラス。spawnPTY, setupDataHandlers, setupErrorHandlers, cleanupPTY, extractClaudeSessionIdの5つのprotectedメソッドと、createSession, destroySessionの2つの抽象メソッドを定義。セキュリティ対策として引数サニタイズとCLAUDECODE環境変数除外を追加。
