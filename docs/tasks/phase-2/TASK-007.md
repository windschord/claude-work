# TASK-007: セッション作成・取得・破棄メソッド実装

## 基本情報

- **タスクID**: TASK-007
- **フェーズ**: Phase 2 - PTYSessionManagerの導入
- **優先度**: 最高
- **推定工数**: 60分
- **ステータス**: TODO
- **担当者**: 未割り当て

## 概要

PTYSessionManagerのコアメソッドであるcreateSession(), destroySession()を実装します。環境アダプターを使用してPTYを作成し、セッションのライフサイクルを管理します。エラーハンドリングとクリーンアップロジックも含めます。

## 要件マッピング

| 要件ID | 内容 |
|-------|------|
| REQ-002-001 | セッションの作成 |
| REQ-002-002 | セッションの取得 |
| REQ-002-003 | セッションの破棄 |
| REQ-002-005 | ライフサイクルイベント |
| REQ-002-006 | 環境アダプターの統合 |

## 技術的文脈

- **ファイルパス**: `src/services/pty-session-manager.ts`
- **フレームワーク**: Node.js, TypeScript
- **ライブラリ**: node-pty, Prisma
- **参照すべき既存コード**:
  - `src/services/claude-pty-manager.ts` (createSession, destroySession)
  - `src/services/adapter-factory.ts` (getAdapter)
  - `src/services/adapters/host-adapter.ts` (spawn, cleanup)
- **設計書**: [docs/design/components/pty-session-manager.md](../../design/components/pty-session-manager.md)

## 情報の明確性

| 分類 | 内容 |
|------|------|
| **明示された情報** | - AdapterFactoryから環境アダプターを取得<br>- アダプターのspawn()でPTYを作成<br>- セッション情報をMapに登録<br>- データベースにステータスを記録<br>- sessionCreatedイベントを発火<br>- 破棄時はPTY、アダプター、接続をクリーンアップ<br>- エラー時は部分的リソースをクリーンアップ |
| **不明/要確認の情報** | - なし（設計書で詳細に定義済み） |

## 実装手順（TDD）

### ステップ1: テスト作成

既存のテストファイル`src/services/__tests__/pty-session-manager.test.ts`に以下を追加：

1. **createSessionのテスト**
   - 新しいセッションを作成できる
   - セッションIDが重複する場合はエラーをスロー
   - 環境情報が見つからない場合はエラーをスロー
   - アダプターのspawn()が呼び出される
   - セッションがMapに登録される
   - sessionCreatedイベントが発火される
   - データベースのステータスがACTIVEに更新される

2. **destroySessionのテスト**
   - セッションを破棄できる
   - PTYのkill()が呼び出される
   - アダプターのcleanup()が呼び出される
   - 接続がすべてクローズされる
   - ConnectionManagerのcleanup()が呼び出される
   - セッションがMapから削除される
   - sessionDestroyedイベントが発火される
   - データベースのステータスがTERMINATEDに更新される
   - 存在しないセッションの破棄は静かに無視される

3. **エラーハンドリングのテスト**
   - セッション作成中のエラーで部分的リソースがクリーンアップされる
   - PTYのkillエラーが無視される（破棄は継続）
   - アダプターのcleanupエラーが無視される（破棄は継続）

4. **接続管理のテスト**
   - addConnection()でConnectionManagerに委譲される
   - removeConnection()でConnectionManagerに委譲される
   - セッションが存在しない場合はエラーをスロー（addConnection）

### ステップ2: テスト実行（失敗確認）

```bash
npm test -- src/services/__tests__/pty-session-manager.test.ts
```

新しいテストが失敗することを確認します。

### ステップ3: テストコミット

```bash
git add src/services/__tests__/pty-session-manager.test.ts
git commit -m "test(TASK-007): add session lifecycle tests

- Add createSession tests (success, duplicate, error)
- Add destroySession tests (success, cleanup, error handling)
- Add error handling tests (partial resource cleanup)
- Add connection management tests (addConnection, removeConnection)"
```

