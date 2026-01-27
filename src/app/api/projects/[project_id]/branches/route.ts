import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { remoteRepoService } from '@/services/remote-repo-service';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ project_id: string }>;
}

/**
 * GET /api/projects/[project_id]/branches - プロジェクトのブランチ一覧を取得
 *
 * プロジェクトのローカルブランチとリモート追跡ブランチの一覧を返します。
 *
 * @returns
 * - 200: ブランチ一覧
 * - 404: プロジェクトが見つからない
 * - 500: サーバーエラー
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { project_id } = await params;

    // プロジェクトを取得
    const project = await prisma.project.findUnique({
      where: { id: project_id },
    });

    if (!project) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 });
    }

    // ブランチ一覧を取得
    const branches = await remoteRepoService.getBranches(project.path);

    logger.debug('Branches retrieved', {
      projectId: project_id,
      count: branches.length,
    });

    return NextResponse.json({ branches });
  } catch (error) {
    logger.error('Failed to get branches', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
