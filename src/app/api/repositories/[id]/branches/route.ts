import { NextRequest, NextResponse } from 'next/server';
import {
  RepositoryManager,
  RepositoryNotFoundError,
} from '@/services/repository-manager';
import { logger } from '@/lib/logger';

const repositoryManager = new RepositoryManager();

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/repositories/:id/branches - ブランチ一覧取得
 *
 * 指定されたリポジトリのブランチ一覧を取得します。
 *
 * @returns
 * - 200: ブランチ一覧
 * - 404: リポジトリが見つからない
 * - 500: サーバーエラー
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const branchInfo = await repositoryManager.getBranches(id);

    return NextResponse.json(branchInfo);
  } catch (error) {
    if (error instanceof RepositoryNotFoundError) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    logger.error('Failed to get branches', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
