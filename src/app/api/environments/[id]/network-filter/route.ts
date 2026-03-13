import { NextRequest, NextResponse } from 'next/server';
import { networkFilterService } from '@/services/network-filter-service';
import { logger } from '@/lib/logger';
import { syncProxyRulesIfNeeded } from '@/lib/proxy-sync';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/environments/:id/network-filter - フィルタリング設定を取得
 *
 * @returns
 * - 200: フィルタリング設定（未設定時は config: null を返す）
 * - 500: サーバーエラー
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Environment id is required' }, { status: 400 });
    }

    const config = await networkFilterService.getFilterConfig(id);

    // 未設定時はconfig: nullを返す（フロントエンド側でnullチェックする）
    return NextResponse.json({ config: config ?? null });
  } catch (error) {
    logger.error('Failed to get filter config', { error, id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/environments/:id/network-filter - フィルタリングの有効/無効を切り替え
 *
 * リクエストボディ:
 * - enabled: boolean（必須）
 *
 * @returns
 * - 200: 更新後の設定
 * - 400: enabledフィールドがない場合
 * - 500: サーバーエラー
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Environment id is required' }, { status: 400 });
    }

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

    // enabled は必須フィールド（boolean型）
    if (enabled === undefined || enabled === null || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled is required and must be a boolean' },
        { status: 400 }
      );
    }

    const config = await networkFilterService.updateFilterConfig(id, enabled);
    void syncProxyRulesIfNeeded(id);

    logger.info('Filter config updated', { environmentId: id, enabled });
    return NextResponse.json({ config });
  } catch (error) {
    logger.error('Failed to update filter config', { error, id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
