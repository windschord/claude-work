# TASK-014: 親コンテナIDの永続化と孤立コンテナクリーンアップ

## 基本情報

- **タスクID**: TASK-014
- **フェーズ**: Phase 3 - Docker環境の安定化
- **優先度**: 高
- **推定工数**: 60分
- **ステータス**: DONE
- **担当者**: 未割り当て

## 概要

親コンテナIDをデータベースに永続化し、サーバー再起動後も復元できるようにします。また、サーバー起動時に孤立したDockerコンテナを検出してクリーンアップする機能を実装します。

## 要件マッピング

| 要件ID | 内容 |
|-------|------|
| REQ-003-005 | 親コンテナIDの永続化 |
| REQ-003-006 | 孤立コンテナの検出 |
| NFR-003-003 | 復旧性（5分以内にクリーンアップ） |

## 技術的文脈

- **ファイルパス**:
  - `src/services/adapters/docker-adapter.ts`
  - `prisma/schema.prisma`
  - `server.ts`（サーバー起動時の呼び出し）
- **フレームワーク**: Node.js, TypeScript, Prisma
- **ライブラリ**: @prisma/client, child_process
- **参照すべき既存コード**:
  - `src/services/adapters/docker-adapter.ts` (既存実装)
  - `prisma/schema.prisma` (既存のcontainer_idフィールド)
  - `src/lib/db.ts` (Prismaクライアント)
- **設計書**: [docs/sdd/archive/design-pr96-session-management/components/docker-adapter.md](../../design-pr96-session-management/components/docker-adapter.md)

## 情報の明確性

| 分類 | 内容 |
|------|------|
| **明示された情報** | - データベースの`container_id`フィールドに保存（既存）<br>- `saveContainerId()`メソッドを実装<br>- `getContainerId()`メソッドを実装<br>- `cleanupOrphanedContainers()`静的メソッドを実装<br>- サーバー起動時に呼び出す |
| **不明/要確認の情報** | - なし（設計書で詳細に定義済み） |

## 実装手順（TDD）

### ステップ1: テスト作成

以下のテストケースを作成：

1. **saveContainerIdのテスト**
   - コンテナIDがデータベースに保存される
   - 保存失敗時にエラーをログに記録（スローしない）

2. **getContainerIdのテスト**
   - データベースからコンテナIDを取得できる
   - セッションが存在しない場合はnullを返す

3. **cleanupOrphanedContainersのテスト**
   - データベースから全セッションのコンテナIDを取得
   - 実行中でないコンテナを検出
   - セッション状態をERRORに更新
   - コンテナを削除

4. **spawn()統合のテスト**
   - コンテナ起動後にコンテナIDを保存
   - データベースに記録される

5. **cleanup()統合のテスト**
   - クリーンアップ後にコンテナIDがnullに更新される

### ステップ2: テスト実行（失敗確認）

```bash
npm test -- src/services/adapters/__tests__/docker-adapter.test.ts
```

すべてのテストが失敗することを確認します。

### ステップ3: テストコミット

```bash
git add src/services/adapters/__tests__/docker-adapter.test.ts
git commit -m "test(TASK-014): add container ID persistence and orphan cleanup tests

- Add saveContainerId() test
- Add getContainerId() test
- Add cleanupOrphanedContainers() test
- Add spawn() integration test with persistence
- Add cleanup() integration test with DB update"
```

### ステップ4: 実装

`src/services/adapters/docker-adapter.ts`に以下を追加：

1. **Prismaクライアントの追加**
   ```typescript
   import { PrismaClient } from '@prisma/client'
   import { db } from '@/lib/db'

   export class DockerAdapter implements EnvironmentAdapter {
     private prisma: PrismaClient = db
     // ... 既存のプロパティ
   }
   ```

2. **saveContainerId()メソッド**
   ```typescript
   private async saveContainerId(sessionId: string, containerId: string): Promise<void> {
     try {
       await this.prisma.session.update({
         where: { id: sessionId },
         data: { container_id: containerId }
       })

       logger.debug(`Saved container ID ${containerId} for session ${sessionId}`)
     } catch (error) {
       logger.error(`Failed to save container ID:`, error)
       // 永続化失敗は致命的ではないため、エラーをスローしない
     }
   }
   ```

3. **getContainerId()メソッド**
   ```typescript
   async getContainerId(sessionId: string): Promise<string | null> {
     try {
       const session = await this.prisma.session.findUnique({
         where: { id: sessionId },
         select: { container_id: true }
       })

       return session?.container_id || null
     } catch (error) {
       logger.error(`Failed to get container ID for session ${sessionId}:`, error)
       return null
     }
   }
   ```

