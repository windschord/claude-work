import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';

function validateClaudeCodeOptions(options: unknown): string | null {
  if (options === undefined) return null;
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    return 'claude_code_options must be an object';
  }
  for (const value of Object.values(options)) {
    if (typeof value !== 'string') {
      return 'claude_code_options values must be strings';
    }
  }
  return null;
}

function validateCustomEnvVars(envVars: unknown): string | null {
  if (envVars === undefined) return null;
  if (typeof envVars !== 'object' || envVars === null || Array.isArray(envVars)) {
    return 'custom_env_vars must be an object';
  }
  for (const [key, value] of Object.entries(envVars as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      return 'custom_env_vars values must be strings';
    }
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      return 'custom_env_vars keys must be uppercase with underscores';
    }
  }
  return null;
}

/**
 * GET /api/projects/[project_id] - プロジェクト詳細取得
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const { project_id } = await params;

    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, project_id),
      with: {
        environment: {
          columns: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    logger.error('Failed to get project', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[project_id] - プロジェクト設定更新（claude_code_options, custom_env_vars）
 *
 * environment_idはプロジェクト作成後に変更不可のため、このAPIでは受け付けない。
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const { project_id } = await params;

    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error, project_id });
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { claude_code_options, custom_env_vars } = body;

    // プロジェクトの存在確認
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, project_id)).get();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // claude_code_options のバリデーション
    const optionsError = validateClaudeCodeOptions(claude_code_options);
    if (optionsError) {
      return NextResponse.json({ error: optionsError }, { status: 400 });
    }

    // custom_env_vars のバリデーション
    const envVarsError = validateCustomEnvVars(custom_env_vars);
    if (envVarsError) {
      return NextResponse.json({ error: envVarsError }, { status: 400 });
    }

    // 更新データの構築
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (claude_code_options !== undefined) updateData.claude_code_options = JSON.stringify(claude_code_options);
    if (custom_env_vars !== undefined) updateData.custom_env_vars = JSON.stringify(custom_env_vars);

    // 更新
    const updated = db
      .update(schema.projects)
      .set(updateData)
      .where(eq(schema.projects.id, project_id))
      .returning()
      .get();

    logger.info('Project settings updated', {
      projectId: project_id,
      updatedFields: Object.keys(updateData).filter(k => k !== 'updated_at'),
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Failed to update project', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[project_id] - プロジェクト更新（name, path, run_scripts, claude_code_options, custom_env_vars）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const { project_id } = await params;

    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error, project_id });
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { name, path: newPath, run_scripts, claude_code_options, custom_env_vars } = body;

    // プロジェクトの存在確認
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, project_id)).get();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // claude_code_options のバリデーション
    const optionsError = validateClaudeCodeOptions(claude_code_options);
    if (optionsError) {
      return NextResponse.json({ error: optionsError }, { status: 400 });
    }

    // custom_env_vars のバリデーション
    const envVarsError = validateCustomEnvVars(custom_env_vars);
    if (envVarsError) {
      return NextResponse.json({ error: envVarsError }, { status: 400 });
    }

    // path のバリデーション
    if (newPath !== undefined) {
      if (!existsSync(newPath)) {
        return NextResponse.json({ error: 'Path does not exist' }, { status: 400 });
      }

      const result = spawnSync('git', ['rev-parse', '--git-dir'], {
        cwd: newPath,
        encoding: 'utf-8',
        timeout: 10_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });

      if (result.error || result.status !== 0) {
        return NextResponse.json({ error: 'Git repository validation failed' }, { status: 400 });
      }

      // 重複チェック
      const existing = db.select().from(schema.projects)
        .where(eq(schema.projects.path, newPath))
        .get();
      if (existing && existing.id !== project_id) {
        return NextResponse.json({ error: 'A project with this path already exists' }, { status: 409 });
      }
    }

    // 更新データの構築
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (name !== undefined) updateData.name = name;
    if (newPath !== undefined) updateData.path = newPath;
    if (claude_code_options !== undefined) updateData.claude_code_options = JSON.stringify(claude_code_options);
    if (custom_env_vars !== undefined) updateData.custom_env_vars = JSON.stringify(custom_env_vars);

    // プロジェクト更新
    const updated = db
      .update(schema.projects)
      .set(updateData)
      .where(eq(schema.projects.id, project_id))
      .returning()
      .get();

    // run_scripts の更新（提供された場合のみ）
    if (run_scripts !== undefined) {
      // 既存スクリプトを削除
      db.delete(schema.runScripts).where(eq(schema.runScripts.project_id, project_id)).run();

      // 新しいスクリプトを追加
      for (const script of run_scripts) {
        db.insert(schema.runScripts).values({
          project_id: project_id,
          name: script.name,
          command: script.command,
          description: script.description || null,
        }).run();
      }
    }

    // スクリプトを取得してレスポンスに含める
    const scripts = db.select().from(schema.runScripts)
      .where(eq(schema.runScripts.project_id, project_id))
      .all();

    logger.info('Project updated', { projectId: project_id });

    return NextResponse.json({ project: { ...updated, scripts } });
  } catch (error) {
    logger.error('Failed to update project', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[project_id] - プロジェクト削除
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const { project_id } = await params;

    // プロジェクトの存在確認
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, project_id)).get();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // プロジェクト削除（cascadeでセッション、メッセージ、スクリプトも削除）
    db.delete(schema.projects).where(eq(schema.projects.id, project_id)).run();

    logger.info('Project deleted', { projectId: project_id });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('Failed to delete project', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
