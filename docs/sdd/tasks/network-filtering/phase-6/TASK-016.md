# TASK-016: DockerAdapterのフィルタリング統合（コンテナ作成・停止フロー）

## 説明

DockerAdapterのbuildContainerOptionsとcreateSession/stopSessionを変更し、フィルタリング有効時にinternalネットワーク接続・HTTP_PROXY設定・ルール同期を行う。

- **対象ファイルパス**:
  - 実装: `src/services/adapters/docker-adapter.ts`（修正）
  - テスト: `src/services/adapters/__tests__/docker-adapter.test.ts`（修正）
- **参照設計**:
  - `docs/sdd/design/network-filtering/components/docker-compose-proxy.md`（DockerAdapterへの影響セクション）
  - `docs/sdd/design/network-filtering/index.md`（コンテナ起動/停止フロー）

## 技術的文脈

- DockerAdapter: `src/services/adapters/docker-adapter.ts`
- dockerodeライブラリでコンテナ操作
- NetworkFilterService: `src/services/network-filter-service.ts`（isFilterEnabled, getRules）
- ProxyClient: `src/services/proxy-client.ts`（TASK-013で作成）

## 情報の明確性

| 分類 | 内容 |
|------|------|
| 明示された情報 | フロー設計、ネットワーク設定、環境変数は確定 |
| 不明/要確認の情報 | なし |

## 実装内容

### 1. buildContainerOptions変更

フィルタリング有効時のコンテナ作成オプション変更:

```typescript
// buildContainerOptionsの変更
if (filterEnabled) {
  // NetworkMode: internalネットワークに接続
  createOptions.HostConfig.NetworkMode = process.env.PROXY_NETWORK_NAME || 'claudework-filter';

  // proxy環境変数を追加
  Env.push('HTTP_PROXY=http://network-filter-proxy:3128');
  Env.push('HTTPS_PROXY=http://network-filter-proxy:3128');
}
```

### 2. createSession変更

コンテナ起動後にルール同期を追加:

```typescript
// createSessionフローに追加（container.start()の後）
if (await networkFilterService.isFilterEnabled(this.config.environmentId)) {
  // proxyヘルスチェック
  const proxyClient = new ProxyClient();
  await proxyClient.healthCheck(); // 失敗時はエラー（フェイルセーフ）

  // コンテナIPアドレス取得
  const containerInfo = await docker.inspectContainer(containerName);
  const networkName = process.env.PROXY_NETWORK_NAME || 'claudework-filter';
  const containerIP = containerInfo.NetworkSettings.Networks[networkName]?.IPAddress;

  if (!containerIP) {
    throw new Error('Container IP not found on filter network');
  }

  // ルール同期
  await proxyClient.syncRules(containerIP, this.config.environmentId);

  // containerIPをセッション情報に保存（停止時のクリーンアップ用）
}
```

### 3. stopSession / コンテナ終了時のクリーンアップ

```typescript
// コンテナ停止/終了時に追加
if (session.containerIP) {
  try {
    const proxyClient = new ProxyClient();
    await proxyClient.deleteRules(session.containerIP);
  } catch (error) {
    logger.warn('Failed to cleanup proxy rules', { error });
    // クリーンアップ失敗は警告のみ（コンテナ停止を妨げない）
  }
}
```

### 4. DockerSessionインターフェース拡張

```typescript
interface DockerSession {
  // ...既存フィールド
  containerIP?: string;  // フィルタリング用IPアドレス（追加）
}
```

## 実装手順（TDD）

1. テスト作成: `src/services/adapters/__tests__/docker-adapter.test.ts` に追加
   - 正常系: フィルタリング有効時にNetworkModeが`claudework-filter`に設定される
   - 正常系: フィルタリング有効時にHTTP_PROXY/HTTPS_PROXY環境変数が設定される
   - 正常系: フィルタリング無効時は現行動作（NetworkMode未変更、proxy環境変数なし）
   - 正常系: コンテナ起動後にproxyClient.syncRulesが呼ばれる
   - 正常系: コンテナ停止時にproxyClient.deleteRulesが呼ばれる
   - 異常系: proxyヘルスチェック失敗時にセッション作成がエラーになる
   - 異常系: クリーンアップ失敗時は警告のみでコンテナ停止は継続
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: docker-adapter.ts を修正
5. テスト通過を確認
6. 実装コミット

### テストのモック戦略

- `ProxyClient` クラスをモック
- `networkFilterService.isFilterEnabled` をモック
- `DockerClient.getInstance()` は既存モックを利用

## 受入基準

- [ ] フィルタリング有効時にNetworkModeが設定される
- [ ] フィルタリング有効時にHTTP_PROXY/HTTPS_PROXYが設定される
- [ ] フィルタリング無効時は現行動作を維持
- [ ] コンテナ起動後にルール同期が行われる
- [ ] コンテナ停止時にルールクリーンアップが行われる
- [ ] proxyヘルスチェック失敗時はフェイルセーフ（起動中止）
- [ ] テストが7つ以上追加されている
- [ ] 既存テストが壊れていない
- [ ] ESLintエラーがゼロ

## 依存関係

- TASK-013（ProxyClient）

## 推定工数

40分

## ステータス

`DONE`

## 完了サマリー

DockerAdapterにフィルタリング統合を実装。buildContainerOptionsでネットワーク/プロキシ設定、createSessionでヘルスチェック・IP取得・ルール同期、destroySession/onExitでクリーンアップを追加。TDD: 10テスト追加、全24テストパス。
