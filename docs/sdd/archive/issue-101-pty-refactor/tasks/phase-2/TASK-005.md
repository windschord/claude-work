# TASK-005: HostAdapter実装(ClaudePTYManager依存削除)

> **サブエージェント実行指示**

---

## あなたのタスク

**HostAdapter実装(ClaudePTYManager依存削除)** を実装してください。

### 実装の目標

HostAdapterをBasePTYAdapterを継承するように変更し、ClaudePTYManager依存を削除する。Circular delegationを解消する。

### 作成/変更するファイル

| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 変更 | `src/services/adapters/host-adapter.ts` | ClaudePTYManager依存削除、BasePTYAdapter継承 |

---

## 技術的コンテキスト

### 参照すべきファイル
- `@src/services/adapters/base-adapter.ts` - BasePTYAdapter実装
- `@docs/sdd/design/components/host-adapter.md` - 設計書

---

## 受入基準

- [x] `import { claudePtyManager } from '../claude-pty-manager';` を削除
- [x] `extends BasePTYAdapter` を追加
- [x] createSession(Claude Codeモード)でBasePTYAdapter.spawnPTY()を使用
- [x] createSession(Claude Codeモード)でoptions.cols/rowsを渡す
- [x] destroySession(Claude Codeモード)でBasePTYAdapter.cleanupPTY()を使用
- [x] shellModeロジックは維持
- [x] TASK-004のテストが全て通過
- [x] コミット: `feat: HostAdapterリファクタリング(ClaudePTYManager依存削除) [TASK-005]`

---

## 実装の詳細仕様

### 主要な変更点

**削除**:
```typescript
import { claudePtyManager } from '../claude-pty-manager';
claudePtyManager.createSession(...);
claudePtyManager.destroySession(...);
claudePtyManager.on(...);
```

**追加**:
```typescript
export class HostAdapter extends BasePTYAdapter {
  private ptyInstances: Map<string, IPty> = new Map();

  createSession(...) {
    if (options?.shellMode) {
      // 既存ロジック維持
    } else {
      const cols = options?.cols ?? 80;
      const rows = options?.rows ?? 24;
      const ptyInstance = this.spawnPTY('claude', args, { cols, rows, cwd: workingDir });
      this.setupDataHandlers(ptyInstance, sessionId);
      this.setupErrorHandlers(ptyInstance, sessionId);
      this.ptyInstances.set(sessionId, ptyInstance);
    }
  }

  destroySession(sessionId: string): void {
    if (this.shellSessions.has(sessionId)) {
      // 既存ロジック維持
    } else {
      const ptyInstance = this.ptyInstances.get(sessionId);
      if (ptyInstance) {
        await this.cleanupPTY(ptyInstance);
        this.ptyInstances.delete(sessionId);
      }
    }
  }
}
```

---

## 推定工数
50分

## ステータス

`DONE`

**完了サマリー**: HostAdapterからClaudePTYManager依存を完全削除。BasePTYAdapterを継承し、createSessionでspawnPTY()使用、destroySessionでcleanupPTY()使用に変更。shellModeロジックは維持。8テスト全通過。
