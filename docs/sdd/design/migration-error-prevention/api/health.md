# API設計: ヘルスチェックエンドポイント

## 概要

**関連要件**: [US-003: システムヘルスチェックの提供](../../../requirements/migration-error-prevention/stories/US-003.md) @../../../requirements/migration-error-prevention/stories/US-003.md

`/api/health`エンドポイントは、外部監視ツールやSystemdの`ExecStartPost`から呼び出され、データベーススキーマの整合性を含むシステムのヘルスステータスを返します。

## エンドポイント仕様

### リクエスト

```http
GET /api/health HTTP/1.1
Host: localhost:3000
```

- **メソッド**: `GET`
- **パス**: `/api/health`
- **認証**: 不要（内部監視用途）
- **パラメータ**: なし

### レスポンス

#### 正常時（HTTP 200）

```json
{
  "status": "healthy",
  "timestamp": "2026-02-17T12:34:56.789Z",
  "checks": {
    "database": {
      "status": "pass",
      "missingColumns": [],
      "checkedTables": ["Project", "Session", "ExecutionEnvironment", "Message", "Prompt", "RunScript", "GitHubPAT"]
    }
  },
  "features": {
    "dockerEnabled": false
  }
}
```

> **注意**: `checks.database.missingColumns`、`checks.database.checkedTables` は環境変数 `HEALTH_DETAILS=true` の場合のみ返却されます。

#### 異常時（HTTP 503）

```json
{
  "status": "unhealthy",
  "timestamp": "2026-02-17T12:34:56.789Z",
  "checks": {
    "database": {
      "status": "fail",
      "missingColumns": [
        {
          "table": "Session",
          "column": "active_connections",
          "expectedType": "integer"
        },
        {
          "table": "Session",
          "column": "destroy_at",
          "expectedType": "integer"
        }
      ]
    }
  }
}
```

### ステータスコード

| コード | 意味 | 条件 |
|--------|------|------|
| 200 | OK | スキーマ整合性チェックがすべてパス |
| 503 | Service Unavailable | スキーマ不一致が検出された |
| 500 | Internal Server Error | 予期しないエラー（例外発生） |

## データモデル

### レスポンススキーマ

```typescript
/**
 * ヘルスチェックレスポンス
 */
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string; // ISO 8601形式
  checks: {
    database: DatabaseCheck;
  };
  features: {
    dockerEnabled: boolean;
  };
}

/**
 * データベースチェック結果
 */
interface DatabaseCheck {
  status: 'pass' | 'fail';
  /** HEALTH_DETAILS=true の場合のみ返却 */
  missingColumns?: MissingColumn[];
  /** HEALTH_DETAILS=true の場合のみ返却 */
  checkedTables?: string[];
}

/**
 * 不足カラム情報
 */
interface MissingColumn {
  table: string;
  column: string;
  expectedType: string;
}
```

## 実装

### ファイル構成

```text
src/app/api/health/
├── route.ts              # Next.js App Router APIハンドラー
└── __tests__/
    └── route.test.ts     # ユニットテスト
```

### route.ts

```typescript
import { db } from '@/lib/db';
import { validateSchemaIntegrity } from '@/lib/schema-check';
import { NextResponse } from 'next/server';

/**
 * GET /api/health
 *
 * システムのヘルスステータスを返す
 */
export async function GET() {
  try {
    // スキーマ整合性チェックを実行
    const validationResult = validateSchemaIntegrity(db);

    if (validationResult.valid) {
      // 正常時: HTTP 200
      return NextResponse.json(
        {
          status: 'healthy',
          timestamp: validationResult.timestamp.toISOString(),
          checks: {
            database: {
              status: 'pass',
              missingColumns: [],
            },
          },
        },
        { status: 200 }
      );
    } else {
      // 異常時: HTTP 503
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: validationResult.timestamp.toISOString(),
          checks: {
            database: {
              status: 'fail',
              missingColumns: validationResult.missingColumns,
            },
          },
        },
        { status: 503 }
      );
    }
  } catch (error) {
    // 予期しないエラー: HTTP 500
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
```

## 統合ポイント

### Systemd ExecStartPost

**ファイル**: `/etc/systemd/system/claude-work.service`

```ini
[Service]
ExecStart=/usr/bin/npx claude-work
ExecStartPost=/usr/bin/curl -sf http://localhost:3000/api/health || exit 1
```

- `-s`: サイレントモード（進捗非表示）
- `-f`: 失敗時に非ゼロで終了（HTTP 4xx/5xxの場合）
- `|| exit 1`: ヘルスチェック失敗時はSystemdにエラーを通知

### Prometheus監視

**prometheus.yml**:

```yaml
scrape_configs:
  - job_name: 'claudework'
    scrape_interval: 30s
    scrape_timeout: 5s
    metrics_path: '/api/health'
    static_configs:
      - targets: ['localhost:3000']
```

**アラート設定例**:

