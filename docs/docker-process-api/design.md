# 設計書: Docker環境プロセス管理API修正

## 1. アーキテクチャ概要

### 現状のアーキテクチャ

```
┌─────────────────┐     ┌─────────────────┐
│  API Endpoint   │────▶│ ProcessManager  │──────▶ HOST環境のみ対応
│ process/route.ts│     │ (レガシー)       │
└─────────────────┘     └─────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  WebSocket      │────▶│ AdapterFactory  │────▶│ HostAdapter     │
│ claude-ws.ts    │     │                 │     │ DockerAdapter   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

問題: APIエンドポイントがProcessManagerのみを使用し、AdapterFactoryを使用していない

### 修正後のアーキテクチャ

```
┌─────────────────┐     ┌─────────────────────────────────────────┐
│  API Endpoint   │────▶│ environment_id確認                      │
│ process/route.ts│     │   ├─ あり → AdapterFactory.getAdapter() │
└─────────────────┘     │   └─ なし → ProcessManager (レガシー)   │
                        └─────────────────────────────────────────┘

┌─────────────────────┐     ┌─────────────────────────────────────────┐
│ ProcessLifecycle    │────▶│ セッションDB参照                        │
│ Manager             │     │   ├─ environment_id あり → Adapter経由  │
│ (idle_timeout)      │     │   └─ environment_id なし → ProcessMgr  │
└─────────────────────┘     └─────────────────────────────────────────┘
```

## 2. コンポーネント設計

### 2.1 修正対象ファイル

| ファイル | 役割 | 修正内容 |
|---------|------|---------|
| `src/app/api/sessions/[id]/process/route.ts` | プロセス状態確認・再起動API | AdapterFactory対応追加 |
| `src/services/process-lifecycle-manager.ts` | アイドルタイムアウト管理 | AdapterFactory対応追加 |

### 2.2 process/route.ts の修正設計

#### GET メソッド（状態確認）

```typescript
// 修正前
const running = processManager.hasProcess(targetSession.id);

// 修正後
let running = false;
if (targetSession.environment_id) {
  // 新しい環境システム
  const environment = await db.query.executionEnvironments.findFirst({
    where: eq(schema.executionEnvironments.id, targetSession.environment_id),
  });
  if (environment) {
    const adapter = AdapterFactory.getAdapter(environment);
    running = adapter.hasSession(targetSession.id);
  }
} else {
  // レガシー: ProcessManager
  running = processManager.hasProcess(targetSession.id);
}
```

#### POST メソッド（再起動）

```typescript
// 修正前
await processManager.startClaudeCode({
  sessionId: targetSession.id,
  worktreePath: targetSession.worktree_path,
});

// 修正後
if (targetSession.environment_id) {
  // 新しい環境システム
  const environment = await db.query.executionEnvironments.findFirst({
    where: eq(schema.executionEnvironments.id, targetSession.environment_id),
  });
  if (environment) {
    const adapter = AdapterFactory.getAdapter(environment);
    await adapter.createSession(
      targetSession.id,
      targetSession.worktree_path,
      undefined,
      { resumeSessionId: targetSession.resume_session_id ?? undefined }
    );
  }
} else {
  // レガシー: ProcessManager
  await processManager.startClaudeCode({
    sessionId: targetSession.id,
    worktreePath: targetSession.worktree_path,
  });
}
```

### 2.3 process-lifecycle-manager.ts の修正設計

#### pauseSession メソッド

```typescript
// 修正前
const processManager = ProcessManager.getInstance();
await processManager.stopProcess(sessionId);

// 修正後
// DBからセッション情報を取得
const session = await db.query.sessions.findFirst({
  where: eq(schema.sessions.id, sessionId),
});

if (session?.environment_id) {
  // 新しい環境システム
  const environment = await db.query.executionEnvironments.findFirst({
    where: eq(schema.executionEnvironments.id, session.environment_id),
  });
  if (environment) {
    const adapter = AdapterFactory.getAdapter(environment);
    adapter.destroySession(sessionId);
  }
} else {
  // レガシー: ProcessManager
  const processManager = ProcessManager.getInstance();
  await processManager.stopProcess(sessionId);
}
```

## 3. データフロー

### 3.1 状態確認フロー（GET /api/sessions/[id]/process）

```
1. リクエスト受信
2. セッションをDBから取得
3. environment_id の確認
   ├─ あり: ExecutionEnvironmentを取得 → AdapterFactory.getAdapter() → adapter.hasSession()
   └─ なし: ProcessManager.hasProcess()
