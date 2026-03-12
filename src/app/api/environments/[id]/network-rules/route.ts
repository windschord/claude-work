import { NextRequest, NextResponse } from 'next/server';
import { networkFilterService, ValidationError } from '@/services/network-filter-service';
import { logger } from '@/lib/logger';
import { syncProxyRulesIfNeeded } from '@/lib/proxy-sync';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/environments/:id/network-rules - フィルタリングルール一覧を取得
 *
 * @returns
 * - 200: ルール一覧
 * - 404: 環境が見つからない
 * - 500: サーバーエラー
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // id の先行検証
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Environment id is required' }, { status: 400 });
    }

    const rules = await networkFilterService.getRules(id);

    return NextResponse.json({ rules });
  } catch (error) {
    const { id } = await params;

    if (error instanceof Error && error.message.includes('not found')) {
      logger.warn('Environment not found for network rules', { id });
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    logger.error('Failed to get network rules', { error, id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/environments/:id/network-rules - フィルタリングルールを作成
 *
 * リクエストボディ:
 * - target: ドメイン名/IP/ワイルドカード/CIDR形式（必須）
 * - port: ポート番号（任意、1-65535）
 * - description: 説明（任意、最大200文字）
 *
 * @returns
 * - 201: 作成成功
 * - 400: バリデーションエラー
 * - 500: サーバーエラー
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // id の先行検証
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'Environment id is required' }, { status: 400 });
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

    const { target, port, description } = body as Record<string, unknown>;

    // target は必須・型検証・長さ制限
    if (!target || typeof target !== 'string' || target.trim() === '') {
      return NextResponse.json({ error: 'target is required' }, { status: 400 });
    }
    if (target.length > 253) {
      return NextResponse.json({ error: 'target is too long' }, { status: 400 });
    }

    // port は undefined か整数（1-65535の範囲）
    if (port !== undefined && port !== null) {
      if (typeof port !== 'number' || !Number.isInteger(port)) {
        return NextResponse.json({ error: 'port must be an integer' }, { status: 400 });
      }
      if (port < 1 || port > 65535) {
        return NextResponse.json({ error: 'port must be between 1 and 65535' }, { status: 400 });
      }
    }

    // description は undefined か string
    if (description !== undefined && typeof description !== 'string') {
      return NextResponse.json({ error: 'description must be a string' }, { status: 400 });
    }

    const input = {
      target: target.trim(),
      port: port !== undefined ? (port as number | null) : undefined,
      description: description !== undefined ? (description as string) : undefined,
    };

    const rule = await networkFilterService.createRule(id, input);
    await syncProxyRulesIfNeeded(id);

    logger.info('Network filter rule created', { environmentId: id, ruleId: rule.id });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    const { id } = await params;

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error('Failed to create network rule', { error, id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
