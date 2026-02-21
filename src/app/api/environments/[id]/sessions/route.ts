import { NextRequest, NextResponse } from 'next/server';
import { environmentService } from '@/services/environment-service';
import { db, schema } from '@/lib/db';
import { eq, isNotNull, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/environments/:id/sessions - 環境に紐づくセッション一覧を取得
 *
 * プロジェクトの environment_id 経由でセッションを検索し、
 * container_id が non-null（実行中）のセッションのみ返す。
 *
 * @returns
 * - 200: セッション一覧と件数
 * - 404: 環境が見つからない
 * - 500: サーバーエラー
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // 環境の存在確認
    const environment = await environmentService.findById(id);
    if (!environment) {
      return NextResponse.json({ error: '環境が見つかりません' }, { status: 404 });
    }

    // 該当環境を使用しているセッションを取得
    // sessions -> projects (JOIN) で environment_id を参照し、container_id が non-null のもの
    const sessions = db.select({
      id: schema.sessions.id,
      name: schema.sessions.name,
      status: schema.sessions.status,
      container_id: schema.sessions.container_id,
    })
    .from(schema.sessions)
    .where(
      isNotNull(schema.sessions.container_id)
    )
    .innerJoin(
      schema.projects,
      and(
        eq(schema.sessions.project_id, schema.projects.id),
        eq(schema.projects.environment_id, id)
      )
    )
    .all();

    return NextResponse.json({
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    logger.error('Failed to get sessions for environment', { error });
    return NextResponse.json({ error: 'セッション一覧の取得に失敗しました' }, { status: 500 });
  }
}
