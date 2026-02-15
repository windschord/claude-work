# PTY/セッション管理の設計原則

## 概要

本文書は、ClaudeWorkのPTY/セッション管理における設計原則とガイドラインを定義する。
過去のDocker環境ターミナル表示問題（Issue #87, #91, #92, #101）の連続的な修正から得られた教訓に基づき、今後の開発・修正で遵守すべき原則を策定する。

---

## 1. アーキテクチャ設計原則

### 1.1 レイヤー分離と責務の明確化

現在のアーキテクチャは以下の階層構造を持つ:

```
[WebSocket Layer]     claude-ws.ts / terminal-ws.ts
        |
[Session Manager]     PTYSessionManager (統合管理)
        |
[Adapter Layer]       HostAdapter / DockerAdapter (環境抽象化)
        |
[PTY Layer]           ClaudePTYManager / ptyManager / node-pty
        |
[Infrastructure]      ConnectionManager / ScrollbackBuffer / DB
```

**原則 A1: 各レイヤーは1つの責務のみを持つ**

| レイヤー | 責務 | やってはいけないこと |
|---|---|---|
| WebSocket Layer | プロトコル変換、メッセージルーティング | PTYの直接操作、DB操作 |
| Session Manager | セッションライフサイクル管理、状態遷移 | PTY固有の実装詳細への依存 |
| Adapter Layer | 環境差異の吸収（HOST/Docker/SSH） | WebSocket接続管理、DB直接操作 |
| PTY Layer | プロセス生成・入出力管理 | セッション状態管理、接続管理 |
| Infrastructure | 横断的関心事（接続プール、バッファ、永続化） | ビジネスロジック |

**原則 A2: 依存は常に上位から下位へ（一方向）**

- 下位レイヤーが上位レイヤーを知ってはならない
- EventEmitterによるイベント通知で逆方向の通信を実現する
- import文が逆方向を向いている場合は設計上の問題がある

**原則 A3: レイヤー間のインターフェースは明示的に定義する**

- `EnvironmentAdapter`インターフェースのように、レイヤー境界には必ず型定義を設ける
- 実装クラスへの直接依存ではなく、インターフェースへの依存を優先する

### 1.2 現状の問題点と改善方向

**問題1: HostAdapterの過渡的ラッパー構造**

```
PTYSessionManager -> HostAdapter -> ClaudePTYManager -> PTYSessionManager(再帰的参照)
```

`ClaudePTYManager`は`PTYSessionManager`への「薄いラッパー」と自称しているが、`HostAdapter`がさらにそのラッパーとなっており、3層の不必要な委譲チェーンが存在する。

改善方向:
- `ClaudePTYManager`を廃止し、`HostAdapter`が直接`node-pty`を操作する
- もしくは`HostAdapter`が`PTYSessionManager`の内部ロジックを直接実装する

**問題2: ConnectionManagerの責務過多**

`ConnectionManager`が以下を全て管理している:
- WebSocket接続プール
- スクロールバックバッファ
- イベントハンドラーの登録/解除

改善方向:
- スクロールバックバッファの管理を独立したサービスに分離
- イベントハンドラー登録は`PTYSessionManager`の内部実装に留める

**問題3: claude-ws.tsにおるカプセル化の破壊**

```typescript
// claude-ws.ts:256 - privateフィールドにanyでアクセスしている
const connectionManager = (ptySessionManager as any).connectionManager;
```

改善方向:
- `PTYSessionManager`に`getScrollbackContent(sessionId): string | null`のようなpublicメソッドを追加

---

## 2. 循環参照の防止策

### 2.1 現在の循環参照パターン

```
PTYSessionManager ─imports─> AdapterFactory ─creates─> HostAdapter
     ^                                                      |
     |                                                      |
     └─────── imports ClaudePTYManager ─imports ────────────┘
```

`HostAdapter`は`ClaudePTYManager`をインポートし、`ClaudePTYManager`は`PTYSessionManager`をインポートしている。これは実行時には問題にならない（遅延初期化のため）が、設計上の脆弱性となる。

### 2.2 防止原則

**原則 C1: モジュール依存グラフは有向非巡回グラフ(DAG)でなければならない**

