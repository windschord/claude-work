# TASK-006: PTYSessionManagerの基本構造作成

## 基本情報

- **タスクID**: TASK-006
- **フェーズ**: Phase 2 - PTYSessionManagerの導入
- **優先度**: 最高
- **推定工数**: 60分
- **ステータス**: IN_PROGRESS
- **担当者**: 未割り当て

## 概要

PTYSessionManagerのシングルトンクラスを作成し、基本的なデータ構造とインターフェースを定義します。セッションの一元管理のための土台を構築し、ConnectionManagerおよびAdapterFactoryとの統合ポイントを確立します。

## 要件マッピング

| 要件ID | 内容 |
|-------|------|
| REQ-002-004 | 状態の一元管理 |
| REQ-002-006 | 環境アダプターの統合 |
| NFR-002-001 | 拡張性 |
| NFR-002-002 | テスタビリティ |

## 技術的文脈

- **ファイルパス**: `src/services/pty-session-manager.ts`
- **フレームワーク**: Node.js, TypeScript
- **ライブラリ**: EventEmitter, node-pty
- **参照すべき既存コード**:
  - `src/services/claude-pty-manager.ts` (既存のPTY管理)
  - `src/services/adapter-factory.ts` (環境アダプター)
  - `src/lib/websocket/connection-manager.ts` (Phase 1で拡張済み)
- **設計書**: [docs/design/components/pty-session-manager.md](../../design/components/pty-session-manager.md)

## 情報の明確性

| 分類 | 内容 |
|------|------|
| **明示された情報** | - シングルトンパターンで実装<br>- EventEmitterを継承<br>- Map<string, PTYSession>でセッション管理<br>- ConnectionManagerとAdapterFactoryをDI<br>- IPTYSessionManagerインターフェースを実装<br>- ライフサイクルイベント（sessionCreated, sessionDestroyed, sessionError）を発火 |
| **不明/要確認の情報** | - なし（設計書で詳細に定義済み） |

## 実装手順（TDD）

### ステップ1: テスト作成

```bash
# テストファイルを作成
mkdir -p src/services/__tests__
touch src/services/__tests__/pty-session-manager.test.ts
```

以下のテストケースを作成：

1. **シングルトンパターンのテスト**
   - getInstance()が常に同じインスタンスを返す
   - コンストラクタが直接呼び出せない（privateである）

2. **基本メソッドのテスト**
   - hasSession()が存在しないセッションに対してfalseを返す
   - listSessions()が空配列を返す（初期状態）
   - getSession()が存在しないセッションに対してundefinedを返す

3. **イベントエミッターのテスト**
   - sessionCreatedイベントをリスンできる
   - sessionDestroyedイベントをリスンできる
   - sessionErrorイベントをリスンできる

4. **ConnectionManager統合のテスト**
   - ConnectionManager.getInstance()が呼び出される
   - connectionManagerプロパティが設定される

5. **AdapterFactory統合のテスト**
   - AdapterFactory.getInstance()が呼び出される
   - adapterFactoryプロパティが設定される

### ステップ2: テスト実行（失敗確認）

```bash
npm test -- src/services/__tests__/pty-session-manager.test.ts
```

すべてのテストが失敗することを確認します。

### ステップ3: テストコミット

```bash
git add src/services/__tests__/pty-session-manager.test.ts
git commit -m "test(TASK-006): add PTYSessionManager basic structure tests

- Add singleton pattern tests
- Add basic method tests (hasSession, listSessions, getSession)
- Add event emitter tests (sessionCreated, sessionDestroyed, sessionError)
- Add ConnectionManager integration tests
- Add AdapterFactory integration tests"
```

### ステップ4: 実装

`src/services/pty-session-manager.ts`を作成：

