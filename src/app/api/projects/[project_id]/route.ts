import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

/**
 * Gitリポジトリが存在するか確認
 */
function isGitRepository(path: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd: path, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

interface RunScriptInput {
  name: string;
  command: string;
  description?: string;
}

/**
 * PUT /api/projects/[project_id] - プロジェクト更新
 *
 * 指定されたプロジェクトの設定を更新します。
 *
 * @param request - リクエストボディに更新フィールドを含むJSON
 * @param params - project_idを含むパスパラメータ
 *
 * @returns
 * - 200: プロジェクト更新成功
 * - 400: 無効なリクエスト（pathがGitリポジトリでない等）
 * - 404: プロジェクトが見つからない
 * - 409: pathが既に別のプロジェクトで使用されている
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * PUT /api/projects/uuid-123
 * Content-Type: application/json
 * {
 *   "name": "Updated Project",
 *   "path": "/path/to/repo",
 *   "run_scripts": [
 *     { "name": "build", "command": "npm run build", "description": "Build" }
 *   ]
 * }
 * ```
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const { project_id } = await params;

    let body: {
      name?: string;
      path?: string;
      run_scripts?: RunScriptInput[];
    };
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error, project_id });
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const existing = db.select().from(schema.projects).where(eq(schema.projects.id, project_id)).get();

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // pathの検証（変更される場合のみ）
    if (body.path !== undefined && body.path !== existing.path) {
      // パスの存在確認
      if (!existsSync(body.path)) {
        logger.warn('Path does not exist', { path: body.path, project_id });
        return NextResponse.json(
          { error: 'Path does not exist' },
          { status: 400 }
        );
      }

      // Gitリポジトリ確認
      if (!isGitRepository(body.path)) {
        logger.warn('Path is not a Git repository', { path: body.path, project_id });
        return NextResponse.json(
          { error: 'Path is not a Git repository' },
          { status: 400 }
        );
      }

      // ユニーク制約の事前チェック
      const existingWithPath = db.select().from(schema.projects).where(eq(schema.projects.path, body.path)).get();
      if (existingWithPath && existingWithPath.id !== project_id) {
        logger.warn('Path already exists for another project', {
          path: body.path,
          project_id,
          existing_project_id: existingWithPath.id,
        });
        return NextResponse.json(
          { error: 'A project with this path already exists' },
          { status: 409 }
        );
      }
    }

    // トランザクションでプロジェクトとrun_scriptsを更新
    const project = db.transaction((tx) => {
      // run_scriptsが指定されている場合は一括更新（既存削除→新規作成）
      if (body.run_scripts !== undefined) {
        // 既存のRunScriptを削除
        tx.delete(schema.runScripts).where(eq(schema.runScripts.project_id, project_id)).run();

        // 新しいRunScriptを作成
        if (body.run_scripts.length > 0) {
          for (const script of body.run_scripts) {
            tx.insert(schema.runScripts).values({
              project_id,
              name: script.name,
              command: script.command,
              description: script.description ?? null,
            }).run();
          }
        }
      }

      // プロジェクトを更新
      const updatedProject = tx.update(schema.projects)
        .set({
          name: body.name ?? existing.name,
          path: body.path ?? existing.path,
          updated_at: new Date(),
        })
        .where(eq(schema.projects.id, project_id))
        .returning()
        .get();

      // scriptsを取得
      const scripts = tx.select().from(schema.runScripts).where(eq(schema.runScripts.project_id, project_id)).all();

      return {
        ...updatedProject,
        scripts,
      };
    });

    logger.info('Project updated', {
      id: project_id,
      name: project.name,
      path: project.path,
      scripts_count: project.scripts.length,
    });
    return NextResponse.json({ project });
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    // SQLiteのユニーク制約違反をハンドリング（pathカラムのみ）
    const sqliteError = error as { code?: string };
    const isPathUniqueViolation = (sqliteError.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (error instanceof Error && error.message.includes('UNIQUE constraint failed'))) &&
      (error instanceof Error && error.message.includes('path'));
    if (isPathUniqueViolation) {
      logger.warn('Unique constraint violation on path', { code: sqliteError.code, error, id: errorProjectId });
      return NextResponse.json(
        { error: 'A project with this path already exists' },
        { status: 409 }
      );
    }
    logger.error('Failed to update project', { error, id: errorProjectId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[project_id] - プロジェクト削除
 *
 * 指定されたプロジェクトを削除します。
 *
 * @param params - project_idを含むパスパラメータ
 *
 * @returns
 * - 204: プロジェクト削除成功（レスポンスボディなし）
 * - 404: プロジェクトが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * DELETE /api/projects/uuid-123
 *
 * // レスポンス
 * 204 No Content
 * ```
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const { project_id } = await params;

    const existing = db.select().from(schema.projects).where(eq(schema.projects.id, project_id)).get();

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    db.delete(schema.projects).where(eq(schema.projects.id, project_id)).run();

    logger.info('Project deleted', { id: project_id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    logger.error('Failed to delete project', { error, id: errorProjectId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
