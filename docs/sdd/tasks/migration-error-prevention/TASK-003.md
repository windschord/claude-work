# TASK-003: ヘルスチェックAPI実装

## 概要

`/api/health`エンドポイントを実装し、外部監視ツールからスキーマ整合性を確認できるようにします。

## 関連ドキュメント

- **要件**: [US-003](../../requirements/migration-error-prevention/stories/US-003.md) @../../requirements/migration-error-prevention/stories/US-003.md
- **設計**: [ヘルスチェックAPI](../../design/migration-error-prevention/api/health.md) @../../design/migration-error-prevention/api/health.md

## 実装対象ファイル

- **新規作成**:
  - `src/app/api/health/route.ts` - APIハンドラー
  - `src/app/api/health/__tests__/route.test.ts` - ユニットテスト

## TDD手順

### 1. テストファースト

`src/app/api/health/__tests__/route.test.ts`を作成:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { GET } from '../route';
import * as schemaCheck from '@/lib/schema-check';

vi.mock('@/lib/schema-check');

describe('GET /api/health', () => {
  it('スキーマ整合性OKの場合はHTTP 200を返す', async () => {
    vi.mocked(schemaCheck.validateSchemaIntegrity).mockReturnValue({
      valid: true,
      missingColumns: [],
      checkedTables: ['Project'],
      timestamp: new Date('2026-02-17T12:00:00Z'),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
  });

  it('スキーマ不一致の場合はHTTP 503を返す', async () => {
    vi.mocked(schemaCheck.validateSchemaIntegrity).mockReturnValue({
      valid: false,
      missingColumns: [{ table: 'Session', column: 'active_connections', expectedType: 'integer' }],
      checkedTables: ['Session'],
      timestamp: new Date('2026-02-17T12:00:00Z'),
    });

    const response = await GET();
    expect(response.status).toBe(503);
  });
});
```

### 2. テスト実行（失敗確認）

```bash
npm test -- src/app/api/health/__tests__/route.test.ts
# 期待: FAIL
```

### 3. 実装

`src/app/api/health/route.ts`を作成:

```typescript
import { db } from '@/lib/db';
import { validateSchemaIntegrity } from '@/lib/schema-check';
import { DockerService } from '@/services/docker-service';
import { NextResponse } from 'next/server';

export async function GET() {
  const dockerService = new DockerService();
  const exposeDetails = process.env.HEALTH_DETAILS === 'true';

  try {
    const result = validateSchemaIntegrity(db.$client);
    const httpStatus = result.valid ? 200 : 503;
    const status = result.valid ? 'healthy' : 'unhealthy';

    return NextResponse.json(
      {
        status,
        timestamp: result.timestamp.toISOString(),
        checks: {
          database: {
            status: result.valid ? 'pass' : 'fail',
            ...(exposeDetails
              ? { missingColumns: result.missingColumns, checkedTables: result.checkedTables }
              : {}),
          },
        },
        features: { dockerEnabled: dockerService.isEnabled() },
      },
      { status: httpStatus }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: exposeDetails
          ? error instanceof Error ? error.message : 'Unknown error'
          : 'Internal error',
      },
      { status: 500 }
    );
  }
}
```

### 4. テスト実行（成功確認）

```bash
npm test -- src/app/api/health/__tests__/route.test.ts
# 期待: PASS
```

## 受入基準

- [ ] `/api/health`エンドポイントが実装されている
- [ ] スキーマ整合性OKの場合はHTTP 200を返す
- [ ] スキーマ不一致の場合はHTTP 503を返す
- [ ] レスポンスに不足カラムの詳細が含まれる
- [ ] ユニットテストがすべてパスする

## ステータス

**DONE**
