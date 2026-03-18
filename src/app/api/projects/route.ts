import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { spawnSync } from 'child_process';
import { basename, relative, resolve } from 'path';
import { realpathSync } from 'fs';
import { logger } from '@/lib/logger';
import { sanitizePath } from '@/lib/path-safety';

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
    const rawProjects = await db.query.projects.findMany({
      orderBy: [desc(schema.projects.created_at)],
      with: {
        environment: true,
        sessions: {
          orderBy: [desc(schema.sessions.created_at)],
        },
        scripts: true,
      },
    });

    // scriptsをrun_scriptsに変換
    const projects = rawProjects.map((project) => ({
      ...project,
      run_scripts: project.scripts.map((s) => ({ name: s.name, command: s.command })),
      scripts: undefined,
    }));

    // セッションをフラット化し、環境情報を追加（プロジェクトから取得）
    const allSessions = rawProjects.flatMap((project) =>
      project.sessions.map((session) => ({
        ...session,
        environment_name: project.environment?.name || null,
        environment_type: project.environment?.type || null,
      }))
    );

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
      absolutePath = realpathSync(sanitizePath(projectPath));
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
    const { environmentService, DEFAULT_SANDBOX_IMAGE_NAME } = await import('@/services/environment-service');

    // 重複チェック（プロジェクト作成前に確認）
    const existingProject = db.select({ id: schema.projects.id })
      .from(schema.projects)
      .where(eq(schema.projects.path, absolutePath))
      .get();
    if (existingProject) {
      return NextResponse.json(
        { error: 'このパスは既に登録されています' },
        { status: 409 }
      );
    }

    // 環境を先に作成（project_id は後でプロジェクト作成後に設定）
    // NOTE: projects.environment_id と executionEnvironments.project_id の循環参照を
    //       解決するため、環境を先に作成してからプロジェクトを作成し、最後に環境の
    //       project_id を更新する。
    //       アトミック性の確保: プロジェクト作成が失敗した場合、catch ブロックで
    //       孤立した環境をクリーンアップする（下の try/catch を参照）。
    //       SQLite の外部キー制約上、両テーブルを同一トランザクションで INSERT する
    //       ことができないため、この 2 フェーズ方式を採用している。
    const environment = await environmentService.create({
      name: `${name} 環境`,
      type: 'DOCKER',
      config: { imageName: DEFAULT_SANDBOX_IMAGE_NAME, imageTag: 'latest' },
    });

    try {
      // プロジェクトを作成（有効な environment_id を使用）
      const project = db.insert(schema.projects).values({
        name,
        path: absolutePath,
        // clone_location は「リポジトリの保存場所」であり、実行環境の type とは別の概念。
        // 'host' はリポジトリがホストファイルシステム上にあることを意味し、
        // 実行環境 type（DOCKER）とは独立している。
        clone_location: 'host',
        environment_id: environment.id,
      }).returning().get();

      if (!project) {
        throw new Error('Failed to create project');
      }

      // 環境の project_id を更新して1対1関係を確立
      db.update(schema.executionEnvironments)
        .set({ project_id: project.id })
        .where(eq(schema.executionEnvironments.id, environment.id))
        .run();

      logger.info('Project created with auto-created environment', {
        id: project.id,
        name,
        path: absolutePath,
        environmentId: environment.id,
      });
      return NextResponse.json({ project }, { status: 201 });
    } catch (error) {
      // プロジェクト作成失敗時は孤立した環境をクリーンアップ
      logger.warn('Project creation failed, cleaning up orphaned environment', {
        environmentId: environment.id,
        error,
      });
      try {
        await environmentService.delete(environment.id);
      } catch (cleanupError) {
        logger.error('Failed to clean up orphaned environment', {
          environmentId: environment.id,
          cleanupError,
        });
      }

      // SQLite UNIQUE constraint violationのハンドリング
      const sqliteError = error as { code?: string };
      const isUniqueViolation = sqliteError.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        (error instanceof Error && error.message.includes('UNIQUE constraint failed'));
      if (isUniqueViolation) {
        logger.warn('Duplicate project path', { code: sqliteError.code, error });
        return NextResponse.json(
          { error: 'このパスは既に登録されています' },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    logger.error('Failed to create project', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
