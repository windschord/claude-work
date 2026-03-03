import { NextRequest, NextResponse } from 'next/server';
import { networkFilterService } from '@/services/network-filter-service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/environments/:id/network-rules/templates - デフォルトルールテンプレートを取得
 *
 * @returns
 * - 200: テンプレート一覧
 * - 500: サーバーエラー
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // id は現在 getDefaultTemplates() では使用されないが、将来的に環境ごとの
    // カスタムテンプレートをサポートする際に使用する想定で保持している
    const { id } = await params;

    const templates = networkFilterService.getDefaultTemplates();

    logger.info('Default templates retrieved', { environmentId: id, count: templates.length });
    return NextResponse.json({ templates });
  } catch (error) {
    const { id } = await params;
    logger.error('Failed to get templates', { error, id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
