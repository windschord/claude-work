# Worktreeベースセッション管理 - 技術設計書

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 情報の明確性チェック

### ユーザーから明示された情報
- [x] 技術スタック: 既存のNext.js + Prisma + Docker環境を継続使用
- [x] アーキテクチャパターン: リポジトリ事前登録 → セッション作成
- [x] Worktree配置場所: `~/.claudework/worktrees/`
- [x] ブランチ命名規則: `session/<セッション名>`
- [x] リモートリポジトリ: Docker volume使用、ローカルチェックアウトなし
- [x] 既存データ: すべてリセット可能
- [x] UI配置: サイドバーにリポジトリセクション追加

### 不明/要確認の情報

すべての情報はユーザーとの対話で確認済みです。

---

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                           │
├─────────────────────────────────────────────────────────────────────┤
│  Sidebar           │  Main Content                                   │
│  ┌───────────────┐ │  ┌─────────────────────────────────────────┐   │
│  │ Repositories  │ │  │ CreateSessionModal                       │   │
│  │ ┌───────────┐ │ │  │ - リポジトリ選択（ドロップダウン）      │   │
│  │ │ local-repo│ │ │  │ - 親ブランチ選択                        │   │
│  │ │ remote-rp │ │ │  │ - セッション名入力                      │   │
│  │ └───────────┘ │ │  │ - ブランチ名プレビュー                  │   │
│  │ [+ Add Repo] │ │  └─────────────────────────────────────────┘   │
│  └───────────────┘ │                                                 │
│  ┌───────────────┐ │  ┌─────────────────────────────────────────┐   │
│  │ Sessions      │ │  │ Terminal (XTerm.js)                      │   │
│  │ ┌───────────┐ │ │  │                                          │   │
│  │ │ session-1 │ │ │  │                                          │   │
│  │ │ session-2 │ │ │  └─────────────────────────────────────────┘   │
│  │ └───────────┘ │ │                                                 │
│  └───────────────┘ │                                                 │
└────────────────────┴────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend (Next.js API)                        │
├─────────────────────────────────────────────────────────────────────┤
│  /api/repositories          │  /api/sessions                         │
│  - GET    (一覧取得)        │  - GET    (一覧取得)                   │
│  - POST   (登録)            │  - POST   (作成)                       │
│  - DELETE (削除)            │  - DELETE (削除)                       │
│                             │  - PATCH  (開始/停止)                   │
│  /api/repositories/:id      │                                        │
│  - GET    (詳細取得)        │  /api/filesystem/branches              │
│                             │  - GET    (ブランチ一覧)               │
└─────────────────┬───────────┴────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Services Layer                               │
├─────────────────────────────────────────────────────────────────────┤
│  RepositoryManager         │  ContainerManager (Updated)             │
│  - register()              │  - createSession()                      │
│  - list()                  │  - startSession()                       │
│  - delete()                │  - stopSession()                        │
│  - getBranches()           │  - deleteSession()                      │
│                            │                                         │
│  WorktreeService (New)     │  DockerService (Existing)               │
│  - create()                │  - createContainer()                    │
│  - remove()                │  - startContainer()                     │
│  - list()                  │  - stopContainer()                      │
└─────────────────┬───────────┴────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Prisma (SQLite)           │  File System                            │
│  ┌─────────────────────┐   │  ┌─────────────────────────────────┐   │
│  │ Repository          │   │  │ ~/.claudework/worktrees/         │   │
│  │ - id                │   │  │   └── <repo>-<session>/         │   │
│  │ - name              │   │  │       └── (git worktree)        │   │
│  │ - type (local/rem)  │   │  └─────────────────────────────────┘   │
│  │ - path/url          │   │                                        │
│  │ - defaultBranch     │   │  Docker                                │
│  └─────────────────────┘   │  ┌─────────────────────────────────┐   │
│  ┌─────────────────────┐   │  │ Volumes (remote repos only)     │   │
│  │ Session             │   │  │   └── claudework-<session>      │   │
│  │ - id                │   │  │                                  │   │
│  │ - repositoryId      │   │  │ Containers                       │   │
│  │ - worktreePath      │   │  │   └── claudework-<session-id>   │   │
│  │ - branch            │   │  └─────────────────────────────────┘   │
│  └─────────────────────┘   │                                        │
└─────────────────────────────┴────────────────────────────────────────┘
```

---

## コンポーネント

### コンポーネント1: Repository（データモデル）

**目的**: 登録済みリポジトリを永続化する

**責務**:
- リポジトリ情報（名前、タイプ、パス/URL）を保存
- デフォルトブランチを保存
- 関連セッションとのリレーション管理

**フィールド**:
| フィールド | 型 | 説明 |
|-----------|------|------|
| id | String (UUID) | 一意識別子 |
| name | String | 表示名 |
| type | String | "local" または "remote" |
| path | String? | ローカルパス（type=local時） |
| url | String? | リモートURL（type=remote時） |
| defaultBranch | String | デフォルトブランチ名 |
| createdAt | DateTime | 作成日時 |
| updatedAt | DateTime | 更新日時 |

---

### コンポーネント2: Session（データモデル - 更新）

**目的**: セッション情報を永続化する（リポジトリ参照に変更）

**責務**:
- リポジトリとの関連を管理
- Worktree/ブランチ情報を保存
- Dockerコンテナとの関連を管理

**フィールド変更**:
| 変更 | フィールド | 型 | 説明 |
|------|-----------|------|------|
| 削除 | repoUrl | - | Repositoryに移行 |
| 削除 | localPath | - | Repositoryに移行 |
| 追加 | repositoryId | String | Repository参照 |
| 追加 | worktreePath | String? | Worktreeパス（local時） |
| 追加 | parentBranch | String | 親ブランチ名 |
| 変更 | branch | String | セッションブランチ（session/xxx形式） |

---

### コンポーネント3: WorktreeService（新規）

**目的**: Git Worktreeの作成・削除を管理

**責務**:
- Worktreeの作成（`git worktree add`）
- Worktreeの削除（`git worktree remove`）
- Worktree一覧の取得
- ブランチ名の自動生成

**インターフェース**:
```typescript
interface WorktreeService {
  // Worktreeを作成
  create(options: {
    repoPath: string;      // 親リポジトリのパス
    worktreePath: string;  // Worktreeの配置先
    branch: string;        // 新しいブランチ名
    parentBranch: string;  // 親ブランチ名
  }): Promise<void>;

