/**
 * Filesystem Branches API
 * GET /api/filesystem/branches?path=/home/user/projects/myapp
 * Gitリポジトリのブランチ一覧を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  FilesystemService,
  AccessDeniedError,
} from '@/services/filesystem-service';

/**
 * GET /api/filesystem/branches
 * クエリパラメータ: path (必須)
 * レスポンス: { branches, currentBranch }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    // path は必須パラメータ
    if (!path) {
      return NextResponse.json(
        { error: 'path parameter is required' },
        { status: 400 }
      );
    }

    const service = new FilesystemService();

    // ブランチ一覧と現在のブランチを取得
    const branches = await service.getGitBranches(path);
    const currentBranch = await service.getCurrentBranch(path);

    return NextResponse.json({
      branches,
      currentBranch,
    });
  } catch (error) {
    // AccessDeniedError: 403
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    // Not a git repository: 400
    if (error instanceof Error && error.message.includes('git repository')) {
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
