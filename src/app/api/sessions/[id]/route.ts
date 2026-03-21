import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ProcessManager } from '@/services/process-manager';
import { logger } from '@/lib/logger';
import { spawnSync } from 'child_process';
import { basename, resolve } from 'path';

const processManager = ProcessManager.getInstance();

/**
 * GET /api/sessions/[id] - セッション詳細取得
 *
 * 指定されたIDのセッション情報を取得します。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: セッション情報（統一形式）
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/sessions/session-uuid
 *
 * // レスポンス
 * {
 *   "session": {
 *     "id": "session-uuid",
 *     "project_id": "uuid-1234",
 *     "name": "新機能実装",
 *     "status": "running",
 *     "model": "claude-3-5-sonnet-20241022",
 *     "worktree_path": "/path/to/worktrees/session-1234567890",
 *     "branch_name": "session/session-1234567890",
 *     "created_at": "2025-12-13T09:00:00.000Z"
 *   }
 * }
 * ```
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const targetSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, id),
      with: {
        project: {
          with: {
            environment: true,
          },
        },
      },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // フロントエンド用にフラット化した形式に変換
    const sessionWithEnvironment = {
      ...targetSession,
      environment_name: targetSession.project?.environment?.name || null,
      environment_type: targetSession.project?.environment?.type as 'HOST' | 'DOCKER' | 'SSH' | null,
      environment: undefined, // ネストされたオブジェクトは削除
    };

    logger.debug('Session retrieved', { id });
    return NextResponse.json({ session: sessionWithEnvironment });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to get session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/sessions/[id] - セッション削除
 *
 * 指定されたIDのセッションを削除します。
 * 実行中のプロセスは停止され、データベースからセッションが削除されます。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 204: 削除成功（レスポンスボディなし）
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * DELETE /api/sessions/session-uuid
 *
 * // レスポンス
 * 204 No Content
 * ```
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const targetSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, id),
      with: { project: true },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Stop process if running
    if (targetSession.status === 'running' || targetSession.status === 'waiting_input') {
      try {
        await processManager.stop(targetSession.id);
        logger.debug('Process stopped before deletion', { session_id: targetSession.id });
      } catch (error) {
        logger.warn('Failed to stop process before deletion', {
          error,
          session_id: targetSession.id,
        });
      }
    }

    // 旧方式で作成されたセッション（branch_name が設定されている）の場合のみworktreeを削除
    if (targetSession.branch_name && targetSession.branch_name !== '') {
      try {
        const sessionName = basename(targetSession.worktree_path);
        if (targetSession.project.clone_location === 'docker') {
          // Docker環境: legacyセッションのworktree削除は自動化されていない
          // 手動クリーンアップが必要な旨を警告ログに出力
          logger.warn('Docker legacy session deleted: worktree may be orphaned and require manual cleanup', {
            session_id: targetSession.id,
            sessionName,
            worktree_path: targetSession.worktree_path,
            branch_name: targetSession.branch_name,
          });
        } else {
          // worktree_pathがプロジェクトの.worktrees/配下であることを検証
          const expectedBase = resolve(targetSession.project.path, '.worktrees');
          const resolvedWorktreePath = resolve(targetSession.worktree_path);
          if (!resolvedWorktreePath.startsWith(expectedBase + '/')) {
            logger.warn('Skipping worktree removal: path is not under .worktrees/', {
              session_id: targetSession.id,
              worktree_path: targetSession.worktree_path,
              expected_base: expectedBase,
            });
          } else {
            // Host環境: gitコマンドでworktree削除
            const removeResult = spawnSync('git', ['worktree', 'remove', '--force', targetSession.worktree_path], {
              // プロジェクトのルートディレクトリで実行（worktreeの管理元）
              cwd: targetSession.project.path,
              encoding: 'utf-8',
            });

            if (removeResult.error || removeResult.status !== 0) {
              logger.warn('Failed to remove worktree for legacy session (continuing with deletion)', {
                session_id: targetSession.id,
                sessionName,
                error: removeResult.stderr || removeResult.error?.message,
              });
            } else {
              logger.info('Removed worktree for legacy session', {
                session_id: targetSession.id,
                sessionName,
              });

              // branch_nameがsession/プレフィックスであることを検証してからブランチ削除
              const branchName = targetSession.branch_name;
              if (!branchName.startsWith('session/')) {
                logger.warn('Skipping branch deletion: branch_name does not have session/ prefix', {
                  session_id: targetSession.id,
                  branchName,
                });
              } else {
                const branchResult = spawnSync('git', ['branch', '-D', branchName], {
                  cwd: targetSession.project.path,
                  encoding: 'utf-8',
                });

                if (branchResult.error || branchResult.status !== 0) {
                  logger.warn('Failed to delete branch for legacy session', {
                    session_id: targetSession.id,
                    branchName,
                    error: branchResult.stderr || branchResult.error?.message,
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        // worktree削除失敗は警告のみ（セッション削除は続行）
        logger.warn('Error during worktree cleanup for legacy session', {
          session_id: targetSession.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    // 新方式（branch_name === ''）ではworktree削除不要（Claude Code管理）

    // Delete session from database
    await db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run();

    logger.info('Session deleted', { id });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to delete session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/sessions/[id] - セッション情報更新
 *
 * 指定されたIDのセッション情報を更新します。
 * 現在はセッション名の更新のみサポートしています。
 *
 * @param request - ボディにnameを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: 更新成功（セッション情報を含む）
 * - 400: 名前が空またはバリデーションエラー
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * PATCH /api/sessions/session-uuid
 * Content-Type: application/json
 * { "name": "新しいセッション名" }
 *
 * // レスポンス
 * {
 *   "session": {
 *     "id": "session-uuid",
 *     "name": "新しいセッション名",
 *     ...
 *   }
 * }
 * ```
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // リクエストボディの解析
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { name } = body;

    // 名前のバリデーション
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // セッションが存在するか確認
    const existingSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, id),
    });

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // セッション名を更新
    await db.update(schema.sessions)
      .set({ name: trimmedName, updated_at: new Date() })
      .where(eq(schema.sessions.id, id))
      .run();

    const updatedSession = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, id),
      with: {
        project: {
          with: {
            environment: true,
          },
        },
      },
    });

    if (!updatedSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // フロントエンド用にフラット化した形式に変換
    const sessionWithEnvironment = {
      ...updatedSession,
      environment_name: updatedSession.project?.environment?.name || null,
      environment_type: updatedSession.project?.environment?.type as 'HOST' | 'DOCKER' | 'SSH' | null,
      environment: undefined, // ネストされたオブジェクトは削除
    };

    logger.info('Session name updated', { id, name: trimmedName });
    return NextResponse.json({ session: sessionWithEnvironment });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to update session', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
