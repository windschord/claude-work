# TASK-007: DockerAdapter実装(共通ロジック移動)

> **サブエージェント実行指示**

---

## あなたのタスク

**DockerAdapter実装(共通ロジック移動)** を実装してください。

### 実装の目標

DockerAdapterをBasePTYAdapterを継承するように変更し、共通ロジックをbase-adapterへ移動する。createExecSessionのcols/rowsハードコードを修正する。

### 作成/変更するファイル

| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 変更 | `src/services/adapters/docker-adapter.ts` | BasePTYAdapter継承、共通ロジック移動 |

---

## 技術的コンテキスト

### 参照すべきファイル
- `@src/services/adapters/base-adapter.ts` - BasePTYAdapter実装
- `@docs/sdd/design/issue-101-pty-refactor/components/docker-adapter.md` - 設計書

---

## 受入基準

- [ ] `extends BasePTYAdapter` を追加
- [ ] createSession()でBasePTYAdapter.spawnPTY()を使用
- [ ] cols/rows初期化ロジック(471-489行)を削除(base-adapterへ移動済み)
- [ ] createExecSession()のcols/rowsハードコード(329-333行)を修正
- [ ] Docker固有ロジック(ensureContainer, cleanupContainer)は維持
- [ ] TASK-006のテストが全て通過
- [ ] コミット: `feat: DockerAdapterリファクタリング(共通ロジック移動) [TASK-007]`

---

## 実装の詳細仕様

### createExecSession修正

**変更前**:
```typescript
const ptyProcess = pty.spawn('docker', args, {
  name: 'xterm-256color',
  cols: 80,  // ← ハードコード
  rows: 24,  // ← ハードコード
  ...
});
```

**変更後**:
```typescript
private async createExecSession(sessionId: string, containerName: string, cols: number, rows: number): Promise<void> {
  const args = ['exec', '-it', containerName, '/bin/bash'];
  const ptyInstance = this.spawnPTY('docker', args, { cols, rows });
  this.setupDataHandlers(ptyInstance, sessionId);
  this.setupErrorHandlers(ptyInstance, sessionId);
}
```

---

## 推定工数
50分