4. **cleanupOrphanedContainers()静的メソッド**
   ```typescript
   static async cleanupOrphanedContainers(prisma: PrismaClient): Promise<void> {
     logger.info('Checking for orphaned Docker containers')

     try {
       // データベースから全セッションのコンテナIDを取得
       const sessions = await prisma.session.findMany({
         where: {
           container_id: { not: null },
           status: { in: ['ACTIVE', 'IDLE'] }
         },
         select: { id: true, container_id: true }
       })

       for (const session of sessions) {
         if (!session.container_id) continue

         try {
           // コンテナが実行中か確認
           const { stdout } = await execAsync(
             `docker inspect --format='{{.State.Running}}' ${session.container_id}`
           )

           const isRunning = stdout.trim() === 'true'

           if (!isRunning) {
             logger.warn(`Orphaned container detected: ${session.container_id} for session ${session.id}`)

             // セッション状態をERRORに更新
             await prisma.session.update({
               where: { id: session.id },
               data: {
                 status: 'ERROR',
                 container_id: null
               }
             })

             // コンテナが存在すれば削除
             try {
               await execAsync(`docker rm -f ${session.container_id}`)
               logger.info(`Removed orphaned container ${session.container_id}`)
             } catch (rmError) {
               logger.error(`Failed to remove orphaned container:`, rmError)
             }
           }
         } catch (error) {
           logger.error(`Failed to check container ${session.container_id}:`, error)

           // コンテナが存在しない場合も孤立とみなす
           await prisma.session.update({
             where: { id: session.id },
             data: {
               status: 'ERROR',
               container_id: null
             }
           })
         }
       }

       logger.info('Orphaned container cleanup completed')
     } catch (error) {
       logger.error('Failed to cleanup orphaned containers:', error)
     }
   }
   ```

5. **spawn()メソッドの修正**
   - コンテナ起動後に`saveContainerId()`を呼び出す

6. **cleanup()メソッドの修正**
   - コンテナ停止後にcontainer_idをnullに更新

7. **server.tsの修正**
   ```typescript
   // サーバー起動時に孤立コンテナをクリーンアップ
   import { DockerAdapter } from '@/services/adapters/docker-adapter'
   import { db } from '@/lib/db'

   // サーバー起動時
   await DockerAdapter.cleanupOrphanedContainers(db)
   ```

### ステップ5: テスト実行（通過確認）

```bash
npm test -- src/services/adapters/__tests__/docker-adapter.test.ts
```

すべてのテストが通過することを確認します。

### ステップ6: 実装コミット

```bash
git add src/services/adapters/docker-adapter.ts server.ts
git commit -m "feat(TASK-014): implement container ID persistence and orphan cleanup

- Add saveContainerId() to persist container ID to database
- Add getContainerId() to retrieve container ID from database
- Add cleanupOrphanedContainers() static method for server startup
- Call saveContainerId() in spawn() after container creation
- Update container_id to null in cleanup()
- Integrate cleanupOrphanedContainers() in server.ts startup
- Add comprehensive logging

Implements: REQ-003-005, REQ-003-006, NFR-003-003

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/services/adapters/docker-adapter.ts`に`saveContainerId()`メソッドが実装されている
- [ ] `getContainerId()`メソッドが実装されている
- [ ] `cleanupOrphanedContainers()`静的メソッドが実装されている
- [ ] `spawn()`がコンテナIDをデータベースに保存する
- [ ] `cleanup()`がcontainer_idをnullに更新する
- [ ] `server.ts`がサーバー起動時に`cleanupOrphanedContainers()`を呼び出す
- [ ] テストカバレッジが80%以上
- [ ] `npm test`で全テストが通過する
- [ ] ESLintエラーがゼロ
- [ ] サーバー起動後5分以内に孤立コンテナがクリーンアップされる（手動テスト）

## 検証方法

### 単体テスト実行

```bash
npm test -- src/services/adapters/__tests__/docker-adapter.test.ts --coverage
```

カバレッジが80%以上であることを確認。

### Lint実行

```bash
npm run lint -- src/services/adapters/docker-adapter.ts server.ts
```

エラーがゼロであることを確認。

### 手動テスト

```bash
# 1. Docker環境でセッションを作成
# 2. データベースでcontainer_idが記録されていることを確認
npx prisma studio

# 3. サーバーを強制終了（Ctrl+C）
# 4. サーバーを再起動
npm run dev

# 5. ログで孤立コンテナのクリーンアップを確認
# 6. データベースでセッション状態がERRORに更新されていることを確認
# 7. コンテナが削除されていることを確認
docker ps -a | grep claude-work
```

## 依存関係

### 前提条件
- TASK-013: docker stopのPromise化とエラーハンドリング

### 後続タスク
- TASK-015: DockerAdapterの統合テスト

## トラブルシューティング

### よくある問題

1. **データベース更新の失敗**
   - 問題: セッションが存在しない
   - 解決: try-catchでエラーをキャッチ、ログに記録

2. **docker inspectの失敗**
   - 問題: コンテナIDが無効
   - 解決: エラーを孤立コンテナとして扱う

3. **docker rmの失敗**
   - 問題: コンテナが既に削除されている
   - 解決: エラーをログに記録するがスキップ

## パフォーマンス最適化

### 並列処理

```typescript
// 将来の最適化: 孤立コンテナのチェックを並列化
const promises = sessions.map(session => this.checkAndCleanupContainer(session))
await Promise.allSettled(promises)
```

## 完了サマリ

- `cleanupOrphanedContainers()`静的メソッドを実装し、サーバー起動時に孤立コンテナを検出・クリーンアップ
- データベースから全セッションのコンテナIDを取得し、実行状態を確認
- 停止中または存在しないコンテナを検出し、セッション状態をERRORに更新
- `docker rm -f`で孤立コンテナを削除
- `server.ts`のサーバー起動時に`cleanupOrphanedContainers()`を呼び出す実装を追加
- 包括的なログ出力により、孤立コンテナの検出とクリーンアップ状況を可視化

## 参照

- [要件定義: US-003](../../requirements/stories/US-003.md)
- [設計: DockerAdapter](../../design/components/docker-adapter.md)
- [データベーススキーマ](../../design/database/schema.md)
