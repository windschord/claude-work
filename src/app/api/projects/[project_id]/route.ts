import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

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

    return NextResponse.json(project);
  } catch (error) {
    logger.error('Failed to get project', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[project_id] - プロジェクト更新
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

    const { environment_id } = body;

    // プロジェクトの存在確認
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, project_id)).get();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 更新
    const updated = db
      .update(schema.projects)
      .set({
        environment_id: environment_id === null ? null : environment_id,
        updated_at: new Date(),
      })
      .where(eq(schema.projects.id, project_id))
      .returning()
      .get();

    logger.info('Project environment updated', {
      projectId: project_id,
      environment_id,
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Failed to update project', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
