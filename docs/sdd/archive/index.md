# アーカイブ - ClaudeWork SDD

完了済みプロジェクトのSDD（要件定義・設計・タスク）を格納しています。

## 完了済みプロジェクト一覧

### コア機能

| プロジェクト | 説明 | ドキュメント |
|-------------|------|-------------|
| [core](core/) | ClaudeWorkのコア機能 | design, requirements |
| [claude-interaction](claude-interaction/) | Claudeとの対話機能 | design, requirements |
| [git-operations](git-operations/) | Gitワークツリー操作機能 | design, requirements |
| [terminal](terminal/) | ターミナル機能 | design, requirements |
| [sidebar-ui](sidebar-ui/) | サイドバーUI | design, requirements |
| [responsive](responsive/) | レスポンシブデザイン対応 | design, requirements |
| [notifications](notifications/) | システム通知機能 | design, requirements |
| [settings-ui](settings-ui/) | 設定ページのナビゲーション改善 | design, requirements, tasks |

### Docker環境

| プロジェクト | 説明 | ドキュメント |
|-------------|------|-------------|
| [docker-terminal](docker-terminal/) | Docker環境でのターミナル機能 | design, requirements, tasks |
| [docker-input-fix](docker-input-fix/) | Docker環境での入力処理修正 | design, requirements, tasks |
| [docker-resize-regression](docker-resize-regression/) | ターミナルリサイズ問題修正 | design, requirements, tasks |
| [docker-worktree-fix](docker-worktree-fix/) | Worktreeパス問題修正 | design, requirements, tasks |
| [docker-session-fixes](docker-session-fixes/) | セッション作成バグ修正 (Issue #206,#207,#208) | design, requirements, tasks |
| [docker-port-volume](docker-port-volume/) | ポートマッピング・ボリュームマウント設定 | design, requirements, tasks |
| [docker-named-volume](docker-named-volume/) | Docker named volume対応 | design, requirements, tasks |
| [docker-default-remote-clone](docker-default-remote-clone/) | Docker環境デフォルト化・リモートリポジトリクローン | design, requirements, tasks |
| [disable-host-in-docker](disable-host-in-docker/) | Docker内でのHOST環境自動無効化 | design, requirements, tasks |
| [docker-migration-fix](docker-migration-fix/) | Docker移行時の修正 | 孤立ドキュメント |
| [docker-primary-deploy](docker-primary-deploy/) | Docker主体デプロイ | 孤立ドキュメント |
| [dockerode-migration](dockerode-migration/) | Dockerode移行 | 孤立ドキュメント |
| [volume-delete-options](volume-delete-options/) | ボリューム削除オプション | design, requirements, tasks |

### データベース・ORM

| プロジェクト | 説明 | ドキュメント |
|-------------|------|-------------|
| [db-migration](db-migration/) | データベース移行機能 | design, requirements, tasks |
| [db-migration-v6](db-migration-v6/) | DB移行 v6 | design, requirements, tasks |
| [prisma-7-upgrade](prisma-7-upgrade/) | Prisma v7アップグレード | design, requirements, tasks |
| [migration-error-prevention](migration-error-prevention/) | 移行エラー防止 | design, requirements, tasks |
| [persistent-data](persistent-data/) | データ永続化設計 | design, tasks |

### セッション・環境管理

| プロジェクト | 説明 | ドキュメント |
|-------------|------|-------------|
| [issue-101-pty-refactor](issue-101-pty-refactor/) | PTYマネージャーのアーキテクチャ改善 | design, requirements, tasks |
| [project-environment-binding](project-environment-binding/) | プロジェクト-環境バインディング | design, requirements, tasks |
| [project-wizard](project-wizard/) | プロジェクトウィザード | design, requirements, tasks |
| [skip-permissions](skip-permissions/) | パーミッションスキップ | design, requirements, tasks |
| [skip-permissions-conflict](skip-permissions-conflict/) | パーミッションスキップ競合解消 | design, requirements, tasks |
| [encryption-key-auto-gen](encryption-key-auto-gen/) | 暗号化キー自動生成 | design, requirements, tasks |

### ネットワーク・セキュリティ

| プロジェクト | 説明 | ドキュメント |
|-------------|------|-------------|
| [network-filtering](network-filtering/) | Docker環境ネットワークフィルタリング | design, requirements, tasks |

### リリース・デプロイ

| プロジェクト | 説明 | ドキュメント |
|-------------|------|-------------|
| [app-docker-release](app-docker-release/) | DockerイメージGHCR公開・GitHub Release自動化 | design, requirements, tasks |
| [hybrid-clone](hybrid-clone/) | ホスト/Docker環境でのプロジェクトclone | design, requirements, tasks |
| [port-check](port-check/) | ポートチェック機能 | design, requirements, tasks |

### UI・UX修正

| プロジェクト | 説明 | ドキュメント |
|-------------|------|-------------|
| [dangerous-path-onblur-fix](dangerous-path-onblur-fix/) | パス入力onBlurバグ修正 | design, requirements, tasks |
| [dev-tool-settings](dev-tool-settings/) | 開発ツール設定 | design, requirements, tasks |
| [add-worktree-option](add-worktree-option/) | Claude Code --worktreeオプション対応 | design, requirements, tasks |
| [readonly-environment-setting](readonly-environment-setting/) | 読み取り専用環境設定 | design, requirements, tasks |
| [sidebar-session-default-env](sidebar-session-default-env/) | サイドバーセッションのデフォルト環境 | design, requirements, tasks |

### 開発プロセス

| プロジェクト | 説明 | ドキュメント |
|-------------|------|-------------|
| [subprocess-test-rules](subprocess-test-rules/) | subprocessテスト検証規則 (Issue #111) | design, requirements, tasks |

### レガシー (SDD統合前)

| プロジェクト | 説明 |
|-------------|------|
| [sdd-auth-removal](sdd-auth-removal/) | 認証機能削除 |
| [sdd-docker-integration](sdd-docker-integration/) | Docker統合 |
| [sdd-execution-environments](sdd-execution-environments/) | 実行環境 |
| [sdd-fix-json-display](sdd-fix-json-display/) | JSON表示修正 |
| [sdd-model-selection](sdd-model-selection/) | モデル選択 |
| [sdd-session-improvements](sdd-session-improvements/) | セッション改善 |
| [sdd-thin-wrapper-ui](sdd-thin-wrapper-ui/) | Thin Wrapper UI |
| [design-npx-github](design-npx-github/) | npx GitHub統合 (廃止) |
| [design-npx-prisma-fix](design-npx-prisma-fix/) | npx Prisma修正 (廃止) |
| [design-pr96-session-management](design-pr96-session-management/) | PR#96 セッション管理 |
| [design-systemd-setup](design-systemd-setup/) | systemdセットアップ (廃止) |
| [design-vitest-process-orphan.md](design-vitest-process-orphan.md) | Vitestプロセス孤立問題 |

### トラブルシューティング

| 問題 | 日付 |
|------|------|
| [duplicate-toaster](troubleshooting/2026-02-09-duplicate-toaster/) | 2026-02-09 |
| [iptables-permission-nftables](troubleshooting/2026-03-06-iptables-permission-nftables/) | 2026-03-06 |
| [network-filter-template-ui-update](troubleshooting/2026-03-08-network-filter-template-ui-update/) | 2026-03-08 |

### その他

- [completed-phases.md](completed-phases.md) - フェーズ完了履歴
- [tasks-all.md](tasks-all.md) - 全タスク一覧 (レガシー)
