# TASK-013: docker stopのPromise化とエラーハンドリング

## 基本情報

- **タスクID**: TASK-013
- **フェーズ**: Phase 3 - Docker環境の安定化
- **優先度**: 高
- **推定工数**: 40分
- **ステータス**: DONE
- **担当者**: 未割り当て

## 概要

DockerAdapterの`cleanup()`メソッドを改善し、`docker stop`コマンドをPromise化して同期的に停止処理を行います。エラーハンドリングを強化し、停止失敗時には`docker kill`で強制終了する多段階の停止ロジックを実装します。

## 要件マッピング

| 要件ID | 内容 |
|-------|------|
| REQ-003-003 | 同期的なコンテナ停止 |
| REQ-003-004 | エラーハンドリング |
| NFR-003-002 | docker stop失敗率 5%以下 |

## 技術的文脈

- **ファイルパス**: `src/services/adapters/docker-adapter.ts`
- **フレームワーク**: Node.js, TypeScript
- **ライブラリ**: child_process, util.promisify
- **参照すべき既存コード**:
  - `src/services/adapters/docker-adapter.ts` (既存のcleanup実装)
  - `src/lib/logger.ts` (ログ出力)
- **設計書**: [docs/design/components/docker-adapter.md](../../design/components/docker-adapter.md)

## 情報の明確性

| 分類 | 内容 |
|------|------|
| **明示された情報** | - `stopContainer()`プライベートメソッドを実装<br>- `docker stop -t 10`で10秒猶予<br>- 失敗時は`docker kill`で強制終了<br>- エラーをログに記録するがスローしない<br>- `cleanup()`から呼び出す |
| **不明/要確認の情報** | - なし（設計書で詳細に定義済み） |

## 実装手順（TDD）

### ステップ1: テスト作成

以下のテストケースを作成：

1. **stopContainer成功のテスト**
   - `docker stop`が正常に完了する
   - タイムアウト15秒で完了する

2. **stopContainer失敗→killのテスト**
   - `docker stop`が失敗する
   - `docker kill`が実行される
   - エラーがスローされない（ログのみ）

3. **コンテナが既に停止している場合のテスト**
   - "No such container"エラーが発生
   - エラーを無視して正常終了

4. **cleanupの統合テスト**
   - `cleanup()`が`stopContainer()`を呼び出す
   - 停止完了まで待機してから後続処理

5. **エラーハンドリングのテスト**
   - stopとkillの両方が失敗してもシステムがクラッシュしない
   - エラーがログに記録される

### ステップ2: テスト実行（失敗確認）

```bash
npm test -- src/services/adapters/__tests__/docker-adapter.test.ts
```

すべてのテストが失敗することを確認します。

### ステップ3: テストコミット

```bash
git add src/services/adapters/__tests__/docker-adapter.test.ts
git commit -m "test(TASK-013): add docker stop Promise and error handling tests

- Add stopContainer() success test
- Add stop failure -> kill fallback test
- Add already stopped container test
- Add cleanup() integration test
- Add double failure error handling test"
```

### ステップ4: 実装

`src/services/adapters/docker-adapter.ts`に以下を追加：

1. **stopContainer()メソッド**
   ```typescript
   private async stopContainer(containerId: string): Promise<void> {
     logger.info(`Stopping container ${containerId}`)

     try {
       // 10秒のタイムアウトで停止を試行
       await execAsync(`docker stop -t 10 ${containerId}`, {
         timeout: 15000 // 15秒（猶予を含む）
       })

       logger.info(`Container ${containerId} stopped successfully`)
     } catch (error: any) {
       // コンテナが既に停止している場合はエラーを無視
       if (error.message.includes('No such container') ||
           error.message.includes('is not running')) {
         logger.debug(`Container ${containerId} already stopped`)
         return
       }

       logger.error(`Failed to stop container ${containerId}:`, error)

       // 強制停止を試行
       try {
         await execAsync(`docker kill ${containerId}`, {
           timeout: 5000
         })
         logger.warn(`Container ${containerId} force-killed`)
       } catch (killError) {
         logger.error(`Failed to force-kill container ${containerId}:`, killError)
       }

       // エラーをログに記録するが、スローはしない（後続処理を継続）
     }
   }
   ```

