# セッション作成エラー調査レポート

調査日時: 2025-12-17
調査対象: タスク10.1 - セッション作成500エラーの原因調査

## エラー概要

セッション作成リクエスト（POST `/api/projects/{project_id}/sessions`）が500エラーで失敗する問題が発生しています。

### エラー詳細

```
POST http://localhost:3000/api/projects/bb75e609-4e1a-4167-a11e-0e461a878934/sessions
Status: 500 Internal Server Error

Request Body:
{
  "name": "テストセッション",
  "prompt": "Hello, Claude! これはテストです。",
  "model": "auto"
}

Response Body:
{
  "error": "Internal server error"
}
```

## 調査結果

### 1. サーバーログ

**状態**: サーバーが起動していないため、実行時のログを直接取得できませんでした。

**確認事項**:
- サーバープロセスは現在停止中
- 過去のログファイルは確認できず

**推奨アクション**:
- サーバーを起動してエラーを再現し、コンソールログを確認する必要がある
- エラー発生時のスタックトレースを取得する

### 2. データベース状態

**状態**: ✅ 正常

**確認結果**:
```bash
# データベースファイルの存在確認
$ ls -lh /Users/tsk/Sync/git/claude-work/prisma/data/
-rw-r--r--@ 1 tsk  staff    80K 12月 17 07:34 claudework.db  # メインDB
-rw-r--r--@ 1 tsk  staff     0B 12月 17 08:07 dev.db         # 空ファイル
-rw-r--r--@ 1 tsk  staff    64K 12月 17 08:26 test.db       # テスト用DB

# マイグレーション状態
$ npx prisma migrate status
Database schema is up to date!

# テーブルの存在確認
$ sqlite3 claudework.db "SELECT name FROM sqlite_master WHERE type='table';"
_prisma_migrations
Session
Message
AuthSession
Prompt
RunScript
Project

# プロジェクトデータの確認
$ sqlite3 claudework.db "SELECT id, name, path FROM Project;"
bb75e609-4e1a-4167-a11e-0e461a878934|claude-work|/Users/tsk/Sync/git/claude-work
```

**分析**:
- メインデータベース `claudework.db` は正常に存在し、80KBのサイズがある
- すべての必要なテーブルが作成済み
- テスト対象のプロジェクト（bb75e609-4e1a-4167-a11e-0e461a878934）が存在する
- マイグレーションは最新状態

**問題点**:
- `dev.db` が0バイトの空ファイルとして存在している
- これは初期化に失敗した可能性を示唆しているが、使用されているのは `claudework.db` なので影響なし

### 3. 環境変数

**状態**: ⚠️ 一部確認不可

**確認結果**:
```bash
# .envファイルへのアクセス
$ cat .env
Permission denied (セキュリティ制約のため読み取り不可)

# Prisma設定から推測されるDATABASE_URL
DATABASE_URL=file:./data/claudework.db

# Claude Codeパスの確認
$ which claude
claude: aliased to /Users/tsk/.claude/local/claude
```

**分析**:
- `DATABASE_URL` は正しく設定されている（マイグレーション成功から推測）
- Claude Codeコマンドは `/Users/tsk/.claude/local/claude` に存在
- `CLAUDE_CODE_PATH` 環境変数の設定は確認できないが、コードでは `process.env.CLAUDE_CODE_PATH || 'claude'` とデフォルト値を持つ

**潜在的な問題**:
- `.env` ファイルが適切に読み込まれているか確認が必要
- `CLAUDE_CODE_PATH` が設定されていない場合、デフォルトの `'claude'` が使用される
- エイリアスは環境変数として認識されないため、フルパスを設定する必要がある可能性

### 4. Git worktree

**状態**: ✅ ディレクトリは正常

**確認結果**:
```bash
# worktreeディレクトリの確認
$ ls -la .worktrees/
drwxr-xr-x@  2 tsk  staff   64 12月 17 07:34 .
drwxr-xr-x  38 tsk  staff 1216 12月 17 08:10 ..

# 権限確認（テスト作成・削除）
# ※セキュリティ制約により実行不可だったが、ディレクトリ権限は正常
```

**分析**:
- `.worktrees/` ディレクトリは存在し、空の状態
- ディレクトリ権限は `drwxr-xr-x` で読み書き実行可能
- 過去にworktreeが作成された形跡はなし（クリーンな状態）

**潜在的な問題**:
- Git worktree作成時のエラーハンドリングを確認する必要がある
- プロジェクトパス `/Users/tsk/Sync/git/claude-work` が有効なGitリポジトリか確認が必要

**Git設定の確認**:
```bash
$ git config --get user.email
1859918+windschord@users.noreply.github.com
```
- Git設定は正常（ユーザー情報が設定済み）

### 5. Prismaクライアントの初期化状態

**状態**: ✅ 正常に実装済み

**コード確認**: `/Users/tsk/Sync/git/claude-work/src/lib/db.ts`

```typescript
// デフォルトのDATABASE_URL設定
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./data/test.db';
}

// シングルトンパターンでインスタンス管理
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
```

**分析**:
- Prismaクライアントは適切にシングルトンパターンで実装されている
- 環境変数 `DATABASE_URL` が未設定の場合、テスト用DBにフォールバックする
- 開発環境ではクエリログが有効化されている

**問題点**:
- 特に問題は見つからず

## 根本原因の推定

コードレビューとファイル確認から、以下の原因が考えられます:

### 🔴 最も可能性が高い原因

**1. Claude Codeプロセスの起動失敗**

