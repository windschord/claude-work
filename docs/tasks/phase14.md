# フェーズ14: Phase 13マージ後の環境変数設定改善とPR #2 Actions修正

推定期間: 105分（AIエージェント作業時間）
MVP: Yes

## 概要

Phase 13マージ後の動作検証で発見された環境変数設定の問題を修正し、PR #2のGitHub Actions失敗を解決します。
サーバー起動時の環境変数チェックとログインAPIのエラーメッセージを改善し、開発者体験を向上させます。

**参照**:
- `docs/verification-report-phase13-post-merge.md`
- PR #2: https://github.com/windschord/claude-work/pull/2

---

## タスク14.1: サーバー起動時の環境変数チェック追加

**優先度**: Critical
**推定工数**: 40分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

サーバー起動時に必須環境変数（`CLAUDE_WORK_TOKEN`、`SESSION_SECRET`）をチェックし、未設定の場合は明確なエラーメッセージを表示してサーバーを起動しないようにします。Phase 13で実装した`DATABASE_URL`チェックと同様のアプローチを採用します。

**現在の問題**:
- `.env`ファイルが未作成の場合、サーバーは起動するがログインできない
- 環境変数未設定時のエラーメッセージが不明確
- 開発者がログイン画面まで進んで初めて問題に気づく

**修正内容**:
- `server.ts`に環境変数チェック機能を追加
- 未設定時に詳細なエラーメッセージを表示
- セットアップ手順を明記したエラーメッセージ

### 実装手順

1. **TDD: テストの作成**

   `src/lib/__tests__/env-validation.test.ts`を作成し、環境変数バリデーションのテストを実装：

   ```typescript
   import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

   describe('環境変数バリデーション', () => {
     const originalEnv = process.env;

     beforeEach(() => {
       vi.resetModules();
       process.env = { ...originalEnv };
     });

     afterEach(() => {
       process.env = originalEnv;
     });

     it('すべての必須環境変数が設定されている場合、エラーをスローしない', () => {
       process.env.CLAUDE_WORK_TOKEN = 'test-token';
       process.env.SESSION_SECRET = 'test-secret-32-characters-long';
       process.env.DATABASE_URL = 'file:./prisma/data/test.db';

       expect(() => {
         // バリデーション関数を呼び出す
         require('../env-validation').validateRequiredEnvVars();
       }).not.toThrow();
     });

     it('CLAUDE_WORK_TOKENが未設定の場合、エラーをスローする', () => {
       delete process.env.CLAUDE_WORK_TOKEN;
       process.env.SESSION_SECRET = 'test-secret-32-characters-long';
       process.env.DATABASE_URL = 'file:./prisma/data/test.db';

       expect(() => {
         require('../env-validation').validateRequiredEnvVars();
       }).toThrow('CLAUDE_WORK_TOKEN environment variable is not set');
     });

     it('SESSION_SECRETが未設定の場合、エラーをスローする', () => {
       process.env.CLAUDE_WORK_TOKEN = 'test-token';
       delete process.env.SESSION_SECRET;
       process.env.DATABASE_URL = 'file:./prisma/data/test.db';

       expect(() => {
         require('../env-validation').validateRequiredEnvVars();
       }).toThrow('SESSION_SECRET environment variable is not set');
     });

     it('SESSION_SECRETが32文字未満の場合、エラーをスローする', () => {
       process.env.CLAUDE_WORK_TOKEN = 'test-token';
       process.env.SESSION_SECRET = 'short';
       process.env.DATABASE_URL = 'file:./prisma/data/test.db';

       expect(() => {
         require('../env-validation').validateRequiredEnvVars();
       }).toThrow('SESSION_SECRET must be at least 32 characters');
     });

     it('DATABASE_URLが未設定の場合、エラーをスローする', () => {
       process.env.CLAUDE_WORK_TOKEN = 'test-token';
       process.env.SESSION_SECRET = 'test-secret-32-characters-long';
       delete process.env.DATABASE_URL;

       expect(() => {
         require('../env-validation').validateRequiredEnvVars();
       }).toThrow('DATABASE_URL environment variable is not set');
     });

     it('複数の環境変数が未設定の場合、すべてのエラーを含むメッセージをスローする', () => {
       delete process.env.CLAUDE_WORK_TOKEN;
       delete process.env.SESSION_SECRET;
       delete process.env.DATABASE_URL;

       expect(() => {
         require('../env-validation').validateRequiredEnvVars();
       }).toThrow(/CLAUDE_WORK_TOKEN.*SESSION_SECRET.*DATABASE_URL/s);
     });
   });
   ```

