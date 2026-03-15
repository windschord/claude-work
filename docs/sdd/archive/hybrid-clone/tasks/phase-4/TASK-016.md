# TASK-016: プロジェクト一覧の環境バッジ表示

## 概要

**目的**: プロジェクト一覧のカードにclone_locationに応じた環境バッジを表示する。

**推定工数**: 30分

## ステータス

`DONE`

**完了サマリー**: src/components/projects/ProjectCard.tsxにclone_locationバッジを実装。docker=Container+青アイコン、host=HardDrive+緑アイコン。clone_location未設定時は'host'にフォールバック。

## 依存関係

- **依存するタスク**: TASK-001
- **このタスクに依存するタスク**: なし

## 関連ドキュメント

- [タスク一覧](../index.md)
