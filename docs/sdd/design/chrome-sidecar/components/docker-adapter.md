# コンポーネント設計: DockerAdapter拡張

## 概要

DockerAdapterの`createSession`と`destroySession`を拡張し、ChromeSidecarServiceを呼び出してサイドカーChromeの起動・停止をセッションライフサイクルに統合する。また、`.mcp.json`への`--browserUrl`注入をコンテナ起動スクリプトに組み込む。

## 対応要件

REQ-001-002, REQ-001-003, REQ-002-001, REQ-003-003

## 変更ファイル

- `src/services/adapters/docker-adapter.ts`
- `src/services/environment-adapter.ts`
- `src/services/adapter-factory.ts`
- `src/types/environment.ts`

## 設計

### CreateSessionOptionsの拡張

```typescript
// src/services/environment-adapter.ts
export interface CreateSessionOptions {
  // ... 既存フィールド
  /** サイドカーChrome設定 */
  chromeSidecar?: ChromeSidecarConfig;
}
```

### DockerEnvironmentConfigの拡張

```typescript
// src/types/environment.ts
export interface DockerEnvironmentConfig {
  // ... 既存フィールド
  /** サイドカーChrome設定 */
  chromeSidecar?: {
    enabled: boolean;
    image: string;
    tag: string;
  };
}
```

### DockerAdapter.createSession の拡張

既存の`createSession`メソッドに、サイドカー起動フェーズを追加する。

```typescript
async createSession(
  sessionId: string,
  workingDir: string,
  initialPrompt?: string,
  options?: CreateSessionOptions
): Promise<void> {
  // ... 既存の前処理（シェルモード判定、フィルタリング確認等）

  // === サイドカー起動フェーズ（新規追加） ===
  let sidecarResult: SidecarStartResult | undefined;
  if (options?.chromeSidecar?.enabled) {
    const sidecarService = new ChromeSidecarService();
    sidecarResult = await sidecarService.startSidecar(
      sessionId,
      options.chromeSidecar
    );

    if (sidecarResult.success) {
      logger.info('DockerAdapter: Chrome sidecar started', {
        sessionId,
        chromeContainer: sidecarResult.containerName,
        networkName: sidecarResult.networkName,
        debugPort: sidecarResult.debugPort,
      });
    } else {
      logger.warn('DockerAdapter: Chrome sidecar failed, continuing without sidecar', {
        sessionId,
        error: sidecarResult.error,
      });
    }
  }

  // === 既存のコンテナオプション構築 ===
  const { createOptions, containerName } = this.buildContainerOptions(workingDir, {
    ...options,
    filterEnabled,
    registryFirewallEnabled,
  });

  // === .mcp.json注入のためのEntrypoint拡張（サイドカー成功時） ===
  if (sidecarResult?.success && sidecarResult.browserUrl) {
    this.injectBrowserUrl(createOptions, sidecarResult.browserUrl);
  }

  // ... 既存のコンテナ作成・起動ロジック

  // === サイドカーネットワークへのClaude Code接続（新規追加） ===
  if (sidecarResult?.success && sidecarResult.networkName) {
    try {
      const sidecarService = new ChromeSidecarService();
      await sidecarService.connectClaudeContainer(
        containerName,
        sidecarResult.networkName
      );
    } catch (error) {
      logger.warn('DockerAdapter: Failed to connect Claude container to sidecar network', {
        sessionId,
        networkName: sidecarResult.networkName,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // Claude Code自体は起動済みなので続行
    }
  }

  // === DB更新: chrome_container_id, chrome_debug_port ===
  if (sidecarResult?.success) {
    db.update(schema.sessions)
      .set({
        chrome_container_id: sidecarResult.containerName,
        chrome_debug_port: sidecarResult.debugPort ?? null,
        updated_at: new Date(),
      })
      .where(eq(schema.sessions.id, sessionId))
      .run();
  }

  // ... 既存のイベント転送ロジック
}
```

### .mcp.json への --browserUrl 注入

Claude Codeコンテナの起動スクリプトに`.mcp.json`の操作を追加する。既存のregistry-firewallパターン（Entrypointをshell経由に変更してセットアップスクリプトを注入）を踏襲する。

