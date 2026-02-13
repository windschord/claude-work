# 技術設計: ハイブリッド設計（ホスト環境/Docker環境でのプロジェクトclone）

## 設計概要

### 目的
プロジェクト登録時にリポジトリの保存場所（ホスト環境/Docker環境）を選択可能にし、SSH認証問題を回避しつつ、Git Worktreeの利点を両方の環境で維持する。

### アーキテクチャ原則
1. **環境の抽象化**: ホスト環境とDocker環境の実装パスを明確に分離
2. **共通ロジックの再利用**: Git操作の基本ロジックは共通化
3. **既存実装との互換性**: 既存のGitServiceとDockerAdapterを最大限活用
4. **設定の外部化**: タイムアウト値やデバッグモード設定を外部化
5. **エラーハンドリングの統一**: 両方の環境で一貫したエラー処理

## アーキテクチャ概要

### システムコンテキスト図

```text
┌─────────────────────────────────────────────────────────────┐
│                        ClaudeWork                           │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │                  Browser UI                        │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │  プロジェクト登録フォーム                     │  │   │
│  │  │  ┌────────────┐  ┌────────────┐             │  │   │
│  │  │  │ ホスト環境 │  │ Docker環境 │ <選択>      │  │   │
│  │  │  └────────────┘  └────────────┘             │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                 │
│                          ▼                                 │
│  ┌────────────────────────────────────────────────────┐   │
│  │            Project Registration API                │   │
│  │            /api/projects/clone                     │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                 │
│              ┌───────────┴───────────┐                    │
│              ▼                       ▼                    │
│  ┌───────────────────┐   ┌───────────────────┐           │
│  │  HostGitService   │   │ DockerGitService  │           │
│  │  (既存実装)       │   │  (新規実装)       │           │
│  └───────────────────┘   └───────────────────┘           │
│              │                       │                    │
│              ▼                       ▼                    │
│  ┌───────────────────┐   ┌───────────────────┐           │
│  │ data/repos/       │   │ Docker Volume     │           │
│  │ .worktrees/       │   │  /repo/           │           │
│  │                   │   │  /repo/.worktrees/│           │
│  └───────────────────┘   └───────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### コンポーネント構成

| コンポーネント | 役割 | 環境 | 詳細 |
|--------------|------|------|------|
| GitOperations (interface) | Git操作の抽象化 | 共通 | [詳細](components/git-operations.md) @components/git-operations.md |
| HostGitService | ホスト環境でのGit操作 | ホスト | [詳細](components/host-git-service.md) @components/host-git-service.md |
| DockerGitService | Docker環境でのGit操作 | Docker | [詳細](components/docker-git-service.md) @components/docker-git-service.md |
| DockerAdapter (拡張) | Docker環境管理 | Docker | [詳細](components/docker-adapter.md) @components/docker-adapter.md |
| ConfigService | 設定管理 | 共通 | [詳細](components/config-service.md) @components/config-service.md |
| ProjectCloneUI | プロジェクト登録UI | Frontend | [詳細](components/project-clone-ui.md) @components/project-clone-ui.md |

## API設計

### API変更一覧

| エンドポイント | メソッド | 変更内容 | 詳細 |
|--------------|---------|---------|------|
| /api/projects/clone | POST | cloneLocationパラメータ追加 | [詳細](api/project-clone.md) @api/project-clone.md |
| /api/settings | GET/PUT | タイムアウト・デバッグモード設定 | [詳細](api/settings.md) @api/settings.md |

## データベーススキーマ

### スキーマ変更

詳細: [schema.md](database/schema.md) @database/schema.md

### 変更サマリ

| テーブル | 変更内容 | マイグレーション |
|---------|---------|----------------|
| Project | cloneLocationフィールド追加 | 既存レコードは'host'として扱う |
| Project | dockerVolumeIdフィールド追加 | 既存レコードはnull |

## 技術的決定事項

| ID | タイトル | 詳細 |
|----|---------|------|
| DEC-001 | Docker環境をデフォルトにする理由 | [詳細](decisions/DEC-001.md) @decisions/DEC-001.md |
| DEC-002 | gh CLI認証を含める理由 | [詳細](decisions/DEC-002.md) @decisions/DEC-002.md |
| DEC-003 | タイムアウトを5分にする理由 | [詳細](decisions/DEC-003.md) @decisions/DEC-003.md |
| DEC-004 | alpine/gitイメージを使用する理由 | [詳細](decisions/DEC-004.md) @decisions/DEC-004.md |
| DEC-005 | Dockerボリューム内にworktreeを作成する理由 | [詳細](decisions/DEC-005.md) @decisions/DEC-005.md |

## 実装パス

### ホスト環境フロー

```text
1. ユーザーがホスト環境を選択
   ↓
