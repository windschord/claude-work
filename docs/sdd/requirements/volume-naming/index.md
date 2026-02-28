# 要件定義: Docker Volumeの読みやすい自動命名と既存Volume選択機能

## 概要

Docker Volumeの命名規則を改善し、`docker volume ls`で一覧表示した際にプロジェクトや環境との対応関係が一目で分かるようにする。また、環境作成時に既存のDocker Volumeを再利用できる選択機能を追加する。

## ユーザーストーリー一覧

| ID | タイトル | 優先度 | ステータス | 詳細リンク |
|----|---------|--------|-----------|------------|
| US-001 | Volume名の自動生成 | 高 | 承認済 | [詳細](stories/US-001.md) @stories/US-001.md |
| US-002 | 既存Volume選択 | 高 | 承認済 | [詳細](stories/US-002.md) @stories/US-002.md |
| US-003 | 後方互換性の維持 | 高 | 承認済 | [詳細](stories/US-003.md) @stories/US-003.md |

## 機能要件サマリ

| 要件ID | 概要 | 関連ストーリー | ステータス |
|--------|------|---------------|-----------|
| REQ-001-001 | スラッグ生成関数の実装 | US-001 | 定義済 |
| REQ-001-002 | リポジトリ用Volume命名 (`cw-repo-{slug}`) | US-001 | 定義済 |
| REQ-001-003 | 設定用Volume命名 (`cw-config-{slug}`) | US-001 | 定義済 |
| REQ-001-004 | Volume名重複時のサフィックス付与 | US-001 | 定義済 |
| REQ-001-005 | Docker Volume名制約への準拠 | US-001 | 定義済 |
| REQ-002-001 | DockerClient Volume一覧取得 | US-002 | 定義済 |
| REQ-002-002 | Volume一覧APIエンドポイント | US-002 | 定義済 |
| REQ-002-003 | VolumeMountList既存Volume選択UI | US-002 | 定義済 |
| REQ-002-004 | Volume名バリデーション更新 | US-002 | 定義済 |
| REQ-003-001 | 既存 `claude-repo-{uuid}` Volumeの認識維持 | US-003 | 定義済 |
| REQ-003-002 | フォールバック命名の維持 | US-003 | 定義済 |

## 非機能要件一覧

| カテゴリ | 詳細リンク | 要件数 |
|----------|------------|--------|
| 互換性要件 | [詳細](nfr/compatibility.md) @nfr/compatibility.md | 2件 |

## 依存関係

- Docker Engine API (dockerode ライブラリ経由)
- Issue #169 (Claude Code設定永続化) と `cw-config-{slug}` 命名規則を共有

## スコープ外

- Volume内データのマイグレーション
- 既存Volumeの自動リネーム
- Volume使用量の監視・アラート機能
