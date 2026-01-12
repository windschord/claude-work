import { NextRequest, NextResponse } from 'next/server';
import { ContainerManager } from '@/services/container-manager';
import { RepositoryNotFoundError } from '@/services/repository-manager';
import { logger } from '@/lib/logger';

const containerManager = new ContainerManager();

/**
 * GET /api/sessions - セッション一覧取得
 *
 * 全てのセッションをrepository情報と共に取得します。
 *
 * @returns
 * - 200: セッション一覧（repository情報を含む）
 * - 500: サーバーエラー
 */
export async function GET(_request: NextRequest) {
  try {
    const sessions = await containerManager.listSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    logger.error('Failed to list sessions', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/sessions - 新規セッション作成
 *
 * 新しいセッションを作成します。
 * 指定されたリポジトリとparentBranchに基づいてセッションが作成されます。
 *
 * @param request - リクエストボディ
 * @body { name: string, repositoryId: string, parentBranch: string }
 *
 * @returns
 * - 201: 作成されたセッション
 * - 400: バリデーションエラー
 * - 404: リポジトリが見つからない
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

    const { name, repositoryId, parentBranch } = body;

    // Validation: name is required
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Validation: repositoryId is required
    if (!repositoryId || typeof repositoryId !== 'string' || !repositoryId.trim()) {
      return NextResponse.json({ error: 'repositoryId is required' }, { status: 400 });
    }

    // Validation: parentBranch is required
    if (!parentBranch || typeof parentBranch !== 'string' || !parentBranch.trim()) {
      return NextResponse.json({ error: 'parentBranch is required' }, { status: 400 });
    }

    const session = await containerManager.createSession({
      name: name.trim(),
      repositoryId: repositoryId.trim(),
      parentBranch: parentBranch.trim(),
    });

    logger.info('Session created via API', { id: session.id, name: session.name });
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create session', { error: errorMessage });

    // Handle RepositoryNotFoundError
    if (error instanceof RepositoryNotFoundError) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 404 }
      );
    }

    if (errorMessage.includes('Docker')) {
      return NextResponse.json(
        { error: `Failed to create session: ${errorMessage}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