4. { running: boolean } を返却
```

### 3.2 再起動フロー（POST /api/sessions/[id]/process）

```
1. リクエスト受信
2. セッションをDBから取得（projectもinclude）
3. 現在の状態確認（既に実行中なら早期リターン）
4. environment_id の確認
   ├─ あり: ExecutionEnvironmentを取得 → AdapterFactory.getAdapter() → adapter.createSession()
   └─ なし: ProcessManager.startClaudeCode()
5. セッションステータスをDBで更新
6. { success: true, running: true } を返却
```

### 3.3 アイドルタイムアウトフロー

```
1. 定期チェック（1分間隔）
2. タイムアウト経過セッションを検出
3. 各セッションに対してpauseSession()を呼び出し
4. pauseSession()内でセッションのenvironment_idを確認
   ├─ あり: AdapterFactory.getAdapter() → adapter.destroySession()
   └─ なし: ProcessManager.stopProcess()
5. アクティビティをクリア
6. イベント発火
```

## 4. 依存関係

### 4.1 新規インポート（process/route.ts）

```typescript
import { AdapterFactory } from '@/services/adapter-factory';
```

### 4.2 新規インポート（process-lifecycle-manager.ts）

```typescript
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { AdapterFactory } from './adapter-factory';
```

## 5. エラーハンドリング

### 5.1 環境取得失敗時

- environment_idはあるがExecutionEnvironmentが見つからない場合
- ログにerrorを出力し、404エラーを返す（フォールバックしない）
- 理由: environment_id付きセッション（DOCKER等）はProcessManagerで管理されないため、フォールバックすると誤った状態になる

### 5.2 アダプター取得失敗時

- AdapterFactory.getAdapter()がエラーをスローした場合
- ログにerrorを出力し、500エラーを返す（フォールバックしない）
- 理由: 同上

## 6. テスト方針

### 6.1 ユニットテスト

| テストケース | 確認内容 |
|------------|---------|
| GET - environment_idあり、アダプターでrunning | running: true を返す |
| GET - environment_idあり、アダプターでnot running | running: false を返す |
| GET - environment_idなし、ProcessManagerでrunning | running: true を返す |
| GET - environment_idなし、ProcessManagerでnot running | running: false を返す |
| POST - environment_idあり、正常起動 | adapter.createSession()が呼ばれる |
| POST - environment_idなし、正常起動 | processManager.startClaudeCode()が呼ばれる |
| pauseSession - environment_idあり | adapter.destroySession()が呼ばれる |
| pauseSession - environment_idなし | processManager.stopProcess()が呼ばれる |

### 6.2 モック対象

- `db.query.sessions.findFirst`
- `db.query.executionEnvironments.findFirst`
- `AdapterFactory.getAdapter`
- `ProcessManager.getInstance`
- アダプターのメソッド（hasSession, createSession, destroySession）

## 7. 技術的決定事項

### 7.1 エラーハンドリング戦略

environment_idがある場合（環境管理型セッション）は、環境やアダプターの取得に失敗してもProcessManagerにフォールバックしない。
理由: environment_id付きセッション（特にDOCKER）はProcessManager側で管理されないため、フォールバックしても正しく動作せず、状態の不整合を引き起こす。
代わりに、明確なエラー（404/500）を返してクライアントに問題を伝える。

### 7.2 同期/非同期

- `adapter.hasSession()`: 同期（メモリ上のMapを確認するだけ）
- `adapter.createSession()`: 非同期の可能性あり（Dockerコンテナ起動）
- `adapter.destroySession()`: 同期（現在の実装）

process-lifecycle-manager.tsのpauseSessionは元々非同期なので、adapter操作も非同期として扱える。

### 7.3 既存インターフェースの維持

EnvironmentAdapterインターフェースは変更しない。既存のhasSession()、createSession()、destroySession()をそのまま使用する。
