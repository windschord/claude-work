# シーケンス図: 孤立リソースのクリーンアップ

## 概要

サーバー起動時に、前回のクラッシュや異常終了で残った孤立Chromeコンテナ・ネットワークをクリーンアップするフロー。

## 対応要件

REQ-002-002

## クリーンアップフロー

```
Server起動        ChromeSidecarSvc    DockerClient       DB
  |                  |                  |                  |
  | cleanupOrphaned()|                  |                  |
  |----------------->|                  |                  |
  |                  |                  |                  |
  |                  | [Phase 1: DBベースのクリーンアップ]  |
  |                  |                  |                  |
  |                  | SELECT sessions                    |
  |                  | WHERE chrome_container_id IS NOT NULL
  |                  |-------------------------------------->|
  |                  |<--------------------------------------|
  |                  |                  |                  |
  |                  | [各セッションについて]                |
  |                  |                  |                  |
  |                  | inspectContainer |                  |
  |                  | (chrome_container_id)               |
  |                  |----------------->|                  |
  |                  |                  |                  |
  |            [コンテナが存在しない or 停止済み]           |
  |                  |                  |                  |
  |                  | removeNetwork    |                  |
  |                  | (cw-net-<sid>)   |                  |
  |                  |----------------->|                  |
  |                  |<-----------------|                  |
  |                  |                  |                  |
  |                  | UPDATE sessions                    |
  |                  | SET chrome_container_id = NULL,     |
  |                  |     chrome_debug_port = NULL        |
  |                  |-------------------------------------->|
  |                  |                  |                  |
  |                  | [Phase 2: ラベルベースのクリーンアップ]|
  |                  |                  |                  |
  |                  | listContainers   |                  |
  |                  | (label: claude-work.chrome-sidecar=true)
  |                  |----------------->|                  |
  |                  |<-----------------|                  |
  |                  |                  |                  |
  |                  | [DBに対応セッションがないコンテナ]    |
  |                  |                  |                  |
  |                  | stopContainer    |                  |
  |                  |----------------->|                  |
  |                  |<-----------------|                  |
  |                  |                  |                  |
  |                  | listNetworks     |                  |
  |                  | (label: claude-work.managed-by=claude-work)
  |                  |----------------->|                  |
  |                  |<-----------------|                  |
  |                  |                  |                  |
  |                  | [接続コンテナがゼロのネットワーク]    |
  |                  |                  |                  |
  |                  | removeNetwork    |                  |
  |                  |----------------->|                  |
  |                  |<-----------------|                  |
  |                  |                  |                  |
  |                  | log: クリーンアップ完了             |
  |                  | (削除コンテナ数, 削除ネットワーク数) |
  |                  |                  |                  |
  |<-----------------|                  |                  |
```

## Phase 1: DBベースのクリーンアップ

DBに記録されたchrome_container_idを起点にクリーンアップする。

```
1. DB SELECT: chrome_container_id IS NOT NULL のセッション一覧取得
2. 各セッションについて:
   a. docker inspect でコンテナの状態確認
   b. コンテナが実行中 → スキップ（正常稼働中）
   c. コンテナが存在しない or 停止済み:
      i.   コンテナが存在すれば停止を試行（AutoRemoveで既に消えている可能性あり）
      ii.  cw-net-<session-id> ネットワークを削除
      iii. DB UPDATE: chrome_container_id = NULL, chrome_debug_port = NULL
```

## Phase 2: ラベルベースのクリーンアップ

DBに記録が残っていない（DBも破損した場合等の）孤立リソースをラベルで検出する。

```
1. docker listContainers (label: claude-work.chrome-sidecar=true)
2. 各コンテナについて:
   a. ラベルからsession-idを取得
   b. DBに対応するセッションが存在するか確認
   c. 存在しない → コンテナを停止

3. docker listNetworks (label: claude-work.managed-by=claude-work, name prefix: cw-net-)
4. 各ネットワークについて:
   a. 接続コンテナ数を確認
   b. 接続コンテナがゼロ → ネットワークを削除
```

## クリーンアップ呼び出しタイミング

サーバー起動時(`server.ts`)で、既存の初期化処理の後に呼び出す。

```typescript
// server.ts (起動処理内)
import { ChromeSidecarService } from './services/chrome-sidecar-service';

// 既存の初期化処理の後
const sidecarService = new ChromeSidecarService();
await sidecarService.cleanupOrphaned();
```

## エラーハンドリング

- 個々のコンテナ/ネットワークの削除失敗は警告ログを出力し、次のリソースに進む
- Phase全体がDockerデーモン未接続等で失敗した場合は、エラーログを出力するがサーバー起動は妨げない
- クリーンアップはbest-effortであり、失敗してもサーバーの動作に影響しない
