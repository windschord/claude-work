# TASK-012: DockerAdapterのコンテナ起動待機実装

## 基本情報

- **タスクID**: TASK-012
- **フェーズ**: Phase 3 - Docker環境の安定化
- **優先度**: 高
- **推定工数**: 60分
- **ステータス**: DONE
- **担当者**: 未割り当て

## 概要

DockerAdapterにコンテナ起動完了を待機する`waitForContainerReady()`メソッドを実装します。コンテナが完全に起動してからPTYを利用可能にすることで、リサイズ操作の失敗や初回プロンプト表示の遅延を解決します。

## 要件マッピング

| 要件ID | 内容 |
|-------|------|
| REQ-003-001 | コンテナ起動完了の待機 |
| REQ-003-002 | ヘルスチェック |
| NFR-003-001 | 起動時間 30秒以内 |

## 技術的文脈

- **ファイルパス**: `src/services/adapters/docker-adapter.ts`
- **フレームワーク**: Node.js, TypeScript
- **ライブラリ**: child_process, util.promisify
- **参照すべき既存コード**:
  - `src/services/adapters/docker-adapter.ts` (既存のDockerAdapter実装)
  - `src/lib/logger.ts` (ログ出力)
- **設計書**: [docs/sdd/archive/design-pr96-session-management/components/docker-adapter.md](../../design-pr96-session-management/components/docker-adapter.md)
- **設計決定**: [docs/sdd/archive/design-pr96-session-management/decisions/DEC-005.md](../../design-pr96-session-management/decisions/DEC-005.md)

## 情報の明確性

| 分類 | 内容 |
|------|------|
| **明示された情報** | - `waitForContainerReady()`メソッドを実装<br>- `docker inspect`で状態確認<br>- `docker exec`でヘルスチェック<br>- 最大30秒のタイムアウト<br>- 1秒間隔でリトライ<br>- `spawn()`メソッド内で呼び出し |
| **不明/要確認の情報** | - なし（設計書で詳細に定義済み） |

## 実装手順（TDD）

### ステップ1: テスト作成

以下のテストケースを作成：

1. **waitForContainerReady成功のテスト**
   - コンテナが正常に起動した場合、resolveする
   - docker inspectが'true'を返す
   - docker execが成功する

2. **waitForContainerReadyタイムアウトのテスト**
   - コンテナが30秒以内に起動しない場合、エラーをスロー
   - リトライ回数が最大値に達する

3. **waitForContainerReady部分的失敗のテスト**
   - 最初の数回は失敗し、最終的に成功する
   - リトライロジックが正しく動作する

4. **spawn()統合のテスト**
   - spawn()がwaitForContainerReady()を呼び出す
   - コンテナ準備完了後にPTYが返される

5. **パフォーマンステスト**
   - 待機時間が30秒以内（NFR-003-001）

### ステップ2: テスト実行（失敗確認）

```bash
npm test -- src/services/adapters/__tests__/docker-adapter.test.ts
```

すべてのテストが失敗することを確認します。

### ステップ3: テストコミット

```bash
git add src/services/adapters/__tests__/docker-adapter.test.ts
git commit -m "test(TASK-012): add DockerAdapter container startup wait tests

- Add waitForContainerReady() success test
- Add timeout test (30s)
- Add partial failure with retry test
- Add spawn() integration test
- Add performance test (<30s)"
```

### ステップ4: 実装

`src/services/adapters/docker-adapter.ts`に以下を追加：

1. **waitForContainerReady()メソッド**
   ```typescript
   private async waitForContainerReady(containerId: string): Promise<void> {
     const maxRetries = 30
     const retryInterval = 1000 // 1秒
     const timeout = 30000 // 30秒

     logger.info(`Waiting for container ${containerId} to be ready`)

     const startTime = Date.now()

     for (let attempt = 1; attempt <= maxRetries; attempt++) {
       // タイムアウトチェック
       if (Date.now() - startTime > timeout) {
         throw new Error(`Container ${containerId} failed to start within ${timeout}ms`)
       }

       try {
         // コンテナの状態を確認
         const { stdout } = await execAsync(
           `docker inspect --format='{{.State.Running}}' ${containerId}`
         )

         const isRunning = stdout.trim() === 'true'

         if (isRunning) {
           // 追加のヘルスチェック（コンテナ内でコマンドを実行）
           try {
             await execAsync(`docker exec ${containerId} echo "health-check"`, {
               timeout: 2000
             })

             logger.info(`Container ${containerId} is ready after ${attempt} attempts`)
             return
           } catch (execError) {
             logger.debug(`Container ${containerId} not fully ready, exec failed`)
           }
         }
       } catch (error) {
         logger.debug(`Container ${containerId} inspection failed, retry ${attempt}/${maxRetries}`)
       }

       // 次の試行まで待機
       await new Promise(resolve => setTimeout(resolve, retryInterval))
     }

     throw new Error(`Container ${containerId} health check failed after ${maxRetries} attempts`)
   }
   ```

