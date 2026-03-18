import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, desc, and } from 'drizzle-orm';
import { GitService } from '@/services/git-service';
import { logger } from '@/lib/logger';
import { generateUniqueSessionName } from '@/lib/session-name-generator';
import { environmentService } from '@/services/environment-service';
import { ClaudeOptionsService } from '@/services/claude-options-service';
import { isHostEnvironmentAllowed } from '@/lib/environment-detect';

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
        project: {
          columns: {
            environment_id: true,
          },
          with: {
            environment: {
              columns: {
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    // フロントエンド用にフラット化した形式に変換
    const sessionsWithEnvironment = sessions.map((session: typeof sessions[number]) => ({
      ...session,
      environment_name: session.project?.environment?.name || null,
      environment_type: session.project?.environment?.type as 'HOST' | 'DOCKER' | 'SSH' | null,
      project: undefined, // ネストされたオブジェクトは削除
    }));

    logger.debug('Sessions retrieved', { project_id, count: sessions.length });
    return NextResponse.json({ sessions: sessionsWithEnvironment });
  } catch (error) {
    const { project_id: errorProjectId } = await params;
    logger.error('Failed to get sessions', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      project_id: errorProjectId,
    });
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
 *   - `source_branch`（オプション）: ブランチ作成元ブランチ名
 * @param params.project_id - プロジェクトID
 *
 * @returns
 * - 201: セッション作成成功
 * - 400: 不正なJSONボディ、型バリデーションエラー、環境未設定、セッション名重複
 * - 403: Docker環境内でのHOST環境利用（禁止）
 * - 404: プロジェクトまたは環境が見つからない
 * - 500: サーバーエラー
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
 * // レスポンス
 * {
 *   "session": {
 *     "id": "session-uuid",
 *     "project_id": "uuid-1234",
 *     "name": "新機能実装",
 *     "status": "running",
 *     "worktree_path": "/path/to/worktrees/session-1234567890",
 *     "branch_name": "session/session-1234567890",
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

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be a JSON object' },
        { status: 400 }
      );
    }

    let { claude_code_options, custom_env_vars } = body as Record<string, unknown>;
    const { name: rawName, prompt: rawPrompt, source_branch: rawSourceBranch } = body as Record<string, unknown>;

    // name, prompt, source_branch の型バリデーション
    if (rawName !== undefined && typeof rawName !== 'string') {
      return NextResponse.json({ error: 'name must be a string' }, { status: 400 });
    }
    if (rawPrompt !== undefined && typeof rawPrompt !== 'string') {
      return NextResponse.json({ error: 'prompt must be a string' }, { status: 400 });
    }
    if (rawSourceBranch !== undefined && typeof rawSourceBranch !== 'string') {
      return NextResponse.json({ error: 'source_branch must be a string' }, { status: 400 });
    }
    const name = rawName as string | undefined;
    const prompt = (rawPrompt as string) ?? '';
    const source_branch = rawSourceBranch as string | undefined;

    // claude_code_options のバリデーション（各フィールドが文字列であることを検証）
    if (claude_code_options !== undefined) {
      const validatedOptions = ClaudeOptionsService.validateClaudeCodeOptions(claude_code_options);
      if (validatedOptions === null) {
        const unknownKeys = ClaudeOptionsService.getUnknownKeys(claude_code_options);
        const errorMessage = unknownKeys.length > 0
          ? `Invalid keys in claude_code_options: ${unknownKeys.join(', ')}. Allowed keys: model, allowedTools, permissionMode, additionalFlags, dangerouslySkipPermissions, worktree`
          : 'claude_code_options must be a plain object with valid fields (model, allowedTools, permissionMode, additionalFlags, dangerouslySkipPermissions, worktree)';
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        );
      }
      // バリデーション済みの値で上書き
      claude_code_options = validatedOptions;
    }

    // custom_env_vars のバリデーション（キーが^[A-Z_][A-Z0-9_]*$にマッチし、値が文字列であることを検証）
    if (custom_env_vars !== undefined) {
      const validatedEnvVars = ClaudeOptionsService.validateCustomEnvVars(custom_env_vars);
      if (validatedEnvVars === null) {
        return NextResponse.json(
          { error: 'custom_env_vars must be a plain object with keys matching ^[A-Z_][A-Z0-9_]*$ and string values' },
          { status: 400 }
        );
      }
      // バリデーション済みの値で上書き
      custom_env_vars = validatedEnvVars;
    }

    // プロジェクト情報を早期に取得（clone_location確認のため）
    const project = db.select().from(schema.projects).where(eq(schema.projects.id, project_id)).get();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // プロジェクトに紐付く環境を取得（1対1関係）
    let effectiveEnvironmentType: string | null = null;

    const env = await environmentService.findByProjectId(project_id);
    if (!env) {
      return NextResponse.json(
        { error: 'プロジェクトに実行環境が設定されていません。プロジェクト設定で環境を確認してください。' },
        { status: 400 }
      );
    }
    effectiveEnvironmentType = env.type;
    logger.info('Using project environment', {
      project_id,
      environment_id: env.id,
      environmentType: env.type,
    });

    // Docker環境プロジェクトのボリュームIDバリデーション
    if (project.clone_location === 'docker' && !project.docker_volume_id) {
      return NextResponse.json(
        {
          error: 'Docker volume not configured',
          message: 'このプロジェクトはDocker環境(clone_location=docker)ですが、Dockerボリュームが設定されていません。プロジェクトを削除して再作成してください。',
        },
        { status: 400 },
      );
    }

    // HOST環境の利用制限チェック（キャッシュ済みのtypeを使用してDB再クエリを回避）
    if (!isHostEnvironmentAllowed() && effectiveEnvironmentType === 'HOST') {
      return NextResponse.json(
        { error: 'Docker環境内ではHOST環境でのセッション作成はできません' },
        { status: 403 }
      );
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

    const timestamp = Date.now();
    const sessionName = `session-${timestamp}`;

    // worktreeオプション判定（worktree作成スキップ判定のための簡易マージ）
    const projectOptions = ClaudeOptionsService.parseOptions(project.claude_code_options);
    const sessionWorktreeOptions = claude_code_options || {};
    const mergedForWorktreeCheck = ClaudeOptionsService.mergeOptions(projectOptions, sessionWorktreeOptions);
    const useClaudeWorktree = ClaudeOptionsService.hasWorktreeOption(mergedForWorktreeCheck);

    let worktreePath: string;
    let branchName: string;

    if (useClaudeWorktree) {
      // Claude Codeがworktreeを管理するため、プロジェクトパスをそのまま使用
      if (project.clone_location === 'docker') {
        worktreePath = '/repo';
      } else {
        worktreePath = project.path;
      }
      branchName = '';
      logger.info('Using Claude Code --worktree mode, skipping manual worktree creation', {
        project_id,
        sessionName,
      });
    } else {
      branchName = `session/${sessionName}`;

      try {
        if (project.clone_location === 'docker') {
          // Docker環境でcloneされたプロジェクト → DockerGitServiceを使用
          const { DockerGitService } = await import('@/services/docker-git-service');
          const dockerGitService = new DockerGitService();

          // NOTE: source_branch は現在 DockerGitService では未対応のため無視される。
          // DockerGitService.createWorktree は GitWorktreeOptions に source_branch フィールドを
          // 持たず、Docker内で git worktree add を実行する際にブランチ元を指定する仕組みがない。
          // 対応が必要な場合は DockerGitService と GitWorktreeOptions を拡張すること。
          const result = await dockerGitService.createWorktree({
            projectId: project.id,
            sessionName: sessionName,
            branchName: branchName,
            dockerVolumeId: project.docker_volume_id,
          });

          if (!result.success) {
            throw result.error || new Error('Failed to create worktree in Docker environment');
          }

          // Docker環境の場合、worktreeパスはDockerボリューム内のパス
          worktreePath = `/repo/.worktrees/${sessionName}`;

          logger.info('Created worktree in Docker volume', {
            project_id,
            sessionName,
            volumeName: project.docker_volume_id || `claude-repo-${project.id}`,
          });
        } else {
          // Host環境でcloneされたプロジェクト → GitServiceを使用
          const gitService = new GitService(project.path, logger);
          worktreePath = gitService.createWorktree(sessionName, source_branch || undefined);

          logger.info('Created worktree on host filesystem', {
            project_id,
            sessionName,
            worktreePath,
          });
        }
      } catch (worktreeError) {
        logger.error('Failed to create worktree', {
          errorMessage: worktreeError instanceof Error ? worktreeError.message : String(worktreeError),
          errorStack: worktreeError instanceof Error ? worktreeError.stack : undefined,
          project_id,
          sessionName,
          clone_location: project.clone_location,
        });
        throw worktreeError;
      }
    }

    const newSession = db.insert(schema.sessions).values({
      project_id,
      name: sessionDisplayName,
      status: 'initializing',  // PTY接続時に'running'に変更される
      worktree_path: worktreePath,
      branch_name: branchName,
      // environment_id は sessions テーブルから削除済み（1対1化によりプロジェクトから取得）
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
    logger.error('Failed to create session', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      project_id: errorProjectId,
    });

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
