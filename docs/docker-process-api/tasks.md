# タスク管理書: Docker環境プロセス管理API修正

## タスク一覧

| ID | タスク | 状態 | 要件ID | 依存 |
|----|--------|------|--------|------|
| T-001 | process/route.ts GET メソッドの環境対応 | DONE | REQ-001 | - |
| T-002 | process/route.ts POST メソッドの環境対応 | DONE | REQ-002 | T-001 |
| T-003 | process-lifecycle-manager.ts pauseSession の環境対応 | DONE | REQ-003 | - |
| T-004 | ユニットテストの作成・実行 | DONE | 全体 | T-001, T-002, T-003 |

## タスク詳細

---

### T-001: process/route.ts GET メソッドの環境対応

**状態:** DONE
**完了サマリー:** environment_idの有無に応じてAdapterFactory経由またはProcessManagerで状態確認する実装を追加。環境未発見/adapter取得失敗時は404/500エラーを返す。
**要件:** REQ-001
**ファイル:** `src/app/api/sessions/[id]/process/route.ts`
**依存:** なし

**TDD手順:**

1. テストファイル作成: `src/app/api/sessions/[id]/process/__tests__/route.test.ts`
2. テストケース作成:
   - environment_idあり + adapter.hasSession() = true → running: true
   - environment_idあり + adapter.hasSession() = false → running: false
   - environment_idなし + processManager.hasProcess() = true → running: true
   - environment_idなし + processManager.hasProcess() = false → running: false
3. テスト実行（失敗確認）
4. 実装
5. テスト実行（成功確認）

**実装内容:**

```typescript
// 動的インポート（node-ptyのビルド時読み込み回避）
async function getAdapterFactory() {
  const { AdapterFactory } = await import('@/services/adapter-factory');
  return AdapterFactory;
}

// GETメソッド内
const targetSession = await db.query.sessions.findFirst({
  where: eq(schema.sessions.id, id),
});

if (!targetSession) {
  return NextResponse.json({ error: 'Session not found' }, { status: 404 });
}

let running = false;

if (targetSession.environment_id) {
  // 新しい環境システム
  const environment = await db.query.executionEnvironments.findFirst({
    where: eq(schema.executionEnvironments.id, targetSession.environment_id),
  });
  if (!environment) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
  }
  try {
    const AdapterFactory = await getAdapterFactory();
    const adapter = AdapterFactory.getAdapter(environment);
    running = adapter.hasSession(targetSession.id);
  } catch (adapterError) {
    logger.error('Failed to get adapter for environment-backed session', {
      error: adapterError,
      session_id: id,
      environment_id: targetSession.environment_id,
    });
    return NextResponse.json({ error: 'Failed to get environment adapter' }, { status: 500 });
  }
} else {
  // レガシー: ProcessManager
  running = processManager.hasProcess(targetSession.id);
}
```

**受入基準:**
- [ ] environment_idがある場合、AdapterFactory経由で状態確認する
- [ ] environment_idがない場合、ProcessManagerで状態確認する
- [ ] 環境取得失敗時に404エラーを返す（フォールバックしない）
- [ ] adapter取得失敗時に500エラーを返す（フォールバックしない）
- [ ] テストが全て通過する

---

### T-002: process/route.ts POST メソッドの環境対応

**状態:** DONE
**完了サマリー:** environment_idの有無に応じてAdapterFactory経由またはProcessManagerで起動する実装を追加。resume_session_idサポート付き。
**要件:** REQ-002
**ファイル:** `src/app/api/sessions/[id]/process/route.ts`
**依存:** T-001（インポートを共有）

**TDD手順:**

1. テストケース追加:
   - environment_idあり → adapter.createSession()が呼ばれる
   - environment_idなし → processManager.startClaudeCode()が呼ばれる
   - 既にrunning → 早期リターン（T-001の状態確認を使用）
2. テスト実行（失敗確認）
3. 実装
4. テスト実行（成功確認）

**実装内容:**

```typescript
// POSTメソッド内の状態確認もT-001と同様に修正

// 状態確認
let isRunning = false;
if (targetSession.environment_id) {
  const environment = await db.query.executionEnvironments.findFirst({
    where: eq(schema.executionEnvironments.id, targetSession.environment_id),
  });
  if (environment) {
    try {
      const adapter = AdapterFactory.getAdapter(environment);
      isRunning = adapter.hasSession(targetSession.id);
    } catch {
      isRunning = processManager.hasProcess(targetSession.id);
    }
  }
} else {
  isRunning = processManager.hasProcess(targetSession.id);
}

if (isRunning) {
  return NextResponse.json({
    success: true,
    running: true,
    message: 'Process already running',
  });
}

// プロセス起動
if (targetSession.environment_id) {
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
  } else {
    throw new Error(`Environment not found: ${targetSession.environment_id}`);
  }
} else {
  await processManager.startClaudeCode({
    sessionId: targetSession.id,
    worktreePath: targetSession.worktree_path,
  });
}
```

**受入基準:**
- [ ] environment_idがある場合、AdapterFactory経由で起動する
- [ ] environment_idがない場合、ProcessManagerで起動する
- [ ] 環境が見つからない場合、エラーを返す
- [ ] テストが全て通過する

