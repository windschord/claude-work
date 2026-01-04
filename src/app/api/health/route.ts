import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { DockerService } from '@/services/docker-service';

/**
 * GET /api/health - ヘルスチェックエンドポイント
 *
 * サーバーの稼働状況を確認するためのシンプルなエンドポイントです。
 * 認証は不要です。
 *
 * @returns
 * - 200: サーバーが正常に稼働中
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/health
 *
 * // レスポンス
 * {
 *   "status": "ok",
 *   "timestamp": "2025-12-13T09:00:00.000Z",
 *   "features": {
 *     "dockerEnabled": false
 *   }
 * }
 * ```
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const dockerService = new DockerService();

  logger.debug('Health check requested', { timestamp });

  return NextResponse.json(
    {
      status: 'ok',
      timestamp,
      features: {
        dockerEnabled: dockerService.isEnabled(),
      },
    },
    { status: 200 }
  );
}
