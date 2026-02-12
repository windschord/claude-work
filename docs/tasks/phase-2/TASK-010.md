# TASK-010: WebSocketハンドラーのPTYSessionManager統合

## 基本情報

- **タスクID**: TASK-010
- **フェーズ**: Phase 2 - PTYSessionManagerの導入
- **優先度**: 中
- **推定工数**: 50分
- **ステータス**: TODO
- **担当者**: 未割り当て

## 概要

WebSocketハンドラー（claude-ws.ts, terminal-ws.ts）をPTYSessionManager経由でPTYにアクセスするように変更します。接続プール管理もPTYSessionManagerに委譲し、WebSocketハンドラーのコードを簡素化します。

## 要件マッピング

| 要件ID | 内容 |
|-------|------|
| REQ-002-007 | WebSocketハンドラーの簡素化 |
| REQ-001-001 | 接続プールの管理 |

## 技術的文脈

- **ファイルパス**:
  - `src/lib/websocket/claude-ws.ts`
  - `src/lib/websocket/terminal-ws.ts`
- **フレームワーク**: Node.js, TypeScript
- **ライブラリ**: ws (WebSocket)
- **参照すべき既存コード**:
  - `src/services/pty-session-manager.ts` (統合先)
  - `src/lib/websocket/session-ws.ts` (既存のConnectionManager使用例)
- **設計書**: [docs/design/components/pty-session-manager.md](../../design/components/pty-session-manager.md)

## 情報の明確性

| 分類 | 内容 |
|------|------|
| **明示された情報** | - WebSocket接続時にPTYSessionManager.addConnection()を呼び出す<br>- WebSocket切断時にPTYSessionManager.removeConnection()を呼び出す<br>- メッセージ送信時にPTYSessionManager.sendInput()を呼び出す<br>- リサイズ時にPTYSessionManager.resize()を呼び出す<br>- スクロールバックバッファはPTYSessionManagerから取得<br>- ClaudePTYManager/PTYManagerへの直接アクセスを削除 |
| **不明/要確認の情報** | - なし（設計書で詳細に定義済み） |

## 実装手順（TDD）

### ステップ1: テスト作成

既存のテストファイル`src/lib/websocket/__tests__/claude-ws.test.ts`と`terminal-ws.test.ts`に以下を追加：

1. **接続管理のテスト（claude-ws）**
   - WebSocket接続時にPTYSessionManager.addConnection()が呼び出される
   - WebSocket切断時にPTYSessionManager.removeConnection()が呼び出される
   - スクロールバックバッファがPTYSessionManagerから取得される

2. **メッセージ処理のテスト（claude-ws）**
   - inputメッセージでPTYSessionManager.sendInput()が呼び出される
   - resizeメッセージでPTYSessionManager.resize()が呼び出される

3. **接続管理のテスト（terminal-ws）**
   - WebSocket接続時にPTYSessionManager.addConnection()が呼び出される（PTYManager用のセッション）
   - WebSocket切断時にPTYSessionManager.removeConnection()が呼び出される
   - スクロールバックバッファがPTYSessionManagerから取得される

4. **メッセージ処理のテスト（terminal-ws）**
   - inputメッセージでPTYSessionManager.sendInput()が呼び出される
   - resizeメッセージでPTYSessionManager.resize()が呼び出される

### ステップ2: テスト実行（失敗確認）

```bash
npm test -- src/lib/websocket/__tests__/claude-ws.test.ts
npm test -- src/lib/websocket/__tests__/terminal-ws.test.ts
```

新しいテストが失敗することを確認します。

### ステップ3: テストコミット

```bash
git add src/lib/websocket/__tests__/claude-ws.test.ts src/lib/websocket/__tests__/terminal-ws.test.ts
git commit -m "test(TASK-010): add PTYSessionManager integration tests for WebSocket handlers

- Add connection management tests for claude-ws
- Add message processing tests for claude-ws
- Add connection management tests for terminal-ws
- Add message processing tests for terminal-ws"
```

