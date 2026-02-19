# TASK-003: DeveloperSettingsService実装（TDD）

## あなたのタスク
Git設定の保存・読み取り・優先順位解決を行う **DeveloperSettingsService** を実装してください。

## 作成/変更するファイル
| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `src/services/__tests__/developer-settings-service.test.ts` | 単体テスト |
| 作成 | `src/services/developer-settings-service.ts` | DeveloperSettingsService実装 |

## 技術的コンテキスト
- 言語: TypeScript
- ORM: Drizzle ORM
- テスト: Vitest
- 参照: `@docs/sdd/design/dev-tool-settings/components/developer-settings-service.md`
- 要件: `@docs/sdd/requirements/dev-tool-settings/stories/US-001.md`, `@docs/sdd/requirements/dev-tool-settings/stories/US-002.md`

## 受入基準
- [ ] `getEffectiveSettings(projectId)` メソッドが実装されている（優先順位解決）
- [ ] `getGlobalSettings()` メソッドが実装されている
- [ ] `updateGlobalSettings(data)` メソッドが実装されている
- [ ] `getProjectSettings(projectId)` メソッドが実装されている
- [ ] `updateProjectSettings(projectId, data)` メソッドが実装されている
- [ ] `deleteProjectSettings(projectId)` メソッドが実装されている
- [ ] 優先順位ロジック（プロジェクト > グローバル）がテストで確認されている
- [ ] `npm test` ですべてのテストがパスする

## 実装手順（TDD）
1. テスト作成: `developer-settings-service.test.ts`
2. テスト実行: 失敗を確認
3. テストコミット: `test: Add DeveloperSettingsService tests`
4. 実装: `developer-settings-service.ts`
5. テスト通過確認
6. 実装コミット: `feat: Implement DeveloperSettingsService`

**推定工数**: 40分 | **ステータス**: TODO | **依存**: TASK-001
