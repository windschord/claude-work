import { NextRequest, NextResponse } from 'next/server';
import { networkFilterService } from '@/services/network-filter-service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/environments/:id/network-filter/test - 通信テスト（dry-run）
 *
 * リクエストボディ:
 * - target: string（必須） - 通信先（ドメインまたはIP）
 * - port: number（任意） - ポート番号
 *
 * @returns
 * - 200: 通信テスト結果（allowed, matchedRule）
 * - 400: targetが未指定
 * - 500: サーバーエラー
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { target, port } = body as Record<string, unknown>;

    // target は必須
    if (!target || typeof target !== 'string' || target.trim() === '') {
      return NextResponse.json({ error: 'target is required' }, { status: 400 });
    }

    // port のバリデーション（任意項目だが、指定時は整数 1-65535）
    if (port !== undefined && port !== null) {
      if (typeof port !== 'number' || !Number.isInteger(port)) {
        return NextResponse.json({ error: 'port must be an integer' }, { status: 400 });
      }
      if (port < 1 || port > 65535) {
        return NextResponse.json({ error: 'port must be between 1 and 65535' }, { status: 400 });
      }
    }

    const portNumber = port !== undefined ? (port as number) : undefined;

    const result = await networkFilterService.testConnection(id, target.trim(), portNumber);

    logger.info('Connection test executed', { environmentId: id, target, port, allowed: result.allowed });
    return NextResponse.json({ result });
  } catch (error) {
    const { id } = await params;
    logger.error('Failed to test connection', { error, id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
