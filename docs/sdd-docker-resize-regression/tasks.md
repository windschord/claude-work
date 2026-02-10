# タスク管理書: Docker環境ターミナルリサイズ回帰修正

## タスク一覧

| ID | タスク | 対応要件 | ステータス |
|----|--------|----------|------------|
| TASK-001 | 遅延リサイズの無条件スケジューリング（テスト） | REQ-002 | completed |
| TASK-002 | 遅延リサイズの無条件スケジューリング（実装） | REQ-002 | completed |
| TASK-003 | restartSessionのリサイズ情報保存・復元（テスト） | REQ-003 | completed |
| TASK-004 | restartSessionのリサイズ情報保存・復元（実装） | REQ-003 | completed |
| TASK-005 | WebSocketリサイズメッセージの早期バッファリング（テスト） | REQ-001 | completed |
| TASK-006 | WebSocketリサイズメッセージの早期バッファリング（実装） | REQ-001 | completed |
| TASK-007 | 全テスト実行・動作確認 | NFR-001, NFR-002 | completed (テストのみ) |

## TASK-001: 遅延リサイズの無条件スケジューリング（テスト）

**ファイル:** `src/services/adapters/__tests__/docker-adapter.test.ts`

**テスト追加:**

1. `遅延リサイズ: lastKnownCols/Rows未設定でもsetTimeoutがスケジュールされる`
   - セッション作成後、resize()を呼ばずにonDataを発火
   - setTimeoutが呼ばれることを確認
   - 1秒後のコールバックでは、lastKnownCols/Rowsが未設定のためresize()は呼ばれないことを確認

2. `遅延リサイズ: shellModeではスケジュールされない`
   - shellMode=trueでexecセッション作成
   - onData発火後もsetTimeoutが呼ばれないことを確認

**受入基準:**
- テストが正しく失敗する（RED段階）

## TASK-002: 遅延リサイズの無条件スケジューリング（実装）

**ファイル:** `src/services/adapters/docker-adapter.ts`

**変更箇所:** `createSession()`メソッドのonDataハンドラー内（行375-393付近）

**変更内容:**
```typescript
// Before:
if (session.lastKnownCols && session.lastKnownRows) {
  setTimeout(() => {
    const s = this.sessions.get(sessionId);
    if (s && s.lastKnownCols && s.lastKnownRows) {
      s.ptyProcess.resize(s.lastKnownCols, s.lastKnownRows);
    }
  }, 1000);
}

// After:
if (!session.shellMode) {
  setTimeout(() => {
    const s = this.sessions.get(sessionId);
    if (s && s.lastKnownCols && s.lastKnownRows) {
      logger.info('DockerAdapter: Applying deferred resize after first output', {
        sessionId, cols: s.lastKnownCols, rows: s.lastKnownRows,
      });
      s.ptyProcess.resize(s.lastKnownCols, s.lastKnownRows);
    }
  }, 1000);
}
```

**受入基準:**
- TASK-001のテストがパスする（GREEN段階）
- 既存の遅延リサイズテストもパスする

## TASK-003: restartSessionのリサイズ情報保存・復元（テスト）

**ファイル:** `src/services/adapters/__tests__/docker-adapter.test.ts`

**テスト追加:**

1. `restartSession: リサイズ情報が新セッションに引き継がれる`
   - セッション作成後にresize(120, 40)を呼ぶ
   - restartSession()を実行
   - 新セッションのPTYに対してresize(120, 40)が呼ばれることを確認

2. `restartSession: リサイズ情報が未設定でもエラーにならない`
   - セッション作成後、resize()を呼ばずにrestartSession()を実行
   - エラーなく新セッションが作成されることを確認

**受入基準:**
- テストが正しく失敗する（RED段階）

## TASK-004: restartSessionのリサイズ情報保存・復元（実装）

**ファイル:** `src/services/adapters/docker-adapter.ts`

**変更箇所:** `restartSession()`メソッド（行511-539付近）

**変更内容:**
1. destroySession前に`lastKnownCols`/`lastKnownRows`を退避
2. `restoreResizeInfo()`プライベートメソッドを追加
3. createSession完了後にrestoreResizeInfoを呼び出し

**受入基準:**
- TASK-003のテストがパスする（GREEN段階）
- 既存のrestartSessionテストもパスする

## TASK-005: WebSocketリサイズメッセージの早期バッファリング（テスト）

**ファイル:** `src/lib/websocket/__tests__/claude-ws.test.ts`（既存ファイル、またはなければ新規作成を検討）

**テスト追加:**

1. `WebSocket接続直後のリサイズメッセージがバッファされ、セッション準備後に適用される`

**注意:** WebSocketハンドラーは外部依存が多いため、統合テストレベルでの検証が現実的。
DockerAdapterレベルでの修正（TASK-001/002/003/004）で十分カバーできる場合はスキップ可。

**受入基準:**
- テストが作成される、またはスキップ判断の根拠が記録される

## TASK-006: WebSocketリサイズメッセージの早期バッファリング（実装）

**ファイル:** `src/lib/websocket/claude-ws.ts`

**変更箇所:** `setupClaudeWebSocket()`内のconnectionハンドラー

**変更内容:**
1. `ws.on('message', ...)`を非同期処理の前に移動
2. `pendingResize`変数でリサイズをバッファリング
3. `sessionReady`フラグでセッション準備状態を管理
4. セッション準備完了後にバッファされたリサイズを適用

**受入基準:**
- 接続直後のリサイズメッセージが消失しない
- 既存のメッセージ処理（input, restart, paste-image）に影響しない

## TASK-007: 全テスト実行・動作確認

**コマンド:**
```bash
npx vitest run src/services/adapters/__tests__/docker-adapter.test.ts
npm test
```

**受入基準:**
- DockerAdapterテストが全パス
- 全テストスイートが既知の失敗以外でパス