  // Worktreeを削除
  remove(worktreePath: string): Promise<void>;

  // Worktree一覧を取得
  list(repoPath: string): Promise<WorktreeInfo[]>;

  // ブランチ名を生成
  generateBranchName(sessionName: string): string;
}
```

**配置場所**: `~/.claudework/worktrees/<repo-name>-<session-name>/`

---

### コンポーネント4: RepositoryManager（新規）

**目的**: リポジトリの登録・管理を行う

**責務**:
- リポジトリの登録（ローカル/リモート）
- リポジトリ一覧の取得
- リポジトリの削除
- ブランチ一覧の取得

**インターフェース**:
```typescript
interface RepositoryManager {
  // リポジトリを登録
  register(options: {
    name: string;
    type: 'local' | 'remote';
    path?: string;   // local時
    url?: string;    // remote時
  }): Promise<Repository>;

  // 一覧取得
  findAll(): Promise<Repository[]>;

  // ID指定で取得
  findById(id: string): Promise<Repository | null>;

  // 削除
  delete(id: string): Promise<void>;

  // ブランチ一覧取得
  getBranches(id: string): Promise<string[]>;
}
```

---

### コンポーネント5: ContainerManager（更新）

**目的**: Dockerコンテナのライフサイクル管理

**変更内容**:
- `createSession`のパラメータ変更（repositoryId指定）
- ローカルリポジトリ時: Worktree作成 → bind mount
- リモートリポジトリ時: volume作成 → clone（従来動作）

**新しいインターフェース**:
```typescript
interface CreateSessionOptions {
  name: string;
  repositoryId: string;
  parentBranch: string;
}

