# Docker環境セッション作成バグ修正 - 技術設計書

## 概要

Docker環境でのセッション作成時に発生する3つのバグ（Issue #206, #207, #208）を修正する。

## 要件との対応

| 要件ID | 設計要素 | 対応コンポーネント |
|--------|---------|-------------------|
| US-001/REQ-001〜003 | ボリューム名解決の修正 | [docker-git-service](components/docker-git-service.md) |
| US-002/REQ-001〜002 | applyFilterの処理順序変更 | [network-filter-service](components/network-filter-service.md) |
| US-003/REQ-001〜002 | セッション作成APIバリデーション | [session-api](components/session-api.md) |
| NFR-001 | エラーメッセージの改善 | session-api |
| NFR-002 | ルール0件時の正常終了 | network-filter-service |
| NFR-003 | 後方互換性の維持 | docker-git-service |

## 修正方針

### 1. DockerGitService.getVolumeName() (Issue #206)

**現状の問題:**
`getVolumeName(projectId)` が `createWorktree()` 等から `projectName` なしで呼ばれ、常にフォールバック値 `claude-repo-<projectId>` を返す。実際のボリュームは `cw-repo-<name>` 形式で作成されDB登録済み。

**修正方針:**
`getVolumeName()` のシグネチャに `dockerVolumeId` オプション引数を追加し、指定された場合はそれを優先使用する。呼び出し元のメソッドは `GitWorktreeOptions` や各メソッドの引数経由で `dockerVolumeId` を受け取り渡す。

詳細: [docker-git-service.md](components/docker-git-service.md)

### 2. NetworkFilterService.applyFilter() (Issue #207)

**現状の問題:**
`applyFilter()` がルール取得前にiptables可用性チェックを実行するため、ルール0件でもiptablesエラーでPTY作成が失敗する。

**修正方針:**
処理順序を変更し、ルール取得をiptablesチェック前に移動。有効ルール0件なら早期リターン。

詳細: [network-filter-service.md](components/network-filter-service.md)

### 3. セッション作成APIバリデーション (Issue #208)

**現状の問題:**
`clone_location=docker` かつ `docker_volume_id=null` のプロジェクトでセッション作成時、DockerGitServiceが存在しないボリュームを参照してInternal Server Errorになる。

**修正方針:**
セッション作成API（POST handler）でworktree作成前にバリデーションを追加。

詳細: [session-api.md](components/session-api.md)
