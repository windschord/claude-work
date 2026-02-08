import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, desc, and } from 'drizzle-orm';
import { GitService } from '@/services/git-service';
import { logger } from '@/lib/logger';
import { generateUniqueSessionName } from '@/lib/session-name-generator';
import { dockerService, DockerError } from '@/services/docker-service';
import { environmentService } from '@/services/environment-service';

/**
 * GET /api/projects/[project_id]/sessions - プロジェクトのセッション一覧取得
 *
 * 指定されたプロジェクトに属するすべてのセッションを作成日時の降順で取得します。
 *
 * @param params.project_id - プロジェクトID
 *
 * @returns
 * - 200: セッション一覧（統一形式）
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/projects/uuid-1234/sessions
 *
 * // レスポンス
 * {
 *   "sessions": [
 *     {
 *       "id": "session-uuid",
 *       "project_id": "uuid-1234",
 *       "name": "新機能実装",
 *       "status": "running",
 *       "worktree_path": "/path/to/worktrees/session-1234567890",
 *       "branch_name": "session/session-1234567890",
 *       "created_at": "2025-12-13T09:00:00.000Z"
 *     }
 *   ]
 * }
 * ```
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const { project_id } = await params;

    const sessions = await db.query.sessions.findMany({
      where: eq(schema.sessions.project_id, project_id),
      orderBy: desc(schema.sessions.created_at),
      with: {
        environment: {
          columns: {
            name: true,
            type: true,
          },
        },
      },
    });

    // フロントエンド用にフラット化した形式に変換
    const sessionsWithEnvironment = sessions.map((session: typeof sessions[number]) => ({
      ...session,
      environment_name: session.environment?.name || null,
      environment_type: session.environment?.type as 'HOST' | 'DOCKER' | 'SSH' | null,
      environment: undefined, // ネストされたオブジェクトは削除
    }));

    logger.debug('Sessions retrieved', { project_id, count: sessions.length });
    return NextResponse.json({ sessions: sessionsWithEnvironment });
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    logger.error('Failed to get sessions', { error, project_id: errorProjectId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[project_id]/sessions - 新規セッション作成
 *
 * 指定されたプロジェクトに新しいセッションを作成します。
 * Git worktreeとブランチが自動的に作成され、Claude Codeプロセスが起動されます。
 * セッション名が未指定の場合は「形容詞-動物名」形式で自動生成されます。
 *
 * @param request - リクエストボディに以下を含むJSON:
 *   - `prompt`（オプション）: 初期プロンプト
 *   - `name`（オプション、未指定時は自動生成）: セッション名
 *   - `dockerMode`（オプション、デフォルト: false）: Dockerモードで実行するかどうか
 * @param params.project_id - プロジェクトID
 *
 * @returns
 * - 201: セッション作成成功
 * - 400: nameまたはpromptが指定されていない
 * - 404: プロジェクトが見つからない
 * - 500: サーバーエラー
 * - 503: Docker未インストールまたは利用不可（dockerMode=true時）
 *
 * @example
 * ```typescript
 * // リクエスト（ローカルモード）
 * POST /api/projects/uuid-1234/sessions
 * Content-Type: application/json
 * {
 *   "name": "新機能実装",
 *   "prompt": "ユーザー認証機能を実装してください"
 * }
 *
 * // リクエスト（Dockerモード）
 * POST /api/projects/uuid-1234/sessions
 * Content-Type: application/json
 * {
 *   "name": "Dockerセッション",
 *   "prompt": "テストを実行してください",
 *   "dockerMode": true
 * }
 *
 * // レスポンス
 * {
 *   "session": {
 *     "id": "session-uuid",
 *     "project_id": "uuid-1234",
 *     "name": "新機能実装",
 *     "status": "running",
 *     "worktree_path": "/path/to/worktrees/session-1234567890",
 *     "branch_name": "session/session-1234567890",
 *     "docker_mode": false,
 *     "created_at": "2025-12-13T09:00:00.000Z"
 *   }
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  try {
    const { project_id } = await params;

    let body;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn('Invalid JSON in request body', { error, project_id });
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { name, prompt = '', dockerMode = false, environment_id, source_branch, claude_code_options, custom_env_vars } = body;

    // claude_code_options のバリデーション
    if (claude_code_options !== undefined) {
      if (typeof claude_code_options !== 'object' || claude_code_options === null || Array.isArray(claude_code_options)) {
        return NextResponse.json({ error: 'claude_code_options must be a plain object' }, { status: 400 });
      }
    }

    // custom_env_vars のバリデーション（plain objectかつ値がすべて文字列）
    if (custom_env_vars !== undefined) {
      if (typeof custom_env_vars !== 'object' || custom_env_vars === null || Array.isArray(custom_env_vars)) {
        return NextResponse.json({ error: 'custom_env_vars must be a plain object' }, { status: 400 });
      }
      for (const value of Object.values(custom_env_vars)) {
        if (typeof value !== 'string') {
          return NextResponse.json({ error: 'custom_env_vars values must be strings' }, { status: 400 });
        }
      }
    }

    // 実効環境とdockerModeを決定
    let effectiveEnvironmentId: string | null = null;
    let effectiveDockerMode = false;

    // パラメータ優先順位:
    // 1. environment_id が指定されていればそれを使用
    // 2. dockerMode=true かつ environment_id未指定 → レガシー動作（警告ログ出力）
    // 3. 両方未指定 → デフォルト環境（environment_id=null, docker_mode=false）

    if (environment_id) {
      // 新方式: environment_idを検証
      const env = await environmentService.findById(environment_id);
      if (!env) {
        return NextResponse.json({ error: 'Environment not found' }, { status: 400 });
      }
      effectiveEnvironmentId = environment_id;
      // environment_idが指定されていればdockerModeは無視
      logger.info('Creating session with environment', {
        project_id,
        environment_id,
        environmentType: env.type,
      });
    } else if (dockerMode) {
      // レガシー方式: 警告を出力しつつ従来動作を維持
      logger.warn('dockerMode parameter is deprecated, use environment_id instead', {
        project_id,
      });
      effectiveDockerMode = true;
    }

    // Dockerモードの場合（レガシー方式）、Docker可用性と認証情報をチェック
    if (effectiveDockerMode) {
      logger.info('Creating session with Docker mode', { project_id });

      // Docker環境診断
      const dockerError = await dockerService.diagnoseDockerError();
      if (dockerError) {
        logger.warn('Docker error diagnosed', {
          project_id,
          errorType: dockerError.errorType,
          message: dockerError.message,
        });
        return NextResponse.json(
          {
            error: dockerError.userMessage,
            errorType: dockerError.errorType,
            suggestion: dockerError.suggestion,
          },
          { status: 503 }
        );
      }

      // 認証情報チェック
      const authIssues = await dockerService.diagnoseAuthIssues();
      if (authIssues.length > 0) {
        logger.warn('Auth issues found for Docker mode', { project_id, issues: authIssues });
        // 警告としてログに記録するが、セッション作成は続行
        // （ユーザーがClaude認証を手動で行う場合もあるため）
      }

      // イメージ存在チェック、なければビルド
      const imageExists = await dockerService.imageExists();
      if (!imageExists) {
        logger.info('Docker image not found, building...', { project_id });
        try {
          await dockerService.buildImage();
          logger.info('Docker image built successfully', { project_id });
        } catch (buildError) {
          logger.error('Failed to build Docker image', { error: buildError, project_id });

          let errorMessage: string;
          let suggestion: string;

          if (buildError instanceof DockerError) {
            errorMessage = buildError.userMessage;
            suggestion = buildError.suggestion;
          } else if (buildError instanceof Error) {
            errorMessage = `Dockerイメージのビルドに失敗しました: ${buildError.message}`;
            suggestion = 'Dockerfileの構文を確認し、docker buildコマンドを手動で実行してエラーを確認してください';
          } else {
            errorMessage = 'Dockerイメージのビルドに失敗しました';
            suggestion = 'docker/Dockerfileを確認してください';
          }

          return NextResponse.json(
            {
              error: errorMessage,
              errorType: 'DOCKER_IMAGE_BUILD_FAILED',
              suggestion,
            },
            { status: 500 }
          );
        }
      }
    }

    // セッション名が未指定の場合は一意な名前を自動生成
    let sessionDisplayName: string;
    if (name?.trim()) {
      sessionDisplayName = name.trim();
      // ユーザー指定の名前も重複チェック
      const existingSession = db.select().from(schema.sessions).where(and(eq(schema.sessions.project_id, project_id), eq(schema.sessions.name, sessionDisplayName))).get();
      if (existingSession) {
        return NextResponse.json(
          { error: 'Session name already exists in this project' },
          { status: 400 }
        );
      }
    } else {
      // 既存のセッション名を取得して重複を避ける
      const existingSessions = db.select({ name: schema.sessions.name }).from(schema.sessions).where(eq(schema.sessions.project_id, project_id)).all();
      const existingNames = existingSessions.map((s) => s.name);
      sessionDisplayName = generateUniqueSessionName(existingNames);
    }

    const project = db.select().from(schema.projects).where(eq(schema.projects.id, project_id)).get();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const timestamp = Date.now();
    const sessionName = `session-${timestamp}`;
    const branchName = `session/${sessionName}`;

    const gitService = new GitService(project.path, logger);
    let worktreePath: string;

    try {
      worktreePath = gitService.createWorktree(sessionName, branchName, source_branch || undefined);
    } catch (worktreeError) {
      logger.error('Failed to create worktree', {
        error: worktreeError,
        project_id,
        sessionName,
      });
      throw worktreeError;
    }

    const newSession = db.insert(schema.sessions).values({
      project_id,
      name: sessionDisplayName,
      status: 'initializing',  // PTY接続時に'running'に変更される
      worktree_path: worktreePath,
      branch_name: branchName,
      docker_mode: effectiveDockerMode,
      environment_id: effectiveEnvironmentId,
      claude_code_options: claude_code_options ? JSON.stringify(claude_code_options) : null,
      custom_env_vars: custom_env_vars ? JSON.stringify(custom_env_vars) : null,
    }).returning().get();

    if (!newSession) {
      throw new Error('Failed to create session');
    }

    // プロンプトが存在する場合のみ保存または更新
    if (prompt && prompt.trim()) {
      const existingPrompt = db.select().from(schema.prompts).where(eq(schema.prompts.content, prompt)).get();

      if (existingPrompt) {
        db.update(schema.prompts).set({
          used_count: existingPrompt.used_count + 1,
          last_used_at: new Date(),
          updated_at: new Date(),
        }).where(eq(schema.prompts.id, existingPrompt.id)).run();
      } else {
        db.insert(schema.prompts).values({
          content: prompt,
          used_count: 1,
          last_used_at: new Date(),
        }).run();
      }

      // 初期プロンプトをユーザーメッセージとして保存
      // WebSocket接続時にこのメッセージがClaude PTYに送信される
      db.insert(schema.messages).values({
        session_id: newSession.id,
        role: 'user',
        content: prompt,
      }).run();
    }

    logger.info('Session created', {
      id: newSession.id,
      name: sessionDisplayName,
      project_id,
      worktree_path: worktreePath,
      source_branch: source_branch || undefined,
    });

    return NextResponse.json({ session: newSession }, { status: 201 });
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    logger.error('Failed to create session', { error, project_id: errorProjectId });

    // 開発環境では詳細なエラーメッセージを返す
    if (process.env.NODE_ENV === 'development') {
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      return NextResponse.json(
        {
          error: errorMessage,
          details: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
