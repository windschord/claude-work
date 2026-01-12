import { NextRequest, NextResponse } from 'next/server';
import { ContainerManager } from '@/services/container-manager';
import { FilesystemService } from '@/services/filesystem-service';
import { logger } from '@/lib/logger';
import type { SessionSourceType } from '@/types/docker-session';

const containerManager = new ContainerManager();
const filesystemService = new FilesystemService();

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
 * @body sourceType='remote': { name: string, sourceType: 'remote', repoUrl: string, branch: string }
 * @body sourceType='local': { name: string, sourceType: 'local', localPath: string }
 * @body 後方互換: { name: string, repoUrl: string, branch: string }
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

    const { name, sourceType, repoUrl, branch, localPath } = body;

    // Validation: name is always required
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Determine source type (default to 'remote' for backward compatibility)
    const effectiveSourceType: SessionSourceType = sourceType || 'remote';

    // Validate sourceType
    if (effectiveSourceType !== 'remote' && effectiveSourceType !== 'local') {
      return NextResponse.json(
        { error: 'sourceType must be "remote" or "local"' },
        { status: 400 }
      );
    }

    if (effectiveSourceType === 'remote') {
      // Remote source validation
      if (!repoUrl || typeof repoUrl !== 'string' || !repoUrl.trim()) {
        return NextResponse.json({ error: 'repoUrl is required for remote source' }, { status: 400 });
      }

      if (!branch || typeof branch !== 'string' || !branch.trim()) {
        return NextResponse.json({ error: 'branch is required for remote source' }, { status: 400 });
      }

      const session = await containerManager.createSession({
        name: name.trim(),
        sourceType: 'remote',
        repoUrl: repoUrl.trim(),
        branch: branch.trim(),
      });

      logger.info('Session created via API (remote)', { id: session.id, name: session.name });
      return NextResponse.json({ session }, { status: 201 });
    } else {
      // Local source validation
      if (!localPath || typeof localPath !== 'string' || !localPath.trim()) {
        return NextResponse.json({ error: 'localPath is required for local source' }, { status: 400 });
      }

      const trimmedPath = localPath.trim();

      // Security check: path must be within home directory
      if (!filesystemService.isPathAllowed(trimmedPath)) {
        return NextResponse.json(
          { error: 'Access denied: path must be within home directory' },
          { status: 400 }
        );
      }

      // Check if path exists and is a git repository
      try {
        const isGitRepo = await filesystemService.isGitRepository(trimmedPath);
        if (!isGitRepo) {
          return NextResponse.json(
            { error: 'Path is not a git repository' },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Path does not exist or is not accessible' },
          { status: 400 }
        );
      }

      const session = await containerManager.createSession({
        name: name.trim(),
        sourceType: 'local',
        localPath: trimmedPath,
      });

      logger.info('Session created via API (local)', { id: session.id, name: session.name });
      return NextResponse.json({ session }, { status: 201 });
    }
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