### ステップ4: 実装

`src/services/pty-session-manager.ts`の以下のメソッドを実装：

1. **createSession**
   ```typescript
   async createSession(options: SessionOptions): Promise<PTYSession> {
     const { sessionId, projectId, environmentId, worktreePath, branchName, cols, rows } = options

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
           branchName,
           worktreePath,
           environmentId
         },
         createdAt: new Date(),
         lastActiveAt: new Date()
       }

       // セッションを登録
       this.sessions.set(sessionId, session)

       // スクロールバックバッファを設定
       const ScrollbackBuffer = (await import('./scrollback-buffer')).ScrollbackBuffer
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

2. **destroySession**
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

3. **cleanupFailedSession（プライベートメソッド）**
   ```typescript
   private async cleanupFailedSession(sessionId: string): Promise<void> {
     try {
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

4. **addConnectionとremoveConnection**
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

   private async updateConnectionCount(sessionId: string): Promise<void> {
     const count = this.connectionManager.getConnectionCount(sessionId)
     await this.prisma.session.update({
       where: { id: sessionId },
       data: { active_connections: count }
     })
   }
   ```

### ステップ5: テスト実行（通過確認）

```bash
npm test -- src/services/__tests__/pty-session-manager.test.ts
```

すべてのテストが通過することを確認します。

### ステップ6: 実装コミット

```bash
git add src/services/pty-session-manager.ts
git commit -m "feat(TASK-007): implement session lifecycle methods

- Implement createSession() with environment adapter integration
- Implement destroySession() with full resource cleanup
- Add cleanupFailedSession() for error handling
- Implement addConnection() and removeConnection() with DB updates
- Add updateConnectionCount() helper method
- Emit lifecycle events (sessionCreated, sessionDestroyed, sessionError)
- Update database status on session state changes

Implements: REQ-002-001, REQ-002-002, REQ-002-003, REQ-002-005, REQ-002-006

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] createSession()が実装されている
- [ ] destroySession()が実装されている
- [ ] cleanupFailedSession()が実装されている（プライベート）
- [ ] addConnection()とremoveConnection()が実装されている
- [ ] updateConnectionCount()が実装されている（プライベート）
- [ ] 環境アダプターのspawn()が呼び出される
- [ ] データベースのステータスが適切に更新される
- [ ] sessionCreatedとsessionDestroyedイベントが発火される
- [ ] エラー時にcleanupFailedSession()が呼び出される
- [ ] テストがすべて通過する
- [ ] ESLintエラーがゼロ

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

## 依存関係

### 前提条件
- TASK-006: PTYSessionManagerの基本構造作成

### 後続タスク
- TASK-008: PTYイベントハンドラー登録の実装

## トラブルシューティング

### よくある問題

1. **環境情報が見つからない**
   - 問題: ExecutionEnvironmentが存在しない
   - 解決: テストでモックデータを作成、本番ではデフォルトHOST環境を使用

2. **アダプターのspawnエラー**
   - 問題: PTY作成に失敗
   - 解決: cleanupFailedSession()で部分的リソースをクリーンアップ

3. **データベース更新エラー**
   - 問題: Prismaの更新に失敗
   - 解決: エラーをログに記録し、セッション破棄は継続

4. **PTYのkillエラー**
   - 問題: 既に終了しているPTYをkill()
   - 解決: try-catchで無視し、破棄は継続

## パフォーマンス最適化

### データベース更新の非同期化

```typescript
// 接続数の更新は非同期で行い、エラーが発生しても待機しない
this.updateConnectionCount(sessionId).catch(error => {
  logger.error(`Failed to update connection count:`, error)
})
```

## 参照

- [要件定義: US-002](../../requirements/stories/US-002.md)
- [設計: PTYSessionManager](../../design/components/pty-session-manager.md)
- [設計決定: DEC-002](../../design/decisions/DEC-002.md)
