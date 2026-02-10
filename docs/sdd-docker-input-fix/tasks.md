# タスク管理書: Docker環境ターミナル入力不能の修正

## タスク一覧

| ID | タスク | ステータス | 依存 |
|----|--------|-----------|------|
| TASK-001 | テスト追加（RED） | pending | - |
| TASK-002 | stopContainerメソッド追加 | pending | TASK-001 |
| TASK-003 | destroySession/onExit/restartSession修正 | pending | TASK-002 |
| TASK-004 | write()に警告ログ追加 | pending | TASK-003 |
| TASK-005 | 回帰テスト確認 | pending | TASK-004 |

## タスク詳細

### TASK-001: テスト追加（TDD RED段階）

**ファイル**: `src/services/adapters/__tests__/docker-adapter.test.ts`

**実装指示**:

1. `child_process.execFile` のモックを追加（既存の`spawnSync`モックに加えて）
2. 以下のテストケースを追加:

```
describe('stopContainer', () => {
  - destroySession()呼び出し後にdocker stopが実行されること
  - destroySession()のshellModeセッションではdocker stopが実行されないこと
  - onExit時にdocker stopが実行されること
  - restartSession()が旧コンテナ停止後に新コンテナを作成すること
}

describe('write with logging', () => {
  - セッション不在時にlogger.warnが呼ばれること
}
```

**受入基準**:
- [ ] stopContainerに関するテストが5件追加されている
- [ ] write()の警告ログテストが1件追加されている
- [ ] テスト実行時にすべて失敗する（RED）

### TASK-002: stopContainerメソッド追加

**ファイル**: `src/services/adapters/docker-adapter.ts`

**実装指示**:

1. `stopContainer(containerName: string): void` プライベートメソッドを追加
2. `docker stop -t 3` を `execFile` で実行
3. 失敗時は `docker kill` でフォールバック
4. すべて非同期・バックグラウンド実行

**受入基準**:
- [ ] stopContainerメソッドが追加されている
- [ ] docker stopとdocker killのフォールバックチェーンがある
- [ ] Promiseをawaitせずバックグラウンド実行している

### TASK-003: destroySession/onExit/restartSession修正

**ファイル**: `src/services/adapters/docker-adapter.ts`

**実装指示**:

1. `destroySession()`: shellMode以外のセッションで`stopContainer()`を呼び出す
2. `createSession()`のonExitハンドラー: `containerId`を`sessions.delete()`前に保存し、shellMode以外で`stopContainer()`を呼び出す
3. `restartSession()`: `destroySession()`後に`docker wait`でコンテナ停止を待機してから`createSession()`を呼ぶ

**受入基準**:
- [ ] destroySession()でshellMode以外のコンテナが停止される
- [ ] onExit時にゾンビコンテナが停止される
- [ ] restartSession()で旧コンテナ停止後に新コンテナが作成される
- [ ] shellModeセッションの破棄でコンテナが停止されない

### TASK-004: write()に警告ログ追加

**ファイル**: `src/services/adapters/docker-adapter.ts`

**実装指示**:

1. `write()`メソッドでセッション不在時に`logger.warn`を呼び出す
2. オプショナルチェーニングを明示的なif文に変更

**受入基準**:
- [ ] セッション不在時にlogger.warnが呼ばれる
- [ ] セッション存在時は既存動作と同じ

### TASK-005: 回帰テスト確認

**コマンド**: `npx vitest run src/services/adapters/__tests__/docker-adapter.test.ts`

**受入基準**:
- [ ] 新規テストがすべてパスする（GREEN）
- [ ] 既存テストがすべてパスする（回帰なし）
