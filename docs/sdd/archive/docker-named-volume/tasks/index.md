# タスク管理: Docker名前付きVolume

## タスク一覧

| ID | タイトル | ステータス | 依存 | 工数 |
|----|---------|-----------|------|------|
| TASK-001 | DockerAdapter - authDirPathオプショナル化と名前付きVolumeマウント | DONE | - | 30min |
| TASK-002 | EnvironmentService - 設定Volume作成・削除メソッド追加 | DONE | TASK-001 | 30min |
| TASK-003 | AdapterFactoryとAPIルートの統合変更 | DONE | TASK-001, TASK-002 | 20min |

## 実行順序

TASK-001 -> TASK-002 -> TASK-003
