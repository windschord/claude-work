import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getEnvironmentsDir } from '@/lib/data-dir';

// 許可されたベースディレクトリ
const ALLOWED_BASE_DIRS = [
  getEnvironmentsDir(),
];

// イメージ名/タグのバリデーション正規表現
// Docker公式のイメージ名規則に準拠
const IMAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const IMAGE_TAG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const MAX_IMAGE_NAME_LENGTH = 128;
const MAX_IMAGE_TAG_LENGTH = 128;

/**
 * パスが許可されたベースディレクトリ配下かどうかを検証
 */
function isPathAllowed(filePath: string): boolean {
  const resolvedPath = path.resolve(filePath);
  return ALLOWED_BASE_DIRS.some(baseDir => resolvedPath.startsWith(baseDir + path.sep));
}

/**
 * イメージ名のバリデーション
 */
function isValidImageName(name: string): boolean {
  if (!name || name.length > MAX_IMAGE_NAME_LENGTH) {
    return false;
  }
  return IMAGE_NAME_PATTERN.test(name);
}

/**
 * イメージタグのバリデーション
 */
function isValidImageTag(tag: string): boolean {
  if (!tag || tag.length > MAX_IMAGE_TAG_LENGTH) {
    return false;
  }
  return IMAGE_TAG_PATTERN.test(tag);
}

export async function POST(request: NextRequest) {
  const { dockerfilePath, imageName, imageTag = 'latest' } = await request.json();

  // バリデーション
  if (!dockerfilePath) {
    return NextResponse.json({ error: 'dockerfilePath is required' }, { status: 400 });
  }
  if (!imageName) {
    return NextResponse.json({ error: 'imageName is required' }, { status: 400 });
  }

  // イメージ名/タグのバリデーション
  if (!isValidImageName(imageName)) {
    return NextResponse.json(
      { error: 'Invalid imageName format. Must match pattern: lowercase alphanumeric with dots, underscores, or hyphens' },
      { status: 400 }
    );
  }
  if (!isValidImageTag(imageTag)) {
    return NextResponse.json(
      { error: 'Invalid imageTag format. Must match pattern: alphanumeric with dots, underscores, or hyphens' },
      { status: 400 }
    );
  }

  // dockerfilePathを絶対パスに変換（getEnvironmentsDir()基準）
  const resolvedDockerfilePath = path.resolve(getEnvironmentsDir(), dockerfilePath);

  // パストラバーサル対策: 許可されたディレクトリかチェック
  if (!isPathAllowed(resolvedDockerfilePath)) {
    logger.warn('Attempted access to unauthorized path', { dockerfilePath });
    return NextResponse.json(
      { error: 'Dockerfile path is not allowed' },
      { status: 400 }
    );
  }

  // Dockerfile存在チェック
  try {
    await fs.access(resolvedDockerfilePath);
  } catch {
    // パス情報を漏洩させない
    return NextResponse.json(
      { error: 'Dockerfile not found' },
      { status: 400 }
    );
  }

  const fullImageName = `${imageName}:${imageTag}`;
  const dockerfileDir = path.dirname(resolvedDockerfilePath);
  const dockerfileName = path.basename(resolvedDockerfilePath);

  logger.info('Starting Docker image build', {
    dockerfilePath,
    imageName: fullImageName,
    dockerfileDir,
  });

  try {
    // spawn を使用してコマンドインジェクションを防止
    const buildResult = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const args = ['build', '-t', fullImageName, '-f', dockerfileName, '.'];
      const child = spawn('docker', args, {
        cwd: dockerfileDir,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // タイムアウト設定 (10分)
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error('Build timeout'));
      }, 600000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const error = new Error(`Build failed with code ${code}`) as Error & { stdout?: string; stderr?: string };
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    logger.info('Docker image build completed', {
      imageName: fullImageName,
    });

    return NextResponse.json({
      success: true,
      imageName: fullImageName,
      buildLog: buildResult.stdout + buildResult.stderr,
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