2. **テストの実行と失敗確認**:
   ```bash
   npm test src/lib/__tests__/env-validation.test.ts
   ```

3. **テストのコミット**:
   ```bash
   git add src/lib/__tests__/env-validation.test.ts
   git commit -m "test: 環境変数バリデーションのテストを追加

- CLAUDE_WORK_TOKEN必須チェック
- SESSION_SECRET必須チェックと長さ検証
- DATABASE_URL必須チェック
- 複数エラー時の統合メッセージ

参照: docs/verification-report-phase13-post-merge.md 問題2"
   ```

4. **src/lib/env-validation.tsの実装**:

   新規ファイル`src/lib/env-validation.ts`を作成：

   ```typescript
   /**
    * 必須環境変数のバリデーション
    *
    * サーバー起動時に必須の環境変数が設定されているか確認します。
    * 未設定の場合は詳細なエラーメッセージを表示します。
    */

   interface EnvValidationError {
     variable: string;
     message: string;
   }

   export function validateRequiredEnvVars(): void {
     const errors: EnvValidationError[] = [];

     // CLAUDE_WORK_TOKENのチェック
     if (!process.env.CLAUDE_WORK_TOKEN || process.env.CLAUDE_WORK_TOKEN.trim() === '') {
       errors.push({
         variable: 'CLAUDE_WORK_TOKEN',
         message: 'CLAUDE_WORK_TOKEN environment variable is not set. This is required for authentication.',
       });
     }

     // SESSION_SECRETのチェック
     if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.trim() === '') {
       errors.push({
         variable: 'SESSION_SECRET',
         message: 'SESSION_SECRET environment variable is not set. This is required for session management.',
       });
     } else if (process.env.SESSION_SECRET.length < 32) {
       errors.push({
         variable: 'SESSION_SECRET',
         message: 'SESSION_SECRET must be at least 32 characters long for security.',
       });
     }

     // DATABASE_URLのチェック
     if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
       errors.push({
         variable: 'DATABASE_URL',
         message: 'DATABASE_URL environment variable is not set. This is required for database connection.',
       });
     }

     // エラーがある場合は詳細なメッセージを表示
     if (errors.length > 0) {
       const errorMessages = errors.map(e => `  - ${e.variable}: ${e.message}`).join('\n');

       throw new Error(
         `Missing required environment variables:\n\n${errorMessages}\n\n` +
         'Please follow these steps:\n' +
         '1. Copy .env.example to .env:\n' +
         '   cp .env.example .env\n\n' +
         '2. Edit .env and set the required variables:\n' +
         '   - CLAUDE_WORK_TOKEN: A secure random token for authentication\n' +
         '   - SESSION_SECRET: A 32+ character secret for session encryption\n' +
         '   - DATABASE_URL: Database connection URL (e.g., file:./prisma/data/claudework.db)\n\n' +
         'For more details, see README.md and docs/ENV_VARS.md'
       );
     }
   }
   ```

5. **server.tsに環境変数チェックを追加**:

   `server.ts`の先頭（他のimportの後）に以下を追加：

   ```typescript
   import { validateRequiredEnvVars } from '@/lib/env-validation';

   // 環境変数のバリデーション（サーバー起動前）
   try {
     validateRequiredEnvVars();
   } catch (error) {
     if (error instanceof Error) {
       console.error('\n❌ Environment variable validation failed:\n');
       console.error(error.message);
     }
     process.exit(1);
   }
   ```

6. **テストの再実行と通過確認**:
   ```bash
   npm test src/lib/__tests__/env-validation.test.ts
   ```

7. **実装のコミット**:
   ```bash
   git add src/lib/env-validation.ts server.ts
   git commit -m "fix: サーバー起動時の環境変数チェックを追加

- CLAUDE_WORK_TOKEN、SESSION_SECRET、DATABASE_URLを必須化
- 未設定時に詳細なエラーメッセージとセットアップ手順を表示
- SESSION_SECRETの長さ検証（32文字以上）を追加
- 複数エラー時は全エラーを一度に表示

参照: docs/verification-report-phase13-post-merge.md 問題2"
   ```

8. **動作確認**:
   ```bash
   # 環境変数を未設定にしてサーバー起動を試みる
   # エラーメッセージが表示されることを確認
   mv .env .env.backup || true
   npm run dev

   # 環境変数を設定してサーバー起動
   mv .env.backup .env || true
   npm run dev
   # 正常に起動することを確認
   ```

### 受入基準

