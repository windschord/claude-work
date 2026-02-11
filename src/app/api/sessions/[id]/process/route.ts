import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ProcessManager } from '@/services/process-manager';
import { logger } from '@/lib/logger';
import type { EnvironmentAdapter } from '@/services/environment-adapter';
import type { ExecutionEnvironment } from '@/lib/db';

// 動的インポートでAdapterFactoryを取得（node-ptyがビルド時に読み込まれるのを防ぐ）
async function getAdapterFactory() {
  const { AdapterFactory } = await import('@/services/adapter-factory');
  return AdapterFactory;
}

const processManager = ProcessManager.getInstance();

/**
 * GET /api/sessions/[id]/process - プロセス状態確認
 *
 * 指定されたIDのセッションのClaude Codeプロセスが実行中かどうかを確認します。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: プロセス状態 { running: boolean }
 * - 404: セッションが見つからない / 環境が見つからない
 * - 500: サーバーエラー / アダプター取得失敗
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/sessions/session-uuid/process
 *
 * // レスポンス（プロセス実行中）
 * {
 *   "running": true
 * }
 *
 * // レスポンス（プロセス停止中）
 * {
 *   "running": false
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
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    let running = false;

    if (targetSession.environment_id) {
      // 新しい環境システム: AdapterFactory経由で状態確認
      const environment = await db.query.executionEnvironments.findFirst({
        where: eq(schema.executionEnvironments.id, targetSession.environment_id),
      });
      if (!environment) {
        logger.warn('Environment not found for session', {
          session_id: id,
          environment_id: targetSession.environment_id,
        });
        return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
      }

      try {
        const AdapterFactory = await getAdapterFactory();
        const adapter = AdapterFactory.getAdapter(environment);
        running = adapter.hasSession(targetSession.id);
      } catch (adapterError) {
        // environment_id付きセッション（DOCKER等）はProcessManagerで管理されないため、
        // フォールバックせずエラーを返す
        logger.error('Failed to get adapter for environment-backed session', {
          error: adapterError,
          session_id: id,
          environment_id: targetSession.environment_id,
        });
        return NextResponse.json(
          { error: 'Failed to get environment adapter' },
          { status: 500 }
        );
      }
    } else {
      // レガシー: ProcessManager
      running = processManager.hasProcess(targetSession.id);
    }

    logger.debug('Process status checked', { session_id: id, running });
    return NextResponse.json({ running });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to check process status', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/sessions/[id]/process - プロセス再起動
 *
 * 停止中のセッションのClaude Codeプロセスを再起動します。
 * 既にプロセスが実行中の場合は何もせず成功を返します。
 *
 * @param params.id - セッションID
 *
 * @returns
 * - 200: 成功 { success: true, running: true } または { success: true, running: true, message: 'Process already running' }
 * - 404: セッションが見つからない / 環境が見つからない
 * - 500: サーバーエラー / アダプター取得失敗
 *
 * @example
 * ```typescript
 * // リクエスト
 * POST /api/sessions/session-uuid/process
 *
 * // レスポンス（起動成功）
 * {
 *   "success": true,
 *   "running": true
 * }
 *
 * // レスポンス（既に実行中）
 * {
 *   "success": true,
 *   "running": true,
 *   "message": "Process already running"
 * }
 * ```
 */
export async function POST(
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

    // 環境情報を一度だけ取得（環境付きセッションの場合）
    let environment: ExecutionEnvironment | undefined;
    let adapter: EnvironmentAdapter | undefined;

    if (targetSession.environment_id) {
      environment = await db.query.executionEnvironments.findFirst({
        where: eq(schema.executionEnvironments.id, targetSession.environment_id),
      });
      if (!environment) {
        logger.warn('Environment not found for session', {
          session_id: id,
          environment_id: targetSession.environment_id,
        });
        return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
      }

      try {
        const AdapterFactory = await getAdapterFactory();
        adapter = AdapterFactory.getAdapter(environment);
      } catch (adapterError) {
        logger.error('Failed to get adapter for environment-backed session', {
          error: adapterError,
          session_id: id,
          environment_id: targetSession.environment_id,
        });
        return NextResponse.json(
          { error: 'Failed to get environment adapter' },
          { status: 500 }
        );
      }
    }

    // プロセスが既に実行中かチェック
    let isRunning = false;
    if (adapter) {
      isRunning = adapter.hasSession(targetSession.id);
    } else {
      // レガシー: ProcessManager
      isRunning = processManager.hasProcess(targetSession.id);
    }

    if (isRunning) {
      logger.debug('Process already running', { session_id: id });
      return NextResponse.json({
        success: true,
        running: true,
        message: 'Process already running',
      });
    }

    // プロセスを起動
    if (adapter) {
      await adapter.createSession(
        targetSession.id,
        targetSession.worktree_path,
        undefined,
        { resumeSessionId: targetSession.resume_session_id ?? undefined }
      );
    } else {
      // レガシー: ProcessManager（promptなしで起動）
      await processManager.startClaudeCode({
        sessionId: targetSession.id,
        worktreePath: targetSession.worktree_path,
      });
    }

    // セッションのステータスをrunningに更新
    try {
      await db.update(schema.sessions)
        .set({
          status: 'running',
          last_activity_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(schema.sessions.id, targetSession.id))
        .run();
    } catch (dbError) {
      logger.error('Failed to update session status after starting process', {
        error: dbError,
        session_id: targetSession.id,
      });
      // プロセスを停止してクリーンアップ（起動時に取得したadapterを使用）
      if (adapter) {
        try {
          await adapter.destroySession(targetSession.id);
        } catch (err) {
          logger.error('Failed to destroy session after DB update failure', { error: err });
        }
      } else {
        await processManager.stopProcess(targetSession.id).catch((err) => {
          logger.error('Failed to stop process after DB update failure', { error: err });
        });
      }
      throw dbError;
    }

    logger.info('Process started successfully', { session_id: id });
    return NextResponse.json({ success: true, running: true });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to start process', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
