# Docker環境セッション作成バグ修正 - 要件定義

## 概要

Docker環境でのセッション作成時に発生する3つのバグを修正する。
いずれもDocker環境でのworktree作成・PTY起動に関わる問題で、セッション作成が失敗する原因となっている。

## 関連Issue

| Issue | タイトル | 優先度 |
|-------|---------|--------|
| #206 | DockerGitService.getVolumeName()がdocker_volume_idフィールドを参照しない | 高 |
| #207 | ネットワークフィルタルール0件でもenabled=trueならiptablesチェックが走りPTY作成が失敗する | 中 |
| #208 | clone_location=dockerでdocker_volume_id=nullのプロジェクトに対するバリデーション不足 | 中 |

## ユーザーストーリー一覧

| ID | タイトル | 対応Issue | 優先度 | ステータス |
|----|---------|-----------|--------|-----------|
| US-001 | DockerボリュームID参照によるWorktree作成 | #206 | 高 | 新規 |
| US-002 | ネットワークフィルタルール0件時のiptablesチェックスキップ | #207 | 中 | 新規 |
| US-003 | Docker環境プロジェクトのボリュームIDバリデーション | #208 | 中 | 新規 |

## 非機能要件

| カテゴリ | ドキュメント |
|---------|-------------|
| 信頼性 | [詳細](nfr/reliability.md) @nfr/reliability.md |

## スコープ

### 対象

- `DockerGitService.getVolumeName()` のボリューム名解決ロジック修正
- `NetworkFilterService.applyFilter()` のルール0件時の早期リターン
- セッション作成APIのバリデーション強化

### 対象外

- Docker環境の新機能追加
- ネットワークフィルタリングの機能追加
- UIの変更
