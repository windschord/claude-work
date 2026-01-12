import { NextRequest, NextResponse } from 'next/server';
import { RepositoryManager } from '@/services/repository-manager';
import { logger } from '@/lib/logger';

const repositoryManager = new RepositoryManager();

/**
 * GET /api/repositories - リポジトリ一覧取得
 *
 * 全てのリポジトリをセッション数とともに取得します。
 *
 * @returns
 * - 200: リポジトリ一覧
 * - 500: サーバーエラー
 */
export async function GET(_request: NextRequest) {
  try {
    const repositories = await repositoryManager.findAll();
    return NextResponse.json({ repositories });
  } catch (error) {
    logger.error('Failed to list repositories', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/repositories - リポジトリ登録
 *
 * 新しいリポジトリを登録します。
 *
 * @param request - リクエストボディ
 * @body type='local': { name: string, type: 'local', path: string }
 * @body type='remote': { name: string, type: 'remote', url: string }
 *
 * @returns
 * - 201: 登録されたリポジトリ
 * - 400: バリデーションエラー
 * - 500: サーバーエラー
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { name, type, path, url } = body;

    // Validation: name is required
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Validation: type is required and must be 'local' or 'remote'
    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    if (type !== 'local' && type !== 'remote') {
      return NextResponse.json(
        { error: 'type must be "local" or "remote"' },
        { status: 400 }
      );
    }

    // Type-specific validation
    if (type === 'local') {
      if (!path || typeof path !== 'string' || !path.trim()) {
        return NextResponse.json({ error: 'path is required for local repository' }, { status: 400 });
      }

      const repository = await repositoryManager.register({
        name: name.trim(),
        type: 'local',
        path: path.trim(),
      });

      logger.info('Repository registered via API (local)', { id: repository.id, name: repository.name });
      return NextResponse.json(repository, { status: 201 });
    } else {
      // type === 'remote'
      if (!url || typeof url !== 'string' || !url.trim()) {
        return NextResponse.json({ error: 'url is required for remote repository' }, { status: 400 });
      }

      const repository = await repositoryManager.register({
        name: name.trim(),
        type: 'remote',
        url: url.trim(),
      });

      logger.info('Repository registered via API (remote)', { id: repository.id, name: repository.name });
      return NextResponse.json(repository, { status: 201 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to register repository', { error: errorMessage });

    // Handle known validation errors from RepositoryManager
    if (
      errorMessage.includes('not a git repository') ||
      errorMessage.includes('Failed to get default branch from remote repository')
    ) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