1. **型定義**
   ```typescript
   import { EventEmitter } from 'events'
   import { IPty } from 'node-pty'
   import { ConnectionManager } from '@/lib/websocket/connection-manager'
   import { AdapterFactory } from './adapter-factory'
   import { EnvironmentAdapter } from './environment-adapter'
   import { db } from '@/lib/db'
   import { logger } from '@/lib/logger'
   import type { PrismaClient } from '@prisma/client'
   import type WebSocket from 'ws'

   export interface PTYSession {
     id: string
     pty: IPty
     adapter: EnvironmentAdapter
     environmentType: 'HOST' | 'DOCKER' | 'SSH'
     metadata: SessionMetadata
     createdAt: Date
     lastActiveAt: Date
   }

   export interface SessionMetadata {
     projectId: string
     branchName: string
     worktreePath: string
     containerID?: string
     environmentId: string
   }

   export interface SessionOptions {
     sessionId: string
     projectId: string
     branchName: string
     worktreePath: string
     environmentId: string
     cols?: number
     rows?: number
   }

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

2. **シングルトンクラス**
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
       logger.info('PTYSessionManager initialized')
     }

     public static getInstance(): PTYSessionManager {
       if (!PTYSessionManager.instance) {
         PTYSessionManager.instance = new PTYSessionManager()
       }
       return PTYSessionManager.instance
     }

     // 基本メソッドのスタブ実装
     hasSession(sessionId: string): boolean {
       return this.sessions.has(sessionId)
     }

     listSessions(): string[] {
       return Array.from(this.sessions.keys())
     }

     getSession(sessionId: string): PTYSession | undefined {
       return this.sessions.get(sessionId)
     }

     // createSessionとdestroySessionは次のタスクで実装
     async createSession(options: SessionOptions): Promise<PTYSession> {
       throw new Error('Not implemented yet')
     }

     async destroySession(sessionId: string): Promise<void> {
       throw new Error('Not implemented yet')
     }

     // 接続管理は次のタスクで実装
     addConnection(sessionId: string, ws: WebSocket): void {
       throw new Error('Not implemented yet')
     }

     removeConnection(sessionId: string, ws: WebSocket): void {
       throw new Error('Not implemented yet')
     }

     getConnectionCount(sessionId: string): number {
       return this.connectionManager.getConnectionCount(sessionId)
     }

     // PTYインタラクションは次のタスクで実装
     sendInput(sessionId: string, data: string): void {
       throw new Error('Not implemented yet')
     }

     resize(sessionId: string, cols: number, rows: number): void {
       throw new Error('Not implemented yet')
     }
   }

   // グローバルインスタンスのエクスポート
   export const ptySessionManager = PTYSessionManager.getInstance()
   ```

### ステップ5: テスト実行（通過確認）

```bash
npm test -- src/services/__tests__/pty-session-manager.test.ts
```

すべてのテストが通過することを確認します。

### ステップ6: 実装コミット

```bash
git add src/services/pty-session-manager.ts
git commit -m "feat(TASK-006): create PTYSessionManager basic structure

- Implement singleton pattern with getInstance()
- Add PTYSession and SessionOptions type definitions
- Add IPTYSessionManager interface with full method signatures
- Integrate ConnectionManager and AdapterFactory
- Implement basic methods: hasSession, listSessions, getSession
- Add stub implementations for createSession, destroySession, etc.
- Extend EventEmitter for lifecycle events

Implements: REQ-002-004, REQ-002-006, NFR-002-001, NFR-002-002

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/services/pty-session-manager.ts`が作成されている
- [ ] PTYSessionManagerクラスがシングルトンパターンで実装されている
- [ ] IPTYSessionManagerインターフェースがすべてのメソッドを定義している
- [ ] PTYSession, SessionMetadata, SessionOptionsの型定義が含まれている
- [ ] ConnectionManagerとAdapterFactoryがコンストラクタで初期化される
- [ ] EventEmitterを継承している
- [ ] hasSession(), listSessions(), getSession()が実装されている
- [ ] `src/services/__tests__/pty-session-manager.test.ts`にテストが5カテゴリ以上ある
- [ ] `npm test`で全テストが通過する
- [ ] ESLintエラーがゼロ
- [ ] TypeScriptのコンパイルエラーがゼロ

## 検証方法

### 単体テスト実行

```bash
npm test -- src/services/__tests__/pty-session-manager.test.ts --coverage
```

カバレッジが85%以上であることを確認。

### Lint実行

```bash
npm run lint -- src/services/pty-session-manager.ts
```

エラーがゼロであることを確認。

### TypeScriptコンパイル

```bash
npx tsc --noEmit
```

コンパイルエラーがゼロであることを確認。

## 依存関係

### 前提条件
- TASK-005: 複数ブラウザE2Eテスト（Phase 1完了）

### 後続タスク
- TASK-007: セッション作成・取得・破棄メソッド実装

## トラブルシューティング

### よくある問題

1. **シングルトンのテストでインスタンスが共有されない**
   - 問題: テストケース間でインスタンスが異なる
   - 解決: beforeEach()でインスタンスをリセットせず、getInstance()を使う

2. **EventEmitterの型エラー**
   - 問題: on()メソッドのオーバーロードが認識されない
   - 解決: IPTYSessionManagerでon()メソッドを明示的に定義

3. **循環依存エラー**
   - 問題: ConnectionManagerとPTYSessionManagerが相互に参照
   - 解決: PTYSessionManagerがConnectionManagerを使う一方向の依存にする

4. **Prismaクライアントの型エラー**
   - 問題: dbのインポートで型が合わない
   - 解決: `import { db } from '@/lib/db'`を使い、PrismaClient型でアノテーション

## パフォーマンス最適化

### シングルトンの最適化

```typescript
// 将来の最適化: レイジーインスタンス化
private static instance: PTYSessionManager | null = null

public static getInstance(): PTYSessionManager {
  if (!PTYSessionManager.instance) {
    PTYSessionManager.instance = new PTYSessionManager()
  }
  return PTYSessionManager.instance
}
```

## 参照

- [要件定義: US-002](../../requirements/stories/US-002.md)
- [設計: PTYSessionManager](../../design/components/pty-session-manager.md)
- [設計決定: DEC-002](../../design/decisions/DEC-002.md)
- [ConnectionManager](../../design/components/connection-manager.md)
