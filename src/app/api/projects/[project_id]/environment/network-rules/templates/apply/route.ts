import { NextRequest, NextResponse } from 'next/server';
import { environmentService } from '@/services/environment-service';
import { networkFilterService, ValidationError } from '@/services/network-filter-service';
import { logger } from '@/lib/logger';
import type { CreateRuleInput } from '@/services/network-filter-service';

interface RouteParams {
  params: Promise<{ project_id: string }>;
}

/**
 * POST /api/projects/[project_id]/environment/network-rules/templates/apply - テンプレートからルールを一括適用
 *
 * リクエストボディ:
 * - rules: CreateRuleInput[]（必須・非空）
 *
 * @returns
 * - 201: 作成結果（created, skipped, rules）
 * - 400: rulesが未指定または空配列
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

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { rules } = body as Record<string, unknown>;

    if (!rules || !Array.isArray(rules)) {
      return NextResponse.json({ error: 'rules is required and must be an array' }, { status: 400 });
    }

    if (rules.length === 0) {
      return NextResponse.json({ error: 'rules must not be empty' }, { status: 400 });
    }

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
        return NextResponse.json(
          { error: `rules[${i}] must be an object` },
          { status: 400 }
        );
      }
      const { target, port } = rule as Record<string, unknown>;
      if (!target || typeof target !== 'string' || target.trim() === '') {
        return NextResponse.json(
          { error: `rules[${i}].target is required and must be a non-empty string` },
          { status: 400 }
        );
      }
      if (port !== undefined && port !== null) {
        if (typeof port !== 'number' || !Number.isInteger(port)) {
          return NextResponse.json(
            { error: `rules[${i}].port must be an integer` },
            { status: 400 }
          );
        }
        if (port < 1 || port > 65535) {
          return NextResponse.json(
            { error: `rules[${i}].port must be between 1 and 65535` },
            { status: 400 }
          );
        }
      }
      const { description } = rule as Record<string, unknown>;
      if (description !== undefined && typeof description !== 'string') {
        return NextResponse.json(
          { error: `rules[${i}].description must be a string` },
          { status: 400 }
        );
      }
    }

    const result = await networkFilterService.applyTemplates(environment.id, rules as CreateRuleInput[]);

    logger.info('Templates applied', {
      project_id,
      created: result.created,
      skipped: result.skipped,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const { project_id } = await params;
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error('Failed to apply templates', { error, project_id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
