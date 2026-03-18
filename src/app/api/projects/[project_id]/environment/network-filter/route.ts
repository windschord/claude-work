import { NextRequest, NextResponse } from 'next/server';
import { environmentService } from '@/services/environment-service';
import { networkFilterService } from '@/services/network-filter-service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ project_id: string }>;
}

/**
 * プロジェクトから環境IDを解決するヘルパー
 */
async function resolveEnvironmentId(project_id: string): Promise<string | null> {
  const environment = await environmentService.findByProjectId(project_id);
  return environment?.id ?? null;
}

/**
 * GET /api/projects/[project_id]/environment/network-filter - フィルタリング設定を取得
 *
 * @returns
 * - 200: フィルタリング設定（未設定時は config: null を返す）
 * - 404: 環境が見つからない
 * - 500: サーバーエラー
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { project_id } = await params;

    const envId = await resolveEnvironmentId(project_id);
    if (!envId) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const config = await networkFilterService.getFilterConfig(envId);

    return NextResponse.json({ config: config ?? null });
  } catch (error) {
    const { project_id } = await params;
    logger.error('Failed to get filter config', { error, project_id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[project_id]/environment/network-filter - フィルタリングの有効/無効を切り替え
 *
 * リクエストボディ:
 * - enabled: boolean（必須）
 *
 * @returns
 * - 200: 更新後の設定
 * - 400: enabledフィールドがない場合
 * - 404: 環境が見つからない
 * - 500: サーバーエラー
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { project_id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { enabled } = body as Record<string, unknown>;

    if (enabled === undefined || enabled === null || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled is required and must be a boolean' },
        { status: 400 }
      );
    }

    const envId = await resolveEnvironmentId(project_id);
    if (!envId) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const config = await networkFilterService.updateFilterConfig(envId, enabled);

    logger.info('Filter config updated', { project_id, envId, enabled });
    return NextResponse.json({ config });
  } catch (error) {
    const { project_id } = await params;
    logger.error('Failed to update filter config', { error, project_id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
