import { NextRequest, NextResponse } from 'next/server';
import { networkFilterService, ValidationError } from '@/services/network-filter-service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string; ruleId: string }>;
}

/**
 * PUT /api/environments/:id/network-rules/:ruleId - フィルタリングルールを更新
 *
 * リクエストボディ（すべて任意）:
 * - target: ドメイン名/IP/ワイルドカード/CIDR形式
 * - port: ポート番号（1-65535、nullで削除）
 * - description: 説明
 * - enabled: 有効/無効
 *
 * @returns
 * - 200: 更新成功
 * - 400: バリデーションエラー
 * - 404: ルールが見つからない
 * - 500: サーバーエラー
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, ruleId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { target, port, description, enabled } = body as Record<string, unknown>;

    const input: {
      target?: string;
      port?: number | null;
      description?: string;
      enabled?: boolean;
    } = {};

    if (target !== undefined) input.target = target as string;
    if (port !== undefined) input.port = port as number | null;
    if (description !== undefined) input.description = description as string;
    if (enabled !== undefined) input.enabled = enabled as boolean;

    const rule = await networkFilterService.updateRule(ruleId, input);

    logger.info('Network filter rule updated', { environmentId: id, ruleId });
    return NextResponse.json({ rule });
  } catch (error) {
    const { id, ruleId } = await params;

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes('not found')) {
      logger.warn('Network filter rule not found', { id, ruleId });
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    logger.error('Failed to update network rule', { error, id, ruleId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/environments/:id/network-rules/:ruleId - フィルタリングルールを削除
 *
 * @returns
 * - 204: 削除成功（No Content）
 * - 404: ルールが見つからない
 * - 500: サーバーエラー
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, ruleId } = await params;

    await networkFilterService.deleteRule(ruleId);

    logger.info('Network filter rule deleted', { environmentId: id, ruleId });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { id, ruleId } = await params;

    if (error instanceof Error && error.message.includes('not found')) {
      logger.warn('Network filter rule not found for deletion', { id, ruleId });
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    logger.error('Failed to delete network rule', { error, id, ruleId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
