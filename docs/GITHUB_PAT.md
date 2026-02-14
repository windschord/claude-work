# GitHub Personal Access Token (PAT) 設定ガイド

このドキュメントでは、ClaudeWorkでGitHub PATを使用するための設定方法を説明します。

## 概要

ClaudeWorkでは、Docker環境でプライベートリポジトリをHTTPS経由でクローンする際に、GitHub Personal Access Token (PAT) を使用できます。PATは暗号化されて安全に保存されます。

## 必要な権限

ClaudeWorkの全機能（リポジトリクローン、PR作成、GitHub Actions確認など）を使用するには、以下の権限が必要です。

### Option A: Classic Personal Access Token（推奨：設定が簡単）

**最小限の権限:**
- ✅ **`repo`** - Full control of private repositories
  - プライベートリポジトリのクローン
  - コードの読み書き
  - PR作成・確認・コメント

**追加で推奨:**
- ✅ **`workflow`** - Update GitHub Action workflows
  - GitHub Actionsの実行確認
  - Workflow結果の取得
  - CI/CDステータスの確認

### Option B: Fine-grained Personal Access Token（推奨：最小権限原則）

**Repository permissions:**
- ✅ **Contents**: `Read and write`
  - リポジトリのクローン
  - コードの読み書き

- ✅ **Pull requests**: `Read and write`
  - プルリクエストの作成
  - PRコメントの追加・確認
  - レビューの確認

- ✅ **Workflows**: `Read and write`
  - GitHub Actions実行確認
  - Workflow結果の取得
  - CI/CDチェック状態の確認

- ✅ **Metadata**: `Read-only`（自動的に付与されます）
  - リポジトリ基本情報の読み取り

## PAT作成手順

### Classic Personal Access Token を作成する場合

1. GitHubにログイン
2. Settings → Developer settings → Personal access tokens → Tokens (classic)
3. "Generate new token" → "Generate new token (classic)" をクリック
4. **Note**: わかりやすい名前を入力（例: "ClaudeWork - My Projects"）
5. **Expiration**: 有効期限を選択（推奨: 90日または1年）
6. **Select scopes**: 以下をチェック
   - ✅ `repo` - Full control of private repositories
   - ✅ `workflow` - Update GitHub Action workflows
7. "Generate token" をクリック
8. 表示されたトークンをコピー（**この画面を離れると二度と表示されません**）

**直接リンク**: https://github.com/settings/tokens/new

### Fine-grained Personal Access Token を作成する場合

1. GitHubにログイン
2. Settings → Developer settings → Personal access tokens → Fine-grained tokens
3. "Generate new token" をクリック
4. **Token name**: わかりやすい名前を入力
5. **Expiration**: 有効期限を選択
6. **Repository access**:
   - "All repositories" または "Only select repositories" を選択
7. **Permissions** → **Repository permissions**:
   - **Contents**: `Read and write`
   - **Pull requests**: `Read and write`
   - **Workflows**: `Read and write`
   - **Metadata**: `Read-only`（自動選択）
8. "Generate token" をクリック
9. 表示されたトークンをコピー

**直接リンク**: https://github.com/settings/personal-access-tokens/new

## ClaudeWorkでの設定

1. ClaudeWorkを起動: `npx claude-work start`
2. ブラウザで http://localhost:3000 を開く
3. Settings → GitHub PAT に移動
4. "新しいPATを追加" をクリック
5. 以下を入力:
   - **名前**: わかりやすい名前（例: "My GitHub PAT"）
   - **トークン**: コピーしたPATを貼り付け
   - **説明**（任意）: 用途のメモ（例: "個人プロジェクト用"）
6. "追加" をクリック

## 使用方法

### プロジェクト登録時にPATを使用

1. Projects画面で "新規プロジェクト追加" をクリック
2. "リモートリポジトリ" タブを選択
3. **実行環境**: "Docker" を選択
4. **リポジトリURL**: HTTPS URLを入力（例: `https://github.com/user/private-repo.git`）
5. **GitHub PAT**: 登録したPATを選択
6. "追加" をクリック

### 対応するURL形式

- ✅ HTTPS: `https://github.com/user/repo.git`
- ❌ SSH: `git@github.com:user/repo.git`（PATは不要、SSH鍵を使用）

## セキュリティ

- PATはAES-256-GCM暗号化されてデータベースに保存されます
- 暗号化キーは環境変数 `ENCRYPTION_KEY` で管理
- トークンの平文は画面に表示されません
- 不要になったPATは削除してください

## トラブルシューティング

### クローン時に401エラーが発生する

**原因**: PATの権限不足またはトークンの有効期限切れ

**対処法**:
1. GitHubでPATの権限を確認
2. 必要な権限（`repo`, `workflow`）が付与されているか確認
3. PATの有効期限を確認
4. 新しいPATを作成して再登録

### PATが選択肢に表示されない

**原因**: PATが無効化されている

**対処法**:
1. Settings → GitHub PAT で該当PATを確認
2. 無効化されている場合は、トグルボタンで有効化

## 参考リンク

- [GitHub公式: Personal access tokens について](https://docs.github.com/ja/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [GitHub公式: Fine-grained personal access token の作成](https://docs.github.com/ja/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)
