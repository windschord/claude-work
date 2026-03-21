import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { EnvFileService, EnvFileError } from '@/services/env-file-service';
import { parseDotenv } from '@/services/dotenv-parser';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/[project_id]/env-files/parse - .envファイルをパースして結果を返す
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const { project_id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const filePath = body?.path;
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'path is required and must be a non-empty string' }, { status: 400 });
    }

    // .envファイル以外の読み取りを防止
    const fileName = path.basename(filePath);
    const envFilePattern = /^\.env(\.[\w.-]+)?$/;
    if (!envFilePattern.test(fileName)) {
      return NextResponse.json({ error: '.envファイルのみ読み込みが許可されています' }, { status: 400 });
    }

    const project = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, project_id))
      .get();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // パストラバーサルチェック
    try {
      EnvFileService.validatePath(project.path, filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid path';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // ファイル読み込み（listEnvFilesの結果をreadEnvFileに渡して二重走査を防止）
    let content: string;
    try {
      const allowedFiles = await EnvFileService.listEnvFiles(project.path, project.clone_location, project.docker_volume_id);
      content = await EnvFileService.readEnvFile(
        project.path,
        filePath,
        project.clone_location,
        project.docker_volume_id,
        allowedFiles,
      );
    } catch (error) {
      if (error instanceof EnvFileError) {
        switch (error.code) {
          case 'FILE_TOO_LARGE':
            return NextResponse.json({ error: error.message }, { status: 413 });
          case 'FILE_NOT_FOUND':
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
          case 'POLICY_VIOLATION':
          case 'DOCKER_VOLUME_MISSING':
            return NextResponse.json({ error: error.message }, { status: 400 });
          default:
            break;
        }
      }
      throw error;
    }

    const result = parseDotenv(content);

    logger.info('Parsed env file', {
      projectId: project_id,
      path: filePath,
      variableCount: Object.keys(result.variables).length,
      errorCount: result.errors.length,
    });

    return NextResponse.json({
      variables: result.variables,
      errors: result.errors,
    });
  } catch (error) {
    logger.error('Failed to parse env file', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
