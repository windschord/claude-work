import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { spawnSync } from 'child_process';
import { basename, resolve } from 'path';
import { realpathSync } from 'fs';
import { logger } from '@/lib/logger';

/**
 * GET /api/projects - プロジェクト一覧取得
 *
 * 登録されているすべてのプロジェクトを作成日時の降順で取得します。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 *
 * @returns
 * - 200: プロジェクト一覧（配列）
 * - 401: 認証されていない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/projects
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス
 * [
 *   {
 *     "id": "uuid",
 *     "name": "my-project",
 *     "path": "/path/to/repo",
 *     "default_model": "auto",
 *     "run_scripts": true,
 *     "created_at": "2025-12-13T09:00:00.000Z"
 *   }
 * ]
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await prisma.project.findMany({
      orderBy: { created_at: 'desc' },
    });

    logger.debug('Projects retrieved', { count: projects.length });
    return NextResponse.json(projects);
  } catch (error) {
    logger.error('Failed to get projects', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects - 新規プロジェクト登録
 *
 * 指定されたパスのGitリポジトリをプロジェクトとして登録します。
 * パスは有効なGitリポジトリである必要があります。
 * 認証が必要です。
 *
 * @param request - リクエストボディに`path`フィールドを含むJSON、sessionIdクッキー
 *
 * @returns
 * - 201: プロジェクト作成成功
 * - 400: pathが指定されていない、または有効なGitリポジトリではない
 * - 401: 認証されていない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/projects
 * Cookie: sessionId=<uuid>
 * Content-Type: application/json
 * { "path": "/path/to/git/repo" }
 *
 * // レスポンス
 * {
 *   "id": "uuid",
 *   "name": "repo",
 *   "path": "/path/to/git/repo",
 *   "default_model": "auto",
 *   "run_scripts": true,
 *   "created_at": "2025-12-13T09:00:00.000Z"
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error });
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { path: projectPath } = body;

    if (!projectPath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // パストラバーサル攻撃を防ぐため、絶対パスに正規化
    let absolutePath: string;
    try {
      absolutePath = realpathSync(resolve(projectPath));
    } catch (error) {
      logger.warn('Invalid path', { path: projectPath, error });
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // 許可されたディレクトリのチェック
    const allowedDirs = process.env.ALLOWED_PROJECT_DIRS?.split(',').map((dir) =>
      dir.trim()
    );
    if (allowedDirs && allowedDirs.length > 0) {
      const isAllowed = allowedDirs.some((allowedDir) => {
        if (!allowedDir) return false;
        try {
          const normalizedAllowedDir = realpathSync(allowedDir);
          return absolutePath.startsWith(normalizedAllowedDir);
        } catch {
          return false;
        }
      });

      if (!isAllowed) {
        logger.warn('Path not in allowed directories', {
          path: absolutePath,
          allowedDirs,
        });
        return NextResponse.json(
          { error: 'Path is not in allowed directories' },
          { status: 403 }
        );
      }
    }

    // Gitリポジトリの検証
    const result = spawnSync('git', ['rev-parse', '--git-dir'], {
      cwd: absolutePath,
      encoding: 'utf-8',
    });

    if (result.error || result.status !== 0) {
      logger.warn('Invalid git repository', { path: absolutePath });
      return NextResponse.json({ error: 'Not a valid git repository' }, { status: 400 });
    }

    const name = basename(absolutePath);

    const project = await prisma.project.create({
      data: {
        name,
        path: absolutePath,
      },
    });

    logger.info('Project created', { id: project.id, name, path: absolutePath });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    logger.error('Failed to create project', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