**根拠**:
- `process-manager.ts` の `startClaudeCode()` メソッドで、環境変数 `CLAUDE_CODE_PATH` を使用
- デフォルト値は `'claude'` だが、実際のコマンドは `/Users/tsk/.claude/local/claude` にエイリアスされている
- Node.jsの `spawn()` はシェルエイリアスを認識しないため、ENOENTエラーが発生する可能性が高い

**該当コード**: `/Users/tsk/Sync/git/claude-work/src/services/process-manager.ts:100-104`
```typescript
const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';

const childProc = spawn(claudeCodePath, args, {
  stdio: ['pipe', 'pipe', 'pipe'],
});
```

**エラーハンドリング**:
```typescript
childProc.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'ENOENT') {
    reject(new Error('Claude Codeが見つかりません。環境変数CLAUDE_CODE_PATHを確認してください。'));
  } else {
    reject(error);
  }
});
```

**問題点**:
- このエラーは非同期で発生し、適切にキャッチされる
- しかし、API route の `POST` ハンドラー内で例外がスローされ、500エラーとして返される
- エラーメッセージ「Claude Codeが見つかりません」がクライアントに返されるべきだが、現在は "Internal server error" のみ

### 🟡 その他の可能性

**2. Git worktree作成の失敗**

**可能性**: 低い

**根拠**:
- `.worktrees/` ディレクトリは正常に存在
- Git設定も正常
- しかし、worktree作成は同期処理 (`spawnSync`) なので、失敗した場合は即座に例外がスローされる

**3. データベース書き込みエラー**

**可能性**: 極めて低い

**根拠**:
- データベースは正常に動作している
- テーブルも正しく作成されている
- プロジェクトデータも存在する

## セッション作成APIフローの分析

`/Users/tsk/Sync/git/claude-work/src/app/api/projects/[project_id]/sessions/route.ts:118-226`

### 処理フロー

1. **認証チェック** (118-131行)
   - ✅ 問題なし

2. **リクエストボディのパース** (135-141行)
   - ✅ 問題なし（JSONパースエラーは400を返す）

3. **バリデーション** (143-150行)
   - ✅ 問題なし（必須パラメータチェック）

4. **プロジェクト存在確認** (152-158行)
   - ✅ データベースは正常なので問題なし

5. **Git worktree作成** (160-176行)
   - ⚠️ 失敗した場合、例外がスローされてcatchブロックへ
   - エラーはログに記録され、500エラーが返される

6. **セッションDB登録** (178-187行)
   - ✅ データベースは正常なので問題なし

7. **Claude Codeプロセス起動** (189-220行)
   - 🔴 **ここが最も問題が発生しやすい箇所**
   - 失敗した場合、worktreeをクリーンアップしてセッションをerror状態に更新
   - その後、例外を再スロー → catchブロックで500エラー

8. **エラーハンドリング** (221-225行)
   - すべてのエラーをキャッチし、"Internal server error" を返す
   - **問題**: 具体的なエラーメッセージがクライアントに返されない

## 推奨される修正方法

### 1. 環境変数 `CLAUDE_CODE_PATH` の設定（最優先）

**方法A**: `.env` ファイルに追加
```bash
CLAUDE_CODE_PATH=/Users/tsk/.claude/local/claude
```

**方法B**: システム環境変数として設定
```bash
export CLAUDE_CODE_PATH=/Users/tsk/.claude/local/claude
```

### 2. エラーハンドリングの改善

**現在のコード**:
```typescript
} catch (error) {
  const { project_id: errorProjectId } = await params;
  logger.error('Failed to create session', { error, project_id: errorProjectId });
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

**推奨される改善**:
```typescript
} catch (error) {
  const { project_id: errorProjectId } = await params;
  logger.error('Failed to create session', { error, project_id: errorProjectId });

  // エラーメッセージをクライアントに返す（開発環境のみ）
  const errorMessage = error instanceof Error ? error.message : 'Internal server error';

  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json({
      error: errorMessage,
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }

  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

### 3. 動作確認手順

修正後、以下の手順で動作確認を行う:

1. `.env` ファイルに `CLAUDE_CODE_PATH` を追加
2. サーバーを再起動
3. セッション作成APIを実行
4. エラーが解消されることを確認
5. Claude Codeプロセスが正常に起動することを確認

## まとめ

### 確認できた事項

- ✅ データベースは正常に動作している
- ✅ Git worktreeディレクトリは正常に存在している
- ✅ Prismaクライアントは適切に実装されている
- ✅ Git設定は正常

### 確認できなかった事項

- ❌ 実際のサーバーログ（サーバー停止中のため）
- ⚠️ `.env` ファイルの内容（セキュリティ制約のため）
- ⚠️ worktreeディレクトリへの書き込み権限（テスト実行制約のため）

### 最も可能性の高い根本原因

**Claude Codeプロセスの起動失敗** - 環境変数 `CLAUDE_CODE_PATH` が未設定または不正な値

**推奨される修正**:
1. `.env` に `CLAUDE_CODE_PATH=/Users/tsk/.claude/local/claude` を追加
2. エラーハンドリングを改善して詳細なエラーメッセージを返すようにする
3. サーバーを起動して実際のエラーログを確認する

### 次のタスク（10.2）に必要な情報

以下の情報が揃っています:

- ✅ エラーが発生している処理フロー
- ✅ 最も可能性の高い根本原因
- ✅ 推奨される修正方法
- ✅ 動作確認手順

タスク10.2では、まず環境変数の設定を行い、その後エラーハンドリングの改善を実装することを推奨します。
