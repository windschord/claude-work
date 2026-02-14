# 要件定義: Docker環境worktree管理の修正

## プロジェクト概要

Docker環境でクローンされたプロジェクトのセッション作成時に、worktreeパスの不整合が原因でPTY初期化とgit操作が失敗する問題を修正する。

## 現在の問題

1. **worktreeパスの不整合**
   - Docker環境プロジェクトのセッション作成時、worktreePathが `/repo/.worktrees/session-XXXXX`（Dockerコンテナ内パス）としてデータベースに保存される
   - PTY作成時、このパスをホスト環境から参照しようとして失敗する

2. **発生するエラー**
   - `PTY creation failed: workingDir does not exist: /repo/.worktrees/session-XXXXX`
   - `fatal: cannot change to '/docker-volumes/claude-repo-XXXXX/.worktrees/session-XXXXX': No such file or directory`
   - 無限ループによるサーバークラッシュ（`RangeError: Maximum call stack size exceeded`）

3. **影響範囲**
   - Shell、Diff、Commitsタブが機能しない
   - git操作が実行できない
   - セッション自体が使用不可

## ユーザーストーリー

| ID | タイトル | 優先度 | ステータス | 詳細 |
|----|---------|--------|-----------|------|
| US-001 | Docker環境でのセッション作成と使用 | 高 | TODO | [詳細](stories/US-001.md) @stories/US-001.md |
| US-002 | Host環境との互換性維持 | 高 | TODO | [詳細](stories/US-002.md) @stories/US-002.md |

## 非機能要件

| カテゴリ | ファイル |
|---------|---------|
| 信頼性 | [reliability.md](nfr/reliability.md) @nfr/reliability.md |
| 互換性 | [compatibility.md](nfr/compatibility.md) @nfr/compatibility.md |

## 技術的制約

- プロジェクトの `clone_location` フィールド（`docker` / `host`）で環境を判別
- Dockerボリューム名: `claude-repo-${projectId}`
- Dockerコンテナ内マウントパス: `/repo`
- EnvironmentAdapter（HostAdapter / DockerAdapter）による環境抽象化
- 既存のHost環境プロジェクトには影響を与えない

## 関連ファイル

- `src/app/api/projects/[project_id]/sessions/route.ts` - セッション作成API
- `src/services/docker-git-service.ts` - Docker環境のgit操作
- `src/services/pty-session-manager.ts` - PTYセッション管理
- `src/services/adapter-factory.ts` - Environment Adapterファクトリー
- `src/services/adapters/docker-adapter.ts` - Docker環境Adapter
