# TASK-002: check-ports APIエンドポイントのテスト作成・実装

## 説明

ポートチェック用のAPIエンドポイントを新規作成する。

- 対象ファイル:
  - テスト: `src/app/api/environments/check-ports/__tests__/route.test.ts`
  - 実装: `src/app/api/environments/check-ports/route.ts`
- 設計書: `docs/sdd/design/port-check/api/check-ports.md`

## 技術的文脈

- フレームワーク: Next.js App Router
- テストフレームワーク: Vitest
- 参照すべき既存コード: `src/app/api/environments/route.ts`（APIルートパターン）
- 参照テスト: `src/app/api/environments/__tests__/port-volume-validation.test.ts`

## 実装手順（TDD）

### 1. テスト作成: `src/app/api/environments/check-ports/__tests__/route.test.ts`

テストケース:
1. **正常系 - 有効なポートリスト**: ports: [3000, 8080] → 200 + results配列
2. **バリデーション - portsが空配列**: ports: [] → 400
3. **バリデーション - portsが配列でない**: ports: "3000" → 400
4. **バリデーション - ポート数上限超過**: 21ポート → 400
5. **バリデーション - 無効なポート番号（0）**: ports: [0] → 400
6. **バリデーション - 範囲外ポート**: ports: [70000] → 400
7. **正常系 - excludeEnvironmentId付き**: excludeEnvironmentId: "env-1" → 200
8. **エラー系 - サーバー内部エラー**: PortChecker例外 → 500

PortCheckerはモック化して、APIのバリデーション・ルーティングロジックのみテスト。

### 2. テスト実行: 失敗を確認

```bash
npx vitest run src/app/api/environments/check-ports/__tests__/route.test.ts
```

### 3. テストコミット

### 4. 実装: `src/app/api/environments/check-ports/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { PortChecker } from '@/services/port-checker';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  // バリデーション + PortChecker呼び出し
}
```

バリデーション:
- `ports` は配列かつ空でないこと
- `ports.length <= 20`
- 各ポートは1〜65535の整数

### 5. テスト通過を確認、実装コミット

## 受入基準

- [ ] `src/app/api/environments/check-ports/__tests__/route.test.ts` に8つ以上のテストケース
- [ ] `src/app/api/environments/check-ports/route.ts` が存在する
- [ ] 全テストがパスする: `npx vitest run src/app/api/environments/check-ports/__tests__/route.test.ts`
- [ ] ESLintエラーがゼロ
- [ ] バリデーションが設計書通り実装されている

## 依存関係

なし（PortCheckerはモック化するため並列実行可能）

## 推定工数

30分

## ステータス

DONE
