import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  const { dockerfilePath, imageName, imageTag = 'latest' } = await request.json();

  // バリデーション
  if (!dockerfilePath) {
    return NextResponse.json({ error: 'dockerfilePath is required' }, { status: 400 });
  }
  if (!imageName) {
    return NextResponse.json({ error: 'imageName is required' }, { status: 400 });
  }

  // Dockerfile存在チェック
  try {
    await fs.access(dockerfilePath);
  } catch {
    return NextResponse.json(
      { error: `Dockerfile not found: ${dockerfilePath}` },
      { status: 400 }
    );
  }

  const fullImageName = `${imageName}:${imageTag}`;
  const dockerfileDir = path.dirname(dockerfilePath);
  const dockerfileName = path.basename(dockerfilePath);

  logger.info('Starting Docker image build', {
    dockerfilePath,
    imageName: fullImageName,
    dockerfileDir,
  });

  try {
    const { stdout, stderr } = await execAsync(
      `docker build -t ${fullImageName} -f ${dockerfileName} .`,
      {
        cwd: dockerfileDir,
        timeout: 600000, // 10分タイムアウト
      }
    );

    logger.info('Docker image build completed', {
      imageName: fullImageName,
    });

    return NextResponse.json({
      success: true,
      imageName: fullImageName,
      buildLog: stdout + stderr,
    });
  } catch (error: unknown) {
    const buildError = error as Error & { stdout?: string; stderr?: string };

    logger.error('Docker image build failed', {
      imageName: fullImageName,
      error: buildError.message,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Build failed',
        buildLog: (buildError.stdout || '') + (buildError.stderr || ''),
      },
      { status: 400 }
    );
  }
}
