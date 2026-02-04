import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { remoteRepoService } from '@/services/remote-repo-service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ project_id: string }>;
}

/**
 * POST /api/projects/[project_id]/pull - リモートリポジトリを更新
 *
 * リモートからcloneしたプロジェクトを最新の状態に更新します（git pull）。
 * fast-forward onlyでpullするため、ローカルに競合する変更がある場合は失敗します。
 *
 * @returns
 * - 200: 更新成功
 * - 400: pull失敗（競合等）またはリモートリポジトリではない
 * - 404: プロジェクトが見つからない
 * - 500: サーバーエラー
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { project_id } = await params;

    // プロジェクトを取得
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, project_id)).get();

    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 });
    }

    // リモートリポジトリかどうか確認
    if (!project.remote_url) {
      return NextResponse.json(
        { error: 'このプロジェクトはリモートから登録されていません' },
        { status: 400 }
      );
    }

    // pullを実行
    const pullResult = await remoteRepoService.pull(project.path);

    if (!pullResult.success) {
      logger.error('Pull failed', { projectId: project_id, error: pullResult.error });
      return NextResponse.json(
        {
          success: false,
          updated: false,
          message: '',
          error: pullResult.error,
        },
        { status: 400 }
      );
    }

    logger.info('Project updated', {
      projectId: project_id,
      updated: pullResult.updated,
    });

    return NextResponse.json({
      success: true,
      updated: pullResult.updated,
      message: pullResult.message,
    });
  } catch (error) {
    logger.error('Failed to pull project', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
