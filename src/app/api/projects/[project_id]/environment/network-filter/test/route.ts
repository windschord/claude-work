import { NextRequest, NextResponse } from 'next/server';
import { environmentService } from '@/services/environment-service';
import { networkFilterService } from '@/services/network-filter-service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ project_id: string }>;
}

/**
 * POST /api/projects/[project_id]/environment/network-filter/test - 通信テスト（dry-run）
 *
 * リクエストボディ:
 * - target: string（必須）
 * - port: number（任意）
 *
 * @returns
 * - 200: 通信テスト結果
 * - 400: targetが未指定
 * - 404: 環境が見つからない
 * - 500: サーバーエラー
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { project_id } = await params;

  const environment = await environmentService.findByProjectId(project_id);
  if (!environment) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
  }

  try {
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

    if (!target || typeof target !== 'string' || target.trim() === '') {
      return NextResponse.json({ error: 'target is required' }, { status: 400 });
    }

    if (port !== undefined && port !== null) {
      if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
        return NextResponse.json({ error: 'port must be an integer between 1 and 65535' }, { status: 400 });
      }
    }

    const portNumber = port != null ? (port as number) : undefined;
    const result = await networkFilterService.testConnection(environment.id, target.trim(), portNumber);

    logger.info('Connection test executed', { project_id, target, port, allowed: result.allowed });
    return NextResponse.json({ result });
  } catch (error) {
    logger.error('Failed to test connection', { error, project_id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
