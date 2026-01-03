import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { spawnSync } from 'child_process';
import { basename, relative, resolve } from 'path';
import { realpathSync } from 'fs';
import { logger } from '@/lib/logger';

/**
 * GET /api/projects - プロジェクト一覧取得
 *
 * 登録されているすべてのプロジェクトを作成日時の降順で取得します。
 *
 * @returns
 * - 200: プロジェクト一覧（統一形式）
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/projects
 *
 * // レスポンス
 * {
 *   "projects": [
 *     {
 *       "id": "uuid",
 *       "name": "my-project",
 *       "path": "/path/to/repo",
 *       "created_at": "2025-12-13T09:00:00.000Z"
 *     }
 *   ]
 * }
 * ```
 */
export async function GET(_request: NextRequest) {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        sessions: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    // セッションをフラット化して返す
    const allSessions = projects.flatMap((project) => project.sessions);

    logger.debug('Projects retrieved', { count: projects.length, sessions: allSessions.length });
    return NextResponse.json({ projects, sessions: allSessions });
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
 *
 * @param request - リクエストボディに`path`フィールドを含むJSON
 *
 * @returns
 * - 201: プロジェクト作成成功
 * - 400: pathが指定されていない、または有効なGitリポジトリではない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/projects
 * Content-Type: application/json
 * { "path": "/path/to/git/repo" }
 *
 * // レスポンス
 * {
 *   "project": {
 *     "id": "uuid",
 *     "name": "repo",
 *     "path": "/path/to/git/repo",
 *     "created_at": "2025-12-13T09:00:00.000Z"
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: '有効なパスを入力してください' }, { status: 400 });
    }

    // 許可されたディレクトリのチェック
    const allowedDirsStr = process.env.ALLOWED_PROJECT_DIRS?.trim();
    if (allowedDirsStr) {
      const allowedDirs = allowedDirsStr.split(',').map((dir) => dir.trim()).filter(Boolean);
      if (allowedDirs.length > 0) {
        const isAllowed = allowedDirs.some((allowedDir) => {
          try {
            const normalizedAllowedDir = realpathSync(allowedDir);
            // path.relativeを使った適切なディレクトリ境界チェック
            const relativePath = relative(normalizedAllowedDir, absolutePath);
            // 相対パスが '..' で始まる場合、許可ディレクトリの外にある
            // 空文字列の場合は同じディレクトリ
            return relativePath && !relativePath.startsWith('..') && !resolve(normalizedAllowedDir, relativePath).startsWith('..');
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
            { error: '指定されたパスは許可されていません' },
            { status: 403 }
          );
        }
      }
    }
    // allowedDirsStrが空または未設定の場合、チェックをスキップ（すべて許可）

    // Gitリポジトリの検証
    const result = spawnSync('git', ['rev-parse', '--git-dir'], {
      cwd: absolutePath,
      encoding: 'utf-8',
      timeout: 10_000, // 10秒でタイムアウト
      maxBuffer: 1024 * 1024, // 1MBまでバッファ許容
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, // インタラクティブプロンプトを抑止
    });

    if (result.error || result.status !== 0) {
      logger.warn('Invalid git repository', { path: absolutePath });
      return NextResponse.json({ error: 'Gitリポジトリではありません' }, { status: 400 });
    }

    const name = basename(absolutePath);

    try {
      const project = await prisma.project.create({
        data: {
          name,
          path: absolutePath,
        },
      });

      logger.info('Project created', { id: project.id, name, path: absolutePath });
      return NextResponse.json({ project }, { status: 201 });
    } catch (error) {
      // Prisma P2002エラー（Unique constraint violation）のハンドリング
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          logger.warn('Duplicate project path', { error });
          return NextResponse.json(
            { error: 'このパスは既に登録されています' },
            { status: 409 }
          );
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Failed to create project', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
