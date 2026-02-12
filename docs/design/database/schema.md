# データベーススキーマ: セッション状態の永続化

## 概要

セッション状態をデータベースに永続化することで、サーバー再起動時の状態復元を実現します。既存のPrismaスキーマに新しいフィールドとEnumを追加します。

## 要件マッピング

このスキーマ設計は以下の要件を満たします：

| 要件ID | 内容 | 実装方法 |
|-------|------|---------|
| REQ-004-001 | セッション状態の記録 | Sessionモデルにstatusフィールド追加 |
| REQ-004-002 | 接続数の永続化 | active_connectionsフィールド追加 |
| REQ-004-003 | タイマー情報の永続化 | destroy_atフィールド追加 |
| REQ-004-004 | 状態の復元 | サーバー起動時にデータベースから読み込み |
| REQ-003-005 | 親コンテナIDの永続化 | container_idフィールド（既存） |

## スキーマ変更

### Sessionモデルの拡張

```prisma
model Session {
  id                String   @id @default(uuid())
  project_id        String
  branch_name       String
  worktree_path     String
  environment_id    String
  container_id      String?  // 既存フィールド

  // 新規フィールド
  active_connections Int      @default(0)
  destroy_at        DateTime?
  last_active_at    DateTime @default(now())
  status            SessionStatus @default(ACTIVE)

  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  project           Project  @relation(fields: [project_id], references: [id], onDelete: Cascade)
  environment       ExecutionEnvironment @relation(fields: [environment_id], references: [id])
  messages          Message[]

  @@index([status])
  @@index([destroy_at])
  @@index([last_active_at])
}

enum SessionStatus {
  ACTIVE      // セッション実行中、接続あり
  IDLE        // セッション実行中、接続なし、タイマー設定中
  ERROR       // エラー状態
  TERMINATED  // 終了済み
}
```

### 変更の詳細

#### 1. active_connections

- **型**: `Int`
- **デフォルト**: `0`
- **目的**: アクティブなWebSocket接続数を記録
- **更新タイミング**: WebSocket接続確立時/切断時

#### 2. destroy_at

- **型**: `DateTime?`
- **Nullable**: はい
- **目的**: セッション自動破棄の予定時刻を記録
- **使用例**: 最後の接続が切断されてから30分後に自動破棄

#### 3. last_active_at

- **型**: `DateTime`
- **デフォルト**: `now()`
- **目的**: 最終アクティブ時刻を記録（PTY入出力、接続確立など）
- **用途**: 長期間非アクティブなセッションの検出、メトリクス収集

#### 4. status

- **型**: `SessionStatus` (Enum)
- **デフォルト**: `ACTIVE`
- **目的**: セッションの現在の状態を記録
- **状態遷移**: 以下のセクションを参照

### SessionStatus Enumの状態遷移

```text
┌─────────┐
│ ACTIVE  │ ← セッション作成時
└────┬────┘
     │ 全接続切断
     │ タイマー設定
     v
┌─────────┐
│  IDLE   │ ← 接続なし、タイマー待機中
└────┬────┘
     │ タイマー期限
     │ 手動削除
     v
┌──────────────┐
│ TERMINATED   │ ← 正常終了
└──────────────┘

    ┌─────────┐
    │ ERROR   │ ← エラー発生（PTYクラッシュ、コンテナクラッシュ等）
    └─────────┘
         │
         │ 手動削除
         v
    ┌──────────────┐
    │ TERMINATED   │
    └──────────────┘
```

#### 状態の定義

| 状態 | 説明 | active_connections | destroy_at |
|-----|------|-------------------|-----------|
| ACTIVE | セッション実行中、接続あり | > 0 | null |
| IDLE | セッション実行中、接続なし | 0 | 設定あり |
| ERROR | エラー状態（PTY/コンテナクラッシュ） | - | null |
| TERMINATED | 終了済み | 0 | null |

### インデックス

パフォーマンス最適化のため、以下のインデックスを追加：

```prisma
@@index([status])         // 状態別のセッション取得
@@index([destroy_at])     // タイマー処理のための検索
@@index([last_active_at]) // 長期非アクティブセッションの検出
```

