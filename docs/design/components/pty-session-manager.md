# PTYSessionManager: PTYセッション統合管理

## 概要

PTYSessionManagerは、PTYセッションのライフサイクル全体を統合管理する新しいコンポーネントです。これまで分散していたClaudePTYManager、PTYManager、接続管理ロジックを統合し、セッション管理を一元化します。

## 要件マッピング

このコンポーネントは以下の要件を満たします：

| 要件ID | 内容 | 実装方法 |
|-------|------|---------|
| REQ-002-001 | セッションの作成 | createSession()メソッド |
| REQ-002-002 | セッションの取得 | getSession()メソッド |
| REQ-002-003 | セッションの破棄 | destroySession()メソッド |
| REQ-002-004 | 状態の一元管理 | Map<string, PTYSession>で管理 |
| REQ-002-005 | ライフサイクルイベント | EventEmitterで通知 |
| REQ-002-006 | 環境アダプターの統合 | AdapterFactoryから取得 |
| REQ-002-007 | WebSocketハンドラーの簡素化 | PTYSessionManager経由でアクセス |

## 責務

1. **セッションライフサイクル管理**: 作成、取得、破棄
2. **環境アダプターの選択**: AdapterFactoryとの連携
3. **接続プールの管理**: ConnectionManagerとの連携
4. **イベントハンドラーの登録**: PTYのイベント処理
5. **状態の一元管理**: セッション状態のマップ管理
6. **ライフサイクルイベント**: セッション作成・破棄のイベント発火

## アーキテクチャ

### クラス図

```typescript
┌─────────────────────────────────────────┐
│     PTYSessionManager (Singleton)       │
├─────────────────────────────────────────┤
│ - sessions: Map<string, PTYSession>     │
│ - connectionManager: ConnectionManager  │
│ - adapterFactory: AdapterFactory        │
│ - prisma: PrismaClient                  │
├─────────────────────────────────────────┤
│ + createSession(options): Promise       │
│ + getSession(id): PTYSession            │
│ + destroySession(id): Promise           │
│ + listSessions(): string[]              │
│ + addConnection(id, ws): void           │
│ + removeConnection(id, ws): void        │
│ + handlePTYData(id, data): void         │
│ + handlePTYExit(id, code): void         │
└─────────────────────────────────────────┘
         |                    |
         | 1:N                | uses
         v                    v
┌──────────────┐    ┌───────────────────┐
│  PTYSession  │    │ ConnectionManager │
└──────────────┘    └───────────────────┘
         |
         | uses
         v
┌────────────────┐
│ EnvironmentAdapter │
│  (Host/Docker) │
└────────────────┘
```

### データ構造

```typescript
interface PTYSession {
  id: string
  pty: IPty
  adapter: EnvironmentAdapter
  environmentType: 'HOST' | 'DOCKER' | 'SSH'
  metadata: SessionMetadata
  createdAt: Date
  lastActiveAt: Date
}

interface SessionMetadata {
  projectId: string
  branchName: string
  worktreePath: string
  containerID?: string
  environmentId: string
}

interface SessionOptions {
  sessionId: string
  projectId: string
  branchName: string
  worktreePath: string
  environmentId: string
  cols?: number
  rows?: number
}
```

## インターフェース

### IPTYSessionManager

```typescript
export interface IPTYSessionManager extends EventEmitter {
  // セッション管理
  createSession(options: SessionOptions): Promise<PTYSession>
  getSession(sessionId: string): PTYSession | undefined
  destroySession(sessionId: string): Promise<void>
  listSessions(): string[]
  hasSession(sessionId: string): boolean

  // 接続管理（ConnectionManagerへの委譲）
  addConnection(sessionId: string, ws: WebSocket): void
  removeConnection(sessionId: string, ws: WebSocket): void
  getConnectionCount(sessionId: string): number

  // PTYインタラクション
  sendInput(sessionId: string, data: string): void
  resize(sessionId: string, cols: number, rows: number): void

  // ライフサイクルイベント
  on(event: 'sessionCreated', listener: (sessionId: string) => void): this
  on(event: 'sessionDestroyed', listener: (sessionId: string) => void): this
  on(event: 'sessionError', listener: (sessionId: string, error: Error) => void): this
}
```