---

### T-003: process-lifecycle-manager.ts pauseSession の環境対応

**状態:** DONE
**完了サマリー:** DBからセッション情報を取得し、environment_idの有無に応じてAdapterFactory経由またはProcessManagerで停止する実装を追加。
**要件:** REQ-003
**ファイル:** `src/services/process-lifecycle-manager.ts`
**依存:** なし

**TDD手順:**

1. テストファイル確認: `src/services/__tests__/process-lifecycle-manager.test.ts`
2. テストケース追加:
   - environment_idあり → adapter.destroySession()が呼ばれる
   - environment_idなし → processManager.stopProcess()が呼ばれる
3. テスト実行（失敗確認）
4. 実装
5. テスト実行（成功確認）

**実装内容:**

```typescript
// 動的インポート（node-ptyのビルド時読み込み回避）
async function getAdapterFactory() {
  const { AdapterFactory } = await import('./adapter-factory');
  return AdapterFactory;
}

// pauseSessionメソッド修正
async pauseSession(
  sessionId: string,
  reason: 'idle_timeout' | 'manual' | 'server_shutdown'
): Promise<void> {
  logger.info(`Pausing session ${sessionId} due to ${reason}`);

  try {
    // DBからセッション情報を取得
    const session = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, sessionId),
    });

    if (session?.environment_id) {
      // 新しい環境システム: AdapterFactory経由で停止
      const environment = await db.query.executionEnvironments.findFirst({
        where: eq(schema.executionEnvironments.id, session.environment_id),
      });
      if (!environment) {
        // environment_id付きセッションに対応する環境が存在しない場合は
        // ProcessManagerへはフォールバックせずエラーとする
        logger.error('Environment not found for environment-managed session', {
          sessionId,
          environmentId: session.environment_id,
        });
        throw new Error(`Execution environment not found for session ${sessionId}`);
      }

      try {
        const AdapterFactory = await getAdapterFactory();
        const adapter = AdapterFactory.getAdapter(environment);
        adapter.destroySession(sessionId);
      } catch (adapterError) {
        // environment_id付きセッションはProcessManagerでは管理されないため、
        // フォールバックせずエラーとして扱う
        logger.error('Failed to stop session via environment adapter', {
          error: adapterError,
          sessionId,
          environmentId: session.environment_id,
        });
        throw adapterError;
      }
    } else {
      // レガシー: ProcessManager
      const processManager = ProcessManager.getInstance();
      await processManager.stopProcess(sessionId);
    }

    // アクティビティをクリア
    this.clearActivity(sessionId);

    // イベント発火
    this.emit('processPaused', sessionId, reason);

    logger.info(`Session ${sessionId} stopped successfully`);
  } catch (error) {
    logger.error(`Failed to stop session ${sessionId}:`, error);
    throw error;
  }
}
```

**受入基準:**
- [ ] environment_idがある場合、AdapterFactory経由で停止する
- [ ] environment_idがない場合、ProcessManagerで停止する
- [ ] 環境取得失敗時にエラーをスローする（フォールバックしない）
- [ ] adapter取得失敗時にエラーをスローする（フォールバックしない）
- [ ] テストが全て通過する

---

### T-004: ユニットテストの作成・実行

**状態:** DONE
**完了サマリー:** route.test.tsに9テスト追加(計15テスト)、process-lifecycle-manager.test.tsに5テスト追加(計28テスト)。全テスト通過確認済み。
**要件:** 全体
**依存:** T-001, T-002, T-003

**作成するテスト:**

1. `src/app/api/sessions/[id]/process/__tests__/route.test.ts`（新規作成）
2. `src/services/__tests__/process-lifecycle-manager.test.ts`（テストケース追加）

**モック対象:**

```typescript
// process/route.ts用
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      sessions: { findFirst: vi.fn() },
      executionEnvironments: { findFirst: vi.fn() },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ run: vi.fn() }),
      }),
    }),
  },
  schema: { sessions: {}, executionEnvironments: {} },
}));

vi.mock('@/services/adapter-factory', () => ({
  AdapterFactory: {
    getAdapter: vi.fn(),
  },
}));

vi.mock('@/services/process-manager', () => ({
  ProcessManager: {
    getInstance: vi.fn().mockReturnValue({
      hasProcess: vi.fn(),
      startClaudeCode: vi.fn(),
      stopProcess: vi.fn(),
    }),
  },
}));
```

**テスト実行:**

```bash
npm test -- src/app/api/sessions/[id]/process/__tests__/route.test.ts
npm test -- src/services/__tests__/process-lifecycle-manager.test.ts
```

**受入基準:**
- [ ] 全テストケースが通過する
- [ ] カバレッジが十分である（新規コードの80%以上）
- [ ] 既存テストが壊れていない

---

## 完了基準

1. [ ] T-001〜T-003の実装が完了している
2. [ ] T-004のテストが全て通過している
3. [ ] 既存のテストスイートが通過している
4. [ ] TypeScriptビルドが成功している
5. [ ] 手動テストで以下を確認:
   - Docker環境のセッションでProcessStatusが正しく表示される
   - Docker環境のセッションで再起動ボタンが正しく動作する
   - Docker環境のセッションでidle_timeoutが正しく動作する
