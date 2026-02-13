# ConnectionManager: WebSocket接続プール管理

## 概要

ConnectionManagerは、WebSocket接続のライフサイクルを管理し、PTYセッションと複数のWebSocket接続の1:N関係を実現するコンポーネントです。既存の実装を拡張し、Session WebSocketだけでなく、Claude WebSocketとTerminal WebSocketもサポートします。

## 要件マッピング

このコンポーネントは以下の要件を満たします：

| 要件ID | 内容 | 実装方法 |
|-------|------|---------|
| REQ-001-001 | 接続プールの管理 | セッションIDをキーとしたMap<string, Set<WebSocket>> |
| REQ-001-003 | ブロードキャスト配信 | broadcast()メソッドで全接続に送信 |
| REQ-001-005 | 接続の削除 | removeConnection()でSetから削除 |
| REQ-001-007 | ConnectionManagerの統一使用 | すべてのWebSocketハンドラーから使用 |

## 責務

1. **接続プール管理**: セッションIDごとに接続のSetを管理
2. **ブロードキャスト**: PTYからの出力を全接続に配信
3. **接続追加/削除**: 接続のライフサイクル管理
4. **スクロールバックバッファ送信**: 新規接続時にバッファを送信

## インターフェース

### 型定義

```typescript
export interface IConnectionManager {
  // 接続プールの管理
  addConnection(sessionId: string, ws: WebSocket): void
  removeConnection(sessionId: string, ws: WebSocket): void
  getConnections(sessionId: string): Set<WebSocket>
  hasConnections(sessionId: string): boolean
  getConnectionCount(sessionId: string): number

  // メッセージ送信
  broadcast(sessionId: string, message: string | Buffer): void
  sendToConnection(ws: WebSocket, message: string | Buffer): void

  // スクロールバックバッファ管理
  setScrollbackBuffer(sessionId: string, buffer: ScrollbackBuffer): void
  sendScrollbackToConnection(sessionId: string, ws: WebSocket): void

  // イベントハンドラー管理
  registerHandler(sessionId: string, eventName: string, handler: Function): void
  unregisterHandler(sessionId: string, eventName: string): void
  hasHandler(sessionId: string, eventName: string): boolean

  // クリーンアップ
  cleanup(sessionId: string): void
}
```

### 内部データ構造

```typescript
class ConnectionManager implements IConnectionManager {
  // セッションIDごとの接続プール
  private connectionPools: Map<string, Set<WebSocket>> = new Map()

  // セッションIDごとのスクロールバックバッファ
  private scrollbackBuffers: Map<string, ScrollbackBuffer> = new Map()

  // セッションIDごとのイベントハンドラー
  // 各セッションにつき1つのハンドラーのみ登録
  private eventHandlers: Map<string, Map<string, Function>> = new Map()

  // メトリクス収集
  private metrics: ConnectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    messagesSent: 0,
    messagesDropped: 0
  }
}
```

## 主要メソッド

### addConnection

新しいWebSocket接続を接続プールに追加します。

```typescript
addConnection(sessionId: string, ws: WebSocket): void {
  // 接続プールの取得または作成
  if (!this.connectionPools.has(sessionId)) {
    this.connectionPools.set(sessionId, new Set())
  }

  const pool = this.connectionPools.get(sessionId)!
  pool.add(ws)

  // メトリクス更新
  this.metrics.totalConnections++
  this.metrics.activeConnections++

  logger.debug(`Connection added to session ${sessionId}, total: ${pool.size}`)

  // 接続エラー/クローズのハンドラー設定
  ws.on('error', () => this.handleConnectionError(sessionId, ws))
  ws.on('close', () => this.removeConnection(sessionId, ws))

  // スクロールバックバッファを送信
  this.sendScrollbackToConnection(sessionId, ws)
}
```

### removeConnection

WebSocket接続を接続プールから削除します。

```typescript
removeConnection(sessionId: string, ws: WebSocket): void {
  const pool = this.connectionPools.get(sessionId)
  if (!pool) {
    logger.warn(`No connection pool for session ${sessionId}`)
    return
  }

  const removed = pool.delete(ws)
  if (removed) {
    this.metrics.activeConnections--
    logger.debug(`Connection removed from session ${sessionId}, remaining: ${pool.size}`)
  }

  // 接続が0になったらイベントを発火
  if (pool.size === 0) {
    this.emit('allConnectionsClosed', sessionId)

    // 接続プールとハンドラーをクリーンアップ
    this.connectionPools.delete(sessionId)
    this.eventHandlers.delete(sessionId)
    this.scrollbackBuffers.delete(sessionId)
  }
}
```

