# コンポーネント設計: ChromeSidecarService

## 概要

Chromeサイドカーコンテナのライフサイクル（起動・ヘルスチェック・停止・クリーンアップ）を管理する専用サービス。DockerAdapterから呼び出され、サイドカーに関するDocker操作を一箇所に集約する。

## 対応要件

REQ-001-001, REQ-001-002, REQ-001-004, REQ-002-001, REQ-002-002, REQ-004-001, NFR-SEC-001, NFR-SEC-002, NFR-RES-001, NFR-RES-002, NFR-RES-003

## ファイル配置

`src/services/chrome-sidecar-service.ts`

## インターフェース設計

```typescript
/**
 * サイドカー起動結果
 */
export interface SidecarStartResult {
  /** 起動成功かどうか */
  success: boolean;
  /** Chromeコンテナ名 (成功時) */
  containerName?: string;
  /** ネットワーク名 (成功時) */
  networkName?: string;
  /** ホスト側デバッグポート (ポートマッピング成功時) */
  debugPort?: number;
  /** Chrome内部URL (Claude CodeからのCDP接続先) */
  browserUrl?: string;
  /** 失敗理由 (失敗時) */
  error?: string;
}

/**
 * サイドカー設定 (ExecutionEnvironment.config.chromeSidecarから取得)
 */
export interface ChromeSidecarConfig {
  enabled: boolean;
  image: string;   // デフォルト: 'chromium/headless-shell'
  tag: string;     // デフォルト: '131.0.6778.204'
}

/**
 * ChromeSidecarService
 *
 * セッション単位のChromeサイドカーコンテナを管理する。
 * DockerClientを使用してDocker APIと通信する。
 */
export class ChromeSidecarService {
  /**
   * サイドカーChromeを起動する
   *
   * 1. セッション専用ブリッジネットワーク作成
   * 2. Chromeコンテナ作成・起動
   * 3. CDPヘルスチェック (最大30秒)
   * 4. ヘルスチェック成功: SidecarStartResult返却
   *    ヘルスチェック失敗: クリーンアップしてsuccess=false返却
   *
   * @param sessionId - セッションID
   * @param config - サイドカー設定
   * @returns サイドカー起動結果
   */
  async startSidecar(
    sessionId: string,
    config: ChromeSidecarConfig
  ): Promise<SidecarStartResult>;

  /**
   * サイドカーChromeを停止・削除する
   *
   * 1. Chromeコンテナ停止 (AutoRemoveで自動削除)
   * 2. セッション専用ネットワーク削除
   *
   * @param sessionId - セッションID
   * @param containerName - Chromeコンテナ名
   * @param networkName - ネットワーク名 (省略時はセッションIDから推定)
   */
  async stopSidecar(
    sessionId: string,
    containerName: string,
    networkName?: string
  ): Promise<void>;

  /**
   * Claude Codeコンテナをサイドカーネットワークに接続する
   *
   * Claude Codeコンテナ起動後に呼び出し、
   * セッション専用ネットワークに追加接続する。
   *
   * @param claudeContainerName - Claude Codeコンテナ名
   * @param networkName - セッション専用ネットワーク名
   */
  async connectClaudeContainer(
    claudeContainerName: string,
    networkName: string
  ): Promise<void>;

  /**
   * 孤立したChromeコンテナ・ネットワークをクリーンアップする
   *
   * サーバー起動時に呼び出す。
   * DBに記録されたchrome_container_idに対応するコンテナが
   * 実行中でない場合、コンテナとネットワークを削除する。
   */
  async cleanupOrphaned(): Promise<void>;

  /**
   * 現在起動中のサイドカー数を取得する
   *
   * Dockerラベル `claude-work.chrome-sidecar=true` で
   * 実行中コンテナをカウントする。
   */
  async getActiveSidecarCount(): Promise<number>;
}
```

## 内部設計

### 命名規則

| リソース | 命名パターン | 例 |
|----------|------------|-----|
| Chromeコンテナ | `cw-chrome-<session-id>` | `cw-chrome-abc123` |
| ブリッジネットワーク | `cw-net-<session-id>` | `cw-net-abc123` |

### Dockerラベル

全てのリソース（コンテナ、ネットワーク）に以下のラベルを付与する:

| ラベルキー | 値 | 用途 |
|-----------|-----|------|
| `claude-work.session-id` | セッションID | 孤立リソース検出・クリーンアップ |
| `claude-work.chrome-sidecar` | `true` | Chromeコンテナの識別 |
| `claude-work.managed-by` | `claude-work` | ClaudeWork管理リソースの識別 |

