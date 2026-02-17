import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { DockerService } from '@/services/docker-service';
import { validateSchemaIntegrity } from '@/lib/schema-check';
import { db } from '@/lib/db';

/**
 * GET /api/health - ヘルスチェックエンドポイント
 *
 * スキーマ整合性チェックを含むサーバーの稼働状況を返します。
 * 認証は不要です。
 *
 * @returns
 * - 200: healthy（スキーマ正常）
 * - 503: unhealthy（スキーマ不一致）
 * - 500: unhealthy（内部エラー）
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/health
 *
 * // 正常時レスポンス (200)
 * {
 *   "status": "healthy",
 *   "timestamp": "2026-02-17T12:00:00.000Z",
 *   "checks": {
 *     "database": {
 *       "status": "pass",
 *       "missingColumns": [],
 *       "checkedTables": ["Project", "Session"]
 *     }
 *   }
 * }
 *
 * // スキーマ不一致時レスポンス (503)
 * {
 *   "status": "unhealthy",
 *   "timestamp": "2026-02-17T12:00:00.000Z",
 *   "checks": {
 *     "database": {
 *       "status": "fail",
 *       "missingColumns": [{ "table": "Session", "column": "active_connections", "expectedType": "integer" }],
 *       "checkedTables": ["Session"]
 *     }
 *   }
 * }
 * ```
 */
export async function GET() {
  const dockerService = new DockerService();

  try {
    const result = validateSchemaIntegrity(db.$client);

    logger.debug('Health check requested', { valid: result.valid });

    const httpStatus = result.valid ? 200 : 503;
    const status = result.valid ? 'healthy' : 'unhealthy';

    return NextResponse.json(
      {
        status,
        timestamp: result.timestamp.toISOString(),
        checks: {
          database: {
            status: result.valid ? 'pass' : 'fail',
            missingColumns: result.missingColumns,
            checkedTables: result.checkedTables,
          },
        },
        features: {
          dockerEnabled: dockerService.isEnabled(),
        },
      },
      { status: httpStatus }
    );
  } catch (error) {
    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