### broadcast

PTYからの出力を接続プール内の全WebSocket接続にブロードキャストします。

```typescript
broadcast(sessionId: string, message: string | Buffer): void {
  const pool = this.connectionPools.get(sessionId)
  if (!pool || pool.size === 0) {
    logger.warn(`No active connections for session ${sessionId}`)
    return
  }

  const startTime = performance.now()
  let successCount = 0
  let failureCount = 0

  // 全接続に送信
  for (const ws of pool) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message)
        successCount++
      } else {
        logger.warn(`WebSocket not open for session ${sessionId}, state: ${ws.readyState}`)
        failureCount++
      }
    } catch (error) {
      logger.error(`Failed to send message to connection:`, error)
      failureCount++
      this.metrics.messagesDropped++
    }
  }

  const duration = performance.now() - startTime
  this.metrics.messagesSent += successCount

  // パフォーマンス監視（NFR-PERF-001: < 100ms）
  if (duration > 100) {
    logger.warn(`Broadcast took ${duration}ms for ${pool.size} connections`)
  }

  logger.debug(`Broadcast to session ${sessionId}: ${successCount} sent, ${failureCount} failed, ${duration}ms`)
}
```

### sendScrollbackToConnection

新規接続に対してスクロールバックバッファを送信します。

```typescript
sendScrollbackToConnection(sessionId: string, ws: WebSocket): void {
  const buffer = this.scrollbackBuffers.get(sessionId)
  if (!buffer) {
    logger.debug(`No scrollback buffer for session ${sessionId}`)
    return
  }

  try {
    const content = buffer.getContent()
    if (content && ws.readyState === WebSocket.OPEN) {
      ws.send(content)
      logger.debug(`Sent scrollback buffer to connection (${content.length} bytes)`)
    }
  } catch (error) {
    logger.error(`Failed to send scrollback buffer:`, error)
  }
}
```

### registerHandler / unregisterHandler

PTYのイベントハンドラーをセッション単位で管理します。

```typescript
registerHandler(sessionId: string, eventName: string, handler: Function): void {
  if (!this.eventHandlers.has(sessionId)) {
    this.eventHandlers.set(sessionId, new Map())
  }

  const handlers = this.eventHandlers.get(sessionId)!

  // 既存のハンドラーがあれば警告
  if (handlers.has(eventName)) {
    logger.warn(`Handler for ${eventName} already registered for session ${sessionId}, overwriting`)
  }

  handlers.set(eventName, handler)
  logger.debug(`Registered ${eventName} handler for session ${sessionId}`)
}

unregisterHandler(sessionId: string, eventName: string): void {
  const handlers = this.eventHandlers.get(sessionId)
  if (!handlers) {
    return
  }

  handlers.delete(eventName)
  logger.debug(`Unregistered ${eventName} handler for session ${sessionId}`)

  // ハンドラーが空になったら削除
  if (handlers.size === 0) {
    this.eventHandlers.delete(sessionId)
  }
}

hasHandler(sessionId: string, eventName: string): boolean {
  const handlers = this.eventHandlers.get(sessionId)
  return handlers?.has(eventName) ?? false
}
```

## エラーハンドリング

### 接続エラー

```typescript
private handleConnectionError(sessionId: string, ws: WebSocket): void {
  logger.error(`WebSocket error for session ${sessionId}`)

  // エラーが発生した接続を削除
  this.removeConnection(sessionId, ws)
}
```

### 送信エラー

```typescript
// broadcast()内で個別にエラーハンドリング
// 1つの接続の失敗が他の接続に影響しないように
try {
  ws.send(message)
} catch (error) {
  logger.error(`Failed to send message:`, error)
  this.metrics.messagesDropped++
  // 接続を削除せず、次回の送信で再試行
}
```

## パフォーマンス最適化

### 1. ブロードキャストの最適化

```typescript
// 小さなメッセージはバッファリング（将来の最適化）
private shouldBuffer(message: string | Buffer): boolean {
  const size = Buffer.byteLength(message)
  return size < 1024 // 1KB未満はバッファリング
}

// バッファリングされたメッセージを一括送信
private flushBuffer(sessionId: string): void {
  // 実装は将来の最適化タスクで
}
```

### 2. 接続プールのキャッシュ

```typescript
// Map検索を最小化
// getConnectionCount()などでキャッシュを活用
```

