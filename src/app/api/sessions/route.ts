import { NextRequest, NextResponse } from 'next/server';
import { ContainerManager } from '@/services/container-manager';
import { logger } from '@/lib/logger';

const containerManager = new ContainerManager();

/**
 * GET /api/sessions - セッション一覧取得
 *
 * 全てのセッションを取得します。
 *
 * @returns
 * - 200: セッション一覧
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
 * DockerコンテナとVolumeが作成され、指定されたリポジトリがクローンされます。
 *
 * @param request - リクエストボディ
 * @body { name: string, repoUrl: string, branch: string }
 *
 * @returns
 * - 201: 作成されたセッション
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

    const { name, repoUrl, branch } = body;

    // Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!repoUrl || typeof repoUrl !== 'string' || !repoUrl.trim()) {
      return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 });
    }

    if (!branch || typeof branch !== 'string' || !branch.trim()) {
      return NextResponse.json({ error: 'branch is required' }, { status: 400 });
    }

    const session = await containerManager.createSession({
      name: name.trim(),
      repoUrl: repoUrl.trim(),
      branch: branch.trim(),
    });

    logger.info('Session created via API', { id: session.id, name: session.name });
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create session', { error: errorMessage });

    if (errorMessage.includes('Docker')) {
      return NextResponse.json(
        { error: `Failed to create session: ${errorMessage}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
