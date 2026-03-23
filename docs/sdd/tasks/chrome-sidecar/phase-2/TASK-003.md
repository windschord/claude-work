# TASK-003: ChromeSidecarService

## 説明

Chromeサイドカーコンテナのライフサイクル（起動・ヘルスチェック・停止・クリーンアップ）を管理する `ChromeSidecarService` を新規作成する。

**対象ファイル**:
- `src/services/chrome-sidecar-service.ts` - 新規作成
- `src/services/__tests__/chrome-sidecar-service.test.ts` - テスト

**設計書**: `docs/sdd/design/chrome-sidecar/components/chrome-sidecar-service.md`

## 技術的文脈

- DockerClientを使用してDocker APIと通信
- セッション専用ブリッジネットワーク (`cw-net-<session-id>`) を作成
- Chromeコンテナ (`cw-chrome-<session-id>`) をネットワーク内に起動
- CDPヘルスチェック（HTTP GET /json/version、最大30秒ポーリング）
- セキュリティ: CapDrop ALL, no-new-privileges, メモリ制限512MB
- ポートマッピング: CDP 9222を127.0.0.1:*に動的マッピング
- Dockerラベル: `claude-work.session-id`, `claude-work.chrome-sidecar`, `claude-work.managed-by`

## TDD手順

### テストファイル

`src/services/__tests__/chrome-sidecar-service.test.ts`

### テストケース

#### startSidecar

1. **正常系: サイドカー起動成功**
   - ネットワーク作成 -> コンテナ作成 -> コンテナ起動 -> CDPヘルスチェック成功の順で呼ばれること
   - SidecarStartResult が `success: true` で、containerName, networkName, debugPort, browserUrl が設定されること
   - コンテナ作成オプションに正しいラベル、CapDrop, SecurityOpt, Memory が設定されること

2. **正常系: ポートマッピングからdebugPort取得**
   - container.inspect() の結果からホスト側ポート番号を正しく抽出すること
   - browserUrl が `ws://cw-chrome-<sid>:9222` 形式であること

3. **異常系: ネットワーク作成失敗**
   - `success: false` が返り、error にエラーメッセージが含まれること
   - コンテナ作成が呼ばれないこと（ロールバック）

4. **異常系: CDPヘルスチェックタイムアウト**
   - 30秒経過後に `success: false` が返ること
   - Chromeコンテナ停止とネットワーク削除が呼ばれること（クリーンアップ）

5. **異常系: コンテナ起動失敗**
   - ネットワーク削除が呼ばれること（ロールバック）
   - `success: false` が返ること

6. **異常系: ポートマッピング失敗**
   - `success: true` かつ `debugPort: undefined` が返ること
   - Chromeコンテナ自体は起動成功として扱うこと

#### stopSidecar

7. **正常系: サイドカー停止成功**
   - コンテナ停止 -> ネットワークからdisconnect -> ネットワーク削除の順で呼ばれること

8. **異常系: コンテナ停止失敗**
   - 警告ログが出力されること
   - 例外がスローされないこと（best-effort）

9. **異常系: ネットワーク削除失敗**
   - 警告ログが出力されること
   - 例外がスローされないこと

#### connectClaudeContainer

10. **正常系: Claude Codeコンテナをネットワークに接続**
    - docker network connect が正しいパラメータで呼ばれること

11. **異常系: 接続失敗**
    - 例外がスローされること（呼び出し元でハンドリング）

#### cleanupOrphaned

12. **Phase 1: DBベースのクリーンアップ**
    - chrome_container_id IS NOT NULL のセッションを取得すること
    - 停止済みコンテナのネットワークを削除し、DBをNULL更新すること
    - 実行中コンテナはスキップすること

13. **Phase 2: ラベルベースのクリーンアップ**
    - `claude-work.chrome-sidecar=true` ラベルのコンテナ一覧を取得すること
    - DBに対応セッションがないコンテナを停止すること
    - 接続コンテナがゼロのネットワークを削除すること

#### getActiveSidecarCount

14. **アクティブサイドカー数取得**
    - `claude-work.chrome-sidecar=true` ラベルで実行中コンテナ数を返すこと

### 実装手順

1. テストファイル作成（DockerClient, db をモック）
2. テスト実行（全件RED確認）
3. `src/services/chrome-sidecar-service.ts` を作成
   - SidecarStartResult, ChromeSidecarConfig のインポート
   - startSidecar: ネットワーク作成 -> コンテナ作成・起動 -> CDPヘルスチェック -> ポート取得
   - stopSidecar: コンテナ停止 -> ネットワーク削除
   - connectClaudeContainer: ネットワーク接続
   - cleanupOrphaned: DB + ラベルベースのクリーンアップ
   - getActiveSidecarCount: ラベルベースのカウント
4. テスト実行（全件GREEN確認）

## 受入基準

- [ ] `ChromeSidecarService` クラスがexportされている
- [ ] `startSidecar` がセキュリティ設定付きでChromeコンテナを起動できること
- [ ] CDPヘルスチェックが30秒タイムアウトで動作すること
- [ ] ネットワーク作成失敗時にコンテナが作成されないこと
- [ ] CDPタイムアウト時にリソースがクリーンアップされること
- [ ] `stopSidecar` がbest-effortで動作すること
- [ ] `cleanupOrphaned` がDB + ラベルベースで孤立リソースを検出・削除すること
- [ ] 全テストケースがパスすること

**依存関係**: TASK-001 (DBスキーマ: chrome_container_id, chrome_debug_port)
**推定工数**: 60分
**ステータス**: `TODO`
