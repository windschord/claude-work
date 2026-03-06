# 技術設計書: ネットワークフィルタリング無保護ウィンドウの修正 (Issue #193)

## 概要

- **要件**: [docs/sdd/requirements/network-filtering/issue-193-unprotected-window.md](../../requirements/network-filtering/issue-193-unprotected-window.md)
- **対象ファイル**: `src/services/adapters/docker-adapter.ts`, `src/services/network-filter-service.ts`
- **対象テスト**: `src/services/adapters/__tests__/docker-adapter-filter.test.ts`

## 修正アプローチ: NetworkMode: 'none' + bridge再接続方式

### 設計方針

フィルタリングが有効な場合にのみ、コンテナを `NetworkMode: 'none'` で作成・起動し、bridgeネットワークに接続した後にsubnetを取得してiptablesルールを適用する。フィルタリングが無効な場合は既存の動作を維持する。

### 修正後フロー（フィルタリング有効時）

```text
1. isFilterEnabled(environmentId) で有効チェック
   ↓ 有効
2. buildContainerOptions() → NetworkMode: 'none' に上書き
   ↓
3. container.create(options) ← ネットワークなしで作成
   ↓
4. container.attach() ← ストリームをアタッチ
   ↓
5. ptyProcess.setStream(stream)
   ↓
6. container.start() ← ネットワークなしで起動（安全）
   ↓
7. docker.getNetwork('bridge').connect({ Container: container.id })
   ← bridgeネットワークに接続（iptablesルール適用前は通信可能だが、起動直後で初期化中のため、ユーザー入力は未受付）
   ↓
8. getContainerSubnet(container) ← bridge接続後にsubnetを取得
   ↓
9. applyFilter(environmentId, subnet) ← iptablesルール適用
   ↓
10. waitForContainerReady() ← Claude Code起動待ち（フィルタリング済み）
```

### 修正後フロー（フィルタリング無効時）

```text
（既存フローを維持）
container.start()
getContainerSubnet()
applyFilter() ← 内部でスキップ
waitForContainerReady()
```

### リスク分析

**残存する隙間**: step 7（bridge接続）からstep 9（applyFilter完了）までの間は、コンテナはネットワークに接続されているがiptablesルールがない状態。ただし：
- step 6でコンテナは起動したばかりで、Claude Codeの初期化が完了していない
- step 10のwaitForContainerReadyが完了するまでClaude Codeはユーザー入力を受け付けない
- 通常この隙間は数百ミリ秒から1秒程度であり、大幅に改善される
- ただし、applyFilter() 内でのDNS解決に時間がかかる場合、この隙間が数秒以上に拡大する可能性がある（DNS応答遅延・タイムアウトが発生した場合）

これは完全なゼロリスクではないが、現状の「コンテナ起動から数秒間の無保護」と比べて大幅に改善される。

## 既知の制約と将来の改善

### 1. bridge接続からapplyFilter完了までの隙間（DNS解決遅延時の拡大）

現状の設計では、step 7（bridge接続）からstep 9（applyFilter完了）の間は無保護ウィンドウが存在する。applyFilter() 内でDNS解決が行われる場合、DNS応答の遅延やタイムアウトにより、この隙間が数秒以上に拡大する可能性がある。

**将来の緩和策候補**:
- `container.pause()` / `container.unpause()` を活用し、bridge接続直後にコンテナをpauseして、applyFilter完了後にunpauseする
- applyFilter() の事前DNS解決（コンテナ起動前にDNSを解決しておき、IPアドレス直接指定でiptablesルールを適用）

### 2. getContainerSubnetのフォールバック値とズレの可能性

`getContainerSubnet()` でsubnet取得に失敗した場合、デフォルト値 `172.17.0.0/16` にフォールバックする実装が存在する可能性がある。実際のDocker bridgeネットワークのsubnetがこのデフォルト値と異なる環境では、iptablesルールが正しく機能しない可能性がある。

**将来の緩和策候補**:
- subnet取得リトライロジックの追加
- フォールバック時に警告ログを出力し、管理者が検知できるようにする
- subnet取得失敗時はコンテナ起動を中断してエラーにする（セキュリティ優先）

## コンポーネント設計

### 1. NetworkFilterService に isFilterEnabled() 追加

**ファイル**: `src/services/network-filter-service.ts`

```typescript
/**
 * フィルタリングが有効かどうかを確認するヘルパーメソッド
 * @param environmentId - 環境ID
 * @returns フィルタリングが有効な場合true
 */
async isFilterEnabled(environmentId: string): Promise<boolean> {
  const config = await this.getFilterConfig(environmentId);
  return config !== null && config.enabled;
}
```

### 2. DockerAdapter の createSession() 修正

**ファイル**: `src/services/adapters/docker-adapter.ts`

