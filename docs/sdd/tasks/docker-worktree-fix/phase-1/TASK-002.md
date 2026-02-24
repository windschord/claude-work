# TASK-002: エラーハンドリングの改善

## 説明

git操作とPTY作成のエラーハンドリングを改善し、無限ループとサーバークラッシュを防ぐ。

## 対象ファイル

- `src/services/docker-git-service.ts`
- `src/services/pty-session-manager.ts`
- `src/app/api/sessions/[id]/commits/route.ts`

## 技術的文脈

- git操作失敗時の再試行制限（最大3回）
- エラー発生時のセッションステータス更新
- 適切なエラーログ出力

## 実装手順

### 1. DockerGitServiceのエラーハンドリング改善

**ファイル**: `src/services/docker-git-service.ts`

```typescript
async getCommits(projectId: string, sessionName: string): Promise<Commit[]> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // git log実行
      const result = await this.executeGitCommand(/* ... */);
      return parseCommits(result.stdout);
    } catch (error) {
      lastError = error as Error;
      logger.warn(`Git operation failed (attempt ${attempt}/${maxRetries})`, {
        projectId,
        sessionName,
        error: lastError.message,
      });

      // ディレクトリ不在エラーの場合は再試行しない
      if (lastError.message.includes('No such file or directory')) {
        logger.error('Worktree directory does not exist, aborting retries', {
          projectId,
          sessionName,
        });
        break;
      }

      if (attempt < maxRetries) {
        await sleep(1000 * attempt);  // バックオフ
      }
    }
  }

  // すべての再試行が失敗
  throw new GitOperationError(
    `Git operation failed after ${maxRetries} attempts: ${lastError?.message}`,
    'docker',
    'commits'
  );
}
```

### 2. PTYSessionManagerのエラーハンドリング

**ファイル**: `src/services/pty-session-manager.ts`

```typescript
async createSession(options: SessionOptions): Promise<PTYSession> {
  try {
    const adapter = AdapterFactory.getAdapter(environmentType);
    const ptyProcess = await adapter.spawnPTY(options);

    // 成功時のセッションステータス更新
    await db.update(sessions)
      .set({ status: 'running' })
      .where(eq(sessions.id, options.sessionId));

    return {
      id: options.sessionId,
      adapter,
      environmentType,
      metadata: { /* ... */ },
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };
  } catch (error) {
    // エラー時のセッションステータス更新
    await db.update(sessions)
      .set({ status: 'error' })
      .where(eq(sessions.id, options.sessionId));

    logger.error('Failed to create PTY session', {
      sessionId: options.sessionId,
      error,
    });

    throw error;
  }
}
```

### 3. Commits APIのエラーハンドリング

**ファイル**: `src/app/api/sessions/[id]/commits/route.ts`

無限ループを防ぐため、エラー時は即座にエラーレスポンスを返す。

```typescript
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // ... git操作 ...
  } catch (error) {
    logger.error('Failed to get commits', { sessionId: id, error });

    // エラーレスポンスを返して終了（再試行しない）
    return NextResponse.json(
      { error: 'Failed to get commits', commits: [] },
      { status: 500 }
    );
  }
}
```

## 受入基準

- [ ] git操作の再試行回数が3回に制限されている
- [ ] ディレクトリ不在エラーで即座に失敗する
- [ ] PTY作成失敗時にセッションステータスが`error`になる
- [ ] エラーログに十分な情報が記録される
- [ ] サーバーがクラッシュしない

## 依存関係

TASK-001

## 推定工数

30分

## ステータス

`DONE`

**完了サマリー**: DockerGitServiceにretryWithBackoff（指数バックオフ、最大3回リトライ、永続エラー検出）を実装。PTYSessionManagerは既にPTY作成失敗時のセッションステータス更新（error）とクリーンアップを実装済み。Commits APIも存在チェックで無限ループを防止済み。テスト17件（既存8+リトライ9）全通過。
