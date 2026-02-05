import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { remoteRepoService } from '@/services/remote-repo-service';
import { relative, resolve, join } from 'path';
import { realpathSync, existsSync, mkdirSync } from 'fs';
import { logger } from '@/lib/logger';

/**
 * POST /api/projects/clone - リモートリポジトリをcloneしてプロジェクト登録
 *
 * リモートGitリポジトリをcloneし、プロジェクトとして登録します。
 *
 * @param request - リクエストボディ
 *   - url: リモートリポジトリURL（必須）
 *   - targetDir: clone先ディレクトリ（任意、デフォルト: data/repos/）
 *   - name: プロジェクト名（任意、デフォルト: URLから自動抽出）
 *
 * @returns
 * - 201: プロジェクト作成成功
 * - 400: URLが無効、または clone失敗
 * - 403: 許可されていないディレクトリ
 * - 409: 既に同じパスのプロジェクトが存在
 * - 500: サーバーエラー
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

    const { url, targetDir, name } = body;

    if (!url) {
      return NextResponse.json({ error: 'URLは必須です' }, { status: 400 });
    }

    // URL検証
    const validation = remoteRepoService.validateRemoteUrl(url);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // clone先ディレクトリの決定
    let cloneTargetDir: string | undefined;
    let baseDir: string | undefined;

    if (targetDir) {
      // ユーザー指定のディレクトリ
      // 親ディレクトリが存在するか確認（clone先自体は存在してはいけない）
      const resolvedTargetDir = resolve(targetDir);
      const parentDir = join(resolvedTargetDir, '..');

      try {
        // 親ディレクトリが存在しない場合は作成
        if (!existsSync(parentDir)) {
          mkdirSync(parentDir, { recursive: true });
        }
        // clone先は存在してはいけない（git cloneが作成する）
        if (existsSync(resolvedTargetDir)) {
          return NextResponse.json({ error: `ディレクトリ ${resolvedTargetDir} は既に存在します` }, { status: 400 });
        }
        cloneTargetDir = resolvedTargetDir;
      } catch (error) {
        logger.warn('Invalid target directory', { targetDir, error });
        return NextResponse.json({ error: '有効なディレクトリパスを入力してください' }, { status: 400 });
      }

      // 許可されたディレクトリのチェック
      const allowedDirsStr = process.env.ALLOWED_PROJECT_DIRS?.trim();
      if (allowedDirsStr) {
        const allowedDirs = allowedDirsStr.split(',').map((dir) => dir.trim()).filter(Boolean);
        if (allowedDirs.length > 0) {
          const isAllowed = allowedDirs.some((allowedDir) => {
            try {
              const normalizedAllowedDir = realpathSync(allowedDir);
              // cloneTargetDir はまだ存在しない可能性があるので resolve のみ使用
              const relativePath = relative(normalizedAllowedDir, cloneTargetDir!);
              return relativePath && !relativePath.startsWith('..') && !resolve(normalizedAllowedDir, relativePath).startsWith('..');
            } catch {
              return false;
            }
          });

          if (!isAllowed) {
            logger.warn('Path not in allowed directories', {
              path: cloneTargetDir,
              allowedDirs,
            });
            return NextResponse.json(
              { error: '指定されたディレクトリは許可されていません' },
              { status: 403 }
            );
          }
        }
      }
    } else {
      // デフォルトディレクトリ（data/repos/）
      baseDir = join(process.cwd(), 'data', 'repos');
      if (!existsSync(baseDir)) {
        mkdirSync(baseDir, { recursive: true });
      }
    }

    // リポジトリをclone
    const cloneResult = await remoteRepoService.clone({
      url,
      targetDir: cloneTargetDir,
      baseDir,
      name,
    });

    if (!cloneResult.success) {
      logger.error('Clone failed', { url, error: cloneResult.error });
      return NextResponse.json({ error: cloneResult.error }, { status: 400 });
    }

    // プロジェクト名を決定
    const projectName = name || remoteRepoService.extractRepoName(url);

    // プロジェクトをDBに登録
    try {
      const project = db.insert(schema.projects).values({
        name: projectName,
        path: cloneResult.path,
        remote_url: url,
      }).returning().get();

      if (!project) {
        throw new Error('Failed to create project');
      }

      logger.info('Project created from remote', {
        id: project.id,
        name: projectName,
        path: cloneResult.path,
        remote_url: url,
      });

      return NextResponse.json({ project }, { status: 201 });
    } catch (error) {
      // SQLite UNIQUE constraint violationのハンドリング
      const sqliteError = error as { code?: string };
      const isUniqueViolation = sqliteError.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        (error instanceof Error && error.message.includes('UNIQUE constraint failed'));
      if (isUniqueViolation) {
        logger.warn('Duplicate project path', { code: sqliteError.code, error });
        return NextResponse.json(
          { error: 'このリポジトリは既に登録されています' },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    logger.error('Failed to clone and create project', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