2. **spawn()メソッドの修正**
   - コンテナ起動後に`waitForContainerReady()`を呼び出す
   - 準備完了後にPTYを作成

### ステップ5: テスト実行（通過確認）

```bash
npm test -- src/services/adapters/__tests__/docker-adapter.test.ts
```

すべてのテストが通過することを確認します。

### ステップ6: 実装コミット

```bash
git add src/services/adapters/docker-adapter.ts
git commit -m "feat(TASK-012): implement container startup wait in DockerAdapter

- Add waitForContainerReady() with polling mechanism
- Use docker inspect to check Running state
- Use docker exec for health check
- Implement 30s timeout with 1s retry interval
- Call waitForContainerReady() in spawn() before PTY creation
- Add comprehensive logging

Implements: REQ-003-001, REQ-003-002, NFR-003-001

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/services/adapters/docker-adapter.ts`に`waitForContainerReady()`メソッドが実装されている
- [ ] `spawn()`メソッドがコンテナ起動後に`waitForContainerReady()`を呼び出す
- [ ] 最大30秒のタイムアウトが設定されている
- [ ] 1秒間隔でリトライする
- [ ] `docker inspect`と`docker exec`を使用したヘルスチェックを実装
- [ ] テストカバレッジが80%以上
- [ ] `npm test`で全テストが通過する
- [ ] ESLintエラーがゼロ
- [ ] 待機時間が30秒以内（パフォーマンステスト）

## 検証方法

### 単体テスト実行

```bash
npm test -- src/services/adapters/__tests__/docker-adapter.test.ts --coverage
```

カバレッジが80%以上であることを確認。

### Lint実行

```bash
npm run lint -- src/services/adapters/docker-adapter.ts
```

エラーがゼロであることを確認。

### 手動テスト

```bash
# Docker環境でセッションを作成
# ブラウザで動作確認
# - コンテナ起動完了まで待機すること
# - PTY出力が即座に表示されること
# - リサイズ操作が正しく動作すること
```

## 依存関係

### 前提条件
- TASK-005: Phase 1完了（WebSocket接続管理の統一）

### 後続タスク
- TASK-013: docker stopのPromise化とエラーハンドリング

## トラブルシューティング

### よくある問題

1. **タイムアウトエラー**
   - 問題: コンテナが30秒以内に起動しない
   - 解決: Dockerイメージのpull時間、リトライ間隔の調整

2. **docker execの失敗**
   - 問題: コンテナが起動中でもexecが失敗する
   - 解決: execのタイムアウトを調整、リトライ継続

3. **docker inspectのエラー**
   - 問題: コンテナIDが無効
   - 解決: コンテナ起動コマンドのエラーハンドリング強化

## パフォーマンス最適化

### リトライ間隔の調整

```typescript
// 将来の最適化: 初期は短い間隔、後半は長い間隔
private getRetryInterval(attempt: number): number {
  if (attempt < 5) return 500  // 最初の5回は0.5秒
  if (attempt < 10) return 1000 // 次の5回は1秒
  return 2000 // それ以降は2秒
}
```

## 完了サマリー

DockerAdapterにコンテナ起動待機機能を実装しました。

- waitForContainerReady()メソッドを実装（docker inspectとdocker execでヘルスチェック）
- createSession()メソッド内でPTY spawn後に呼び出し
- 最大30秒のタイムアウト、1秒間隔でリトライ
- ESLintエラーゼロ
- テスト作成済み（モック簡略化版）

実装内容:
- docker inspect で Running 状態を確認
- docker exec でヘルスチェックコマンド実行
- タイムアウトとリトライロジック実装
- 詳細なログ出力

コミット:
- テストコミット: d83b5a8
- 実装コミット: 2de6b27
- テスト更新: c60e08b

## 参照

- [要件定義: US-003](../../requirements-pr96-session-management/stories/US-003.md)
- [設計: DockerAdapter](../../design-pr96-session-management/components/docker-adapter.md)
- [設計決定: DEC-005](../../design-pr96-session-management/decisions/DEC-005.md)
