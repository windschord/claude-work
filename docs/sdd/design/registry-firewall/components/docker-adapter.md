# コンポーネント設計: DockerAdapter拡張

## 概要

DockerAdapterの`buildContainerOptions`メソッドを拡張し、registry-firewallが有効な場合にパッケージマネージャーのレジストリ設定をコンテナに注入する。

## 対応要件

REQ-004, REQ-005, REQ-006, NFR-SEC-002, NFR-SEC-003, NFR-AVA-001

## 設計

### CreateSessionOptionsの拡張

```typescript
interface CreateSessionOptions {
  // ... 既存フィールド
  registryFirewallEnabled?: boolean;  // registry-firewall有効フラグ
}
```

### buildContainerOptionsへの追加ロジック

`filterEnabled`チェックの後に、`registryFirewallEnabled`チェックを追加:

```typescript
// Registry Firewall: パッケージマネージャーのレジストリ設定
if (options?.registryFirewallEnabled) {
  const rfHost = process.env.REGISTRY_FIREWALL_URL || 'http://registry-firewall:8080';

  // pip (環境変数で設定)
  Env.push(`PIP_INDEX_URL=${rfHost}/pypi/simple/`);
  Env.push(`PIP_TRUSTED_HOST=registry-firewall`);

  // go (環境変数で設定)
  Env.push(`GOPROXY=${rfHost}/go/,direct`);

  // npm (環境変数では設定不可、起動スクリプトで設定)
  // cargo (設定ファイルが必要、起動スクリプトで設定)
  // → Entrypointをラッパースクリプトに変更
}
```

### npm/cargoの設定注入

npmとcargoは環境変数だけでは設定できないため、コンテナ起動時にスクリプトで設定する。

方式: Entrypointの前にshellコマンドで設定を注入

```typescript
if (options?.registryFirewallEnabled && !options?.shellMode) {
  const rfHost = process.env.REGISTRY_FIREWALL_URL || 'http://registry-firewall:8080';
  // URL検証。無効な場合はスキップ
  let rfHostname: string;
  try { rfHostname = new URL(rfHost).hostname; } catch { /* skip */ return; }

  // 重複env varを除去してから注入
  Env.push(`PIP_INDEX_URL=${rfHost}/pypi/simple/`);
  Env.push(`PIP_TRUSTED_HOST=${rfHostname}`);
  Env.push(`GOPROXY=${rfHost}/go/,direct`);

  // filterEnabled併用時: registry-firewallへの通信をHTTP_PROXYから除外
  if (options?.filterEnabled) {
    Env.push(`NO_PROXY=${rfHostname}`);
    Env.push(`no_proxy=${rfHostname}`);
  }

  // npm/cargoはprintf方式で設定ファイルを生成
  const setupScript = [
    `npm config set registry '${rfHost}/npm/'`,
    `mkdir -p ~/.cargo`,
    `printf '%s\\n' '...' > ~/.cargo/config.toml`,
  ].join(' && ');

  const originalCmd = [...Entrypoint, ...(Cmd.length > 0 ? Cmd : [])];
  Entrypoint = ['/bin/sh', '-c'];
  Cmd = [setupScript + ' && exec "$@"', '--', ...originalCmd];
}
```

### 既存network-filter-proxyとの共存

- `filterEnabled`と`registryFirewallEnabled`は独立したフラグ
- `registryFirewallEnabled`単独ではNetworkModeを変更しない。registry-firewallはdocker-compose.ymlのdefaultネットワークにも接続しているため、コンテナがデフォルトのブリッジネットワークにいればregistry-firewallに到達可能
- 両方が有効の場合:
  - HTTP_PROXY/HTTPS_PROXY → network-filter-proxy(一般的なHTTP通信)
  - NO_PROXY → registry-firewallホスト名(プロキシをバイパス)
  - パッケージマネージャー設定 → registry-firewall(パッケージレジストリ)

### registryFirewallEnabledフラグの取得

セッション作成時(`createSession`)で、ConfigServiceから設定を取得:

```typescript
// PTYSessionManager.createSession (src/services/pty-session-manager.ts)
const configService = getConfigService();
const config = configService.getConfig();

// DockerAdapter.createSessionに渡すoptions
const options: CreateSessionOptions = {
  filterEnabled: networkFilterEnabled,
  registryFirewallEnabled: config.registry_firewall_enabled,
  // ...
};
```

### 障害時の振る舞い (NFR-AVA-001)

- registry-firewallが停止している場合でもコンテナは起動する
- パッケージマネージャーの設定は注入されるが、実際のパッケージインストール時にregistry-firewallに接続できずエラーとなる
- これは意図した動作（セキュリティ上、フォールバックで直接レジストリにアクセスさせない）
