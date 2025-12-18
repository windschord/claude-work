import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getSession } from '@/lib/auth';

/**
 * GET /api/prompts - プロンプト履歴取得
 *
 * ユーザーが使用したプロンプトの履歴を取得します。
 * used_countの降順で最大50件まで返します。
 *
 * @param request - リクエスト
 *
 * @returns
 * - 200: プロンプト履歴（統一形式）
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/prompts
 *
 * // レスポンス
 * {
 *   "prompts": [
 *     {
 *       "id": "uuid",
 *       "content": "Implement user auth",
 *       "used_count": 3,
 *       "last_used_at": "2025-12-08T10:00:00Z"
 *     }
 *   ]
 * }
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prompts = await prisma.prompt.findMany({
      orderBy: { used_count: 'desc' },
      take: 50,
    });

    logger.debug('Prompts retrieved', { count: prompts.length });
    return NextResponse.json({ prompts });
  } catch (error) {
    logger.error('Failed to get prompts', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/prompts - プロンプトの保存または更新
 *
 * 新しいプロンプトを作成するか、既存のプロンプトのused_countを更新します。
 *
 * @param request - リクエストボディに`content`フィールドを含むJSON
 *
 * @returns
 * - 201: 新規作成成功
 * - 200: 既存プロンプトの更新成功
 * - 400: contentが指定されていない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/prompts
 * Content-Type: application/json
 * { "content": "Implement user authentication" }
 *
 * // レスポンス（新規作成）
 * {
 *   "id": "uuid",
 *   "content": "Implement user authentication",
 *   "used_count": 1,
 *   "last_used_at": "2025-12-18T10:00:00Z"
 * }
 *
 * // レスポンス（既存更新）
 * {
 *   "id": "uuid",
 *   "content": "Implement user authentication",
 *   "used_count": 6,
 *   "last_used_at": "2025-12-18T10:00:00Z"
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error });
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { content } = body;

    if (!content || content.trim() === '') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // 既存のプロンプトを検索
    const existingPrompt = await prisma.prompt.findFirst({
      where: { content },
    });

    if (existingPrompt) {
      // 既存プロンプトのused_countをインクリメント
      const updatedPrompt = await prisma.prompt.update({
        where: { id: existingPrompt.id },
        data: {
          used_count: { increment: 1 },
          last_used_at: new Date(),
        },
      });

      logger.debug('Prompt updated', { id: updatedPrompt.id, used_count: updatedPrompt.used_count });
      return NextResponse.json(updatedPrompt, { status: 200 });
    } else {
      // 新規プロンプトを作成
      const newPrompt = await prisma.prompt.create({
        data: {
          content,
          used_count: 1,
          last_used_at: new Date(),
        },
      });

      logger.debug('Prompt created', { id: newPrompt.id });
      return NextResponse.json(newPrompt, { status: 201 });
    }
  } catch (error) {
    logger.error('Failed to save prompt', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
