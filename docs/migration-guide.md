# ハイブリッド設計マイグレーションガイド

## 概要

このドキュメントは、ハイブリッド設計（Host環境/Docker環境選択機能）への移行ガイドです。

## 既存プロジェクトへの影響

### 自動マイグレーション

既存のプロジェクトは以下のように自動的に処理されます：

1. **データベーススキーマ変更**
   - `clone_location`フィールドが追加され、デフォルト値は`'docker'`
   - `docker_volume_id`フィールドが追加（既存プロジェクトは`NULL`）

2. **既存プロジェクトの扱い**
   - `clone_location`が`NULL`の既存プロジェクトは、Host環境として扱われます
   - UIでは緑色の「Host」バッジが表示されます
   - データの移行は不要です

### データベースマイグレーション

手動でのデータベース更新が必要な場合：

```sql
-- clone_locationフィールドを追加
ALTER TABLE Project ADD COLUMN clone_location text DEFAULT 'docker';

-- docker_volume_idフィールドを追加
ALTER TABLE Project ADD COLUMN docker_volume_id text;
```

Drizzle ORMを使用している場合：

```bash
# スキーマをプッシュ
npx drizzle-kit push
```

**注意**: Drizzle ORMのマイグレーションが失敗する場合は、上記のSQLを手動で実行してください。

## 新機能の使用方法

### プロジェクト登録時の保存場所選択

リモートリポジトリをcloneする際、保存場所を選択できます：

1. **Docker環境（推奨）**
   - SSH Agent認証が自動で利用可能
   - Dockerボリュームに保存（`claude-repo-<project-id>`）
   - 1Password SSH Agentなどとの互換性が高い

2. **Host環境**
   - ローカルのGit設定を使用
   - `data/repos/`または指定ディレクトリに保存
   - 既存の実装と同じ動作

### 設定画面

`/settings`ページで以下の設定が可能です：

- **Git Cloneタイムアウト**: 1-30分（デフォルト: 5分）
- **デバッグモード**: Dockerボリューム保持（デフォルト: 無効）

## トラブルシューティング

### Docker環境でcloneが失敗する場合

1. **Dockerが起動しているか確認**
   ```bash
   docker info
   ```

2. **alpine/gitイメージがあるか確認**
   ```bash
   docker images alpine/git
   ```
   なければ手動でpull:
   ```bash
   docker pull alpine/git
   ```

3. **SSH Agent転送の確認**
   ```bash
   echo $SSH_AUTH_SOCK
   ```
   環境変数が設定されていない場合、SSH Agent認証が利用できません。

4. **タイムアウトの延長**
   設定画面でタイムアウト値を増やしてください（大きなリポジトリの場合）。

### デバッグモード

エラー時やトラブルシューティング時は、デバッグモードを有効にしてDockerボリュームを保持できます：

1. `/settings`で「Dockerボリュームを保持する」にチェック
2. エラー発生後、ボリュームの内容を確認:
   ```bash
   docker run --rm -v claude-repo-<project-id>:/repo alpine/git -C /repo status
   ```

### ボリュームのクリーンアップ

不要なDockerボリュームを削除する場合：

```bash
# 特定のボリュームを削除
docker volume rm claude-repo-<project-id>

# 使用されていない全ボリュームを削除
docker volume prune
```

## API変更

### POST /api/projects/clone

新しいパラメータ：

- `cloneLocation`: `'host'` | `'docker'`（任意、デフォルト: `'docker'`）

**例**:

```json
{
  "url": "git@github.com:user/repo.git",
  "cloneLocation": "docker"
}
```

**レスポンス**:

```json
{
  "project": {
    "id": "123",
    "name": "repo",
    "path": "/docker-volumes/claude-repo-123",
    "remote_url": "git@github.com:user/repo.git",
    "clone_location": "docker",
    "docker_volume_id": "claude-repo-123"
  }
}
```

### GET/PUT /api/settings/config

新しいエンドポート：

**GET /api/settings/config**:

```json
{
  "config": {
    "git_clone_timeout_minutes": 5,
    "debug_mode_keep_volumes": false
  }
}
```

**PUT /api/settings/config**:

```json
{
  "git_clone_timeout_minutes": 10,
  "debug_mode_keep_volumes": true
}
```

## 後方互換性

- 既存のローカルプロジェクト登録は変更なし
- `cloneLocation`を指定しない場合、既存のロジック（Host環境）が動作
- `targetDir`を指定した場合、Host環境として扱われる
- 既存のAPIクライアントは新しいパラメータを無視して動作可能

## 推奨される運用

1. **新規プロジェクト**: Docker環境を使用（デフォルト）
2. **既存プロジェクト**: そのままHost環境として継続使用
3. **SSH認証問題がある場合**: Docker環境に切り替え
4. **大きなリポジトリ**: タイムアウトを10-15分に設定

## 参考

- データベーススキーマ: `src/db/schema.ts`
- Docker Git Service: `src/services/docker-git-service.ts`
- 設定サービス: `src/services/config-service.ts`
- バリデーション: `src/lib/validation.ts`
