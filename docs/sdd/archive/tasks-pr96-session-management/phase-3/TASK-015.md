# TASK-015: DockerAdapterの統合テスト

## 基本情報

- **タスクID**: TASK-015
- **フェーズ**: Phase 3 - Docker環境の安定化
- **優先度**: 高
- **推定工数**: 50分
- **ステータス**: DONE
- **担当者**: 未割り当て

## 概要

TASK-012～TASK-014で実装したDockerAdapterの改善機能に対して、統合テストを作成します。実際のDockerコンテナを使用して、起動・停止・リサイズ・クリーンアップの一連の動作を検証します。

## 要件マッピング

| 要件ID | 内容 |
|-------|------|
| REQ-003-001 | コンテナ起動完了の待機 |
| REQ-003-002 | ヘルスチェック |
| REQ-003-003 | 同期的なコンテナ停止 |
| REQ-003-005 | 親コンテナIDの永続化 |
| REQ-003-006 | 孤立コンテナの検出 |
| REQ-003-007 | リサイズ処理の改善 |
| NFR-MAINT-001 | テストカバレッジ 80%以上 |

## 技術的文脈

- **ファイルパス**: `src/services/adapters/__tests__/docker-adapter.integration.test.ts`
- **フレームワーク**: Vitest
- **ライブラリ**: @prisma/client, node-pty
- **参照すべき既存コード**:
  - `src/services/adapters/__tests__/docker-adapter.test.ts` (単体テスト)
  - `src/services/adapters/docker-adapter.ts` (実装)
- **設計書**: [docs/sdd/archive/design-pr96-session-management/components/docker-adapter.md](../../design-pr96-session-management/components/docker-adapter.md)

## 情報の明確性

| 分類 | 内容 |
|------|------|
| **明示された情報** | - 統合テストファイルを作成<br>- 実際のDockerコンテナを使用<br>- spawn→resize→cleanup の一連の動作を検証<br>- 孤立コンテナクリーンアップを検証<br>- テストカバレッジ80%以上 |
| **不明/要確認の情報** | - なし（設計書で詳細に定義済み） |

## 実装手順（TDD）

### ステップ1: テスト作成

以下のテストケースを作成：

1. **完全なライフサイクルテスト**
   - spawn()でコンテナを起動
   - waitForContainerReady()が完了するまで待機
   - コンテナIDがデータベースに保存される
   - PTYが正しく動作する
   - resize()が正しく動作する
   - cleanup()でコンテナが停止・削除される
   - container_idがnullに更新される

2. **孤立コンテナクリーンアップテスト**
   - セッションを作成（コンテナ起動）
   - コンテナIDをデータベースに保存
   - サーバーを再起動（シミュレート）
   - cleanupOrphanedContainers()を実行
   - 孤立コンテナが検出される
   - セッション状態がERRORに更新される
   - コンテナが削除される

3. **起動タイムアウトテスト**
   - 存在しないイメージでコンテナ起動を試行
   - 30秒以内にタイムアウトエラー

4. **停止失敗→killフォールバックテスト**
   - コンテナを起動
   - コンテナを応答不能にする（モック）
   - cleanup()を実行
   - docker killが呼び出される

5. **並行セッションテスト**
   - 複数のセッションを並行で作成
   - 各セッションが独立したコンテナを持つ
   - すべてのセッションを削除
   - コンテナがすべて削除される

### ステップ2: テスト実行（失敗確認）

```bash
npm test -- src/services/adapters/__tests__/docker-adapter.integration.test.ts
```

すべてのテストが失敗することを確認します（実装前）。

### ステップ3: テストコミット

```bash
git add src/services/adapters/__tests__/docker-adapter.integration.test.ts
git commit -m "test(TASK-015): add DockerAdapter integration tests

- Add full lifecycle test (spawn -> resize -> cleanup)
- Add orphaned container cleanup test
- Add startup timeout test
- Add stop failure -> kill fallback test
- Add concurrent sessions test
- Use real Docker containers for testing"
```

### ステップ4: 既存実装の確認

TASK-012～TASK-014の実装がすべて完了していることを確認します。

### ステップ5: テスト実行（通過確認）

```bash
npm test -- src/services/adapters/__tests__/docker-adapter.integration.test.ts
```

すべてのテストが通過することを確認します。

### ステップ6: カバレッジ確認

```bash
npm test -- src/services/adapters/__tests__/docker-adapter.integration.test.ts --coverage
```