```typescript
// フィルタリング有効チェック（container.start()前に実施）
const filterEnabled = await networkFilterService.isFilterEnabled(this.config.environmentId);

// buildContainerOptions()で作成したオプションをベースに
const { createOptions, containerName } = this.buildContainerOptions(workingDir, options);

// フィルタリング有効時はNetworkModeをnoneに設定
if (filterEnabled) {
  createOptions.HostConfig = createOptions.HostConfig ?? {};
  createOptions.HostConfig.NetworkMode = 'none';
}

// コンテナ作成（NetworkMode: noneの場合はネットワークなし）
container = await DockerClient.getInstance().createContainer(createOptions);

// ... attach, setStream ...

// コンテナ起動
await container.start();

// フィルタリング有効時: bridgeネットワークに接続してからフィルタ適用
if (filterEnabled) {
  // bridgeネットワークに接続
  const docker = DockerClient.getInstance().getDockerInstance();
  const bridgeNetwork = docker.getNetwork('bridge');
  await bridgeNetwork.connect({ Container: container.id });
}

// ネットワークフィルタリング適用
try {
  const containerSubnet = await this.getContainerSubnet(container);
  await networkFilterService.applyFilter(this.config.environmentId, containerSubnet);
  filterApplied = true;
} catch (filterError) {
  // エラーハンドリング（既存）
}
```

### 3. DockerClient に getDockerInstance() の活用

`DockerClient.getDockerInstance()` は既存のメソッドで、Dockerインスタンスを返す。このメソッドを使ってネットワーク操作を行う。

```typescript
const docker = DockerClient.getInstance().getDockerInstance();
const bridgeNetwork = docker.getNetwork('bridge');
await bridgeNetwork.connect({ Container: container.id });
```

## テスト設計

### 新規テストケース（docker-adapter-filter.test.ts に追加）

#### フィルタリング有効時の NetworkMode 'none' テスト

```typescript
describe('createSession with filter enabled', () => {
  beforeEach(() => {
    // isFilterEnabled が true を返すようにモック
    mockIsFilterEnabled.mockResolvedValue(true);
  });

  it('フィルタリング有効時はNetworkModeがnoneに設定される', async () => {
    await adapter.createSession('session-1', '/workspace');

    const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
    expect(createOptions.HostConfig.NetworkMode).toBe('none');
  });

  it('フィルタリング有効時はbridgeネットワークに接続される', async () => {
    await adapter.createSession('session-1', '/workspace');

    expect(mockBridgeNetwork.connect).toHaveBeenCalledWith({
      Container: mockContainer.id,
    });
  });

  it('フィルタリング有効時はbridge接続後にapplyFilterが呼ばれる', async () => {
    const callOrder: string[] = [];
    mockBridgeNetwork.connect.mockImplementation(async () => {
      callOrder.push('bridge.connect');
    });
    mockApplyFilter.mockImplementation(async () => {
      callOrder.push('applyFilter');
    });

    await adapter.createSession('session-1', '/workspace');

    expect(callOrder.indexOf('bridge.connect')).toBeLessThan(
      callOrder.indexOf('applyFilter')
    );
  });

  it('bridge接続失敗時はコンテナをクリーンアップする', async () => {
    mockBridgeNetwork.connect.mockRejectedValue(new Error('Network not found'));

    await expect(adapter.createSession('session-1', '/workspace')).rejects.toThrow();
    expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
  });
});
```

#### フィルタリング無効時の既存動作維持テスト

```typescript
describe('createSession with filter disabled', () => {
  beforeEach(() => {
    // isFilterEnabled が false を返すようにモック
    mockIsFilterEnabled.mockResolvedValue(false);
  });

  it('フィルタリング無効時はNetworkModeがデフォルト（未設定）', async () => {
    await adapter.createSession('session-1', '/workspace');

    const createOptions = mockDockerClient.createContainer.mock.calls[0][0];
    expect(createOptions.HostConfig.NetworkMode).toBeUndefined();
  });

  it('フィルタリング無効時はbridge接続は実施されない', async () => {
    await adapter.createSession('session-1', '/workspace');

    expect(mockBridgeNetwork.connect).not.toHaveBeenCalled();
  });
});
```

#### isFilterEnabled のテスト（network-filter-service.test.ts に追加）

```typescript
describe('isFilterEnabled', () => {
  it('フィルタリング設定が存在してenabledがtrueの場合にtrueを返す', async () => {
    // getFilterConfig が enabled: true の設定を返すようにモック
    expect(await service.isFilterEnabled('env-1')).toBe(true);
  });

  it('フィルタリング設定が存在しない場合はfalseを返す', async () => {
    // getFilterConfig が null を返すようにモック
    expect(await service.isFilterEnabled('env-1')).toBe(false);
  });

  it('フィルタリング設定が存在してもenabledがfalseの場合はfalseを返す', async () => {
    // getFilterConfig が enabled: false の設定を返すようにモック
    expect(await service.isFilterEnabled('env-1')).toBe(false);
  });
});
```

## 影響範囲

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/services/adapters/docker-adapter.ts` | createSession()のフィルタリング対応NetworkMode制御、bridge接続ロジック追加 |
| `src/services/network-filter-service.ts` | isFilterEnabled()ヘルパーメソッド追加 |
| `src/services/adapters/__tests__/docker-adapter-filter.test.ts` | 新規テストケース追加 |

### 変更しないファイル

- docker-compose.yml（インフラ変更なし）
- iptables-manager.ts（既存のフィルタリングロジック変更なし）
- その他のAdapterファイル（HostAdapter等）

## 関連ドキュメント

- 要件定義: [docs/sdd/requirements/network-filtering/issue-193-unprotected-window.md](../../requirements/network-filtering/issue-193-unprotected-window.md)
- タスク: [docs/sdd/tasks/network-filtering/issue-193-unprotected-window.md](../../tasks/network-filtering/issue-193-unprotected-window.md)
- 既存設計: [docs/sdd/design/network-filtering/index.md](index.md)
