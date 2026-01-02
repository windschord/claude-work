import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getIronSession } from '@/lib/auth';
import { createPR, getPRStatus, extractPRNumber } from '@/services/gh-cli';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/sessions/[id]/pr
 * セッションのブランチからPRを作成する
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // 認証チェック
    const session = await getIronSession(request);
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // セッション取得
    const dbSession = await prisma.session.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!dbSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 既にPRが存在する場合
    if (dbSession.pr_url) {
      return NextResponse.json(
        { error: 'PR already exists', pr_url: dbSession.pr_url },
        { status: 409 }
      );
    }

    // リクエストボディ取得
    const body = await request.json();
    const { title, body: prBody } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // gh CLI でPRを作成
    let prUrl: string;
    try {
      prUrl = createPR({
        title: title.trim(),
        body: prBody?.trim() || '',
        branchName: dbSession.branch_name,
        cwd: dbSession.worktree_path,
      });
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'GH_NOT_INSTALLED') {
        return NextResponse.json(
          { error: 'GitHub CLI (gh) is not installed' },
          { status: 503 }
        );
      }
      const execError = error as { stderr?: string; message?: string };
      return NextResponse.json(
        { error: execError.stderr || execError.message || 'Failed to create PR' },
        { status: 500 }
      );
    }

    // PR URLからPR番号を抽出
    const prNumber = extractPRNumber(prUrl);

    // DBを更新
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        pr_url: prUrl,
        pr_number: prNumber,
        pr_status: 'open',
        pr_updated_at: new Date(),
      },
    });

    return NextResponse.json(
      {
        pr_url: updatedSession.pr_url,
        pr_number: updatedSession.pr_number,
        pr_status: updatedSession.pr_status,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating PR:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sessions/[id]/pr
 * PRのステータスを取得・更新する
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 認証チェック
    const session = await getIronSession(request);
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // セッション取得
    const dbSession = await prisma.session.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!dbSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // PRが存在しない場合
    if (!dbSession.pr_url || !dbSession.pr_number) {
      return NextResponse.json(
        { error: 'No PR found for this session' },
        { status: 404 }
      );
    }

    // gh CLIでPRステータスを取得
    let prStatus: string;
    try {
      const prData = getPRStatus(dbSession.pr_number, dbSession.worktree_path);
      prStatus = prData.merged ? 'merged' : prData.state.toLowerCase();
    } catch {
      // PRステータス取得に失敗した場合は現在の値を返す
      prStatus = dbSession.pr_status || 'unknown';
    }

    // ステータスが変わった場合はDBを更新
    if (prStatus !== dbSession.pr_status) {
      await prisma.session.update({
        where: { id },
        data: {
          pr_status: prStatus,
          pr_updated_at: new Date(),
        },
      });
    }

    return NextResponse.json({
      pr_url: dbSession.pr_url,
      pr_number: dbSession.pr_number,
      pr_status: prStatus,
      pr_updated_at: dbSession.pr_updated_at,
    });
  } catch (error) {
    console.error('Error getting PR status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