2. **cleanup()メソッドの修正**
   ```typescript
   async cleanup(sessionId: string): Promise<void> {
     const state = this.containerStates.get(sessionId)

     if (!state) {
       logger.warn(`No container state for session ${sessionId}`)
       return
     }

     logger.info(`Cleaning up Docker container for session ${sessionId}`)

     try {
       // コンテナを同期的に停止（IMPROVED）
       await this.stopContainer(state.containerId)

       // 状態をクリア
       this.containerStates.delete(sessionId)

       logger.info(`Docker container ${state.containerId} cleaned up successfully`)
     } catch (error) {
       logger.error(`Error during Docker cleanup for session ${sessionId}:`, error)
       // エラーをスローせず、ログのみ記録
     }
   }
   ```

### ステップ5: テスト実行（通過確認）

```bash
npm test -- src/services/adapters/__tests__/docker-adapter.test.ts
```

すべてのテストが通過することを確認します。

### ステップ6: 実装コミット

```bash
git add src/services/adapters/docker-adapter.ts
git commit -m "feat(TASK-013): implement Promise-based docker stop with error handling

- Add stopContainer() with Promise-based docker stop
- Use docker stop -t 10 with 15s timeout
- Implement fallback to docker kill on stop failure
- Ignore already stopped container errors
- Improve cleanup() to use stopContainer()
- Add comprehensive error logging without throwing

Implements: REQ-003-003, REQ-003-004, NFR-003-002

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/services/adapters/docker-adapter.ts`に`stopContainer()`メソッドが実装されている
- [ ] `docker stop -t 10`を使用し、15秒のタイムアウトを設定
- [ ] 停止失敗時に`docker kill`で強制終了
- [ ] "No such container"エラーを適切に処理
- [ ] エラーをログに記録するがスローしない
- [ ] `cleanup()`が`stopContainer()`を呼び出す
- [ ] テストカバレッジが80%以上
- [ ] `npm test`で全テストが通過する
- [ ] ESLintエラーがゼロ
- [ ] 停止失敗率が5%以下（手動テスト）

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
# Docker環境でセッションを作成・削除を繰り返す
# - 正常に停止すること
# - エラーが発生してもシステムがクラッシュしないこと
# - ログにエラーが記録されること

# 強制終了テスト
# - コンテナを手動で削除してからセッション削除
# - エラーが適切に処理されること
```

## 依存関係

### 前提条件
- TASK-012: DockerAdapterのコンテナ起動待機実装

### 後続タスク
- TASK-014: 親コンテナIDの永続化と孤立コンテナクリーンアップ

## トラブルシューティング

### よくある問題

1. **docker stopのタイムアウト**
   - 問題: 10秒で停止しない
   - 解決: タイムアウト値の調整、killへのフォールバック

2. **docker killの失敗**
   - 問題: killも失敗する
   - 解決: ログ記録のみ、コンテナIDをデータベースに記録して後でクリーンアップ

3. **エラーメッセージの判定**
   - 問題: "No such container"以外のメッセージ
   - 解決: エラーメッセージの正規表現マッチング

## パフォーマンス最適化

### タイムアウト値の調整

```typescript
// 将来の最適化: コンテナのリソース使用状況に応じて調整
private getStopTimeout(sessionId: string): number {
  const state = this.containerStates.get(sessionId)
  if (state?.resourceUsage === 'high') {
    return 20 // 高負荷時は長めに
  }
  return 10 // デフォルト
}
```

## 完了サマリ

- `stopContainer()`メソッドをPromise化し、同期的なコンテナ停止を実装
- `docker stop -t 10`を使用し、15秒のタイムアウトを設定
- 停止失敗時に`docker kill`で強制終了するフォールバック処理を実装
- "No such container"および"is not running"エラーを適切に処理
- エラーをログに記録するがスローしない実装により、後続処理の継続を保証
- `destroySession()`および`onExit`ハンドラーで`stopContainer()`を呼び出す実装を改善

## 参照

- [要件定義: US-003](../../requirements/stories/US-003.md)
- [設計: DockerAdapter](../../design/components/docker-adapter.md)
