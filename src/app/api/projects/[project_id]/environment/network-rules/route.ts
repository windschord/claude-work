import { NextRequest, NextResponse } from 'next/server';
import { environmentService } from '@/services/environment-service';
import { networkFilterService, ValidationError } from '@/services/network-filter-service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ project_id: string }>;
}

/**
 * GET /api/projects/[project_id]/environment/network-rules - フィルタリングルール一覧を取得
 *
 * @returns
 * - 200: ルール一覧
 * - 404: 環境が見つからない
 * - 500: サーバーエラー
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { project_id } = await params;

    const environment = await environmentService.findByProjectId(project_id);
    if (!environment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    const rules = await networkFilterService.getRules(environment.id);

    return NextResponse.json({ rules });
  } catch (error) {
    const { project_id } = await params;

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    logger.error('Failed to get network rules', { error, project_id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[project_id]/environment/network-rules - フィルタリングルールを作成
 *
 * @returns
 * - 201: 作成成功
 * - 400: バリデーションエラー
 * - 404: 環境が見つからない
 * - 500: サーバーエラー
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { project_id } = await params;

    const environment = await environmentService.findByProjectId(project_id);
    if (!environment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
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

    if (!target || typeof target !== 'string' || target.trim() === '') {
      return NextResponse.json({ error: 'target is required' }, { status: 400 });
    }
    if (target.length > 253) {
      return NextResponse.json({ error: 'target is too long' }, { status: 400 });
    }

    if (port !== undefined && port !== null) {
      if (typeof port !== 'number' || !Number.isInteger(port)) {
        return NextResponse.json({ error: 'port must be an integer' }, { status: 400 });
      }
      if (port < 1 || port > 65535) {
        return NextResponse.json({ error: 'port must be between 1 and 65535' }, { status: 400 });
      }
    }

    if (description !== undefined && typeof description !== 'string') {
      return NextResponse.json({ error: 'description must be a string' }, { status: 400 });
    }

    const input = {
      target: target.trim(),
      port: port !== undefined ? (port as number | null) : undefined,
      description: description !== undefined ? (description as string) : undefined,
    };

    const rule = await networkFilterService.createRule(environment.id, input);

    logger.info('Network filter rule created', { project_id, ruleId: rule.id });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    const { project_id } = await params;

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    logger.error('Failed to create network rule', { error, project_id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
