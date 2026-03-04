# タスク: Volume削除オプション機能

## タスク一覧

| ID | タスク | ステータス | 依存 |
|----|--------|-----------|------|
| TASK-001 | 環境削除API: Volume保持オプション追加 | TODO | - |
| TASK-002 | 環境削除UI: チェックボックス追加 | TODO | TASK-001 |
| TASK-003 | プロジェクト削除API: Volume削除処理追加 | TODO | - |
| TASK-004 | プロジェクト削除UI: チェックボックス追加 | TODO | TASK-003 |

## TASK-001: 環境削除API - Volume保持オプション追加

### 対象ファイル
- `src/services/environment-service.ts` - delete()にオプション追加
- `src/app/api/environments/[id]/route.ts` - クエリパラメータ解析
- `src/services/__tests__/environment-service.test.ts` - テスト追加

### 実装内容
1. EnvironmentService.delete()にDeleteEnvironmentOptions引数追加
2. keepClaudeVolume/keepConfigVolumeに応じてVolume削除をスキップ
3. APIルートでクエリパラメータを解析してサービスに渡す

## TASK-002: 環境削除UI - チェックボックス追加

### 対象ファイル
- `src/components/environments/DeleteEnvironmentDialog.tsx` - UI変更
- `src/hooks/useEnvironments.ts` - deleteEnvironmentの引数変更
- `src/components/environments/EnvironmentList.tsx` - onDeleteEnvironmentの型変更

### 実装内容
1. Docker環境の場合、チェックボックス2つを表示
2. チェック状態をdeleteEnvironmentに渡す
3. deleteEnvironmentがクエリパラメータとしてAPIに送信

## TASK-003: プロジェクト削除API - Volume削除処理追加

### 対象ファイル
- `src/app/api/projects/[project_id]/route.ts` - Volume削除処理追加
- `src/app/api/projects/[project_id]/__tests__/route.test.ts` - テスト追加

### 実装内容
1. clone_location='docker'かつdocker_volume_idが存在する場合、Volume削除
2. keepGitVolumeクエリパラメータで保持可能
3. 削除はベストエフォート（失敗してもDB削除は成功）

## TASK-004: プロジェクト削除UI - チェックボックス追加

### 対象ファイル
- `src/components/projects/DeleteProjectDialog.tsx` - UI変更
- `src/store/index.ts` - deleteProjectの引数変更

### 実装内容
1. clone_location='docker'の場合、チェックボックスを表示
2. チェック状態をdeleteProjectに渡す
3. deleteProjectがクエリパラメータとしてAPIに送信