- `import`文を追跡して循環がないことを定期的に検証する
- `madge`等のツールで依存グラフを可視化し、CIに組み込む

**原則 C2: 共有シングルトンへの依存はインターフェース経由で行う**

- シングルトンの具象クラスを直接importせず、インターフェースを介する
- ファクトリ関数や依存注入パターンを使用する

**原則 C3: EventEmitterで逆方向依存を排除する**

- 下位レイヤーから上位レイヤーへの通知はイベントで行う
- 上位レイヤーがイベントをsubscribeし、下位レイヤーはemitのみ行う

---

## 3. イベント伝搬の設計ガイドライン

### 3.1 イベントフロー図

```
[node-pty] ──onData──> [DockerAdapter] ──emit('data')──> [PTYSessionManager]
                                                               |
                                                    ┌─────────┴──────────┐
                                                    v                    v
                                        [ConnectionManager]     [emit('data')]
                                          .broadcast()        (外部リスナー用)
                                               |
                                               v
                                        [WebSocket clients]
```

### 3.2 イベント設計原則

**原則 E1: イベントリスナーの登録は作成時、解除は破棄時に必ず対にする**

```typescript
// 良い例: 登録と解除が対になっている
private registerAdapterHandlers(sessionId, adapter) { ... }
private unregisterAdapterHandlers(sessionId, adapter) { ... }
```

- `registerHandler`を呼んだら、必ず対応する`unregisterHandler`が呼ばれるパスを保証する
- `destroySession`のエラーパスでもリスナー解除を実行する

**原則 E2: エラーイベントのemit前にリスナーの存在を確認する**

```typescript
// 良い例（Issue #101で追加されたパターン）
if (this.listenerCount('error') > 0) {
  this.emit('error', sessionId, error);
}
```

- Node.jsのEventEmitterは`'error'`イベントにリスナーがない場合、プロセスがクラッシュする
- 全ての`emit('error', ...)`の前に`listenerCount`チェックを行う

**原則 E3: イベントハンドラー内でセッションID一致をフィルタリングする**

```typescript
// 現在のパターン（PTYSessionManager.registerAdapterHandlers）
const dataHandler = (sid: string, data: string) => {
  if (sid === sessionId) {  // ← このフィルタリングが必須
    this.handleData(sessionId, data);
  }
};
```

- アダプターはシングルトンのため、全セッションのイベントが同じインスタンスからemitされる
- ハンドラーは必ず自身のセッションIDと一致するイベントのみを処理する

**原則 E4: 非同期イベント処理での競合状態を意識する**

Issue #91で発見されたパターン:
```typescript
// 問題: restartSession後に旧PTYのonExitが遅延発火
ptyProcess.onExit(({ exitCode }) => {
  // ↓ このチェックがないと新セッションが破壊される
  const currentSession = this.sessions.get(sessionId);
  if (currentSession && currentSession.ptyProcess !== ptyProcess) {
    return; // stale event
  }
  // ...
});
```

- PTYの終了イベントは非同期で発火するため、セッション再作成との競合が発生しうる
- onExitハンドラー内では必ず「現在のセッションが自分のものか」を検証する

---

## 4. セッションライフサイクル管理

### 4.1 状態遷移図

```
INITIALIZING ─(PTY created)─> ACTIVE ─(last WS disconnected)─> IDLE
     |                          |  ^                              |
     |                          |  └─(WS reconnected)────────────┘
     |                          |
     |                          ├─(PTY exited)─> TERMINATED
     |                          └─(error)─> ERROR
     |
     └─(creation failed)─> ERROR

IDLE ─(destroy timer expired)─> TERMINATED
IDLE ─(WS reconnected)─> ACTIVE
```

### 4.2 ライフサイクル管理原則

**原則 L1: 状態遷移は明示的かつ一元管理する**

- セッションの状態変更は`PTYSessionManager`のみが行う
- `WebSocket Layer`や`Adapter Layer`が直接DB状態を更新してはならない
- 状態遷移のたびにイベントを発火し、他のコンポーネントに通知する

**原則 L2: リソース解放は確実に行う（部分的な失敗に対応）**