### ステップ4: 実装

#### claude-ws.tsのリファクタリング

```typescript
import { PTYSessionManager, ptySessionManager } from '@/services/pty-session-manager'
import { ConnectionManager } from './connection-manager'

class ClaudeWebSocketHandler {
  private connectionManager: ConnectionManager
  private ptySessionManager: PTYSessionManager

  constructor() {
    this.connectionManager = ConnectionManager.getInstance()
    this.ptySessionManager = ptySessionManager
  }

  handleConnection(ws: WebSocket, sessionId: string): void {
    logger.info(`Claude WebSocket connected for session ${sessionId}`)

    try {
      // PTYSessionManagerに接続を追加
      this.ptySessionManager.addConnection(sessionId, ws)

      // スクロールバックバッファを送信
      const buffer = this.connectionManager.getScrollbackBuffer(sessionId)
      if (buffer) {
        this.connectionManager.sendScrollbackToConnection(sessionId, ws)
      }

      // メッセージハンドラー
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())

          switch (message.type) {
            case 'input':
              // PTYSessionManagerに入力を送信
              this.ptySessionManager.sendInput(sessionId, message.data)
              break

            case 'resize':
              // PTYSessionManagerにリサイズを送信
              this.ptySessionManager.resize(sessionId, message.cols, message.rows)
              break

            default:
              logger.warn(`Unknown message type: ${message.type}`)
          }
        } catch (error) {
          logger.error('Failed to process WebSocket message:', error)
        }
      })

      // 切断ハンドラー
      ws.on('close', () => {
        logger.info(`Claude WebSocket disconnected for session ${sessionId}`)
        this.ptySessionManager.removeConnection(sessionId, ws)
      })

      // エラーハンドラー
      ws.on('error', (error) => {
        logger.error(`Claude WebSocket error for session ${sessionId}:`, error)
      })
    } catch (error) {
      logger.error(`Failed to setup Claude WebSocket for session ${sessionId}:`, error)
      ws.close(1011, 'Internal server error')
    }
  }
}

export const claudeWebSocketHandler = new ClaudeWebSocketHandler()
```

#### terminal-ws.tsのリファクタリング

```typescript
import { PTYSessionManager, ptySessionManager } from '@/services/pty-session-manager'
import { ConnectionManager } from './connection-manager'

class TerminalWebSocketHandler {
  private connectionManager: ConnectionManager
  private ptySessionManager: PTYSessionManager

  constructor() {
    this.connectionManager = ConnectionManager.getInstance()
    this.ptySessionManager = ptySessionManager
  }

  handleConnection(ws: WebSocket, sessionId: string): void {
    logger.info(`Terminal WebSocket connected for session ${sessionId}`)

    try {
      // PTYSessionManagerに接続を追加
      // Note: PTYManagerセッションもPTYSessionManagerで管理される想定
      this.ptySessionManager.addConnection(sessionId, ws)

      // スクロールバックバッファを送信
      const buffer = this.connectionManager.getScrollbackBuffer(sessionId)
      if (buffer) {
        this.connectionManager.sendScrollbackToConnection(sessionId, ws)
      }

      // メッセージハンドラー
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())

          switch (message.type) {
            case 'input':
              // PTYSessionManagerに入力を送信
              this.ptySessionManager.sendInput(sessionId, message.data)
              break

            case 'resize':
              // PTYSessionManagerにリサイズを送信
              this.ptySessionManager.resize(sessionId, message.cols, message.rows)
              break

            default:
              logger.warn(`Unknown message type: ${message.type}`)
          }
        } catch (error) {
          logger.error('Failed to process WebSocket message:', error)
        }
      })

      // 切断ハンドラー
      ws.on('close', () => {
        logger.info(`Terminal WebSocket disconnected for session ${sessionId}`)
        this.ptySessionManager.removeConnection(sessionId, ws)
      })

      // エラーハンドラー
      ws.on('error', (error) => {
        logger.error(`Terminal WebSocket error for session ${sessionId}:`, error)
      })
    } catch (error) {
      logger.error(`Failed to setup Terminal WebSocket for session ${sessionId}:`, error)
      ws.close(1011, 'Internal server error')
    }
  }
}

export const terminalWebSocketHandler = new TerminalWebSocketHandler()
```

