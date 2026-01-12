import { NextRequest, NextResponse } from 'next/server';
import {
  RepositoryManager,
  RepositoryNotFoundError,
  RepositoryHasSessionsError,
} from '@/services/repository-manager';
import { logger } from '@/lib/logger';

const repositoryManager = new RepositoryManager();

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/repositories/:id - リポジトリ詳細取得
 *
 * 指定されたIDのリポジトリを取得します。
 *
 * @returns
 * - 200: リポジトリ
 * - 404: リポジトリが見つからない
 * - 500: サーバーエラー
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const repository = await repositoryManager.findById(id);

    if (!repository) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    return NextResponse.json(repository);
  } catch (error) {
    logger.error('Failed to get repository', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/repositories/:id - リポジトリ削除
 *
 * 指定されたIDのリポジトリを削除します。
 * 関連セッションがある場合は409 Conflictを返します。
 *
 * @returns
 * - 204: 削除成功
 * - 404: リポジトリが見つからない
 * - 409: 関連セッションが存在
 * - 500: サーバーエラー
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await repositoryManager.delete(id);

    logger.info('Repository deleted via API', { id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof RepositoryNotFoundError) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    if (error instanceof RepositoryHasSessionsError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    logger.error('Failed to delete repository', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
