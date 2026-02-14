# 設計書: Docker環境worktree管理の修正

## アーキテクチャ概要

Docker環境とHost環境のworktree管理を適切に分離し、EnvironmentAdapterパターンを使って環境依存の処理を抽象化する。

```
┌─────────────────────────────────────────┐
│   Session Creation API                   │
│   (sessions/route.ts)                    │
└───────────────┬─────────────────────────┘
                │
                ├─ clone_location判別
                │
       ┌────────┴─────────┐
       │                  │
   host環境          docker環境
       │                  │
       ▼                  ▼
┌─────────────┐    ┌─────────────┐
│ GitService  │    │DockerGit    │
│             │    │  Service    │
└─────────────┘    └─────────────┘
       │                  │
       ▼                  ▼
┌─────────────┐    ┌─────────────┐
│ HostAdapter │    │DockerAdapter│
└─────────────┘    └─────────────┘
```

## 主要コンポーネント

| コンポーネント | 責務 | 詳細 |
|------------|------|------|
| SessionCreationAPI | セッション作成の統括 | [詳細](components/session-creation-api.md) @components/session-creation-api.md |
| DockerAdapter | Docker環境のPTY/git操作 | [詳細](components/docker-adapter.md) @components/docker-adapter.md |
| PathResolver | worktreeパスの解決 | [詳細](components/path-resolver.md) @components/path-resolver.md |

## 技術的決定事項

| ID | 決定事項 | 詳細 |
|----|---------|------|
| DEC-001 | worktreeパスの二重管理 | [詳細](decisions/DEC-001.md) @decisions/DEC-001.md |
| DEC-002 | エラーハンドリング戦略 | [詳細](decisions/DEC-002.md) @decisions/DEC-002.md |

## データモデル変更

### Session テーブル

現在のスキーマに変更は不要。`worktree_path` フィールドは引き続き使用し、環境に応じた解釈を行う。

```typescript
// Docker環境: /repo/.worktrees/session-XXXXX
// Host環境: /path/to/project/.worktrees/session-XXXXX
```

## 主要な変更箇所

1. **src/services/adapters/docker-adapter.ts**
   - `spawnPTY()` メソッドがDockerコンテナ内でPTYを起動
   - working directoryを `/repo/.worktrees/${sessionName}` に設定

2. **src/services/docker-git-service.ts**
   - エラーハンドリングの改善
   - 再試行制限の実装

3. **src/app/api/projects/[project_id]/sessions/route.ts**
   - worktreeパス設定ロジックの明確化
   - Docker/Host環境の判別処理の改善

## 既存機能への影響

- Host環境プロジェクト: **影響なし**（既存のロジックをそのまま使用）
- Docker環境プロジェクト: **改善**（PTYとgit操作が正常に動作）

## セキュリティ考慮事項

- worktreeパスのバリデーション継続
- Dockerコンテナ内の権限設定確認
- PTY操作の権限チェック

## パフォーマンス考慮事項

- Docker操作のオーバーヘッドは許容範囲内（既存のclone操作と同等）
- git操作のキャッシング機構は維持
