import * as fs from 'fs/promises';
import * as path from 'path';
import * as tar from 'tar-fs';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getEnvironmentsDir } from '@/lib/data-dir';
import { DockerClient } from '@/services/docker-client';

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
    const tarStream = tar.pack(dockerfileDir);
    let buildLog = '';
    let buildError: string | null = null;

    await DockerClient.getInstance().buildImage(
      tarStream,
      {
        t: fullImageName,
        dockerfile: dockerfileName,
      },
      (event) => {
        if (event.stream) {
          buildLog += event.stream;
        }
        if (event.error) {
          buildError = event.error;
        }
      }
    );

    if (buildError) {
      logger.error('Docker image build failed with build error', {
        imageName: fullImageName,
        error: buildError,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Build failed',
          buildLog: buildLog + '\n' + buildError,
        },
        { status: 400 }
      );
    }

    logger.info('Docker image build completed', {
      imageName: fullImageName,
    });

    return NextResponse.json({
      success: true,
      imageName: fullImageName,
      buildLog: buildLog,
    });
  } catch (error: unknown) {
    const buildError = error as Error;

    logger.error('Docker image build failed', {
      imageName: fullImageName,
      error: buildError.message,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Build failed',
        buildLog: buildError.message, // Log might be partial or error message
      },
      { status: 400 }
    );
  }
}