- [ ] `src/lib/env-validation.ts`が作成されている
- [ ] `src/lib/__tests__/env-validation.test.ts`が作成されている
- [ ] テストが6つ含まれている
- [ ] テストのみのコミットが存在する
- [ ] `server.ts`に環境変数チェックが追加されている
- [ ] すべてのテストが通過する（`npm test`）
- [ ] 実装のコミットが存在する
- [ ] 環境変数未設定時にサーバーが起動せず、詳細なエラーメッセージが表示される
- [ ] エラーメッセージにセットアップ手順が含まれている
- [ ] 環境変数設定後は正常に起動する

### 依存関係

なし

### 情報の明確性

**明示された情報**:
- 問題: 環境変数未設定時のエラーメッセージが不明確
- 必須環境変数: `CLAUDE_WORK_TOKEN`、`SESSION_SECRET`、`DATABASE_URL`
- 実装方針: サーバー起動時にチェック（ユーザー確認済み）
- 参考実装: Phase 13の`DATABASE_URL`チェック（`src/lib/db.ts`）
- セキュリティ要件: `SESSION_SECRET`は32文字以上

**不明/要確認の情報**:
- なし（ユーザーに確認済み）

---

## タスク14.2: ログインAPIのエラーメッセージ改善

**優先度**: Medium
**推定工数**: 30分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

ログインAPIのエラーメッセージを改善し、トークンが無効な場合に詳細な情報を提供します。現在の「トークンが無効です」というメッセージをより具体的にします。

**現在の問題**:
- エラーメッセージが不明確（「トークンが無効です」のみ）
- トークンが未設定なのか、入力が間違っているのか判別できない
- デバッグが困難

**修正内容**:
- ログインAPIのエラーメッセージを詳細化
- サーバー側のログを改善

### 実装手順

1. **TDD: テストの作成**

   `src/app/api/auth/login/__tests__/route.test.ts`に新しいテストケースを追加：

   ```typescript
   describe('POST /api/auth/login - エラーメッセージ', () => {
     it('トークンが設定されていない場合、詳細なエラーメッセージを返す', async () => {
       // CLAUDE_WORK_TOKENを一時的に削除
       const originalToken = process.env.CLAUDE_WORK_TOKEN;
       delete process.env.CLAUDE_WORK_TOKEN;

       const response = await POST(
         new NextRequest('http://localhost:3000/api/auth/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ token: 'any-token' }),
         })
       );

       expect(response.status).toBe(500);
       const data = await response.json();
       expect(data.message).toContain('Server configuration error');

       // 環境変数を復元
       process.env.CLAUDE_WORK_TOKEN = originalToken;
     });

     it('入力トークンが空の場合、適切なエラーメッセージを返す', async () => {
       const response = await POST(
         new NextRequest('http://localhost:3000/api/auth/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ token: '' }),
         })
       );

       expect(response.status).toBe(400);
       const data = await response.json();
       expect(data.message).toContain('Token is required');
     });

     it('入力トークンが不正な場合、適切なエラーメッセージを返す', async () => {
       const response = await POST(
         new NextRequest('http://localhost:3000/api/auth/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ token: 'wrong-token' }),
         })
       );

       expect(response.status).toBe(401);
       const data = await response.json();
       expect(data.message).toContain('Invalid authentication token');
     });
   });
   ```

2. **テストの実行と失敗確認**:
   ```bash
   npm test src/app/api/auth/login/__tests__/route.test.ts
   ```

3. **テストのコミット**:
   ```bash
   git add src/app/api/auth/login/__tests__/route.test.ts
   git commit -m "test: ログインAPIのエラーメッセージテストを追加

- サーバー設定エラーのテスト
- 空トークンのテスト
- 不正トークンのテスト

参照: docs/verification-report-phase13-post-merge.md 問題2"
   ```

4. **src/app/api/auth/login/route.tsの修正**:

   現在のエラーハンドリングを改善：

   ```typescript
   export async function POST(request: NextRequest) {
     try {
       const { token } = await request.json();

       // トークンの入力チェック
       if (!token || token.trim() === '') {
         logger.warn('Login attempt with empty token', { service: 'claude-work' });
         return NextResponse.json(
           { message: 'Token is required. Please enter your authentication token.' },
           { status: 400 }
         );
       }

       // サーバー側トークンの設定確認
       const serverToken = process.env.CLAUDE_WORK_TOKEN;
       if (!serverToken || serverToken.trim() === '') {
         logger.error('CLAUDE_WORK_TOKEN not configured', { service: 'claude-work' });
         return NextResponse.json(
           {
             message: 'Server configuration error: Authentication token not configured. ' +
                      'Please contact the administrator.'
           },
           { status: 500 }
         );
       }

       // トークンの検証
       const hashedInput = createHash('sha256').update(token).digest('hex');
       const hashedServer = createHash('sha256').update(serverToken).digest('hex');

       if (hashedInput !== hashedServer) {
         logger.warn('Login attempt with invalid token', { service: 'claude-work' });
         return NextResponse.json(
           {
             message: 'Invalid authentication token. Please check your token and try again. ' +
                      'You can find the correct token in your .env file (CLAUDE_WORK_TOKEN).'
           },
           { status: 401 }
         );
       }

       // ... 以降は既存のコード
     } catch (error) {
       logger.error('Login error', { service: 'claude-work', error });
       return NextResponse.json(
         { message: 'An error occurred during login. Please try again.' },
         { status: 500 }
       );
     }
   }
   ```