async createSession(options: CreateSessionOptions): Promise<Session>;
```

---

## データフロー

### シーケンス1: リポジトリ登録

```
┌────────┐      ┌────────────┐      ┌──────────────────┐      ┌──────────┐
│ Client │      │ API Route  │      │ RepositoryManager│      │ Prisma   │
└───┬────┘      └─────┬──────┘      └────────┬─────────┘      └────┬─────┘
    │                 │                      │                     │
    │ POST /api/repos │                      │                     │
    │ {name,type,path}│                      │                     │
    │─────────────────>                      │                     │
    │                 │ register()           │                     │
    │                 │──────────────────────>                     │
    │                 │                      │ validate path/url   │
    │                 │                      │──────┐              │
    │                 │                      │<─────┘              │
    │                 │                      │ detect default branch│
    │                 │                      │──────┐              │
    │                 │                      │<─────┘              │
    │                 │                      │ repository.create() │
    │                 │                      │─────────────────────>
    │                 │                      │                     │
    │                 │ Repository           │<─────────────────────
    │<─────────────────────────────────────────                    │
    │                 │                      │                     │
```

### シーケンス2: セッション作成（ローカルリポジトリ）

```
┌────────┐   ┌──────────┐   ┌────────────────┐   ┌───────────────┐   ┌────────┐
│ Client │   │ API Route│   │ContainerManager│   │WorktreeService│   │ Docker │
└───┬────┘   └────┬─────┘   └───────┬────────┘   └───────┬───────┘   └───┬────┘
    │             │                 │                    │               │
    │ POST /api/sessions            │                    │               │
    │ {repositoryId,                │                    │               │
    │  parentBranch,name}           │                    │               │
    │────────────────>              │                    │               │
    │             │ createSession() │                    │               │
    │             │─────────────────>                    │               │
    │             │                 │ generateBranchName()               │
    │             │                 │────────────────────>               │
    │             │                 │ "session/xxx"      │               │
    │             │                 │<────────────────────               │
    │             │                 │ worktree.create()  │               │
    │             │                 │────────────────────>               │
    │             │                 │ git worktree add   │               │
    │             │                 │<────────────────────               │
    │             │                 │ createContainer()  │               │
    │             │                 │────────────────────────────────────>
    │             │                 │ (bind mount worktree to /workspace)│
    │             │                 │<────────────────────────────────────
    │             │                 │ startContainer()   │               │
    │             │                 │────────────────────────────────────>
    │             │                 │<────────────────────────────────────
    │             │ Session         │                    │               │
    │<────────────────────────────────                   │               │
    │             │                 │                    │               │
```

### シーケンス3: セッション作成（リモートリポジトリ）

```
┌────────┐   ┌──────────┐   ┌────────────────┐   ┌────────┐
│ Client │   │ API Route│   │ContainerManager│   │ Docker │
└───┬────┘   └────┬─────┘   └───────┬────────┘   └───┬────┘
    │             │                 │                │
    │ POST /api/sessions            │                │
    │ {repositoryId,                │                │
    │  parentBranch,name}           │                │
    │────────────────>              │                │
    │             │ createSession() │                │
    │             │─────────────────>                │
    │             │                 │ createVolume() │
    │             │                 │────────────────>
    │             │                 │<────────────────
    │             │                 │ createContainer()
    │             │                 │────────────────>
    │             │                 │ (volume mount, env: REPO_URL, BRANCH)
    │             │                 │<────────────────
    │             │                 │ startContainer()
    │             │                 │────────────────>
    │             │                 │ (entrypoint: clone & checkout)
    │             │                 │<────────────────
    │             │ Session         │                │
    │<────────────────────────────────                │
    │             │                 │                │
