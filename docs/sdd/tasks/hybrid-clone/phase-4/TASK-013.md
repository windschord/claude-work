# TASK-013: プロジェクト登録API変更

## 概要

**目的**: プロジェクト登録APIにcloneLocationパラメータを追加し、Docker/ホスト環境でのclone処理を実装する。

**推定工数**: 40分

## ステータス

`DONE`

**完了サマリー**: POST /api/projects/cloneにcloneLocationパラメータを追加。validateCloneLocation()でバリデーション、docker/hostに応じてDockerGitServiceまたはホスト環境でclone実行。POST /api/projectsにもclone_location: 'host'を設定。

## 依存関係

- **依存するタスク**: TASK-001, TASK-005, TASK-010
- **このタスクに依存するタスク**: TASK-014

## 関連ドキュメント

- [タスク一覧](../index.md)
