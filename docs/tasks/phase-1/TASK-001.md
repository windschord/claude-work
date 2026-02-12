# TASK-001: ConnectionManagerの拡張

## 基本情報

- **タスクID**: TASK-001
- **フェーズ**: Phase 1 - WebSocket接続管理の統一
- **優先度**: 最高
- **推定工数**: 50分
- **ステータス**: IN_PROGRESS
- **担当者**: 未割り当て

## 概要

ConnectionManagerに新しいメソッドを追加し、セッションIDをキーとした接続プール管理、ブロードキャスト機能、イベントハンドラー管理機能を実装します。既存のSession WebSocket実装を参考に、すべてのWebSocketタイプで使用できるように拡張します。

## 要件マッピング

| 要件ID | 内容 |
|-------|------|
| REQ-001-001 | 接続プールの管理 |
| REQ-001-003 | ブロードキャスト配信 |
| REQ-001-005 | 接続の削除 |
| REQ-001-007 | ConnectionManagerの統一使用 |

## 技術的文脈

- **ファイルパス**: `src/lib/websocket/connection-manager.ts`
- **フレームワーク**: Node.js, TypeScript
- **ライブラリ**: ws (WebSocket), EventEmitter
- **参照すべき既存コード**:
  - `src/lib/websocket/session-ws.ts` (既存のConnectionManager使用例)
  - `src/lib/websocket/scrollback-buffer.ts` (スクロールバックバッファ)
- **設計書**: [docs/design/components/connection-manager.md](../../design/components/connection-manager.md) @../../design/components/connection-manager.md

## 情報の明確性

| 分類 | 内容 |
|------|------|
| **明示された情報** | - ConnectionManagerに接続プール管理機能を追加<br>- セッションIDをキーとしたMap<string, Set<WebSocket>>で管理<br>- broadcast()メソッドで全接続に送信<br>- registerHandler()でイベントハンドラー管理<br>- 既存のSession WebSocket実装は変更しない（後方互換性） |
| **不明/要確認の情報** | - なし（設計書で詳細に定義済み） |

## 実装手順（TDD）

### ステップ1: テスト作成

```bash
# テストファイルを作成
touch src/lib/websocket/__tests__/connection-manager.test.ts
```

以下のテストケースを作成：

1. **接続プール管理のテスト**
   - addConnection()で接続が追加される
   - removeConnection()で接続が削除される
   - getConnectionCount()が正しい接続数を返す
   - hasConnections()が正しく動作する

2. **ブロードキャストのテスト**
   - broadcast()が全接続にメッセージを送信する
   - 接続がOPEN状態でない場合はスキップする
   - 送信エラーが発生しても他の接続に影響しない

3. **イベントハンドラー管理のテスト**
   - registerHandler()でハンドラーが登録される
   - 同じイベントに複数回登録すると警告が出る
   - unregisterHandler()でハンドラーが削除される
   - hasHandler()が正しく動作する

4. **スクロールバックバッファのテスト**
   - setScrollbackBuffer()でバッファが設定される
   - sendScrollbackToConnection()が新規接続にバッファを送信する

5. **クリーンアップのテスト**
   - cleanup()で接続プール、ハンドラー、バッファが削除される

6. **パフォーマンステスト**
   - broadcast()が100ms以内に完了する（NFR-PERF-001）

### ステップ2: テスト実行（失敗確認）

```bash
npm test -- src/lib/websocket/__tests__/connection-manager.test.ts
```

すべてのテストが失敗することを確認します。

### ステップ3: テストコミット

```bash
git add src/lib/websocket/__tests__/connection-manager.test.ts
git commit -m "test(TASK-001): add ConnectionManager extension tests

- Add connection pool management tests
- Add broadcast functionality tests
- Add event handler management tests
- Add scrollback buffer tests
- Add cleanup tests
- Add performance tests (< 100ms)"
```

### ステップ4: 実装

`src/lib/websocket/connection-manager.ts`に以下を追加：

1. **内部データ構造の拡張**
   ```typescript
   private connectionPools: Map<string, Set<WebSocket>> = new Map()
   private scrollbackBuffers: Map<string, ScrollbackBuffer> = new Map()
   private eventHandlers: Map<string, Map<string, Function>> = new Map()
   private metrics: ConnectionMetrics = {
     totalConnections: 0,
     activeConnections: 0,
     messagesSent: 0,
     messagesDropped: 0
   }
   ```

