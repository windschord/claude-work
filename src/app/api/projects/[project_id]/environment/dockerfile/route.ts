import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { environmentService } from '@/services/environment-service';
import { getEnvironmentsDir } from '@/lib/data-dir';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ project_id: string }>;
}

/**
 * POST /api/projects/[project_id]/environment/dockerfile - Dockerfileをアップロード
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const { project_id } = await params;

  try {
    const environment = await environmentService.findByProjectId(project_id);
    if (!environment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    if (environment.type !== 'DOCKER') {
      return NextResponse.json(
        { error: 'Dockerfile upload is only supported for DOCKER environments' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const fileEntry = formData.get('dockerfile');

    if (!fileEntry) {
      return NextResponse.json({ error: 'No dockerfile provided' }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: 'dockerfile must be a file upload, not a string' }, { status: 400 });
    }

    const file = fileEntry;

    const envDir = path.join(getEnvironmentsDir(), environment.id);
    await fs.mkdir(envDir, { recursive: true });

    const dockerfilePath = path.join(envDir, 'Dockerfile');
    const fileContent = await file.text();
    await fs.writeFile(dockerfilePath, fileContent, 'utf-8');

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(environment.config || '{}');
    } catch {
      // DBに不正なJSONが格納されている場合は空オブジェクトにフォールバック
      config = {};
    }
    config.dockerfileUploaded = true;
    config.imageSource = 'dockerfile';

    await environmentService.update(environment.id, { config });

    return NextResponse.json({
      success: true,
      path: `environments/${environment.id}/Dockerfile`,
    });
  } catch (error) {
    logger.error('Failed to upload dockerfile', { error, project_id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[project_id]/environment/dockerfile - Dockerfileを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { project_id } = await params;

  try {
    const environment = await environmentService.findByProjectId(project_id);
    if (!environment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    if (environment.type !== 'DOCKER') {
      return NextResponse.json(
        { error: 'Dockerfile delete is only supported for DOCKER environments' },
        { status: 400 }
      );
    }

    const dockerfilePath = path.join(getEnvironmentsDir(), environment.id, 'Dockerfile');
    try {
      await fs.unlink(dockerfilePath);
    } catch (unlinkError) {
      // ファイルが存在しない場合（ENOENT）は正常とみなして続行する
      // それ以外のエラー（権限エラー等）は上位の catch に伝播させる
      if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw unlinkError;
      }
    }

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(environment.config || '{}');
    } catch {
      // DBに不正なJSONが格納されている場合は空オブジェクトにフォールバック
      config = {};
    }
    config.dockerfileUploaded = false;
    config.imageSource = 'existing';

    await environmentService.update(environment.id, { config });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete dockerfile', { error, project_id });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
