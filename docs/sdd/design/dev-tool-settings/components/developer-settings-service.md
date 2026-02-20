# DeveloperSettingsService

## 概要

**目的**: Git設定の保存・読み取り・優先順位解決を提供

**責務**:
- グローバルGit設定の保存・更新
- プロジェクト別Git設定の保存・更新・削除
- 階層的設定の優先順位解決（プロジェクト > グローバル）
- 有効な設定の取得（フィールドレベルでの優先順位適用）

## インターフェース

### 主要メソッド

#### `getEffectiveSettings(projectId: string): Promise<EffectiveSettings>`
プロジェクトの有効な設定を取得（優先順位解決済み）

#### `getGlobalSettings(): Promise<DeveloperSettings | null>`
グローバル設定を取得

#### `updateGlobalSettings(data: UpdateSettingsInput): Promise<DeveloperSettings>`
グローバル設定を更新（存在しない場合は新規作成）

#### `getProjectSettings(projectId: string): Promise<DeveloperSettings | null>`
プロジェクト別設定を取得

#### `updateProjectSettings(projectId: string, data: UpdateSettingsInput): Promise<DeveloperSettings>`
プロジェクト別設定を更新（存在しない場合は新規作成）

#### `deleteProjectSettings(projectId: string): Promise<void>`
プロジェクト別設定を削除

## 依存関係

- **Drizzle ORM**: データベースアクセス
- **DeveloperSettings テーブル**: データ永続化

## 関連要件

- [US-001](../../requirements/dev-tool-settings/stories/US-001.md): グローバル Git 設定の管理
- [US-002](../../requirements/dev-tool-settings/stories/US-002.md): プロジェクト別 Git 設定の上書き
- [DEC-003](../decisions/DEC-003.md): 階層的設定ロジックの実装場所
