# タスク管理書: Docker Composeプライマリデプロイ化

## タスク一覧

| ID | タスク | ステータス | 依存 |
|----|--------|-----------|------|
| TASK-001 | docker-compose.yml + Dockerfile更新 | DONE | - |
| TASK-002 | .env.example更新 | DONE | TASK-001 |
| TASK-003 | README.md更新 | DONE | TASK-001 |
| TASK-004 | docs/SETUP.md更新 | DONE | TASK-001 |
| TASK-005 | docs/SYSTEMD_SETUP.md更新 (ファイル削除済み) | DONE | - |
| TASK-006 | CLAUDE.md更新 | DONE | TASK-001 |
| TASK-007 | docs/ENV_VARS.md更新 | DONE | TASK-001 |
| TASK-008 | docs/DOCKER_ENVIRONMENT.md更新 | DONE | TASK-001 |
| TASK-009 | ビルド・起動検証 | DONE | TASK-001〜008 |

## 詳細

### TASK-001: docker-compose.yml + Dockerfile更新

**説明**: Docker Compose環境の基盤となるインフラファイルを更新する。

**対象ファイル**: `docker-compose.yml`, `Dockerfile`

**受入基準**:
- docker-compose.ymlに `/var/run/docker.sock:/var/run/docker.sock` マウントが追加されている
- docker-compose.ymlに `env_file` ディレクティブが追加されている
- docker-compose.ymlに `GIT_REPOS_PATH` 環境変数がオプションとして追加されている
- Dockerfileのrunnerステージに `docker-ce-cli` パッケージがインストールされている
- `docker compose config` がエラーなく成功する

**実装手順**:
1. `docker-compose.yml` に volumes セクションで docker.sock マウントを追加
2. `env_file` ディレクティブ追加（`required: false`）
3. `GIT_REPOS_PATH` 環境変数を追加
4. `Dockerfile` の runner ステージに Docker CLI インストール手順を追加
5. `docker compose config` で構文確認

### TASK-002: .env.example更新

**説明**: Docker Compose向けの設定例を `.env.example` に追加する。

**対象ファイル**: `.env.example`

**受入基準**:
- Docker Compose向けセクションが追加されている
- `HOST_PORT` の説明が含まれている
- Docker Compose使用時の `DATABASE_URL` の注意事項が含まれている

### TASK-003: README.md更新

**説明**: クイックスタートをDocker Compose優先に書き換える。

**対象ファイル**: `README.md`

**受入基準**:
- クイックスタートセクションでDocker Compose方法が最初に記載されている
- Docker Compose手順: `git clone` → `.env` 編集 → `docker compose up -d`
- 動作保証環境にDocker Composeが明記されている

### TASK-004: docs/SETUP.md更新

**説明**: セットアップガイドをDocker Compose優先に書き換える。

**対象ファイル**: `docs/SETUP.md`

**受入基準**:
- 最初のセクションが「Docker Compose（推奨）」になっている
- Docker Compose特有のトラブルシューティングが追加されている

### TASK-005: docs/SYSTEMD_SETUP.md更新 (ファイル削除済み)

**説明**: systemdセットアップが代替方法であることを明記する。

**対象ファイル**: `docs/SYSTEMD_SETUP.md` (npx移行に伴い削除済み)

**受入基準**:
- タイトルまたは冒頭に「代替デプロイ方法」であることが明記されている
- Docker Composeが推奨である旨の注記が追加されている

### TASK-006: CLAUDE.md更新

**説明**: Environment SetupセクションをDocker Compose優先に変更する。

**対象ファイル**: `CLAUDE.md`

**受入基準**:
- Running the ApplicationセクションでDocker Composeが記載されている

### TASK-007: docs/ENV_VARS.md更新

**説明**: Docker Compose環境固有の設定セクションを追加する。

**対象ファイル**: `docs/ENV_VARS.md`

**受入基準**:
- Docker Compose向け環境変数セクションが追加されている
- `HOST_PORT` の説明が含まれている
- docker.sockマウントの説明が含まれている

### TASK-008: docs/DOCKER_ENVIRONMENT.md更新

**説明**: Docker Compose運用時の注意事項セクションを追加する。

**対象ファイル**: `docs/DOCKER_ENVIRONMENT.md`

**受入基準**:
- Docker Compose運用セクションが追加されている
- docker.sockマウントの説明がある
- データ永続化の注意点が記載されている

### TASK-009: ビルド・起動検証

**説明**: 全変更を適用した状態でDocker Composeビルド・起動を検証する。

**受入基準**:
- `docker compose config` がエラーなく成功
- `docker compose build` がビルド成功
- `docker compose up -d` で起動し、ヘルスチェック正常
- ブラウザでアプリケーションが正常表示される