```typescript
/**
 * .mcp.jsonにbrowserUrlを注入するためのEntrypoint拡張
 *
 * 既存のregistry-firewallパターンと同様に、
 * Entrypointをshell経由に変更してセットアップスクリプトを挿入する。
 */
private injectBrowserUrl(
  createOptions: Docker.ContainerCreateOptions,
  browserUrl: string
): void {
  // browserUrlを環境変数経由で渡す（シェルインジェクション防止）
  if (!createOptions.Env) createOptions.Env = [];
  createOptions.Env.push(`__CHROME_BROWSER_URL=${browserUrl}`);

  // .mcp.json更新スクリプト
  // jqが利用可能な場合はjqを使用、なければNode.jsワンライナーで処理
  const mcpInjectScript = [
    // WorkingDir(リポジトリルート)の.mcp.jsonを対象とする
    'MCP_FILE="${MCP_FILE:-.mcp.json}"',
    // .mcp.jsonが存在しない場合は空オブジェクトで初期化
    '[ -f "$MCP_FILE" ] || echo \'{"mcpServers":{}}\' > "$MCP_FILE"',
    // Node.jsで.mcp.jsonを更新（jqがない環境を考慮）
    'node -e \'' +
      'const fs = require("fs");' +
      'const f = process.env.MCP_FILE || ".mcp.json";' +
      'const url = process.env.__CHROME_BROWSER_URL;' +
      'if (!url) process.exit(0);' +
      'let cfg = {};' +
      'try { cfg = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}' +
      'if (!cfg.mcpServers) cfg.mcpServers = {};' +
      'if (!cfg.mcpServers["chrome-devtools"]) {' +
        'cfg.mcpServers["chrome-devtools"] = {' +
          '"command": "npx",' +
          '"args": ["-y", "@anthropic-ai/chrome-devtools-mcp@latest", "--browserUrl=" + url]' +
        '};' +
      '} else {' +
        'const args = cfg.mcpServers["chrome-devtools"].args || [];' +
        'const idx = args.findIndex(a => a.startsWith("--browserUrl="));' +
        'if (idx >= 0) args[idx] = "--browserUrl=" + url;' +
        'else args.push("--browserUrl=" + url);' +
        'cfg.mcpServers["chrome-devtools"].args = args;' +
      '}' +
      'fs.writeFileSync(f, JSON.stringify(cfg, null, 2) + "\\n");' +
    '\'',
  ].join(' && ');

  // 既存のEntrypoint/Cmdパターンを維持しつつ、前段にスクリプトを追加
  // registry-firewallと同じパターン: shell -c で元コマンドをexec
  const originalEntrypoint = createOptions.Entrypoint || [];
  const originalCmd = createOptions.Cmd || [];

  // 既にshell経由の場合（registry-firewall等で変換済み）
  if (
    Array.isArray(originalEntrypoint) &&
    originalEntrypoint.length === 2 &&
    originalEntrypoint[0] === '/bin/sh' &&
    originalEntrypoint[1] === '-c' &&
    Array.isArray(originalCmd) &&
    originalCmd.length > 0
  ) {
    // 既存のsetupスクリプトの前にmcp注入を追加
    originalCmd[0] = mcpInjectScript + ' && ' + originalCmd[0];
  } else {
    // shell経由に変換
    const allArgs = [
      ...(Array.isArray(originalEntrypoint) ? originalEntrypoint : [originalEntrypoint]),
      ...(Array.isArray(originalCmd) ? originalCmd : []),
    ].filter(Boolean);
    createOptions.Entrypoint = ['/bin/sh', '-c'];
    createOptions.Cmd = [
      mcpInjectScript + ' && exec "$@"',
      '--',
      ...allArgs,
    ];
  }
}
```

### DockerAdapter.destroySession の拡張

```typescript
async destroySession(sessionId: string): Promise<void> {
  const session = this.sessions.get(sessionId);
  if (session) {
    // ... 既存のクリーンアップロジック

    // === サイドカーChrome停止（新規追加） ===
    // Claude Codeコンテナ停止後にChromeサイドカーを停止
    try {
      const sessionRecord = db.select({
        chrome_container_id: schema.sessions.chrome_container_id,
      }).from(schema.sessions)
        .where(eq(schema.sessions.id, sessionId))
        .get();

      if (sessionRecord?.chrome_container_id) {
        const sidecarService = new ChromeSidecarService();
        await sidecarService.stopSidecar(
          sessionId,
          sessionRecord.chrome_container_id
        );

        // DB更新: chromeカラムをクリア
        db.update(schema.sessions)
          .set({
            chrome_container_id: null,
            chrome_debug_port: null,
            updated_at: new Date(),
          })
          .where(eq(schema.sessions.id, sessionId))
          .run();
      }
    } catch (error) {
      logger.warn('DockerAdapter: Failed to stop Chrome sidecar', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // Chrome停止失敗はセッション破棄を妨げない
      // 次回サーバー起動時のcleanupOrphanedで回収される
    }

    // ... 既存のフィルタリングルールクリーンアップ
  }
}
```

### AdapterFactory の変更

AdapterFactoryの`getDockerAdapter`メソッドにおいて、`chromeSidecar`設定を`DockerAdapterConfig`には含めない。サイドカー設定はセッション作成時のオプションとしてPTYSessionManager経由で渡される。これは既存のfilterEnabled/registryFirewallEnabledと同じパターンである。

### PTYSessionManager の変更

`PTYSessionManager.createSession`で環境のconfig JSONからchromeSidecar設定を読み取り、`CreateSessionOptions`に渡す。

```typescript
// PTYSessionManager.createSession 内
const envConfig: DockerEnvironmentConfig = JSON.parse(environment.config || '{}');
const chromeSidecar = envConfig.chromeSidecar?.enabled
  ? envConfig.chromeSidecar
  : undefined;

await adapter.createSession(sessionId, worktreePath, initialPrompt, {
  ...options,
  chromeSidecar,
});
```

## 既存コードへの影響

| ファイル | 変更種別 | 影響 |
|---------|---------|------|
| docker-adapter.ts | メソッド拡張 | createSession, destroySessionにサイドカーフェーズ追加 |
| environment-adapter.ts | インターフェース拡張 | CreateSessionOptionsにchromeSidecarフィールド追加 |
| adapter-factory.ts | 変更なし | サイドカー設定はセッション単位オプションで渡す |
| pty-session-manager.ts | 軽微な変更 | chromeSidecar設定の読み取り・転送 |
| environment.ts | 型拡張 | DockerEnvironmentConfigにchromeSidecar追加 |