2. /api/projects/clone API呼び出し
   cloneLocation: 'host'
   ↓
3. HostGitService.cloneRepository()
   - data/repos/<project-name>/ にgit clone
   - ホスト環境のSSH設定を使用
   ↓
4. データベースに保存
   cloneLocation: 'host'
   dockerVolumeId: null
   ↓
5. セッション作成時
   HostGitService.createWorktree()
   - .worktrees/<session-name>/ にworktree作成
```

### Docker環境フロー

```text
1. ユーザーがDocker環境を選択（デフォルト）
   ↓
2. /api/projects/clone API呼び出し
   cloneLocation: 'docker'
   ↓
3. DockerGitService.cloneRepository()
   a. Dockerボリューム作成
      docker volume create claude-repo-<project-id>
   b. 一時コンテナでgit clone
      docker run --rm \
        -v claude-repo-<project-id>:/repo \
        -v ~/.ssh:/root/.ssh:ro \
        -v $SSH_AUTH_SOCK:/ssh-agent \
        -v ~/.gitconfig:/root/.gitconfig:ro \
        -v ~/.config/gh:/root/.config/gh:ro \
        alpine/git clone <url> /repo
   ↓
4. データベースに保存
   cloneLocation: 'docker'
   dockerVolumeId: 'claude-repo-<project-id>'
   ↓
5. セッション作成時
   DockerGitService.createWorktree()
   - 一時コンテナでgit worktree add
     docker run --rm \
       -v claude-repo-<project-id>:/repo \
       alpine/git -C /repo worktree add \
       /repo/.worktrees/<session-name> -b session/<session-name>
   - セッション起動時にworktreeディレクトリをマウント
```

## エラーハンドリング設計

### エラー型の統一

```typescript
class GitOperationError extends Error {
  constructor(
    message: string,
    public environment: 'host' | 'docker',
    public operation: 'clone' | 'worktree' | 'volume',
    public recoverable: boolean,
    public cause?: Error
  ) {
    super(message);
    this.name = 'GitOperationError';
  }
}
```

### クリーンアップ戦略

| 失敗ケース | クリーンアップ処理 |
|----------|------------------|
| ホスト環境でのclone失敗 | 部分的にcloneされたディレクトリを削除 |
| Docker環境でのボリューム作成失敗 | なし（ボリュームが作成されていない） |
| Docker環境でのclone失敗 | Dockerボリュームを削除（デバッグモード無効時） |
| worktree作成失敗（ホスト） | 部分的に作成されたworktreeディレクトリを削除 |
| worktree作成失敗（Docker） | worktreeディレクトリを削除（ボリューム内） |

## セキュリティ設計

### 認証情報のマウント

| 認証情報 | マウント先 | モード | 理由 |
|---------|----------|-------|------|
| ~/.ssh | /root/.ssh | ro（読み取り専用） | SSH鍵の改変防止 |
| $SSH_AUTH_SOCK | /ssh-agent | - | SSH Agent通信 |
| ~/.gitconfig | /root/.gitconfig | ro（読み取り専用） | Git設定の改変防止 |
| ~/.config/gh | /root/.config/gh | ro（読み取り専用） | gh認証トークンの改変防止 |

### パストラバーサル対策

```typescript
const VALID_PROJECT_NAME = /^[a-zA-Z0-9_-]+$/;
const MAX_PROJECT_NAME_LENGTH = 255;