2. **新しいメソッドの実装**
   - `addConnection(sessionId: string, ws: WebSocket): void`
   - `removeConnection(sessionId: string, ws: WebSocket): void`
   - `getConnections(sessionId: string): Set<WebSocket>`
   - `hasConnections(sessionId: string): boolean`
   - `getConnectionCount(sessionId: string): number`
   - `broadcast(sessionId: string, message: string | Buffer): void`
   - `sendToConnection(ws: WebSocket, message: string | Buffer): void`
   - `setScrollbackBuffer(sessionId: string, buffer: ScrollbackBuffer): void`
   - `sendScrollbackToConnection(sessionId: string, ws: WebSocket): void`
   - `registerHandler(sessionId: string, eventName: string, handler: Function): void`
   - `unregisterHandler(sessionId: string, eventName: string): void`
   - `hasHandler(sessionId: string, eventName: string): boolean`
   - `cleanup(sessionId: string): void`
   - `getMetrics(): ConnectionMetrics`

3. **イベント発火**
   - `allConnectionsClosed`イベント: 最後の接続が切断された時

### ステップ5: テスト実行（通過確認）

```bash
npm test -- src/lib/websocket/__tests__/connection-manager.test.ts
```

すべてのテストが通過することを確認します。

### ステップ6: 実装コミット

```bash
git add src/lib/websocket/connection-manager.ts
git commit -m "feat(TASK-001): extend ConnectionManager for unified WebSocket management

- Add connection pool management (Map<sessionId, Set<WebSocket>>)
- Add broadcast() method for sending to all connections
- Add event handler management (registerHandler/unregisterHandler)
- Add scrollback buffer management
- Add cleanup() method for resource cleanup
- Add metrics collection
- Emit 'allConnectionsClosed' event when last connection closes

Implements: REQ-001-001, REQ-001-003, REQ-001-005, REQ-001-007

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/lib/websocket/connection-manager.ts`に新しいメソッドが実装されている
- [ ] TypeScriptの型定義が含まれている
- [ ] `src/lib/websocket/__tests__/connection-manager.test.ts`にテストが6カテゴリ以上ある
- [ ] `npm test`で全テストが通過する
- [ ] ESLintエラーがゼロ
- [ ] broadcast()が100ms以内に完了する（10接続の場合）
- [ ] 既存のSession WebSocket実装が破壊されていない
- [ ] 後方互換性が維持されている

## 検証方法

### 単体テスト実行

```bash
npm test -- src/lib/websocket/__tests__/connection-manager.test.ts --coverage
```

カバレッジが85%以上であることを確認。

### Lint実行

```bash
npm run lint -- src/lib/websocket/connection-manager.ts
```

エラーがゼロであることを確認。

### 既存テストの実行

```bash
npm test -- src/lib/websocket/__tests__/session-ws.test.ts
```

既存のSession WebSocketテストが通過することを確認（後方互換性）。

## 依存関係

### 前提条件
- なし（最初のタスク）

### 後続タスク
- TASK-002: Claude WebSocketのConnectionManager統合
- TASK-003: Terminal WebSocketのConnectionManager統合

## トラブルシューティング

### よくある問題

1. **WebSocket状態エラー**
   - 問題: ws.readyState !== WebSocket.OPEN
   - 解決: broadcast()内で状態をチェックし、OPEN以外はスキップ

2. **メモリリーク**
   - 問題: 接続が削除されてもSetに残る
   - 解決: removeConnection()で確実にSet.delete()を呼ぶ

3. **イベントハンドラー重複**
   - 問題: registerHandler()が複数回呼ばれる
   - 解決: 既存のハンドラーを上書きし、警告ログを出力

## パフォーマンス最適化

### ブロードキャストの最適化

```typescript
// 将来の最適化: 小さいメッセージはバッファリング
private shouldBuffer(message: string | Buffer): boolean {
  const size = Buffer.byteLength(message)
  return size < 1024 // 1KB未満
}
```

## 参照

- [要件定義: US-001](../../requirements/stories/US-001.md) @../../requirements/stories/US-001.md
- [設計: ConnectionManager](../../design/components/connection-manager.md) @../../design/components/connection-manager.md
- [設計決定: DEC-001](../../design/decisions/DEC-001.md) @../../design/decisions/DEC-001.md
- [設計決定: DEC-003](../../design/decisions/DEC-003.md) @../../design/decisions/DEC-003.md