```

### シーケンス4: セッション削除（ローカルリポジトリ）

```
┌────────┐   ┌──────────┐   ┌────────────────┐   ┌───────────────┐   ┌────────┐
│ Client │   │ API Route│   │ContainerManager│   │WorktreeService│   │ Docker │
└───┬────┘   └────┬─────┘   └───────┬────────┘   └───────┬───────┘   └───┬────┘
    │             │                 │                    │               │
    │ DELETE /api/sessions/:id      │                    │               │
    │────────────────>              │                    │               │
    │             │ deleteSession() │                    │               │
    │             │─────────────────>                    │               │
    │             │                 │ stopContainer()    │               │
    │             │                 │────────────────────────────────────>
    │             │                 │<────────────────────────────────────
    │             │                 │ removeContainer()  │               │
    │             │                 │────────────────────────────────────>
    │             │                 │<────────────────────────────────────
    │             │                 │ worktree.remove()  │               │
    │             │                 │────────────────────>               │
    │             │                 │ git worktree remove│               │
    │             │                 │<────────────────────               │
    │             │                 │ session.delete()   │               │
    │             │                 │──────┐             │               │
    │             │                 │<─────┘             │               │
    │             │ 204 No Content  │                    │               │
    │<────────────────────────────────                   │               │
    │             │                 │                    │               │