### Chromeコンテナ作成オプション

```typescript
const chromeContainerOptions: Docker.ContainerCreateOptions = {
  name: `cw-chrome-${sessionId}`,
  Image: `${config.image}:${config.tag}`,
  // chromium/headless-shell はCLI引数をCmdで渡す
  Cmd: [
    '--no-sandbox',           // コンテナ内ではsandbox不要
    '--disable-gpu',          // ヘッドレス環境
    '--remote-debugging-address=0.0.0.0',
    '--remote-debugging-port=9222',
  ],
  ExposedPorts: {
    '9222/tcp': {},
  },
  Labels: {
    'claude-work.session-id': sessionId,
    'claude-work.chrome-sidecar': 'true',
    'claude-work.managed-by': 'claude-work',
  },
  HostConfig: {
    PortBindings: {
      '9222/tcp': [{ HostPort: '', HostIp: '127.0.0.1' }],
    },
    CapDrop: ['ALL'],
    SecurityOpt: ['no-new-privileges'],
    Memory: 512 * 1024 * 1024,  // 512MB
    AutoRemove: true,
    NetworkMode: `cw-net-${sessionId}`,
  },
};
```

### ネットワーク作成オプション

```typescript
const networkOptions = {
  Name: `cw-net-${sessionId}`,
  Driver: 'bridge',
  Labels: {
    'claude-work.session-id': sessionId,
    'claude-work.managed-by': 'claude-work',
  },
};
```

### CDPヘルスチェック

```typescript
/**
 * CDPヘルスチェック
 *
 * Chrome DevTools Protocol の /json/version エンドポイントに
 * HTTP GETリクエストを送信し、応答を待つ。
 *
 * ポーリング間隔: 1秒
 * 最大待機時間: 30秒
 * 成功判定: HTTP 200レスポンス
 */
private async waitForCDP(
  containerName: string,
  networkName: string,
  timeoutMs: number = 30000
): Promise<boolean> {
  const startTime = Date.now();
  const interval = 1000;

  while (Date.now() - startTime < timeoutMs) {
    try {
      // コンテナ内からCDP確認（ネットワーク内部通信）
      // docker exec でcurlやwgetの代わりにNode.js http.getを使用
      const container = DockerClient.getInstance().getContainer(containerName);
      const exec = await container.exec({
        Cmd: ['wget', '-q', '-O', '-', 'http://localhost:9222/json/version'],
        AttachStdout: true,
      });
      const stream = await exec.start({});
      // ストリームからレスポンスを読み取り
      // 成功すればtrue
      return true;
    } catch {
      // まだ準備中
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return false; // タイムアウト
}
```

注: 実装時にはchromium/headless-shellイメージにwgetが含まれるかを確認し、含まれない場合はNode.jsのhttp モジュールでコンテナの公開ポート経由でチェックする方式に変更する。その場合、ホスト側にマッピングされたポートまたはDockerネットワーク内部のIPアドレスを使用する。

### 孤立リソースクリーンアップ

```
サーバー起動時:

1. DBから chrome_container_id が NOT NULL のセッションを取得
2. 各コンテナについて:
   a. docker inspect で実行状態を確認
   b. 実行中でない場合:
      - コンテナが存在すれば削除（AutoRemoveで既に消えている可能性あり）
      - cw-net-<session-id> ネットワークを削除
      - DB: chrome_container_id = NULL, chrome_debug_port = NULL に更新
3. ラベルベースの追加チェック:
   a. claude-work.chrome-sidecar=true のコンテナ一覧を取得
   b. DBに対応するセッションがないコンテナを停止・削除
   c. claude-work.managed-by=claude-work のネットワーク一覧を取得
   d. 接続コンテナがゼロのネットワークを削除
```

### ポートマッピング失敗時の処理

HostPort='' での動的マッピングが失敗する場合（エフェメラルポート枯渇等）:

1. Chromeコンテナ作成時にPortBindingsを省略して再試行
2. chrome_debug_port = NULL のまま
3. 警告ログを出力
4. コンテナ間通信（内部ネットワーク経由）は維持される

## 依存関係

| 依存先 | 用途 |
|--------|------|
| DockerClient | Docker API操作（コンテナ作成・停止・ネットワーク作成等） |
| logger | ログ出力 |
| db, schema | セッションのchrome_container_id/chrome_debug_port更新 |
