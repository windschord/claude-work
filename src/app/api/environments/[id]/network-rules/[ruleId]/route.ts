import { NextRequest, NextResponse } from 'next/server';
import { networkFilterService, ValidationError } from '@/services/network-filter-service';
import { logger } from '@/lib/logger';
import { syncProxyRulesIfNeeded } from '@/lib/proxy-sync';

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

    // id と ruleId の基本検証
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Environment id is required' }, { status: 400 });
    }
    if (!ruleId || ruleId.trim() === '') {
      return NextResponse.json({ error: 'Rule id is required' }, { status: 400 });
    }

    // environmentId スコープ強制: ruleId がこの環境に属するか確認
    const existingRules = await networkFilterService.getRules(id);
    if (Array.isArray(existingRules)) {
      const ruleExists = existingRules.some((r) => r.id === ruleId);
      if (!ruleExists) {
        logger.warn('Network filter rule not found in environment', { id, ruleId });
        return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
      }
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { target, port, description, enabled } = body as Record<string, unknown>;

    const input: {
      target?: string;
      port?: number | null;
      description?: string;
      enabled?: boolean;
    } = {};

    if (target !== undefined) {
      if (typeof target !== 'string') {
        return NextResponse.json({ error: 'target must be a string' }, { status: 400 });
      }
      const trimmedTarget = target.trim();
      if (trimmedTarget === '') {
        return NextResponse.json({ error: 'target must not be empty' }, { status: 400 });
      }
      if (trimmedTarget.length > 253) {
        return NextResponse.json({ error: 'target is too long' }, { status: 400 });
      }
      input.target = trimmedTarget;
    }
    if (port !== undefined) {
      if (port !== null && (typeof port !== 'number' || !Number.isInteger(port))) {
        return NextResponse.json({ error: 'port must be an integer or null' }, { status: 400 });
      }
      if (port !== null && typeof port === 'number' && (port < 1 || port > 65535)) {
        return NextResponse.json({ error: 'port must be between 1 and 65535' }, { status: 400 });
      }
      input.port = port as number | null;
    }
    if (description !== undefined) {
      if (typeof description !== 'string') {
        return NextResponse.json({ error: 'description must be a string' }, { status: 400 });
      }
      input.description = description;
    }
    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') {
        return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
      }
      input.enabled = enabled;
    }

    const rule = await networkFilterService.updateRule(ruleId, input);
    await syncProxyRulesIfNeeded(id);

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

    // id と ruleId の基本検証
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Environment id is required' }, { status: 400 });
    }
    if (!ruleId || ruleId.trim() === '') {
      return NextResponse.json({ error: 'Rule id is required' }, { status: 400 });
    }

    // environmentId スコープ強制: ruleId がこの環境に属するか確認
    const existingRules = await networkFilterService.getRules(id);
    if (Array.isArray(existingRules)) {
      const ruleExists = existingRules.some((r) => r.id === ruleId);
      if (!ruleExists) {
        logger.warn('Network filter rule not found in environment for deletion', { id, ruleId });
        return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
      }
    }

    await networkFilterService.deleteRule(ruleId);
    await syncProxyRulesIfNeeded(id);

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
