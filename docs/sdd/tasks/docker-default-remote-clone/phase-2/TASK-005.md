# TASK-005: Pull APIエンドポイントのenvironmentId対応

## 説明

- 対象ファイル: `src/app/api/projects/[project_id]/pull/route.ts`（既存を拡張）
- 既存のPOST /api/projects/[project_id]/pull エンドポイントを拡張
- RemoteRepoService.pull()にenvironmentIdを渡すよう修正
- テストも拡張してenvironmentId対応をカバー

## 実装手順（TDD）

1. テスト拡張: `src/app/api/projects/[project_id]/pull/__tests__/route.test.ts`
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: 43行目を`remoteRepoService.pull(project.path, project.environment_id)`に修正
5. テスト実行: 通過を確認
6. 実装コミット

## リクエスト仕様

- URLパスから`project_id`を取得（既存仕様のまま）
- リクエストボディなし

## レスポンス仕様

### 成功時（200）

```json
{
  "success": true,
  "updated": true,
  "message": "Fast-forward merge successful"
}
```

### エラー時（400/404/500）

```json
{
  "success": false,
  "error": "Error message"
}
```

## 受入基準

- [ ] POST /api/projects/[id]/pull が実装されている
- [ ] 200で成功レスポンスを返す
- [ ] 404でプロジェクト未存在エラーを返す
- [ ] 400でremote_url未設定エラーを返す
- [ ] 500でpull失敗エラーを返す
- [ ] テストが通過する

## 依存関係

- TASK-001（DockerAdapter）
- TASK-002（RemoteRepoService）

## 推定工数

30分

## ステータス

`TODO`