```

---

## API設計

### エンドポイント: GET /api/repositories

**目的**: 登録済みリポジトリ一覧を取得

**レスポンス**:
```json
{
  "repositories": [
    {
      "id": "uuid",
      "name": "my-project",
      "type": "local",
      "path": "/home/user/projects/my-project",
      "defaultBranch": "main",
      "sessionCount": 2,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### エンドポイント: POST /api/repositories

**目的**: リポジトリを登録

**リクエスト**:
```json
{
  "name": "my-project",
  "type": "local",
  "path": "/home/user/projects/my-project"
}
```
または
```json
{
  "name": "my-project",
  "type": "remote",
  "url": "https://github.com/user/my-project.git"
}
```

**レスポンス**:
```json
{
  "id": "uuid",
  "name": "my-project",
  "type": "local",
  "path": "/home/user/projects/my-project",
  "defaultBranch": "main",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### エンドポイント: DELETE /api/repositories/:id

**目的**: リポジトリを削除

**レスポンス**: 204 No Content

**エラー**: 関連セッションが存在する場合は409 Conflict

### エンドポイント: GET /api/repositories/:id/branches

**目的**: リポジトリのブランチ一覧を取得

**レスポンス**:
```json
{
  "branches": ["main", "develop", "feature/xxx"],
  "defaultBranch": "main"
}
```

### エンドポイント: POST /api/sessions（更新）

**目的**: セッションを作成

**リクエスト**:
```json
{
  "name": "my-session",
  "repositoryId": "uuid",
  "parentBranch": "main"
}
```

**レスポンス**:
```json
{
  "id": "uuid",
  "name": "my-session",
  "branch": "session/my-session",
  "parentBranch": "main",
  "repository": {
    "id": "uuid",
    "name": "my-project",
    "type": "local"
  },
  "status": "running",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

## データベーススキーマ

### テーブル: repositories（新規）

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| name | TEXT | NOT NULL | 表示名 |
| type | TEXT | NOT NULL | "local" or "remote" |
| path | TEXT | NULL | ローカルパス |
| url | TEXT | NULL | リモートURL |
| default_branch | TEXT | NOT NULL | デフォルトブランチ |
| created_at | DATETIME | NOT NULL | 作成日時 |
| updated_at | DATETIME | NOT NULL | 更新日時 |

**制約**: `path`と`url`のどちらか一方のみが設定される（CHECK制約）

### テーブル: sessions（更新）

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| name | TEXT | NOT NULL | セッション名 |
| repository_id | TEXT | FOREIGN KEY | リポジトリ参照 |
| container_id | TEXT | NULL | Dockerコンテナ ID |
| volume_name | TEXT | NOT NULL | Docker volume名 |
| worktree_path | TEXT | NULL | Worktreeパス（local時） |
| branch | TEXT | NOT NULL | セッションブランチ |
| parent_branch | TEXT | NOT NULL | 親ブランチ |
| status | TEXT | NOT NULL | ステータス |
| created_at | DATETIME | NOT NULL | 作成日時 |
| updated_at | DATETIME | NOT NULL | 更新日時 |

**削除カラム**: `repo_url`, `local_path`

---

## 技術的決定事項

### 決定1: Worktree配置場所

**検討した選択肢**:
1. `~/.claudework/worktrees/` - 専用ディレクトリ
2. 親リポジトリと同じ階層 - 例: `/home/user/projects/my-project-session1/`

**決定**: 選択肢1 - `~/.claudework/worktrees/`
**根拠**: ユーザーの指定による。管理が容易で、既存のプロジェクト構造に影響を与えない。

### 決定2: ブランチ命名規則

**検討した選択肢**:
1. `session/<session-name>` - プレフィックス付き
2. `<session-name>` - セッション名そのまま

**決定**: 選択肢1 - `session/<session-name>`
**根拠**: ユーザーの指定による。セッション用ブランチが明確に区別できる。

### 決定3: リモートリポジトリの扱い

**検討した選択肢**:
1. ローカルにクローン + Worktree
2. Docker volume内にクローン（従来動作）

**決定**: 選択肢2 - Docker volume内にクローン
**根拠**: ユーザーの指定による。ローカルにファイルを残さない。

### 決定4: 既存データの移行

**検討した選択肢**:
1. マイグレーションで既存データを変換
2. 既存データをすべてリセット

**決定**: 選択肢2 - 既存データをすべてリセット
**根拠**: ユーザーの承認済み。スキーマが大きく変わるため、リセットが最もシンプル。

---

## セキュリティ考慮事項

1. **パス検証**: ローカルリポジトリ登録時、ホームディレクトリ内のみ許可（既存のFilesystemServiceを活用）
2. **URL検証**: リモートリポジトリ登録時、git URLの形式を検証
3. **Worktreeパス**: 固定ディレクトリ内にのみ作成を許可
4. **リポジトリ削除時**: 関連セッションがある場合は削除を拒否

---

## エラー処理

### リポジトリ登録時
- パスが存在しない → 400 Bad Request
- パスがGitリポジトリでない → 400 Bad Request
- URLが無効 → 400 Bad Request
- 同名のリポジトリが存在 → 409 Conflict

### セッション作成時
- リポジトリが存在しない → 404 Not Found
- ブランチが存在しない → 400 Bad Request
- Worktree作成失敗 → 500 Internal Server Error（詳細メッセージ付き）
- 同名のWorktreeが存在 → 409 Conflict

### セッション削除時
- Worktree削除失敗 → 警告ログのみ（コンテナ・DBは削除続行）

---

## フロントエンドコンポーネント

### RepositorySection（新規）

**目的**: サイドバーにリポジトリ一覧を表示

**構成**:
- リポジトリ一覧（アイコンでタイプ区別）
- 各リポジトリのセッション数表示
- 追加ボタン → AddRepositoryModal
- 削除ボタン（セッションがない場合のみ有効）

### AddRepositoryModal（新規）

**目的**: リポジトリを登録するモーダル

**構成**:
- タイプ選択（Local/Remote タブ）
- Local: DirectoryBrowserで選択
- Remote: URL入力
- 名前入力（自動生成可）
- 登録ボタン

### CreateSessionModal（更新）

**目的**: セッションを作成するモーダル

**変更内容**:
- リポジトリ選択（ドロップダウン）
- 親ブランチ選択（リポジトリのブランチから）
- セッション名入力
- ブランチ名プレビュー（`session/<name>`）
- 従来のSourceTypeTabs、LocalRepoFormは削除

---

## 移行計画

1. **Prismaスキーマ更新**
   - Repositoryモデル追加
   - Sessionモデル更新
   - `npx prisma db push`（既存データはリセット）

2. **バックエンド実装**
   - WorktreeService新規作成
   - RepositoryManager新規作成
   - ContainerManager更新
   - API Routes作成/更新

3. **フロントエンド実装**
   - RepositorySection新規作成
   - AddRepositoryModal新規作成
   - CreateSessionModal更新
   - 不要コンポーネント削除

4. **テスト**
   - 単体テスト
   - 統合テスト
   - E2Eテスト