### 3. メトリクスの収集

```typescript
interface ConnectionMetrics {
  totalConnections: number
  activeConnections: number
  messagesSent: number
  messagesDropped: number
  averageBroadcastTime: number
  maxBroadcastTime: number
}

getMetrics(): ConnectionMetrics {
  return { ...this.metrics }
}
```

## テスト戦略

### 単体テスト

```typescript
describe('ConnectionManager', () => {
  describe('addConnection', () => {
    it('should add connection to pool', () => {
      const manager = new ConnectionManager()
      const ws = createMockWebSocket()

      manager.addConnection('session1', ws)

      expect(manager.getConnectionCount('session1')).toBe(1)
    })

    it('should send scrollback buffer to new connection', () => {
      const manager = new ConnectionManager()
      const ws = createMockWebSocket()
      const buffer = new ScrollbackBuffer()
      buffer.append('test output')

      manager.setScrollbackBuffer('session1', buffer)
      manager.addConnection('session1', ws)

      expect(ws.send).toHaveBeenCalledWith('test output')
    })
  })

  describe('broadcast', () => {
    it('should send message to all connections', () => {
      const manager = new ConnectionManager()
      const ws1 = createMockWebSocket()
      const ws2 = createMockWebSocket()

      manager.addConnection('session1', ws1)
      manager.addConnection('session1', ws2)

      manager.broadcast('session1', 'test message')

      expect(ws1.send).toHaveBeenCalledWith('test message')
      expect(ws2.send).toHaveBeenCalledWith('test message')
    })

    it('should complete within 100ms (NFR-PERF-001)', () => {
      const manager = new ConnectionManager()
      // 10個の接続を追加
      for (let i = 0; i < 10; i++) {
        manager.addConnection('session1', createMockWebSocket())
      }

      const startTime = performance.now()
      manager.broadcast('session1', 'test message')
      const duration = performance.now() - startTime

      expect(duration).toBeLessThan(100)
    })
  })

  describe('removeConnection', () => {
    it('should remove connection from pool', () => {
      const manager = new ConnectionManager()
      const ws = createMockWebSocket()

      manager.addConnection('session1', ws)
      manager.removeConnection('session1', ws)

      expect(manager.getConnectionCount('session1')).toBe(0)
    })

    it('should emit allConnectionsClosed when last connection removed', () => {
      const manager = new ConnectionManager()
      const ws = createMockWebSocket()
      const handler = jest.fn()

      manager.on('allConnectionsClosed', handler)
      manager.addConnection('session1', ws)
      manager.removeConnection('session1', ws)

      expect(handler).toHaveBeenCalledWith('session1')
    })
  })
})
```

### 統合テスト

```typescript
describe('ConnectionManager Integration', () => {
  it('should handle multiple sessions independently', async () => {
    const manager = new ConnectionManager()

    // セッション1に2つの接続
    const ws1a = await createRealWebSocket('/ws/claude/session1')
    const ws1b = await createRealWebSocket('/ws/claude/session1')

    // セッション2に1つの接続
    const ws2a = await createRealWebSocket('/ws/claude/session2')

    manager.addConnection('session1', ws1a)
    manager.addConnection('session1', ws1b)
    manager.addConnection('session2', ws2a)

    // セッション1へのブロードキャストはセッション2に影響しない
    manager.broadcast('session1', 'message for session1')

    expect(ws1a.receivedMessages).toContain('message for session1')
    expect(ws1b.receivedMessages).toContain('message for session1')
    expect(ws2a.receivedMessages).not.toContain('message for session1')
  })
})
```

## マイグレーションパス

既存のSession WebSocketハンドラーは既にConnectionManagerを使用しています。以下の順序でマイグレーションします：

1. **ConnectionManagerの拡張**: 新しいメソッドを追加（後方互換性を維持）
2. **claude-ws.tsの移行**: ConnectionManagerを使用するように変更
3. **terminal-ws.tsの移行**: ConnectionManagerを使用するように変更
4. **テストの追加**: 各ハンドラーのテストを追加
5. **統合テスト**: すべてのWebSocketタイプの統合テスト

## 参照

- [要件定義: US-001](../../requirements/stories/US-001.md) @../../requirements/stories/US-001.md
- [設計決定: DEC-001](../decisions/DEC-001.md) @../decisions/DEC-001.md
- [設計決定: DEC-003](../decisions/DEC-003.md) @../decisions/DEC-003.md
- [PTYSessionManager](pty-session-manager.md) @pty-session-manager.md
