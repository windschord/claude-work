import { NextRequest, NextResponse } from 'next/server';
import { environmentService } from '@/services/environment-service';
import { networkFilterService } from '@/services/network-filter-service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ project_id: string }>;
}

/**
 * GET /api/projects/[project_id]/environment/network-rules/templates - デフォルトルールテンプレートを取得
 *
 * @returns
 * - 200: テンプレート一覧
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

    const templates = networkFilterService.getDefaultTemplates();

    logger.info('Default templates retrieved', { project_id, count: templates.length });
    return NextResponse.json({ templates });
  } catch (error) {
    const { project_id } = await params;
    logger.error('Failed to get templates', { error, project_id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
