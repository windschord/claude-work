import { NextRequest, NextResponse } from 'next/server';
import { environmentService } from '@/services/environment-service';
import { db, schema } from '@/lib/db';
import { isNotNull, and, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// 動的インポートでAdapterFactoryを取得（node-ptyがビルド時に読み込まれるのを防ぐ）
async function getAdapterFactory() {
  const { AdapterFactory } = await import('@/services/adapter-factory');
  return AdapterFactory;
}

interface RouteParams {
  params: Promise<{ project_id: string }>;
}

interface SessionResult {
  id: string;
  name: string;
  status: 'restarted' | 'failed';
  error?: string;
}

/**
 * POST /api/projects/[project_id]/environment/apply - 環境設定変更を実行中セッションに即時適用
 *
 * @returns
 * - 200: 適用結果 { applied: number, failed: number, sessions: SessionResult[] }
 * - 404: 環境が見つからない
 * - 500: サーバーエラー
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { project_id } = await params;

    // プロジェクトの環境を取得
    const environment = await environmentService.findByProjectId(project_id);
    if (!environment) {
      return NextResponse.json({ error: '環境が見つかりません' }, { status: 404 });
    }

    // HOST環境は restartSession をサポートしないため即時適用不可
    if (environment.type !== 'DOCKER') {
      return NextResponse.json(
        { error: 'HOST環境では即時適用はサポートされていません' },
        { status: 400 }
      );
    }

    // キャッシュされたDockerAdapterを削除（新しい設定で再生成させる）
    const AdapterFactory = await getAdapterFactory();
    AdapterFactory.removeDockerAdapter(environment.id);

    // 該当プロジェクトの実行中セッションを取得
    const sessions = db.select({
      id: schema.sessions.id,
      name: schema.sessions.name,
      status: schema.sessions.status,
      container_id: schema.sessions.container_id,
      worktree_path: schema.sessions.worktree_path,
    })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.project_id, project_id),
        isNotNull(schema.sessions.container_id),
        eq(schema.sessions.session_state, 'ACTIVE')
      )
    )
    .all();

    // 実行中セッションがない場合
    if (sessions.length === 0) {
      logger.info('No active sessions to apply environment changes', { project_id });
      return NextResponse.json({
        applied: 0,
        failed: 0,
        sessions: [],
      });
    }

    // 新しい設定でアダプターを取得
    const adapter = AdapterFactory.getAdapter(environment);

    // 各セッションを再起動
    const results: SessionResult[] = [];
    let applied = 0;
    let failed = 0;

    for (const session of sessions) {
      try {
        await adapter.restartSession(session.id, session.worktree_path ?? undefined);
        applied++;
        results.push({
          id: session.id,
          name: session.name,
          status: 'restarted',
        });
        logger.info('Session restarted successfully', {
          sessionId: session.id,
          project_id,
        });
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          id: session.id,
          name: session.name,
          status: 'failed',
          error: errorMessage,
        });
        logger.error('Failed to restart session', {
          sessionId: session.id,
          project_id,
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      applied,
      failed,
      sessions: results,
    });
  } catch (error) {
    logger.error('Failed to apply environment settings', { error });
    return NextResponse.json({ error: '環境設定の即時適用に失敗しました' }, { status: 500 });
  }
}