5. **テストの再実行と通過確認**:
   ```bash
   npm test src/app/api/auth/login/__tests__/route.test.ts
   ```

6. **実装のコミット**:
   ```bash
   git add src/app/api/auth/login/route.ts
   git commit -m "fix: ログインAPIのエラーメッセージを改善

- 空トークン時のエラーメッセージを明確化
- サーバー設定エラーと認証エラーを区別
- 不正トークン時にヒントを含むエラーメッセージを表示
- ログレベルを適切に設定（warn/error）

参照: docs/verification-report-phase13-post-merge.md 問題2"
   ```

### 受入基準

- [ ] ログインAPIのテストが3つ追加されている
- [ ] テストのみのコミットが存在する
- [ ] `src/app/api/auth/login/route.ts`のエラーメッセージが改善されている
- [ ] すべてのテストが通過する（`npm test`）
- [ ] 実装のコミットが存在する
- [ ] 空トークン入力時に明確なメッセージが表示される
- [ ] サーバー設定エラーと認証エラーが区別される
- [ ] 不正トークン時にヒントが含まれる

### 依存関係

- タスク14.1（サーバー起動時の環境変数チェック追加）が完了していること

### 情報の明確性

**明示された情報**:
- 問題箇所: `src/app/api/auth/login/route.ts`
- 現在のエラーメッセージ: 「トークンが無効です」
- 改善方針: 起動時とログイン時の両方で改善（ユーザー確認済み）
- 既存のログ実装: `src/lib/logger.ts`

**不明/要確認の情報**:
- なし（ユーザーに確認済み）

---

## タスク14.3: ESLintエラーの修正とコミット

**優先度**: Critical
**推定工数**: 20分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

Phase 13マージ後の動作確認で発見されたESLintエラーを修正し、コミットします。既に修正は完了していますが、正式なコミットが必要です。

**現在の問題**:
- PR #2のGitHub Actionsでlintステップが失敗している
- 2つのESLintエラーが原因でテストワークフローが失敗

**修正済みの内容**:
- `src/app/projects/[id]/layout.tsx:24` - `id`変数を`_id`にリネーム
- `src/app/projects/__tests__/[id].test.tsx:35` - `projectId`変数を`_projectId`にリネーム

### 実装手順

1. **変更の確認**:
   ```bash
   git diff src/app/projects/[id]/layout.tsx
   git diff src/app/projects/__tests__/[id].test.tsx
   ```

2. **ビルドの確認**:
   ```bash
   npm run build:next
   ```

3. **変更のコミット**:
   ```bash
   git add src/app/projects/[id]/layout.tsx src/app/projects/__tests__/[id].test.tsx
   git commit -m "fix: 未使用変数のESLintエラーを修正

- src/app/projects/[id]/layout.tsx: id → _id
- src/app/projects/__tests__/[id].test.tsx: projectId → _projectId
- ESLintルール @typescript-eslint/no-unused-vars に準拠

参照: docs/verification-report-phase13-post-merge.md 問題1"
   ```

### 受入基準

- [ ] `src/app/projects/[id]/layout.tsx`の変更がコミットされている
- [ ] `src/app/projects/__tests__/[id].test.tsx`の変更がコミットされている
- [ ] `npm run build:next`がエラーなく完了する
- [ ] ESLintエラーがゼロである

### 依存関係

なし

### 情報の明確性

**明示された情報**:
- 問題: ESLintエラー（未使用変数）
- 修正内容: 変数名を`_`プレフィックス付きにリネーム
- 状態: 既に修正済み、コミットのみ必要
- 影響: PR #2のGitHub Actionsが失敗

**不明/要確認の情報**:
- なし

---

## タスク14.4: PR #2へのpushとActions確認

