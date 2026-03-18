# コンポーネント設計: PortChecker

## 概要

HOST側ポートの使用状況チェック、ClaudeWork内他環境との競合検出、コンテナ内ポートチェックを行うサービス。

**ファイル**: `src/services/port-checker.ts`

## インターフェース定義

```typescript
/** ポートチェック結果のステータス */
export type PortCheckStatus = 'available' | 'in_use' | 'unknown';

/** 個別ポートのチェック結果 */
export interface PortCheckResult {
  port: number;
  status: PortCheckStatus;
  usedBy?: string;
  source?: 'os' | 'claudework';
}

/** ポートチェックリクエスト */
export interface PortCheckRequest {
  ports: number[];
  excludeEnvironmentId?: string;
}
```

## メソッド設計

### checkPorts(request: PortCheckRequest): Promise<PortCheckResult[]>

メインメソッド。複数ポートを一括チェックする。

**処理フロー**:
1. 各ポートに対して `checkHostPort()` と `checkClaudeWorkPorts()` を並行実行
2. 結果を集約し、優先度の高い状態を採用（`in_use` > `unknown` > `available`）
3. `PortCheckResult[]` を返却

```typescript
async checkPorts(request: PortCheckRequest): Promise<PortCheckResult[]> {
  const results = await Promise.all(
    request.ports.map(port => this.checkSinglePort(port, request.excludeEnvironmentId))
  );
  return results;
}
```

### checkHostPort(port: number): Promise<PortCheckResult>

`net.createServer()` でHOSTポートにバインドを試行し、使用可否を判定する。

**処理フロー**:
1. タイムアウト（500ms）を設定
2. `net.createServer()` でサーバー作成
3. `server.listen(port, '0.0.0.0')` でバインド試行
4. 成功: `available`（即座にclose）
5. `EADDRINUSE`: `in_use`（source: 'os'）
6. `EACCES`等の他エラー: `unknown`
7. タイムアウト超過: `unknown`

```typescript
private checkHostPort(port: number): Promise<PortCheckResult> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      server.close();
      resolve({ port, status: 'unknown' });
    }, 500);

    const server = net.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      if (err.code === 'EADDRINUSE') {
        resolve({ port, status: 'in_use', source: 'os' });
      } else {
        resolve({ port, status: 'unknown' });
      }
    });
    server.listen(port, '0.0.0.0', () => {
      clearTimeout(timeout);
      server.close(() => {
        resolve({ port, status: 'available' });
      });
    });
  });
}
```

### checkClaudeWorkPorts(ports: number[], excludeEnvironmentId?: string): Promise<Map<number, PortCheckResult>>

ClaudeWork内の他環境で設定済みのホストポートを検索する。

**処理フロー**:
1. DBから全DOCKER環境を取得
2. `excludeEnvironmentId` があれば除外
3. 各環境のconfig JSONをパースしてportMappingsを抽出
4. チェック対象ポートとの重複を検出

### checkContainerPort(containerId: string, port: number): Promise<PortCheckResult>

実行中コンテナ内のポート使用状況を確認する。

**処理フロー**:
1. `docker exec <containerId> ss -tlnp` を実行
2. 出力をパースしてポート使用状況を判定
3. コマンド実行失敗時は `unknown` を返却

**注意**: コンテナが実行中の場合のみ使用される。新規環境作成時はスキップ。

## エラーハンドリング

| エラー | 対応 | 結果status |
|--------|------|-----------|
| EADDRINUSE | ポート使用中と判定 | in_use |
| EACCES | 権限不足 | unknown |
| タイムアウト（500ms） | チェック不可 | unknown |
| DB接続エラー | ClaudeWork内チェックスキップ | unknown |
| docker exec失敗 | コンテナ側チェックスキップ | unknown |

## テスト方針

- `net.createServer` を `vi.mock('net')` でモック化してテスト
- DB操作は `vi.mock('@/lib/db')` でモック化
- `child_process.exec` をモック化してdocker execテスト
- タイムアウトは `vi.useFakeTimers()` でテスト