```yaml
groups:
  - name: claudework
    rules:
      - alert: SchemaIntegrityFailed
        expr: up{job="claudework"} == 0
        for: 1m
        annotations:
          summary: "ClaudeWork schema integrity check failed"
          description: "Database schema is out of sync"
```

### Datadog監視

**datadog.yaml**:

```yaml
init_config:

instances:
  - url: http://localhost:3000/api/health
    name: claudework_health
    timeout: 5
```

### Kubernetes Liveness/Readiness Probe

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: claude-work
      image: claudework:latest
      livenessProbe:
        httpGet:
          path: /api/health
          port: 3000
        initialDelaySeconds: 10
        periodSeconds: 30
      readinessProbe:
        httpGet:
          path: /api/health
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 10
```

## 非機能要件

### 性能要件（NFR-005）

- **目標**: 2秒以内にレスポンス
- **実測値**: スキーマ検証は70ms程度（7テーブル）
- **レスポンスタイム**: JSON生成含めて100ms以下

### セキュリティ要件

#### 認証不要の判断

- **用途**: 内部監視ツール専用
- **リスク**: スキーマ情報の漏洩（テーブル名・カラム名）
- **対策**: 今回は認証なしで実装、将来的にはAPIキー認証を検討

#### 情報漏洩対策

- データの内容は返さない（カラム名のみ）
- エラーメッセージに機密情報を含めない

### 可用性要件

- エンドポイント自体の障害を防ぐため、例外ハンドリングを厳重に実施
- データベース接続エラー時もHTTP 500で応答（サイレント失敗させない）

## テスト戦略

### ユニットテスト

**ファイル**: `src/app/api/health/__tests__/route.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import * as schemaCheck from '@/lib/schema-check';

vi.mock('@/lib/schema-check');

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('スキーマ整合性OKの場合はHTTP 200を返す', async () => {
    vi.mocked(schemaCheck.validateSchemaIntegrity).mockReturnValue({
      valid: true,
      missingColumns: [],
      checkedTables: ['Project', 'Session'],
      timestamp: new Date('2026-02-17T12:00:00Z'),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: 'healthy',
      timestamp: '2026-02-17T12:00:00.000Z',
      checks: {
        database: {
          status: 'pass',
          missingColumns: [],
        },
      },
    });
  });

  it('スキーマ不一致の場合はHTTP 503を返す', async () => {
    vi.mocked(schemaCheck.validateSchemaIntegrity).mockReturnValue({
      valid: false,
      missingColumns: [
        { table: 'Session', column: 'active_connections', expectedType: 'integer' },
      ],
      checkedTables: ['Session'],
      timestamp: new Date('2026-02-17T12:00:00Z'),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.checks.database.missingColumns).toHaveLength(1);
  });

  it('例外発生時はHTTP 500を返す', async () => {
    vi.mocked(schemaCheck.validateSchemaIntegrity).mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.status).toBe('unhealthy');
  });
});
```

### 統合テスト

1. **正常系**: サーバー起動後のヘルスチェック
   ```bash
   curl -i http://localhost:3000/api/health
   # 期待: HTTP/1.1 200 OK
   ```

2. **異常系**: スキーマ不一致時のヘルスチェック
   - データベースから意図的にカラムを削除
   - ヘルスチェック実行
   - HTTP 503が返ることを確認

3. **負荷テスト**: 連続リクエスト
   ```bash
   ab -n 1000 -c 10 http://localhost:3000/api/health
   # 期待: すべてのリクエストが2秒以内に応答
   ```

## 将来の拡張

### メトリクスの追加

```json
{
  "status": "healthy",
  "timestamp": "2026-02-17T12:34:56.789Z",
  "checks": {
    "database": { "status": "pass", "missingColumns": [] },
    "disk": { "status": "pass", "freeSpaceGB": 50 },
    "memory": { "status": "pass", "usedMB": 256 }
  }
}
```

### 認証の追加

```typescript
import { headers } from 'next/headers';

export async function GET() {
  const apiKey = headers().get('x-api-key');
  if (apiKey !== process.env.HEALTH_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ...
}
```

### レート制限

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 60, // 最大60リクエスト/分
});
```

## 監視・ログ

### アクセスログ

Next.jsの標準ログに加え、ヘルスチェック専用のログを出力：

```typescript
console.log(`[Health] Status: ${validationResult.valid ? 'OK' : 'NG'}`);
```

### メトリクス

Prometheusメトリクス（将来実装）：

```typescript
const healthCheckTotal = new Counter({
  name: 'health_check_total',
  help: 'Total number of health checks',
  labelNames: ['status'], // 'healthy' or 'unhealthy'
});
```

## 参照

- [要件定義 US-003](../../../requirements/migration-error-prevention/stories/US-003.md) @../../../requirements/migration-error-prevention/stories/US-003.md
- [設計概要](../index.md) @../index.md
- [スキーマ検証コンポーネント](../components/schema-validator.md) @../components/schema-validator.md