**優先度**: Critical
**推定工数**: 15分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

Phase 14の修正（タスク14.1〜14.3）をPR #2（nodejs-architectureブランチ）にpushし、GitHub Actionsが正常に通過することを確認します。

**現在の状況**:
- PR #2のGitHub Actionsでlintステップが失敗している
- ローカルブランチ（nodejs-architecture）に修正がコミット済み
- リモートにpushしてActionsを再実行する必要がある

### 実装手順

1. **コミットの確認**:
   ```bash
   git log --oneline -5
   # タスク14.1, 14.2, 14.3のコミットが存在することを確認
   ```

2. **リモートへpush**:
   ```bash
   git push origin nodejs-architecture
   ```

3. **GitHub Actionsの確認**:
   ```bash
   # push後、Actionsの実行状況を確認
   gh run list --branch nodejs-architecture --limit 5

   # 最新のActionsを監視
   gh run watch
   ```

4. **Actions完了確認**:
   ```bash
   # PR #2のActionsステータスを確認
   gh pr checks 2
   ```

5. **結果の確認**:
   - すべてのActionsが成功していることを確認
   - lintステップが正常に完了していることを確認
   - testステップが正常に完了していることを確認

### 受入基準

- [ ] nodejs-architectureブランチがリモートにpushされている
- [ ] PR #2のGitHub Actionsがすべて成功している
- [ ] lintステップがエラーなく完了している
- [ ] testステップがエラーなく完了している
- [ ] CodeRabbitのレビューが更新されている（自動）

### 依存関係

- タスク14.1（サーバー起動時の環境変数チェック追加）が完了していること
- タスク14.2（ログインAPIのエラーメッセージ改善）が完了していること
- タスク14.3（ESLintエラーの修正とコミット）が完了していること

### 情報の明確性

**明示された情報**:
- 対象PR: PR #2（サーバーサイドをNode.js(Next.js統合構成)に変更）
- ブランチ: nodejs-architecture
- 現在の問題: GitHub Actionsのlintステップが失敗
- 失敗原因: ESLintエラー（タスク14.3で修正済み）

**不明/要確認の情報**:
- なし

---

## フェーズ完了条件

- [ ] すべてのタスク（14.1〜14.4）が完了している
- [ ] タスク14.1: サーバー起動時に環境変数チェックが動作する
- [ ] タスク14.2: ログインAPIのエラーメッセージが改善されている
- [ ] タスク14.3: ESLintエラーが修正されている
- [ ] タスク14.4: PR #2にpushされ、GitHub Actionsがすべて成功している
- [ ] 各タスクのコミットメッセージがConventional Commitsに従っている
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ビルドが成功する（`npm run build:next`）
- [ ] 環境変数未設定時に適切なエラーメッセージが表示される
- [ ] ログイン時のエラーメッセージが明確になっている
- [ ] PR #2のGitHub Actionsがすべて成功している

## 備考

### タスクの実行順序

**推奨順序**:

1. タスク14.3（ESLintエラー修正）- 既に修正済み、コミットのみ
2. タスク14.1（環境変数チェック）- Critical、基盤となる機能
3. タスク14.2（ログインAPIエラー）- 14.1完了後に実装
4. タスク14.4（PR #2へのpush）- すべての修正完了後にpush

タスク14.3はPR #2のActions失敗を解決するため最優先で実施し、その後タスク14.1、14.2を実装してから、すべてをまとめてpushします。

### TDDの徹底

すべてのタスクでテスト駆動開発（TDD）を採用しています：

1. まずテストを書く
2. テストが失敗することを確認
3. テストをコミット
4. 実装してテストを通す
5. 実装をコミット

### 環境変数の管理

タスク14.1完了後、開発者は以下を実施する必要があります：

1. `.env.example`をコピーして`.env`を作成
2. 必須環境変数を設定
3. アプリケーションを起動して動作確認

### セキュリティ考慮事項

- `SESSION_SECRET`は32文字以上の強力な文字列を使用
- トークンはハッシュ化して比較（既存実装を維持）
- エラーメッセージにセキュリティ上の機密情報を含めない

### コミットメッセージの規約

すべてのコミットはConventional Commits形式に従ってください：

- `test:` - テストの追加・修正
- `fix:` - バグ修正
- `docs:` - ドキュメントの更新

### 参照ドキュメント

- 検証レポート: `docs/verification-report-phase13-post-merge.md`
- 環境変数ドキュメント: `docs/ENV_VARS.md`
- README: `README.md`
- Phase 13タスク: `docs/tasks/phase13.md`
- サーバー実装: `server.ts`
