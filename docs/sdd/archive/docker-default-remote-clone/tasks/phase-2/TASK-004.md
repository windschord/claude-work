# TASK-004: Clone APIエンドポイントの実装

## 説明

- 対象ファイル: `src/app/api/projects/clone/route.ts`（新規作成）
- POST /api/projects/clone エンドポイントを実装
- RemoteRepoService経由でクローンを実行し、プロジェクトを登録

## 実装手順（TDD）

1. テスト作成: `src/app/api/projects/clone/__tests__/route.test.ts`
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: POSTハンドラーを作成
5. テスト実行: 通過を確認
6. 実装コミット

## リクエスト仕様

```json
{
  "url": "git@github.com:user/repo.git",
  "name": "optional-name"
}
```

## レスポンス仕様

```json
{
  "id": "uuid",
  "name": "repo",
  "path": "/path/to/repo",
  "remote_url": "git@github.com:user/repo.git",
  "created_at": "2024-01-01T00:00:00Z"
}
```

## 受入基準

- [ ] POST /api/projects/clone が実装されている
- [ ] 201で成功レスポンスを返す
- [ ] 400で無効なURLエラーを返す
- [ ] テストが通過する

## 依存関係

- TASK-001（DockerAdapter）
- TASK-002（RemoteRepoService）

## 推定工数

40分

## ステータス

`DONE`
