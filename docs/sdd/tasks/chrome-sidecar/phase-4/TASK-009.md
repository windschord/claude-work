# TASK-009: サーバー起動時クリーンアップ統合

## 説明

サーバー起動時 (`server.ts`) に `ChromeSidecarService.cleanupOrphaned()` を呼び出し、前回クラッシュや異常終了で残った孤立Chromeコンテナ・ネットワークを自動クリーンアップする。

**対象ファイル**:
- `server.ts` - 起動時初期化処理に cleanupOrphaned 呼び出し追加

**設計書**: `docs/sdd/design/chrome-sidecar/sequences/cleanup.md`

## 技術的文脈

- 既存の初期化処理（DB migrate、デフォルト環境作成等）の後に追加
- cleanupOrphaned は best-effort であり、失敗してもサーバー起動を妨げない
- Docker未接続時はエラーログ出力のみで続行
- 処理結果（削除コンテナ数、ネットワーク数）をログ出力

## TDD手順

### テストファイル

`src/services/__tests__/chrome-sidecar-cleanup-integration.test.ts`

### テストケース

1. **サーバー起動時にcleanupOrphanedが呼ばれること**
   - server.ts の起動フローで ChromeSidecarService.cleanupOrphaned が実行されること

2. **cleanupOrphaned失敗時にサーバー起動が続行されること**
   - cleanupOrphaned が例外をスローしても、サーバーが正常に起動すること
   - エラーログが出力されること

3. **Docker未接続時にgracefulにスキップされること**
   - Docker Engine に接続できない環境でもサーバーが起動すること

### 実装手順

1. テストファイル作成・テスト実行（RED確認）
2. `server.ts` の起動処理に以下を追加:
   ```typescript
   try {
     const sidecarService = new ChromeSidecarService();
     await sidecarService.cleanupOrphaned();
   } catch (error) {
     logger.error('Chrome sidecar cleanup failed', { error });
   }
   ```
3. テスト実行（GREEN確認）

## 受入基準

- [ ] サーバー起動時に cleanupOrphaned が呼び出されること
- [ ] クリーンアップ失敗時にサーバー起動が中止されないこと
- [ ] Docker未接続環境でもサーバーが正常起動すること
- [ ] クリーンアップ結果がログに記録されること
- [ ] 全テストケースがパスすること

**依存関係**: TASK-003 (ChromeSidecarService), TASK-005 (DockerAdapter拡張)
**推定工数**: 20分
**ステータス**: `TODO`
