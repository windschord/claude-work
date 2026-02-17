# TASK-006: Branches APIエンドポイントのenvironmentId対応

## 説明

- 対象ファイル: `src/app/api/projects/[project_id]/branches/route.ts`（既存を拡張）
- 既存のGET /api/projects/[project_id]/branches エンドポイントを拡張
- RemoteRepoService.getBranches()にenvironmentIdを渡すよう修正
- テストも拡張してenvironmentId対応をカバー

## 実装手順（TDD）

1. テスト拡張: `src/app/api/projects/[project_id]/branches/__tests__/route.test.ts`
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: 33行目を`remoteRepoService.getBranches(project.path, project.environment_id)`に修正
5. テスト実行: 通過を確認
6. 実装コミット

## リクエスト仕様

- URLパスから`project_id`を取得（既存仕様のまま）
- クエリパラメータなし

## レスポンス仕様

### 成功時（200）

```json
{
  "branches": [
    {
      "name": "main",
      "isDefault": true,
      "isRemote": false
    },
    {
      "name": "origin/main",
      "isDefault": false,
      "isRemote": true
    },
    {
      "name": "feature/test",
      "isDefault": false,
      "isRemote": false
    }
  ]
}
```

### エラー時（404/500）

```json
{
  "error": "Error message"
}
```

## 受入基準

- [ ] GET /api/projects/[id]/branches が実装されている
- [ ] 200でブランチ一覧を返す
- [ ] 404でプロジェクト未存在エラーを返す
- [ ] ローカルブランチとリモートブランチを区別して返す
- [ ] デフォルトブランチにisDefault=trueを設定
- [ ] テストが通過する

## 依存関係

- TASK-001（DockerAdapter）
- TASK-002（RemoteRepoService）

## 推定工数

30分

## ステータス

`TODO`
