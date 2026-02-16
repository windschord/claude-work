# TASK-013: ドキュメントの更新

## 説明

- 対象ファイル: `CLAUDE.md`, `README.md`, `docs/**`
- Docker主体への移行を反映したドキュメント更新
- リモートリポジトリクローン機能の説明追加
- 既存のドキュメントを新しいワークフローに合わせて修正

## 技術的文脈

- ドキュメント形式: Markdown
- 参照すべき既存ドキュメント: `docs/sdd/requirements/`, `docs/sdd/design/`

## 実装手順

1. ドキュメントレビュー: 既存ドキュメントを確認
2. 更新箇所リストアップ: 変更が必要な箇所を特定
3. ドキュメント更新: 新機能と変更を反映
4. レビュー: 整合性と正確性を確認
5. コミット

## 更新対象ドキュメント

### 1. CLAUDE.md

**追加内容:**
- Docker主体の実行環境説明
- リモートリポジトリクローン機能の説明
- 環境管理の説明（Docker/Host/SSH）

**修正例:**
```markdown
## Execution Environments

Claude Code can run in different execution environments:

**Environment Types**:
- **DOCKER**: Isolated execution in Docker containers (default)
- **HOST**: Direct execution on the local machine
- **SSH**: Remote execution (not yet implemented)

**Default Environment**: The system automatically creates a default Docker environment on first startup.
```

### 2. README.md

**追加内容:**
- リモートリポジトリからのクローン手順
- Docker環境のセットアップ方法
- 環境管理UI の説明

**修正例:**
```markdown
## Features

- **Multi-Session Management**: Run multiple Claude Code sessions in parallel
- **Git Worktree Integration**: Isolate each session in its own environment
- **Remote Repository Cloning**: Clone projects from GitHub/GitLab
- **Docker-Based Execution**: Secure, isolated execution environments (default)
- **Environment Management**: Switch between Docker, Host, and SSH execution
```

### 3. docs/SETUP.md

**追加内容:**
- Docker環境のセットアップ手順
- リモートリポジトリクローンの初回セットアップ
- SSH鍵の設定方法（Docker環境での使用）

**修正例:**
```markdown
## Docker Environment Setup

ClaudeWork uses Docker as the default execution environment for security and isolation.

### Prerequisites
- Docker Desktop installed and running
- SSH keys configured in `~/.ssh/` (for private repository access)

### Initial Setup
1. Start ClaudeWork: `npx claude-work start`
2. A default Docker environment is automatically created
3. SSH keys are mounted read-only from `~/.ssh/`
```

### 4. docs/API.md

**追加内容:**
- Clone API (`POST /api/projects/clone`)
- Pull API (`POST /api/projects/[id]/pull`)
- Branches API (`GET /api/projects/[id]/branches`)

**修正例:**
```markdown
## POST /api/projects/clone

Clone a remote Git repository and register as a project.

**Request Body**:
```json
{
  "url": "git@github.com:user/repo.git",
  "name": "optional-name",
  "cloneLocation": "docker" | "host"
}
```

**Response** (201):
```json
{
  "project": {
    "id": "uuid",
    "name": "repo",
    "path": "/docker-volumes/claude-repo-{id}",
    "remote_url": "git@github.com:user/repo.git",
    "clone_location": "docker"
  }
}
```
```

### 5. docs/ENV_VARS.md

**追加内容:**
- Docker関連の環境変数
- リモートリポジトリ関連の設定

**修正例:**
```markdown
## DOCKER_IMAGE

Docker実行環境で使用するイメージ名。

- Type: `string`
- Default: `node:20-alpine`
- Example: `DOCKER_IMAGE=node:20-alpine`

## DOCKER_VOLUME_PREFIX

Dockerボリュームのプレフィックス。

- Type: `string`
- Default: `claude-repo-`
- Example: `DOCKER_VOLUME_PREFIX=my-project-`
```

## 受入基準

- [ ] `CLAUDE.md`が更新されている
- [ ] `README.md`が更新されている
- [ ] `docs/SETUP.md`が更新されている
- [ ] `docs/API.md`が更新されている
- [ ] `docs/ENV_VARS.md`が更新されている
- [ ] 新機能（リモートクローン、環境管理）の説明がある
- [ ] Docker主体の設計が反映されている
- [ ] ドキュメント間の整合性が保たれている
- [ ] マークダウンの構文エラーがない

## 依存関係

- TASK-001〜011（全機能実装）

## 推定工数

40分

## ステータス

`DONE`

## 完了報告

### 更新内容

**CLAUDE.md:**
- 実行環境の説明をDocker主体に変更（デフォルト環境として強調）
- SSH鍵の自動マウント機能を追加
- データベーススキーマにremote_url、clone_location、GitHubPATを追加

**README.md:**
- 主な機能セクションに以下を追加:
  - リモートリポジトリクローン
  - Docker実行環境（デフォルト）
  - 環境管理（Docker/Host/SSH）
  - ブランチ管理

**docs/SETUP.md:**
- Docker環境を推奨環境として明記
- リモートリポジトリクローンの使い方を詳細に追加:
  - SSH URL（推奨）
  - HTTPS URL
  - 保存場所選択（Docker/Host）
  - プライベートリポジトリのPAT設定
- セッション作成時のブランチ選択機能を追加

**docs/API.md:**
- Clone API（`POST /api/projects/clone`）を追加
  - URL、name、cloneLocation、githubPatId パラメータ
  - レスポンス形式とエラーコード
- Pull API（`POST /api/projects/:id/pull`）を追加
  - レスポンス形式とエラーコード
- Branches API（`GET /api/projects/:id/branches`）を追加
  - ブランチ一覧のレスポンス形式
- セッション作成APIに`branch_name`パラメータを追加

**docs/ENV_VARS.md:**
- すでに完備されているため追加更新なし

### 受入基準チェック

- ✅ `CLAUDE.md`が更新されている
- ✅ `README.md`が更新されている
- ✅ `docs/SETUP.md`が更新されている
- ✅ `docs/API.md`が更新されている
- ✅ `docs/ENV_VARS.md`は既に完備
- ✅ 新機能（リモートクローン、環境管理）の説明がある
- ✅ Docker主体の設計が反映されている
- ✅ ドキュメント間の整合性が保たれている
- ✅ マークダウンの構文エラーがない

### コミット

- `c74f4a1`: "docs: Docker主体とリモートリポジトリ機能を反映"

## 備考

- 既存ドキュメントとの整合性を重視
- スクリーンショットや図は必要に応じて追加（オプション）
- 技術的に正確な記述を心がける