## 実装

### シングルトンパターン

```typescript
export class PTYSessionManager extends EventEmitter implements IPTYSessionManager {
  private static instance: PTYSessionManager

  private sessions: Map<string, PTYSession> = new Map()
  private connectionManager: ConnectionManager
  private adapterFactory: AdapterFactory
  private prisma: PrismaClient

  private constructor() {
    super()
    this.connectionManager = ConnectionManager.getInstance()
    this.adapterFactory = AdapterFactory.getInstance()
    this.prisma = db
  }

  public static getInstance(): PTYSessionManager {
    if (!PTYSessionManager.instance) {
      PTYSessionManager.instance = new PTYSessionManager()
    }
    return PTYSessionManager.instance
  }
}
```

### createSession

セッションを作成し、PTYとアダプターを初期化します。

```typescript
async createSession(options: SessionOptions): Promise<PTYSession> {
  const { sessionId, projectId, environmentId, worktreePath, cols, rows } = options

  // 既存セッションのチェック
  if (this.sessions.has(sessionId)) {
    throw new Error(`Session ${sessionId} already exists`)
  }

  logger.info(`Creating session ${sessionId} for environment ${environmentId}`)

  try {
    // 環境情報を取得
    const environment = await this.prisma.executionEnvironment.findUnique({
      where: { id: environmentId }
    })

    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`)
    }

    // アダプターを取得
    const adapter = await this.adapterFactory.getAdapter(environment.type)

    // PTYを作成
    const pty = await adapter.spawn({
      sessionId,
      cwd: worktreePath,
      cols: cols || 80,
      rows: rows || 24,
      environmentId
    })

    // セッション情報を作成
    const session: PTYSession = {
      id: sessionId,
      pty,
      adapter,
      environmentType: environment.type as 'HOST' | 'DOCKER' | 'SSH',
      metadata: {
        projectId,
        branchName: options.branchName,
        worktreePath,
        environmentId
      },
      createdAt: new Date(),
      lastActiveAt: new Date()
    }

    // セッションを登録
    this.sessions.set(sessionId, session)

    // PTYイベントハンドラーを登録（セッションごとに1つ）
    this.registerPTYHandlers(sessionId, pty)

    // ConnectionManagerにスクロールバックバッファを設定
    const buffer = new ScrollbackBuffer()
    this.connectionManager.setScrollbackBuffer(sessionId, buffer)

    // データベースに記録
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'ACTIVE',
        last_active_at: new Date()
      }
    })

    // イベントを発火
    this.emit('sessionCreated', sessionId)

    logger.info(`Session ${sessionId} created successfully`)
    return session
  } catch (error) {
    logger.error(`Failed to create session ${sessionId}:`, error)

    // 部分的に作成されたリソースをクリーンアップ
    await this.cleanupFailedSession(sessionId)

    throw error
  }
}
```

### registerPTYHandlers

PTYのイベントハンドラーをセッション単位で登録します（重要：1セッション1ハンドラー）。

```typescript
private registerPTYHandlers(sessionId: string, pty: IPty): void {
  // データハンドラー（出力）
  const dataHandler = (data: string) => {
    this.handlePTYData(sessionId, data)
  }

  // 終了ハンドラー
  const exitHandler = (exitCode: { exitCode: number; signal?: number }) => {
    this.handlePTYExit(sessionId, exitCode.exitCode)
  }

  // ハンドラーを登録
  pty.onData(dataHandler)
  pty.onExit(exitHandler)

  // ConnectionManagerに登録情報を記録
  this.connectionManager.registerHandler(sessionId, 'data', dataHandler)
  this.connectionManager.registerHandler(sessionId, 'exit', exitHandler)

  logger.debug(`Registered PTY handlers for session ${sessionId}`)
}
```

### handlePTYData

PTYからの出力を処理し、スクロールバックバッファに追加してからブロードキャストします。

```typescript
private handlePTYData(sessionId: string, data: string): void {
  const session = this.sessions.get(sessionId)
  if (!session) {
    logger.warn(`Received data for unknown session ${sessionId}`)
    return
  }

  // 最終アクティブ時刻を更新
  session.lastActiveAt = new Date()

  // スクロールバックバッファに追加
  const buffer = this.connectionManager.getScrollbackBuffer(sessionId)
  if (buffer) {
    buffer.append(data)
  }

  // 全接続にブロードキャスト
  this.connectionManager.broadcast(sessionId, data)

  // データベースの最終アクティブ時刻を更新（非同期、待機しない）
  this.updateLastActiveTime(sessionId).catch(error => {
    logger.error(`Failed to update last_active_at for ${sessionId}:`, error)
  })
}
```

### destroySession

セッションを破棄し、すべてのリソースをクリーンアップします。

```typescript
async destroySession(sessionId: string): Promise<void> {
  const session = this.sessions.get(sessionId)
  if (!session) {
    logger.warn(`Session ${sessionId} not found for destruction`)
    return
  }

  logger.info(`Destroying session ${sessionId}`)

  try {
    // 全接続を切断
    const connections = this.connectionManager.getConnections(sessionId)
    for (const ws of connections) {
      try {
        ws.close(1000, 'Session destroyed')
      } catch (error) {
        logger.error(`Failed to close connection:`, error)
      }
    }

    // ConnectionManagerのクリーンアップ
    this.connectionManager.cleanup(sessionId)

    // PTYを終了
    try {
      session.pty.kill()
    } catch (error) {
      logger.error(`Failed to kill PTY for ${sessionId}:`, error)
    }

    // アダプターのクリーンアップ
    try {
      await session.adapter.cleanup(sessionId)
    } catch (error) {
      logger.error(`Failed to cleanup adapter for ${sessionId}:`, error)
    }

    // セッションをマップから削除
    this.sessions.delete(sessionId)

    // データベースを更新
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'TERMINATED',
        active_connections: 0
      }
    })

    // イベントを発火
    this.emit('sessionDestroyed', sessionId)

    logger.info(`Session ${sessionId} destroyed successfully`)
  } catch (error) {
    logger.error(`Error during session ${sessionId} destruction:`, error)
    this.emit('sessionError', sessionId, error as Error)
    throw error
  }
}
```

### 接続管理メソッド（ConnectionManagerへの委譲）

```typescript
addConnection(sessionId: string, ws: WebSocket): void {
  const session = this.sessions.get(sessionId)
  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }

  // ConnectionManagerに委譲
  this.connectionManager.addConnection(sessionId, ws)

  // データベースの接続数を更新
  this.updateConnectionCount(sessionId).catch(error => {
    logger.error(`Failed to update connection count:`, error)
  })
}