### ステップ5: テスト実行（通過確認）

```bash
npm test -- src/lib/websocket/__tests__/claude-ws.test.ts
npm test -- src/lib/websocket/__tests__/terminal-ws.test.ts
```

すべてのテストが通過することを確認します。

### ステップ6: 実装コミット

```bash
git add src/lib/websocket/claude-ws.ts src/lib/websocket/terminal-ws.ts
git commit -m "feat(TASK-010): integrate PTYSessionManager into WebSocket handlers

- Refactor claude-ws.ts to use PTYSessionManager
- Refactor terminal-ws.ts to use PTYSessionManager
- Delegate connection management to PTYSessionManager
- Delegate input/resize to PTYSessionManager
- Remove direct access to ClaudePTYManager/PTYManager
- Simplify WebSocket handler code

Implements: REQ-002-007, REQ-001-001

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] claude-ws.tsがPTYSessionManagerを使用している
- [ ] terminal-ws.tsがPTYSessionManagerを使用している
- [ ] addConnection()とremoveConnection()が呼び出される
- [ ] sendInput()とresize()が呼び出される
- [ ] スクロールバックバッファがPTYSessionManagerから取得される
- [ ] ClaudePTYManager/PTYManagerへの直接アクセスが削除されている
- [ ] テストがすべて通過する
- [ ] ESLintエラーがゼロ

## 検証方法

### 単体テスト実行

```bash
npm test -- src/lib/websocket/__tests__/claude-ws.test.ts --coverage
npm test -- src/lib/websocket/__tests__/terminal-ws.test.ts --coverage
```

カバレッジが85%以上であることを確認。

### Lint実行

```bash
npm run lint -- src/lib/websocket/claude-ws.ts src/lib/websocket/terminal-ws.ts
```

エラーがゼロであることを確認。

### 既存機能のリグレッションテスト

```bash
npm test
```

既存のすべてのテストが通過することを確認。

## 依存関係

### 前提条件
- TASK-009: ClaudePTYManagerのリファクタリング

### 後続タスク
- TASK-011: PTYSessionManagerの統合テスト

## トラブルシューティング

### よくある問題

1. **セッションが見つからない**
   - 問題: PTYSessionManager.addConnection()でエラー
   - 解決: セッション作成時にPTYSessionManagerを使用していることを確認

2. **スクロールバックバッファが空**
   - 問題: 接続時にバッファが送信されない
   - 解決: ConnectionManagerのgetScrollbackBuffer()を使用

3. **イベントハンドラーの二重登録**
   - 問題: メッセージが2回処理される
   - 解決: WebSocket接続ごとに1回のみハンドラーを登録

4. **PTYManagerセッションの扱い**
   - 問題: PTYManagerセッションもPTYSessionManagerで管理すべきか
   - 解決: 現時点ではPTYManagerは独立して動作、Phase 2完了後に統合検討

## パフォーマンス最適化

### メッセージパースの最適化

```typescript
// 頻繁に呼ばれるinputメッセージの処理を最適化
if (message.type === 'input' && typeof message.data === 'string') {
  this.ptySessionManager.sendInput(sessionId, message.data)
  return
}
```

## 参照

- [要件定義: US-002](../../requirements/stories/US-002.md)
- [設計: PTYSessionManager](../../design/components/pty-session-manager.md)
- [設計: ClaudeWebSocket](../../design/components/claude-websocket.md)