```typescript
async destroySession(sessionId) {
  try {
    this.clearDestroyTimer(sessionId);     // 1. タイマークリア
    this.unregisterAdapterHandlers(...);   // 2. イベント解除
    // 3. 接続切断
    // 4. アダプター破棄
    // 5. Map削除
    // 6. DB更新
  } catch (error) {
    // 部分的にクリーンアップされた状態でもリーク防止
  }
}
```

- destroyの各ステップが独立して失敗してもリソースリークしないようにする
- 特にEventEmitterリスナーとタイマーのクリアは最優先で実行する

**原則 L3: 再接続のグレース期間を設ける**

- WebSocket切断は必ずしもセッション終了を意味しない
- クライアントの一時的な切断に対してPTYを即座に破棄しない
- `PTY_DESTROY_GRACE_PERIOD`（デフォルト5分）で猶予期間を設ける

**原則 L4: サーバー再起動時のセッション復元を考慮する**

- メモリ上のセッション状態はサーバー再起動で消失する
- DBの状態と実際のPTY/コンテナの状態を照合して復元する
- 復元不可能な場合は孤立リソースとして適切にクリーンアップする

### 4.3 タイマー管理のベストプラクティス

**原則 L5: タイマーは必ずキャンセルパスを持つ**

```typescript
// 良い例: タイマーの設定とキャンセルが対になっている
setDestroyTimer(sessionId, delayMs) {
  this.clearDestroyTimer(sessionId); // 既存タイマーをクリア
  const timer = setTimeout(() => { ... }, delayMs);
  this.destroyTimers.set(sessionId, timer);
}

clearDestroyTimer(sessionId) {
  const timer = this.destroyTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    this.destroyTimers.delete(sessionId);
  }
}
```

- `setTimeout`で設定したタイマーは必ず`clearTimeout`できるように参照を保持する
- 破棄時にはタイマーを最初にクリアする（重複実行防止）

---

## 5. テスト戦略

### 5.1 テストピラミッド

```
          /  E2E Tests  \          ← 少数、ブラウザ操作
         / Integration   \         ← WebSocket + PTY統合
        /   Unit Tests    \        ← 多数、個別コンポーネント
       ────────────────────
```

### 5.2 単体テストの原則

**原則 T1: 外部依存は全てモックする**

- `node-pty`: `pty.spawn`をモックし、EventEmitterで`onData`/`onExit`をシミュレート
- `child_process`: `execFile`/`exec`をモックし、Docker CLIの応答をシミュレート
- `ws.WebSocket`: `readyState`と`send`をモックしてメッセージ送受信を検証
- DB: `drizzle-orm`のクエリをモックしてDB操作を検証

**原則 T2: 状態遷移のテストは全パスを網羅する**

- 正常系: INITIALIZING -> ACTIVE -> IDLE -> TERMINATED
- エラー系: INITIALIZING -> ERROR, ACTIVE -> ERROR
- 再接続: IDLE -> ACTIVE
- 競合: restartSession中のonExit遅延発火

**原則 T3: 非同期イベントの順序とタイミングをテストする**

```typescript
// Issue #87/92/101で発見されたパターンのテスト例
it('初回出力受信後に遅延リサイズが実行される', async () => {
  vi.useFakeTimers();
  // 1. セッション作成
  // 2. resize()でサイズを設定
  // 3. onData発火（初回出力）
  // 4. 1秒進める
  // 5. ptyProcess.resizeが呼ばれたことを検証
  vi.useRealTimers();
});
```

- `vi.useFakeTimers()`でsetTimeout/setIntervalを制御可能にする
- イベントの発火順序が正しいことを検証する

**原則 T4: リソースリークの検出テストを書く**

```typescript
it('destroySession後にイベントリスナーが残っていないこと', () => {
  // 1. セッション作成
  // 2. adapter.listenerCount('data') > 0 を確認
  // 3. セッション破棄
  // 4. adapter.listenerCount('data') === 0 を確認
});
```

### 5.3 統合テスト

**原則 T5: WebSocket + PTYの統合は実際の接続で検証する**

- `ws`ライブラリの実際のWebSocketサーバー/クライアントを使用
- PTYは`node-pty`のモックで代替（実プロセスは不要）
- メッセージの往復、接続/切断、リサイズの一連のフローを検証