removeConnection(sessionId: string, ws: WebSocket): void {
  this.connectionManager.removeConnection(sessionId, ws)

  // データベースの接続数を更新
  this.updateConnectionCount(sessionId).catch(error => {
    logger.error(`Failed to update connection count:`, error)
  })
}

getConnectionCount(sessionId: string): number {
  return this.connectionManager.getConnectionCount(sessionId)
}
```

### PTYインタラクションメソッド

```typescript
sendInput(sessionId: string, data: string): void {
  const session = this.sessions.get(sessionId)
  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }

  session.pty.write(data)
  session.lastActiveAt = new Date()
}

resize(sessionId: string, cols: number, rows: number): void {
  const session = this.sessions.get(sessionId)
  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }

  session.pty.resize(cols, rows)
  logger.debug(`Resized session ${sessionId} to ${cols}x${rows}`)
}
```

## エラーハンドリング

### セッション作成失敗時のクリーンアップ

```typescript
private async cleanupFailedSession(sessionId: string): Promise<void> {
  try {
    // 部分的に作成されたリソースを削除
    const session = this.sessions.get(sessionId)
    if (session) {
      // PTYが存在すれば終了
      if (session.pty) {
        try {
          session.pty.kill()
        } catch (error) {
          logger.error(`Failed to kill PTY during cleanup:`, error)
        }
      }

      // アダプターのクリーンアップ
      if (session.adapter) {
        try {
          await session.adapter.cleanup(sessionId)
        } catch (error) {
          logger.error(`Failed to cleanup adapter during cleanup:`, error)
        }
      }

      this.sessions.delete(sessionId)
    }

    // ConnectionManagerのクリーンアップ
    this.connectionManager.cleanup(sessionId)

    // データベースの状態を更新
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: 'ERROR' }
    })
  } catch (error) {
    logger.error(`Error during failed session cleanup:`, error)
  }
}
```

### PTY終了時の処理

```typescript
private handlePTYExit(sessionId: string, exitCode: number): void {
  logger.info(`PTY exited for session ${sessionId} with code ${exitCode}`)

  const session = this.sessions.get(sessionId)
  if (!session) {
    logger.warn(`PTY exit for unknown session ${sessionId}`)
    return
  }

  // 接続中のクライアントに通知
  this.connectionManager.broadcast(sessionId, JSON.stringify({
    type: 'exit',
    exitCode
  }))

  // セッションを破棄（非同期）
  this.destroySession(sessionId).catch(error => {
    logger.error(`Failed to destroy session after PTY exit:`, error)
  })
}
```

## テスト戦略

### 単体テスト

```typescript
describe('PTYSessionManager', () => {
  let manager: PTYSessionManager

  beforeEach(() => {
    // シングルトンをリセット（テスト用）
    manager = PTYSessionManager.getInstance()
  })

  describe('createSession', () => {
    it('should create a new session', async () => {
      const options: SessionOptions = {
        sessionId: 'test-session',
        projectId: 'project1',
        branchName: 'main',
        worktreePath: '/path/to/worktree',
        environmentId: 'env1'
      }

      const session = await manager.createSession(options)

      expect(session.id).toBe('test-session')
      expect(manager.hasSession('test-session')).toBe(true)
    })

    it('should throw error if session already exists', async () => {
      const options: SessionOptions = { /* ... */ }

      await manager.createSession(options)

      await expect(manager.createSession(options)).rejects.toThrow('already exists')
    })

    it('should register PTY handlers only once', async () => {
      const options: SessionOptions = { /* ... */ }
      const session = await manager.createSession(options)

      const hasDataHandler = manager.hasHandler(session.id, 'data')
      const hasExitHandler = manager.hasHandler(session.id, 'exit')

      expect(hasDataHandler).toBe(true)
      expect(hasExitHandler).toBe(true)
    })
  })

  describe('destroySession', () => {
    it('should destroy session and cleanup resources', async () => {
      const options: SessionOptions = { /* ... */ }
      const session = await manager.createSession(options)

      await manager.destroySession(session.id)

      expect(manager.hasSession(session.id)).toBe(false)
    })

    it('should handle PTY kill error gracefully', async () => {
      const options: SessionOptions = { /* ... */ }
      const session = await manager.createSession(options)

      // PTYのkillをモックしてエラーを投げる
      jest.spyOn(session.pty, 'kill').mockImplementation(() => {
        throw new Error('Kill failed')
      })

      // エラーが発生してもdestroySessionは成功する
      await expect(manager.destroySession(session.id)).resolves.not.toThrow()
    })
  })
})
```

### 統合テスト

```typescript
describe('PTYSessionManager Integration', () => {
  it('should handle session lifecycle', async () => {
    const manager = PTYSessionManager.getInstance()

    // セッション作成
    const session = await manager.createSession({ /* ... */ })

    // 接続追加
    const ws = createMockWebSocket()
    manager.addConnection(session.id, ws)

    // PTY入力
    manager.sendInput(session.id, 'echo hello\n')

    // 出力を受信
    await waitFor(() => {
      expect(ws.receivedMessages).toContain('hello')
    })

    // セッション破棄
    await manager.destroySession(session.id)

    expect(manager.hasSession(session.id)).toBe(false)
  })
})
```

## 参照

- [要件定義: US-002](../../requirements/stories/US-002.md) @../../requirements/stories/US-002.md
- [設計決定: DEC-002](../decisions/DEC-002.md) @../decisions/DEC-002.md
- [設計決定: DEC-003](../decisions/DEC-003.md) @../decisions/DEC-003.md
- [ConnectionManager](connection-manager.md) @connection-manager.md
- [DockerAdapter](docker-adapter.md) @docker-adapter.md
