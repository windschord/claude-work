# TASK-003: EnvironmentServiceにデフォルト環境初期化を追加

## 説明

- 対象ファイル: `src/services/environment-service.ts`
- 初回プロジェクト作成時にデフォルトDocker環境を自動作成するメソッドを追加
- 既に`is_default`フィールドは存在するため、新規環境作成時にフラグを設定

## 実装手順（TDD）

1. テスト作成: `src/services/__tests__/environment-service.test.ts`に`ensureDefaultEnvironment()`のテストを追加
2. テスト実行: 失敗を確認
3. テストコミット
4. 実装: `ensureDefaultEnvironment()`メソッドを追加
5. テスト実行: 通過を確認
6. 実装コミット

## 受入基準

- [ ] `ensureDefaultEnvironment()`メソッドが追加されている
- [ ] Docker環境がない場合に自動作成する
- [ ] `is_default=true`が設定される
- [ ] テストが通過する

## 依存関係

なし

## 推定工数

30分

## ステータス

`TODO`