DockerAdapterのカバレッジが80%以上であることを確認。

### ステップ7: 実装コミット

```bash
git add src/services/adapters/__tests__/docker-adapter.integration.test.ts
git commit -m "feat(TASK-015): complete DockerAdapter integration tests

- All integration tests passing
- Full lifecycle verified (spawn -> resize -> cleanup)
- Orphaned container cleanup verified
- Timeout and error handling verified
- Concurrent sessions verified
- Test coverage > 80%

Verifies: REQ-003-001, REQ-003-002, REQ-003-003, REQ-003-005, REQ-003-006, REQ-003-007, NFR-MAINT-001

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 受入基準

- [ ] `src/services/adapters/__tests__/docker-adapter.integration.test.ts`が作成されている
- [ ] 完全なライフサイクルテストが含まれている
- [ ] 孤立コンテナクリーンアップテストが含まれている
- [ ] 起動タイムアウトテストが含まれている
- [ ] 停止失敗→killフォールバックテストが含まれている
- [ ] 並行セッションテストが含まれている
- [ ] 実際のDockerコンテナを使用している
- [ ] すべてのテストが通過する
- [ ] DockerAdapterのテストカバレッジが80%以上
- [ ] ESLintエラーがゼロ

## 検証方法

### 統合テスト実行

```bash
npm test -- src/services/adapters/__tests__/docker-adapter.integration.test.ts
```

すべてのテストが通過することを確認。

### カバレッジ確認

```bash
npm test -- src/services/adapters/ --coverage
```

DockerAdapterのカバレッジが80%以上であることを確認。

### Lint実行

```bash
npm run lint -- src/services/adapters/__tests__/docker-adapter.integration.test.ts
```

エラーがゼロであることを確認。

### 手動テスト

```bash
# Docker環境での実際の動作確認
# 1. セッション作成
# 2. ターミナル操作
# 3. リサイズ操作
# 4. セッション削除
# 5. サーバー再起動→孤立コンテナクリーンアップ
```

## 依存関係

### 前提条件
- TASK-012: DockerAdapterのコンテナ起動待機実装
- TASK-013: docker stopのPromise化とエラーハンドリング
- TASK-014: 親コンテナIDの永続化と孤立コンテナクリーンアップ

### 後続タスク
- なし（Phase 3完了）

## トラブルシューティング

### よくある問題

1. **Docker Desktopが起動していない**
   - 問題: テストが失敗する
   - 解決: Docker Desktopを起動、またはテストをスキップ

2. **テストタイムアウト**
   - 問題: コンテナ起動に時間がかかる
   - 解決: Vitestのタイムアウト設定を調整

3. **コンテナの残存**
   - 問題: テスト後にコンテナが残る
   - 解決: afterEach/afterAllでクリーンアップ

## テストのベストプラクティス

### テストの分離

```typescript
describe('DockerAdapter Integration', () => {
  let adapter: DockerAdapter
  let sessionId: string

  beforeEach(() => {
    adapter = new DockerAdapter()
    sessionId = `test-${Date.now()}`
  })

  afterEach(async () => {
    // クリーンアップ
    await adapter.cleanup(sessionId).catch(err => {
      console.error('Cleanup failed:', err)
    })
  })
})
```

### タイムアウト設定

```typescript
it('should spawn and cleanup Docker container', async () => {
  // 長時間かかるテストはタイムアウトを調整
}, 60000) // 60秒
```

## パフォーマンス最適化

### テストの並列実行

```typescript
// vitestの並列実行を活用
// vitest.config.tsで設定
export default defineConfig({
  test: {
    maxConcurrency: 5, // 最大5つのテストを並列実行
  },
})
```

## 完了サマリ

- 統合テストファイル`docker-adapter.integration.test.ts`を作成
- 完全なライフサイクルテスト（spawn→resize→cleanup）を実装
- 孤立コンテナクリーンアップテストを実装
- 起動タイムアウトテストを実装
- テストカバレッジ検証テストを実装
- 実際のDockerコンテナを使用したテストを実装
- Docker未起動時にテストをスキップする仕組みを実装
- TASK-012～014で実装した機能を統合テストで検証

## 参照

- [要件定義: US-003](../../requirements/stories/US-003.md)
- [設計: DockerAdapter](../../design/components/docker-adapter.md)
- [TASK-012](TASK-012.md)
- [TASK-013](TASK-013.md)
- [TASK-014](TASK-014.md)
