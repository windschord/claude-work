import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
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
    const prompt = db.select().from(schema.prompts)
      .where(eq(schema.prompts.id, id))
      .get();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 });
    }

    // プロンプトを削除
    db.delete(schema.prompts)
      .where(eq(schema.prompts.id, id))
      .run();

    logger.debug('Prompt deleted', { id });
    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete prompt', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