## 状態管理のロジック

### セッション作成時

```typescript
await prisma.session.create({
  data: {
    id: sessionId,
    project_id: projectId,
    branch_name: branchName,
    worktree_path: worktreePath,
    environment_id: environmentId,
    status: 'ACTIVE',
    active_connections: 0, // 初期は0、接続確立後に更新
    last_active_at: new Date()
  }
})
```

### WebSocket接続確立時

```typescript
// 接続数をインクリメント
await prisma.session.update({
  where: { id: sessionId },
  data: {
    active_connections: { increment: 1 },
    status: 'ACTIVE', // IDLEから復帰する場合
    destroy_at: null, // タイマーをキャンセル
    last_active_at: new Date()
  }
})
```

### WebSocket接続切断時

```typescript
// 接続数をデクリメント
const session = await prisma.session.update({
  where: { id: sessionId },
  data: {
    active_connections: { decrement: 1 },
    last_active_at: new Date()
  }
})

// 最後の接続が切断された場合
if (session.active_connections === 0) {
  const destroyAt = new Date(Date.now() + 30 * 60 * 1000) // 30分後

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: 'IDLE',
      destroy_at: destroyAt
    }
  })
}
```

### PTY入出力時

```typescript
// 最終アクティブ時刻のみ更新（頻繁に更新されるため非同期）
await prisma.session.update({
  where: { id: sessionId },
  data: {
    last_active_at: new Date()
  }
}).catch(error => {
  logger.error('Failed to update last_active_at:', error)
  // エラーをスローせず、ログのみ記録
})
```

### セッション破棄時

```typescript
await prisma.session.update({
  where: { id: sessionId },
  data: {
    status: 'TERMINATED',
    active_connections: 0,
    destroy_at: null,
    container_id: null // Docker環境の場合
  }
})
```

### エラー発生時

```typescript
await prisma.session.update({
  where: { id: sessionId },
  data: {
    status: 'ERROR',
    last_active_at: new Date()
  }
})
```

## サーバー起動時の復元

### 状態復元の手順

```typescript
async function restoreSessionsOnStartup(): Promise<void> {
  logger.info('Restoring sessions from database')

  const sessions = await prisma.session.findMany({
    where: {
      status: { in: ['ACTIVE', 'IDLE'] }
    },
    include: {
      project: true,
      environment: true
    }
  })

  for (const session of sessions) {
    try {
      // PTYが存在するか確認（環境タイプに応じて）
      const ptyExists = await checkPTYExists(session)

      if (ptyExists) {
        // PTYSessionManagerにセッションを復元
        await ptySessionManager.restoreSession({
          sessionId: session.id,
          projectId: session.project_id,
          branchName: session.branch_name,
          worktreePath: session.worktree_path,
          environmentId: session.environment_id
        })

        // タイマーを再設定
        if (session.destroy_at) {
          const now = new Date()
          const destroyAt = new Date(session.destroy_at)

          if (destroyAt > now) {
            // まだ期限前なので再設定
            await ptySessionManager.setDestroyTimer(
              session.id,
              destroyAt.getTime() - now.getTime()
            )
          } else {
            // 期限切れなので即座に破棄
            await ptySessionManager.destroySession(session.id)
          }
        }

        logger.info(`Restored session ${session.id}`)
      } else {
        // 孤立セッション
        logger.warn(`Orphaned session detected: ${session.id}`)
        await cleanupOrphanedSession(session)
      }
    } catch (error) {
      logger.error(`Failed to restore session ${session.id}:`, error)

      // セッションをERROR状態に更新
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'ERROR' }
      })
    }
  }

  logger.info('Session restoration completed')
}
```

### 孤立セッションのクリーンアップ

