/**
 * Filesystem Browse API
 * GET /api/filesystem/browse?path=/home/user/projects
 * ディレクトリ内容を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  FilesystemService,
  AccessDeniedError,
  NotFoundError,
} from '@/services/filesystem-service';

/**
 * GET /api/filesystem/browse
 * クエリパラメータ: path (省略時はホームディレクトリ)
 * レスポンス: { currentPath, parentPath, entries }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path') || undefined;

    const service = new FilesystemService();

    // ディレクトリ内容を取得
    const entries = await service.listDirectory(path);

    // 現在のパスを決定（省略時はホームディレクトリ）
    const currentPath = path || require('os').homedir();

    // 親ディレクトリのパスを取得
    const parentPath = service.getParentPath(currentPath);

    return NextResponse.json({
      currentPath,
      parentPath,
      entries,
    });
  } catch (error) {
    // AccessDeniedError: 403
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    // NotFoundError: 404
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    // Invalid path errors: 400
    if (error instanceof Error && error.message.startsWith('Invalid path')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // その他のエラー: 500
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