function validateProjectName(name: string): boolean {
  if (!name || name.length > MAX_PROJECT_NAME_LENGTH) {
    return false;
  }
  if (name.includes('..') || name.startsWith('/')) {
    return false;
  }
  return VALID_PROJECT_NAME.test(name);
}
```

## パフォーマンス設計

### タイムアウト設定

| 環境 | デフォルトタイムアウト | 最小値 | 最大値 |
|------|---------------------|-------|-------|
| ホスト環境 | 5分 | 1分 | 30分 |
| Docker環境 | 5分 | 1分 | 30分 |

### パフォーマンス目標

| 操作 | ホスト環境 | Docker環境 |
|-----|-----------|-----------|
| git clone（100MB） | 2分以内 | 3分以内 |
| worktree作成 | 5秒以内 | 10秒以内 |

## テスト戦略

### テストカバレッジ目標
- ユニットテスト: 80%以上
- E2Eテスト: 主要フロー100%

### テスト対象
- [ ] プロジェクト登録（ホスト環境）
- [ ] プロジェクト登録（Docker環境）
- [ ] セッション作成（ホスト環境）
- [ ] セッション作成（Docker環境）
- [ ] タイムアウト処理
- [ ] エラーハンドリング
- [ ] Dockerボリュームクリーンアップ
- [ ] 既存プロジェクトの互換性

## 非機能要件との対応

| NFR ID | 要件 | 設計での対応 |
|--------|------|-------------|
| NFR-PERF-001~010 | 性能要件 | タイムアウト設定、パフォーマンス目標の定義 |
| NFR-SEC-001~012 | セキュリティ要件 | 認証情報の読み取り専用マウント、パストラバーサル対策 |
| NFR-MAINT-001~010 | 保守性要件 | 環境の抽象化、共通ロジックの再利用、テストカバレッジ |

## 実装順序

### Phase 1: 基盤整備（1日）
1. データベーススキーマ変更
2. ConfigService実装
3. GitOperationsインターフェース定義

### Phase 2: Docker環境実装（2日）
1. DockerGitService実装（clone）
2. DockerAdapter拡張（gh認証マウント）
3. Dockerボリューム管理

### Phase 3: worktree実装（1.5日）
1. HostGitService.createWorktree()（既存実装の確認）
2. DockerGitService.createWorktree()

### Phase 4: UI実装（1日）
1. プロジェクト登録フォームの保存場所選択UI
2. 設定画面（タイムアウト、デバッグモード）

### Phase 5: テスト・統合（1.5日）
1. ユニットテスト
2. E2Eテスト
3. 既存プロジェクトの互換性確認

## 依存関係

### 外部依存
- Docker（ボリューム管理、コンテナ実行）
- alpine/gitイメージ（Docker環境でのGit操作）
- Prisma（データベーススキーマ変更）

### 内部依存
- PR#96の完了（完了済み）
- 既存のGitService
- 既存のDockerAdapter

## リスクと緩和策

| リスク | 影響 | 緩和策 |
|-------|------|-------|
| Docker環境でのパフォーマンス低下 | 中 | タイムアウト設定、ユーザーへの事前通知 |
| 既存プロジェクトの破壊 | 高 | TDD、既存機能テスト、マイグレーション方針 |
| Dockerボリュームの孤立 | 低 | 自動削除、手動クリーンアップコマンド |

## 承認記録

| 日付 | 承認者 | コメント |
|-----|-------|---------|
| 2026-02-13 | - | 初版作成 |

## 変更履歴

| バージョン | 日付 | 変更内容 |
|----------|------|---------|
| 0.1 | 2026-02-13 | 初版作成 |
