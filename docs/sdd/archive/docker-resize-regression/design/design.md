# 設計書: Docker環境ターミナルリサイズ回帰修正

## アーキテクチャ概要

本修正は2つのファイルに対する3つの独立した変更で構成される:
- `src/lib/websocket/claude-ws.ts` — WebSocketリサイズメッセージの早期バッファリング
- `src/services/adapters/docker-adapter.ts` — 遅延リサイズの改善とrestart時のリサイズ情報保存

## 変更1: WebSocketリサイズメッセージの早期バッファリング (REQ-001)

### 現状の問題

```
クライアント                    サーバー (claude-ws.ts)
    |                              |
    |-- WebSocket接続 ------------>|
    |                              | wss.on('connection', async (ws) => {
    |-- resize(cols,rows) -------->|   await db.query(...)    ← イベントループに制御渡す
    |                              |   // resize message emitted & DROPPED (no handler)
    |                              |   await createSession(...)
    |                              |   ws.on('message', ...)  ← ここでやっとハンドラー登録
    |                              | })
```

### 修正後の設計

`ws.on('message', ...)`を接続ハンドラーの最初（非同期処理前）に登録する。セッション準備完了前に到着したリサイズメッセージはバッファに保存し、セッション作成後に適用する。

```
クライアント                    サーバー (claude-ws.ts)
    |                              |
    |-- WebSocket接続 ------------>|
    |                              | wss.on('connection', async (ws) => {
    |                              |   let pendingResize = null;
    |                              |   let sessionReady = false;
    |                              |   ws.on('message', handler)  ← 最初に登録
    |-- resize(cols,rows) -------->|     → pendingResize = {cols, rows}  (バッファ)
    |                              |   await db.query(...)
    |                              |   await createSession(...)
    |                              |   sessionReady = true;
    |                              |   if (pendingResize) adapter.resize(pendingResize)  ← 適用
    |                              | })
```

### 実装詳細

```typescript
// claude-ws.ts の connection ハンドラー内

// セッション準備前のリサイズをバッファリング
let pendingResize: { cols: number; rows: number } | null = null;
let sessionReady = false;

// メッセージハンドラーを最初に登録（リサイズ消失防止）
ws.on('message', async (message: Buffer) => {
  try {
    const data = JSON.parse(message.toString());
    if (!data || typeof data !== 'object' || !data.type) return;

    if (data.type === 'resize') {
      // バリデーション（既存ロジックと同一）
      if (!isValidResize(data.data)) return;

      if (!sessionReady) {
        // セッション準備前: バッファリング
        pendingResize = { cols: data.data.cols, rows: data.data.rows };
        return;
      }
      // セッション準備後: 即座に適用（既存ロジック）
      adapter.resize(sessionId, data.data.cols, data.data.rows);
    } else if (!sessionReady) {
      // resize以外のメッセージはセッション準備後まで無視
      return;
    } else {
      // 既存のinput/restart/paste-image処理
    }
  } catch { /* ... */ }
});

// ... 既存の非同期セットアップ処理 ...

sessionReady = true;

// バッファされたリサイズを適用
if (pendingResize) {
  adapter.resize(sessionId, pendingResize.cols, pendingResize.rows);
  pendingResize = null;
}
```

## 変更2: 遅延リサイズの無条件スケジューリング (REQ-002)

### 現状の問題

```typescript
// docker-adapter.ts createSession() の onData ハンドラー内
if (!session.hasReceivedOutput && data.length > 0) {
  session.hasReceivedOutput = true;
  // ↓ 外側チェック: この時点でlastKnownCols/Rowsが未設定なら遅延リサイズは永久にスケジュールされない
  if (session.lastKnownCols && session.lastKnownRows) {
    setTimeout(() => { /* ... */ }, 1000);
  }
}
```

### 修正後の設計

外側のガード条件を削除し、遅延リサイズを無条件でスケジュールする。値のチェックはコールバック内で行う。

```typescript
if (!session.hasReceivedOutput && data.length > 0) {
  session.hasReceivedOutput = true;

  // shellModeでなければ遅延リサイズをスケジュール（無条件）
  if (!session.shellMode) {
    setTimeout(() => {
      const s = this.sessions.get(sessionId);
      if (s && s.lastKnownCols && s.lastKnownRows) {
        s.ptyProcess.resize(s.lastKnownCols, s.lastKnownRows);
      }
    }, 1000);
  }
}
```

### 変更のポイント

- `if (session.lastKnownCols && session.lastKnownRows)` の外側チェックを削除
- `if (!session.shellMode)` のガードを追加（shellModeでは遅延リサイズ不要）
- 1秒後のコールバック内での値チェックは維持

## 変更3: restartSessionでのリサイズ情報保存・復元 (REQ-003)

### 現状の問題

```typescript
restartSession(sessionId, workingDir?) {
  const session = this.sessions.get(sessionId);
  if (session) {
    const { workingDir: wd, containerId } = session;
    this.destroySession(sessionId);  // ← lastKnownCols/Rows消失
    this.waitForContainer(containerId)
      .then(() => this.createSession(sessionId, wd));  // ← 新セッションにリサイズ情報なし
  }
}
```

### 修正後の設計

`destroySession()`呼び出し前にリサイズ情報を退避し、新セッション作成後に復元する。

```typescript
restartSession(sessionId, workingDir?) {
  const session = this.sessions.get(sessionId);
  if (session) {
    const { workingDir: wd, containerId, shellMode,
            lastKnownCols, lastKnownRows } = session;  // ← 退避
    this.destroySession(sessionId);

    if (shellMode) {
      this.createSession(sessionId, wd, undefined, { shellMode: true })
        .then(() => this.restoreResizeInfo(sessionId, lastKnownCols, lastKnownRows));
      return;
    }

    this.waitForContainer(containerId)
      .then(() => this.createSession(sessionId, wd))
      .then(() => this.restoreResizeInfo(sessionId, lastKnownCols, lastKnownRows));
  }
}

private restoreResizeInfo(sessionId: string, cols?: number, rows?: number): void {
  if (!cols || !rows) return;
  const session = this.sessions.get(sessionId);
  if (session) {
    session.lastKnownCols = cols;
    session.lastKnownRows = rows;
    // 即座にリサイズも適用
    session.ptyProcess.resize(cols, rows);
  }
}
```

## テスト戦略

### 新規テスト

| テスト | 対象 | 検証内容 |
|--------|------|----------|
| 遅延リサイズ: lastKnownCols未設定でもスケジュールされる | REQ-002 | 初回出力時にlastKnownCols/Rowsが未設定でもsetTimeoutが呼ばれる |
| 遅延リサイズ: shellModeではスケジュールされない | REQ-002 | shellMode=trueの場合、遅延リサイズがスケジュールされない |
| restartSession: リサイズ情報が保存・復元される | REQ-003 | restart後の新セッションにlastKnownCols/Rowsが引き継がれる |
| restartSession: リサイズ情報なしでもエラーにならない | REQ-003 | lastKnownCols/Rowsが未設定でrestartしてもエラーにならない |

### 既存テスト影響

- DockerAdapterの既存テスト（遅延リサイズ、restart関連）の期待値調整が必要
- HostAdapterのテストには影響なし
