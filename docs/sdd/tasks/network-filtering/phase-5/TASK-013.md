# TASK-013: Docker環境作成時のデフォルトルール自動適用

## ステータス: DONE

## 概要

新規Docker環境作成時（`POST /api/environments`）に、ネットワークフィルタリングをデフォルト有効化し、全テンプレートルール（5カテゴリ、9ルール）を自動適用する。

## 関連

- **要件**: [US-006](../../../requirements/network-filtering/stories/US-006.md) @../../../requirements/network-filtering/stories/US-006.md
- **設計**: [NetworkFilterService - デフォルトルール自動適用](../../../design/network-filtering/components/network-filter-service.md) @../../../design/network-filtering/components/network-filter-service.md
- **依存タスク**: TASK-003（NetworkFilterService CRUD）, TASK-008（テンプレートAPI）

## 受入基準

- [x] AC-001: Docker環境作成時にNetworkFilterConfigが `enabled: true` で自動作成される
- [x] AC-002: 全テンプレートルール（9件）が自動適用される
- [x] AC-003: HOST/SSH環境には自動適用されない
- [x] AC-004: フィルタ初期化失敗時も環境作成は成功する（ベストエフォート）
- [x] AC-005: 自動適用されたルールは編集・削除・無効化が可能

## 対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/app/api/environments/route.ts` | POSTハンドラにデフォルトルール自動適用ロジック追加 |
| `src/app/api/environments/__tests__/route.test.ts` | テスト3件追加 |

## 実装手順

### 1. テスト作成（TDD）

`src/app/api/environments/__tests__/route.test.ts` に以下のテストを追加:

```typescript
// NetworkFilterServiceのモック
const mockUpdateFilterConfig = vi.fn();
const mockGetDefaultTemplates = vi.fn();
const mockApplyTemplates = vi.fn();

vi.mock('@/services/network-filter-service', () => ({
  networkFilterService: {
    updateFilterConfig: (...args: unknown[]) => mockUpdateFilterConfig(...args),
    getDefaultTemplates: () => mockGetDefaultTemplates(),
    applyTemplates: (...args: unknown[]) => mockApplyTemplates(...args),
  },
}));
```

**テストケース:**

1. **DOCKER環境作成時にフィルタリング有効化+テンプレート適用**
   - `mockGetDefaultTemplates` が全テンプレートを返す
   - `mockUpdateFilterConfig` が `(envId, true)` で呼ばれる
   - `mockApplyTemplates` が全ルールで呼ばれる
   - レスポンスは201

2. **HOST環境作成時にフィルタリング自動適用がスキップされる**
   - `mockUpdateFilterConfig` が呼ばれない
   - `mockApplyTemplates` が呼ばれない

3. **フィルタ初期化失敗時でも環境作成は成功する**
   - `mockUpdateFilterConfig` がエラーをスロー
   - レスポンスは201（ベストエフォート）

### 2. 実装

`src/app/api/environments/route.ts` の POSTハンドラ内、Config Volume作成成功後に以下を追加:

```typescript
import { networkFilterService } from '@/services/network-filter-service';

// Config Volume作成成功後（type === 'DOCKER' ブロック内）:
try {
  await networkFilterService.updateFilterConfig(environment.id, true);
  const templates = networkFilterService.getDefaultTemplates();
  const allRules = templates.flatMap((t) => t.rules);
  await networkFilterService.applyTemplates(environment.id, allRules);
  logger.info('Default network filter rules applied', { id: environment.id });
} catch (filterError) {
  logger.warn('Failed to apply default network filter rules (non-fatal)', {
    environmentId: environment.id,
    error: filterError,
  });
}
```

### 3. テスト実行・確認

```bash
npx vitest run src/app/api/environments/__tests__/route.test.ts
```

全テスト（27件）がパスすることを確認。

## 推定工数

20min

## 完了日

2026-03-08
