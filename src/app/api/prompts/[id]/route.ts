import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/prompts/[id] - プロンプト履歴削除
 *
 * 指定されたIDのプロンプトを削除します。
 *
 * @param request - リクエスト
 * @param params.id - プロンプトID
 *
 * @returns
 * - 200: 削除成功
 * - 404: プロンプトが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * DELETE /api/prompts/uuid-1234
 *
 * // レスポンス（成功）
 * {
 *   "message": "Deleted successfully"
 * }
 *
 * // レスポンス（失敗）
 * {
 *   "error": "Prompt not found"
 * }
 * ```
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // プロンプトの存在確認
    const prompt = await prisma.prompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    // プロンプトを削除
    await prisma.prompt.delete({
      where: { id },
    });

    logger.debug('Prompt deleted', { id });
    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete prompt', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
