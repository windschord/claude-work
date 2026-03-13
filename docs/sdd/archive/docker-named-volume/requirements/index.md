# 要件定義: Docker名前付きVolumeによるClaude Code設定の永続化

## 概要

Docker環境でのClaude Code設定ファイル（`~/.claude`と`~/.config/claude`）の永続化方式を、バインドマウントからDocker名前付きVolumeに変更する。Gitリポジトリの永続化方式（`claude-repo-{project-id}`名前付きVolume）と統一し、Docker標準のVolume管理ツールで設定データを管理可能にする。

## ユーザーストーリー一覧

| ID | タイトル | 優先度 | ステータス | 詳細リンク |
|----|---------|--------|-----------|------------|
| US-001 | Docker名前付きVolumeによるClaude Code設定の永続化 | 高 | 作成中 | [詳細](stories/US-001.md) @stories/US-001.md |

## 機能要件サマリ

| 要件ID | 概要 | 関連ストーリー | ステータス |
|--------|------|---------------|-----------|
| REQ-001-001 | 環境作成時に名前付きVolume作成 | US-001 | 定義済 |
| REQ-001-002 | Dockerode APIによるVolume作成 | US-001 | 定義済 |
| REQ-001-003 | Volume -> /home/node/.claudeマウント | US-001 | 定義済 |
| REQ-001-004 | Volume -> /home/node/.config/claudeマウント | US-001 | 定義済 |
| REQ-001-005 | コンテナ再作成時の設定永続化 | US-001 | 定義済 |
| REQ-001-006 | docker volume lsでの表示 | US-001 | 定義済 |
| REQ-001-007 | 環境削除時のVolume削除 | US-001 | 定義済 |
| REQ-001-008 | Volume削除失敗時の警告ログ | US-001 | 定義済 |
| REQ-001-009 | 新規環境でホスト側ディレクトリを作成しない | US-001 | 定義済 |
| REQ-001-010 | auth_dir_path未設定時は名前付きVolume使用 | US-001 | 定義済 |
| REQ-001-011 | 既存環境の後方互換性（バインドマウント維持） | US-001 | 定義済 |

## 非機能要件一覧

| カテゴリ | 詳細リンク | 要件数 |
|----------|------------|--------|
| 保守性要件 | [詳細](nfr/maintainability.md) @nfr/maintainability.md | 3件 |

## 依存関係

- Docker Engine（dockerode経由でDocker APIを使用）
- 既存のDockerClient（`src/services/docker-client.ts`）

## スコープ外

- 既存のバインドマウント環境から名前付きVolumeへのデータ移行
- SSH環境の設定永続化
- UIの変更（環境作成・削除フローは既存UIで対応可能）