```typescript
async function cleanupOrphanedSession(session: Session): Promise<void> {
  try {
    // Worktreeを削除（設定による）
    if (shouldDeleteWorktree(session)) {
      await gitService.deleteWorktree(session.worktree_path)
    }

    // Dockerコンテナを削除（該当する場合）
    if (session.container_id) {
      await execAsync(`docker rm -f ${session.container_id}`).catch(error => {
        logger.error(`Failed to remove container ${session.container_id}:`, error)
      })
    }

    // セッションをTERMINATED状態に更新
    await prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'TERMINATED',
        active_connections: 0,
        destroy_at: null,
        container_id: null
      }
    })

    logger.info(`Cleaned up orphaned session ${session.id}`)
  } catch (error) {
    logger.error(`Failed to cleanup orphaned session ${session.id}:`, error)

    // 最低限ERRORマークは付ける
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'ERROR' }
    }).catch(() => {})
  }
}
```

## マイグレーション手順

### 1. スキーマファイルの更新

`prisma/schema.prisma`に上記の変更を適用。

### 2. データベースにスキーマを適用

```bash
npx prisma db push
```

### 3. Prismaクライアントを再生成

```bash
npx prisma generate
```

### 4. 既存データの移行（必要に応じて）

```typescript
// 既存のセッションにデフォルト値を設定
await prisma.session.updateMany({
  where: {
    status: null // 新規フィールドがnullの場合
  },
  data: {
    status: 'ACTIVE',
    active_connections: 0,
    last_active_at: new Date()
  }
})
```

## パフォーマンス考慮事項

### 1. 非同期更新

頻繁に更新される`last_active_at`は非同期で更新し、エラーが発生してもアプリケーションの動作に影響しないようにします。

```typescript
// 待機せず、エラーも無視
updateLastActiveTime(sessionId).catch(error => {
  logger.error('Failed to update last_active_at:', error)
})
```

### 2. バッチ更新

複数のセッションを同時に更新する場合は、トランザクションを使用します。

```typescript
await prisma.$transaction([
  prisma.session.update({ where: { id: 'session1' }, data: { status: 'IDLE' } }),
  prisma.session.update({ where: { id: 'session2' }, data: { status: 'IDLE' } })
])
```

### 3. インデックスの活用

頻繁に検索されるフィールド（`status`, `destroy_at`, `last_active_at`）にインデックスを設定することで、クエリパフォーマンスを向上させます。

## テスト戦略

### 単体テスト

```typescript
describe('Session State Management', () => {
  it('should create session with ACTIVE status', async () => {
    const session = await prisma.session.create({
      data: {
        project_id: 'project1',
        branch_name: 'main',
        worktree_path: '/path',
        environment_id: 'env1',
        status: 'ACTIVE'
      }
    })

    expect(session.status).toBe('ACTIVE')
    expect(session.active_connections).toBe(0)
  })

  it('should transition from ACTIVE to IDLE when last connection closes', async () => {
    // セッション作成
    const session = await createTestSession({ active_connections: 1 })

    // 接続切断
    await prisma.session.update({
      where: { id: session.id },
      data: {
        active_connections: { decrement: 1 },
        status: 'IDLE',
        destroy_at: new Date(Date.now() + 30 * 60 * 1000)
      }
    })

    const updated = await prisma.session.findUnique({ where: { id: session.id } })

    expect(updated?.status).toBe('IDLE')
    expect(updated?.active_connections).toBe(0)
    expect(updated?.destroy_at).not.toBeNull()
  })
})
```

### 統合テスト

```typescript
describe('Session Restoration', () => {
  it('should restore ACTIVE sessions on startup', async () => {
    // テスト用セッションを作成
    await prisma.session.create({
      data: {
        id: 'test-session',
        project_id: 'project1',
        branch_name: 'main',
        worktree_path: '/path',
        environment_id: 'env1',
        status: 'ACTIVE',
        active_connections: 1
      }
    })

    // サーバー再起動をシミュレート
    await restoreSessionsOnStartup()

    // セッションが復元されたことを確認
    const restored = await ptySessionManager.getSession('test-session')
    expect(restored).toBeDefined()
  })
})
```

## 参照

- [要件定義: US-004](../../requirements/stories/US-004.md) @../../requirements/stories/US-004.md
- [設計決定: DEC-004](../decisions/DEC-004.md) @../decisions/DEC-004.md
- [PTYSessionManager](../components/pty-session-manager.md) @../components/pty-session-manager.md
- [既存スキーマ](../../../prisma/schema.prisma) @../../../prisma/schema.prisma