### 5.4 E2Eテスト

**原則 T6: ブラウザ操作でのターミナル表示を検証する**

- Playwrightでブラウザを起動し、実際のターミナル画面を操作
- XTerm.jsのレンダリング結果をスクリーンショットで検証
- Docker環境での表示回帰テストは特に重要（Issue #87/92/101）

---

## 6. Docker環境固有の設計原則

### 6.1 コンテナライフサイクル

**原則 D1: コンテナの起動完了を待ってからPTY操作を行う**

```typescript
// Issue #101で追加されたパターン
await this.waitForContainerReady(containerName);
```

- `docker run`は非同期にコンテナを起動する
- コンテナ内のプロセスが完全に起動する前にresizeやwriteを行うと無視される
- `docker inspect` + `docker exec`のヘルスチェックで起動完了を確認する

**原則 D2: PTY spawn時のターミナルサイズをクライアントから取得する**

```typescript
// Issue #101で追加されたパターン
const ptyProcess = pty.spawn('docker', args, {
  cols: options?.cols ?? 80,  // クライアントサイズを使用
  rows: options?.rows ?? 24,
});
```

- デフォルト80x24ではなく、実際のクライアントターミナルサイズで初期化する
- WebSocket接続開始時にクライアントからresizeメッセージを受け取り、spawn時に適用する

**原則 D3: 遅延リサイズで初期サイズの適用漏れに対処する**

```typescript
// Issue #87で導入、#92で強化されたパターン
if (!session.hasReceivedOutput && data.length > 0) {
  session.hasReceivedOutput = true;
  setTimeout(() => {
    // 初回出力後に保存済みサイズで再適用
    if (s && s.lastKnownCols && s.lastKnownRows) {
      s.ptyProcess.resize(s.lastKnownCols, s.lastKnownRows);
    }
  }, 1000);
}
```

- Docker環境ではコンテナ起動のオーバーヘッドにより、初期resizeが効かない場合がある
- 初回出力受信後にresizeを再適用することで確実にサイズを反映する

**原則 D4: コンテナ停止は明示的かつグレースフルに行う**

```typescript
// Issue #91で導入されたパターン
private async stopContainer(containerName: string): Promise<void> {
  try {
    await execFileAsync('docker', ['stop', '-t', '10', containerName]);
  } catch {
    // フォールバック: 強制停止
    await execFileAsync('docker', ['kill', containerName]);
  }
}
```

- `docker stop`で正常停止を試みた後、タイムアウトで`docker kill`にフォールバック
- PTY終了時にコンテナが残存しないよう、明示的に停止処理を実行する

---

## 7. 今回のIssue #101修正に適用すべき原則の要約

Issue #101は以下の連鎖的な問題から発生した:

1. **#87**: Docker環境でのリサイズが初期サイズに反映されない -> 遅延リサイズ導入
2. **#91**: Docker環境でターミナル入力不能 -> コンテナ停止処理改善
3. **#92**: #87の遅延リサイズが回帰 -> 早期バッファリング、無条件スケジューリング
4. **#101**: 黒画面問題 + Unhandled error -> PTY spawn時のサイズ指定、エラーハンドラー順序修正

**根本原因の共通パターン:**

- Docker環境のコンテナ起動の非同期性に対する考慮不足
- イベントハンドラーの登録タイミングの問題（登録前のイベント消失）
- エラーイベントのリスナー不在によるプロセスクラッシュ

**適用すべき主要原則:**

| 原則 | 内容 | 対象Issue |
|---|---|---|
| E1 | イベントリスナーの登録/解除を対にする | #101 |
| E2 | エラーemit前にリスナー存在確認 | #101 |
| E4 | 非同期イベントの競合状態を検証 | #91 |
| D1 | コンテナ起動完了を待つ | #101 |
| D2 | PTY spawn時にクライアントサイズを使用 | #101 |
| D3 | 遅延リサイズで初期サイズ適用漏れに対処 | #87, #92 |
| D4 | コンテナ停止はグレースフルに | #91 |
| T3 | 非同期イベントの順序/タイミングをテスト | #87, #92, #101 |

---

## 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-02-15 | 初版作成（Issue #101分析に基づく） |
