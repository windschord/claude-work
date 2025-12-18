# フェーズ15: APIレスポンス形式の統一実装とcommitsエンドポイント追加

推定期間: 145分（AIエージェント作業時間）
MVP: Yes

## 概要

Phase 11で定義された統一APIレスポンス形式を、実装コード、仕様書、JSDocのすべてに適用します。さらに、未実装のcommitsエンドポイントも新規実装します。セッション関連とscripts関連のAPIエンドポイント、フロントエンドストアメソッド、設計ドキュメント、コードコメントを同時に修正し、完全に一貫性のあるAPIインターフェースを実現します。

**参照**:
- Phase 11: API Response Format Unification
- Phase 12 Task 12.3: docs/design.mdの更新（コミット: eb0050f）
- `docs/verification-report-api-response-format.md` - 検証レポート（2025-12-18更新）
- `docs/design.md` - セッションAPI仕様

**統一レスポンス形式のポリシー**:
- GET（単一リソース）: `{ resourceName: {...} }`
- POST/PUT: `{ resourceName: {...} }`
- GET（複数リソース）: `{ resourceNames: [...] }`

**修正・実装範囲**:
- 実装コード: 8つのAPIエンドポイント修正、1つのAPIエンドポイント新規実装、3つのストアメソッド修正
- 仕様書: docs/design.mdの6箇所
- JSDoc: 11つのAPIエンドポイント（10修正 + 1新規）
- GitService: 1つのメソッド追加

---

## タスク15.1: APIレスポンス形式の統一（セッション・scripts関連）

**優先度**: High
**推定工数**: 105分（AIエージェント作業時間）
**ステータス**: `TODO`
**実装順序**: 1/2

### 説明

セッション関連とscripts関連の8つのAPIエンドポイントのレスポンス形式を統一ポリシーに合わせて修正します。併せて、フロントエンドストアメソッド、設計書（docs/design.md）、すべてのJSDocも同時に修正し、完全な一貫性を実現します。

**修正対象**:

**実装コード（8エンドポイント + 3ストアメソッド）**:

**セッション関連（5エンドポイント）**:
1. GET /api/projects/{project_id}/sessions - セッション一覧取得
2. GET /api/sessions/{id} - セッション詳細取得
3. POST /api/sessions/{id}/input - メッセージ送信
4. POST /api/sessions/{id}/stop - セッション停止
5. GET /api/sessions/{id}/diff - 差分取得

**scripts関連（3エンドポイント）**:
6. GET /api/projects/{project_id}/scripts - スクリプト一覧取得
7. POST /api/projects/{project_id}/scripts - スクリプト追加
8. PUT /api/projects/{project_id}/scripts/{scriptId} - スクリプト更新

**ストアメソッド（3メソッド）**:
9. fetchSessionDetail, sendMessage, stopSession (src/store/index.ts)

**仕様書（docs/design.md の6箇所）**:
1. POST /api/projects (line 366-373) - レスポンス例を修正
2. GET /api/sessions/{id} (line 447-471) - レスポンス例を修正
3. POST /api/sessions/{id}/input (line 474-482) - レスポンス形式を追加
4. POST /api/sessions/{id}/stop (line 494-496) - レスポンス形式を追加
5. GET /api/sessions/{id}/diff (line 593-616) - レスポンス例を修正（新規追加）
6. POST /api/sessions/{id}/rebase (line 647-653) - コンフリクト時のレスポンス例を修正（新規追加）

**JSDoc（10エンドポイント）**:

**セッション関連（6エンドポイント）**:
1. GET /api/projects - 実装と一致させる
2. GET /api/projects/{project_id}/sessions - 統一形式に更新
3. GET /api/sessions/{id} - 統一形式に更新
4. POST /api/sessions/{id}/input - 統一形式に更新
5. POST /api/sessions/{id}/stop - 統一形式に更新
6. GET /api/sessions/{id}/diff - 統一形式に更新

**scripts関連（3エンドポイント）**:
7. GET /api/projects/{project_id}/scripts - 統一形式に更新
8. POST /api/projects/{project_id}/scripts - 統一形式に更新
9. PUT /api/projects/{project_id}/scripts/{scriptId} - 統一形式に更新

**その他**:
10. POST /api/projects - （既に正しい）

**現在の問題**（検証レポートより - 2025-12-18更新）:
- 実装: 8つのエンドポイントが統一ポリシーに違反（セッション5 + scripts3）
- 仕様書: 3つのエンドポイントが統一ポリシーに準拠していない、2つのエンドポイントにレスポンス形式の記載なし、1つのエンドポイントで実装と不一致
- JSDoc: 5つのエンドポイントで実装と不一致（セッション2 + scripts3）

**修正内容**:
- すべてのエンドポイントで統一形式を適用（実装、仕様書、JSDoc）
- フロントエンドストアメソッドでレスポンスの抽出処理を追加（diffエンドポイント使用箇所を確認）
- 既存のテストを新しいレスポンス形式に対応
- 実装、仕様書、JSDocの完全な一貫性を実現

### 実装手順（TDDアプローチ）

#### ステップ1: テストの更新（Red）

既存のテストファイルを新しいレスポンス形式に対応させます。

**1.1 GET /api/sessions/{id}のテスト更新**

ファイル: `src/app/api/sessions/[id]/__tests__/route.test.ts`

```typescript
// Before（現在の期待値）:
expect(await response.json()).toEqual({
  id: expect.any(String),
  name: 'feature-auth',
  // ...
});

// After（新しい期待値）:
expect(await response.json()).toEqual({
  session: {
    id: expect.any(String),
    name: 'feature-auth',
    // ...
  }
});
```

**1.2 POST /api/sessions/{id}/stopのテスト更新**

ファイル: `src/app/api/sessions/[id]/stop/__tests__/route.test.ts`

```typescript
// Before:
expect(await response.json()).toEqual({
  id: sessionId,
  status: 'stopped',
  // ...
});

// After:
expect(await response.json()).toEqual({
  session: {
    id: sessionId,
    status: 'stopped',
    // ...
  }
});
```

**1.3 テストの実行と失敗確認**

```bash
npm test src/app/api/sessions/[id]/__tests__/route.test.ts
npm test src/app/api/sessions/[id]/stop/__tests__/route.test.ts
```

テストが失敗することを確認します（現在の実装は古い形式のため）。

**1.4 テストコミット**

```bash
git add src/app/api/sessions/[id]/__tests__/route.test.ts
git add src/app/api/sessions/[id]/stop/__tests__/route.test.ts
git commit -m "test: セッションAPIのテストを統一レスポンス形式に対応"
```

#### ステップ2: バックエンドAPIの修正（Green）

**2.1 GET /api/projects/{project_id}/sessionsの修正**

ファイル: `src/app/api/projects/[project_id]/sessions/route.ts`

```typescript
// Before (line 68):
return NextResponse.json(sessions);

// After:
return NextResponse.json({ sessions });
```

**2.2 GET /api/sessions/{id}の修正**

ファイル: `src/app/api/sessions/[id]/route.ts`

```typescript
// Before (line 70):
return NextResponse.json(targetSession);

// After:
return NextResponse.json({ session: targetSession });
```

**JSDocの更新**:
```typescript
/**
 * GET /api/sessions/{id} - セッション詳細取得
 *
 * @returns
 * - 200: セッション詳細（統一形式）
 *   ```json
 *   { "session": { "id": "uuid", "name": "feature-auth", ... } }
 *   ```
 */
```

**2.3 POST /api/sessions/{id}/inputの修正**

ファイル: `src/app/api/sessions/[id]/input/route.ts`

```typescript
// Before (line 91):
return NextResponse.json(message);

// After:
return NextResponse.json({ message });
```

**JSDocの更新**:
```typescript
/**
 * POST /api/sessions/{id}/input - メッセージ送信
 *
 * @returns
 * - 201: メッセージ作成成功（統一形式）
 *   ```json
 *   { "message": { "id": "uuid", "content": "...", ... } }
 *   ```
 */
```

**2.4 POST /api/sessions/{id}/stopの修正**

ファイル: `src/app/api/sessions/[id]/stop/route.ts`

```typescript
// Before (line 86):
return NextResponse.json(updatedSession);

// After:
return NextResponse.json({ session: updatedSession });
```

**JSDocの更新**:
```typescript
/**
 * POST /api/sessions/{id}/stop - セッション停止
 *
 * @returns
 * - 200: セッション停止成功（統一形式）
 *   ```json
 *   { "session": { "id": "uuid", "status": "stopped", ... } }
 *   ```
 */
```

**2.5 GET /api/sessions/{id}/diffの修正**

ファイル: `src/app/api/sessions/[id]/diff/route.ts`

```typescript
// Before (line 77):
return NextResponse.json(diff);

// After:
return NextResponse.json({ diff });
```

**JSDocの更新**:
```typescript
/**
 * GET /api/sessions/{id}/diff - セッションの差分取得
 *
 * @returns
 * - 200: 差分情報（統一形式）
 *   ```json
 *   {
 *     "diff": {
 *       "files": [...],
 *       "totalAdditions": 5,
 *       "totalDeletions": 3
 *     }
 *   }
 *   ```
 */
```

**2.6 GET /api/projects/{project_id}/scriptsの修正**

ファイル: `src/app/api/projects/[project_id]/scripts/route.ts`

```typescript
// Before (line 64):
return NextResponse.json(scripts);

// After:
return NextResponse.json({ scripts });
```

**JSDocの更新**:
```typescript
/**
 * GET /api/projects/[project_id]/scripts - スクリプト一覧取得
 *
 * @returns
 * - 200: スクリプト一覧（統一形式）
 *   ```json
 *   { "scripts": [...] }
 *   ```
 */
```

**2.7 POST /api/projects/{project_id}/scriptsの修正**

ファイル: `src/app/api/projects/[project_id]/scripts/route.ts`

```typescript
// Before (line 192):
return NextResponse.json(script, { status: 201 });

// After:
return NextResponse.json({ script }, { status: 201 });
```

**JSDocの更新**:
```typescript
/**
 * POST /api/projects/[project_id]/scripts - スクリプト追加
 *
 * @returns
 * - 201: スクリプト追加成功（統一形式）
 *   ```json
 *   { "script": {...} }
 *   ```
 */
```

**2.8 PUT /api/projects/{project_id}/scripts/{scriptId}の修正**

ファイル: `src/app/api/projects/[project_id]/scripts/[scriptId]/route.ts`

```typescript
// Before (line 133):
return NextResponse.json(script);

// After:
return NextResponse.json({ script });
```

**JSDocの更新**:
```typescript
/**
 * PUT /api/projects/[project_id]/scripts/[scriptId] - スクリプト更新
 *
 * @returns
 * - 200: スクリプト更新成功（統一形式）
 *   ```json
 *   { "script": {...} }
 *   ```
 */
```

**2.9 テストの実行とパス確認**

```bash
npm test src/app/api/sessions/[id]/__tests__/route.test.ts
npm test src/app/api/sessions/[id]/stop/__tests__/route.test.ts
```

すべてのテストが通過することを確認します。

**2.10 追加のJSDoc更新**

ファイル: `src/app/api/projects/route.ts` (line 23-40)

```typescript
/**
 * GET /api/projects - プロジェクト一覧取得
 *
 * @returns
 * - 200: プロジェクト一覧（統一形式）
 *   ```json
 *   { "projects": [{ "id": "uuid", "name": "my-project", ... }] }
 *   ```
 */
```

ファイル: `src/app/api/projects/[project_id]/sessions/route.ts` (line 24-43)

```typescript
/**
 * GET /api/projects/[project_id]/sessions - プロジェクトのセッション一覧取得
 *
 * @returns
 * - 200: セッション一覧（統一形式）
 *   ```json
 *   { "sessions": [{ "id": "uuid", "name": "新機能実装", ... }] }
 *   ```
 */
```

**2.11 バックエンド実装コミット**

```bash
git add src/app/api/projects/route.ts
git add src/app/api/projects/[project_id]/sessions/route.ts
git add src/app/api/projects/[project_id]/scripts/route.ts
git add src/app/api/projects/[project_id]/scripts/[scriptId]/route.ts
git add src/app/api/sessions/[id]/route.ts
git add src/app/api/sessions/[id]/input/route.ts
git add src/app/api/sessions/[id]/stop/route.ts
git add src/app/api/sessions/[id]/diff/route.ts
git commit -m "fix: APIレスポンス形式を統一ポリシーに合わせて修正

- セッション関連5エンドポイントのレスポンス形式を統一
- scripts関連3エンドポイントのレスポンス形式を統一
- すべてのJSDocを更新して統一形式を反映
- diffエンドポイントも統一ポリシーに準拠"
```

#### ステップ3: 設計書（docs/design.md）の修正

**3.1 POST /api/projects のレスポンス例修正**

ファイル: `docs/design.md` (line 366-373)

```markdown
**レスポンス（201）**:
\```json
{
  "project": {
    "id": "uuid",
    "name": "repo-name",
    "path": "/path/to/git/repo"
  }
}
\```
```

**3.2 GET /api/sessions/{id} のレスポンス例修正**

ファイル: `docs/design.md` (line 447-471)

```markdown
**レスポンス（200）**:
\```json
{
  "session": {
    "id": "uuid",
    "name": "feature-auth",
    "status": "waiting_input",
    "git_status": "dirty",
    "model": "sonnet",
    "worktree_path": "/path/to/worktree",
    "messages": [
      {
        "role": "user",
        "content": "Implement auth",
        "timestamp": "2025-12-08T10:00:00Z"
      },
      {
        "role": "assistant",
        "content": "I'll implement...",
        "timestamp": "2025-12-08T10:00:05Z",
        "sub_agents": [
          {"name": "file_edit", "output": "..."}
        ]
      }
    ]
  }
}
\```
```

**3.3 POST /api/sessions/{id}/input のレスポンス形式追加**

ファイル: `docs/design.md` (line 474-482の後に追加)

```markdown
#### POST /api/sessions/{id}/input
**目的**: セッションへの入力送信（REST fallback）

**リクエスト**:
\```json
{
  "content": "Please also add tests"
}
\```

**レスポンス（200）**:
\```json
{
  "message": {
    "id": "message-uuid",
    "session_id": "session-uuid",
    "role": "user",
    "content": "Please also add tests",
    "created_at": "2025-12-08T10:01:00Z"
  }
}
\```
```

**3.4 POST /api/sessions/{id}/stop のレスポンス形式追加**

ファイル: `docs/design.md` (line 494-496の後に追加)

```markdown
#### POST /api/sessions/{id}/stop
**目的**: セッション停止

**レスポンス（200）**:
\```json
{
  "session": {
    "id": "session-uuid",
    "project_id": "uuid-1234",
    "name": "新機能実装",
    "status": "completed",
    "model": "claude-3-5-sonnet-20241022",
    "worktree_path": "/path/to/worktrees/session-1234567890",
    "branch_name": "session/session-1234567890",
    "created_at": "2025-12-13T09:00:00Z"
  }
}
\```
```

**3.5 GET /api/sessions/{id}/diff のレスポンス例修正**

ファイル: `docs/design.md` (line 593-616)

```markdown
**レスポンス（200）**:
\```json
{
  "diff": {
    "files": [
      {
        "path": "src/auth.ts",
        "status": "modified",
        "additions": 45,
        "deletions": 12,
        "hunks": [
          {
            "old_start": 10,
            "old_lines": 5,
            "new_start": 10,
            "new_lines": 8,
            "content": "@@ -10,5 +10,8 @@\n-old line\n+new line"
          }
        ]
      }
    ],
    "totalAdditions": 45,
    "totalDeletions": 12
  }
}
\```
```

**3.6 POST /api/sessions/{id}/rebase のコンフリクト時レスポンス例修正**

ファイル: `docs/design.md` (line 647-653)

```markdown
**レスポンス（409）**:
\```json
{
  "success": false,
  "conflicts": ["src/auth.ts"]
}
\```
```

**理由**: mergeエンドポイント（line 686-691）と形式を統一するため。`conflicting_files` → `conflicts` に変更。

**3.7 設計書修正コミット**

```bash
git add docs/design.md
git commit -m "docs: APIレスポンス形式を統一ポリシーに合わせて修正

- POST /api/projects のレスポンス例を修正
- GET /api/sessions/{id} のレスポンス例を修正
- POST /api/sessions/{id}/input のレスポンス形式を追加
- POST /api/sessions/{id}/stop のレスポンス形式を追加
- GET /api/sessions/{id}/diff のレスポンス例を統一形式に修正
- POST /api/sessions/{id}/rebase のコンフリクト時レスポンス例をmergeと統一"
```

#### ステップ4: フロントエンドストアの修正

**4.1 fetchSessionDetailの修正**

ファイル: `src/store/index.ts` (line 646)

```typescript
// Before:
const session = await response.json();
set({ currentSession: session, messages });

// After:
const data = await response.json();
set({ currentSession: data.session, messages });
```

**4.2 sendMessageの修正**

ファイル: `src/store/index.ts` (line 679)

```typescript
// Before:
const message = await response.json();
set((state) => ({
  messages: [...state.messages, message],
}));

// After:
const data = await response.json();
set((state) => ({
  messages: [...state.messages, data.message],
}));
```

**4.3 stopSessionの修正**

ファイル: `src/store/index.ts` (line 735)

```typescript
// Before:
const updatedSession = await response.json();
set({ currentSession: updatedSession });

// After:
const data = await response.json();
set({ currentSession: data.session });
```

**注意**: `fetchSessions` (line 555)はすでに正しい形式（`data.sessions`）を使用しているため、修正不要です。

**4.4 diffエンドポイント使用箇所の確認と修正**

```bash
# diffエンドポイントを使用している箇所を検索
grep -r "\/api\/sessions.*\/diff" src/
```

使用箇所が見つかった場合、レスポンスの抽出処理を修正：

```typescript
// Before:
const diff = await response.json();
// diff.files, diff.totalAdditions などを使用

// After:
const data = await response.json();
// data.diff.files, data.diff.totalAdditions などを使用
```

**4.5 フロントエンド修正コミット**

```bash
git add src/store/index.ts
git commit -m "fix: ストアメソッドを統一APIレスポンス形式に対応"
```

#### ステップ5: 統合テストと動作確認

**5.1 すべてのテストの実行**

```bash
npm test
```

すべてのテストが通過することを確認します。

**5.2 ESLintチェック**

```bash
npm run lint
```

エラーがないことを確認します。

**5.3 開発サーバーでの動作確認**

```bash
npm run dev
```

以下の機能が正常に動作することを確認：
- セッション一覧の表示（GET /api/projects/{id}/sessions）
- セッション詳細の表示（GET /api/sessions/{id}）
- メッセージの送信（POST /api/sessions/{id}/input）
- セッションの停止（POST /api/sessions/{id}/stop）

**5.4 最終コミット（必要に応じて）**

動作確認後、追加の修正があればコミットします。

### 受入基準

**実装コード（セッション関連）**:
- [ ] GET /api/projects/{project_id}/sessionsが`{ sessions: [...] }`を返す
- [ ] GET /api/sessions/{id}が`{ session: {...} }`を返す
- [ ] POST /api/sessions/{id}/inputが`{ message: {...} }`を返す
- [ ] POST /api/sessions/{id}/stopが`{ session: {...} }`を返す
- [ ] GET /api/sessions/{id}/diffが`{ diff: {...} }`を返す

**実装コード（scripts関連）**:
- [ ] GET /api/projects/{project_id}/scriptsが`{ scripts: [...] }`を返す
- [ ] POST /api/projects/{project_id}/scriptsが`{ script: {...} }`を返す
- [ ] PUT /api/projects/{project_id}/scripts/{scriptId}が`{ script: {...} }`を返す

**実装コード（フロントエンド）**:
- [ ] `src/store/index.ts`の3つのメソッドがレスポンスから正しく値を抽出している
- [ ] diffエンドポイント使用箇所（存在する場合）が修正されている
- [ ] 既存のテスト2つが新しい形式に対応し、すべて通過する

**JSDoc（セッション関連）**:
- [ ] GET /api/projects のJSDocが実装と一致している（`{ projects }` 形式）
- [ ] GET /api/projects/{project_id}/sessions のJSDocが統一形式（`{ sessions }` 形式）
- [ ] GET /api/sessions/{id} のJSDocが統一形式（`{ session }` 形式）
- [ ] POST /api/sessions/{id}/input のJSDocが統一形式（`{ message }` 形式）
- [ ] POST /api/sessions/{id}/stop のJSDocが統一形式（`{ session }` 形式）
- [ ] GET /api/sessions/{id}/diff のJSDocが統一形式（`{ diff }` 形式）

**JSDoc（scripts関連）**:
- [ ] GET /api/projects/{project_id}/scripts のJSDocが統一形式（`{ scripts }` 形式）
- [ ] POST /api/projects/{project_id}/scripts のJSDocが統一形式（`{ script }` 形式）
- [ ] PUT /api/projects/{project_id}/scripts/{scriptId} のJSDocが統一形式（`{ script }` 形式）

**設計書（docs/design.md）**:
- [ ] POST /api/projects のレスポンス例が統一形式（`{ project }` 形式）
- [ ] GET /api/sessions/{id} のレスポンス例が統一形式（`{ session }` 形式）
- [ ] POST /api/sessions/{id}/input のレスポンス形式が記載されている（`{ message }` 形式）
- [ ] POST /api/sessions/{id}/stop のレスポンス形式が記載されている（`{ session }` 形式）
- [ ] GET /api/sessions/{id}/diff のレスポンス例が統一形式（`{ diff }` 形式）
- [ ] POST /api/sessions/{id}/rebase のコンフリクト時レスポンス例がmergeと統一されている

**テスト・品質**:
- [ ] `npm test`がエラーなく完了する
- [ ] `npm run lint`がエラーなく完了する
- [ ] 開発サーバーで8つのエンドポイントが正常に動作する（セッション5 + scripts3）
- [ ] TDDサイクル（テスト更新→バックエンド修正→設計書修正→フロントエンド修正）に従っている
- [ ] 各ステップでコミットが作成されている（最低4コミット：テスト、バックエンド、設計書、フロントエンド）

### 依存関係

- Phase 11（統一ポリシーの定義）が完了していること
- Phase 12 Task 12.3（設計書の更新）が完了していること
- 開発環境が正しく設定されていること（`.env`ファイル、データベース）

### 技術的文脈

**プロジェクト構成**:
- フレームワーク: Next.js 15 (App Router)
- 状態管理: Zustand
- データベース: Prisma + SQLite
- テスト: Vitest

**既存のコーディングパターン**:
- 非同期Route Handler: `{ params }: { params: Promise<{...}> }`
- エラーハンドリング: try-catchでラップし、適切なHTTPステータスを返す
- レスポンス形式: `NextResponse.json({ ... })`

**参照すべきファイル**:
- 統一済みの例: `src/app/api/projects/route.ts` (Phase 11で修正済み)
- ストアパターン: `src/store/index.ts` の `fetchSessions` メソッド（すでに正しい実装）

### 情報の明確性

**明示された情報**:
- 修正対象の4つのエンドポイントと実装ファイル
- 修正対象の3つのストアメソッドと行番号
- 統一レスポンス形式のポリシー
- 既存のテストファイルの場所
- TDDアプローチの手順

**確認済みの情報（ユーザーからの回答）**:
- フロントエンドも同時に修正する ⭐⭐⭐⭐⭐
- 4つのエンドポイントを1つのタスクにまとめる ⭐⭐⭐⭐⭐
- Phase 15として新規作成 ⭐⭐⭐⭐⭐

**不明/要確認の情報**:
- なし（すべての必要情報が揃っています）

---

## タスク15.2: コミット履歴取得APIの実装

**優先度**: Medium
**推定工数**: 40分（AIエージェント作業時間）
**ステータス**: `TODO`
**実装順序**: 2/2

### 説明

GET /api/sessions/{id}/commits エンドポイントを新規実装します。仕様書（docs/design.md）に記載されているが実装されていないAPIを追加し、セッションのコミット履歴取得機能を提供します。

**実装対象**:
1. `src/services/git-service.ts` - getCommitsメソッドの追加
2. `src/app/api/sessions/[id]/commits/route.ts` - APIエンドポイント（新規ファイル）
3. `src/app/api/sessions/[id]/commits/__tests__/route.test.ts` - テスト（新規ファイル）

**仕様書（docs/design.md line 618-635）のレスポンス形式**:
```json
{
  "commits": [
    {
      "hash": "abc123",
      "short_hash": "abc123",
      "message": "Add authentication",
      "author": "Claude",
      "date": "2025-12-08T10:05:00Z",
      "files_changed": 3
    }
  ]
}
```

### 実装手順（TDDアプローチ）

#### ステップ1: テストの作成（Red）

**1.1 APIエンドポイントのテスト作成**

ファイル: `src/app/api/sessions/[id]/commits/__tests__/route.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';

vi.mock('@/lib/db');
vi.mock('@/lib/auth');
vi.mock('@/services/git-service');

describe('GET /api/sessions/{id}/commits', () => {
  const mockSessionId = 'mock-session-id';
  const mockProjectPath = '/path/to/project';
  const mockWorktreePath = '/path/to/worktree';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('認証されていない場合は401を返す', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/sessions/test-id/commits', {
      headers: { cookie: 'sessionId=invalid' },
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('セッションが見つからない場合は404を返す', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: mockSessionId,
      token_hash: 'hash',
      expires_at: new Date(),
      created_at: new Date(),
    });

    vi.mocked(prisma.session.findUnique).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/sessions/test-id/commits', {
      headers: { cookie: `sessionId=${mockSessionId}` },
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Session not found' });
  });

  it('コミット履歴を統一形式で返す', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: mockSessionId,
      token_hash: 'hash',
      expires_at: new Date(),
      created_at: new Date(),
    });

    vi.mocked(prisma.session.findUnique).mockResolvedValue({
      id: 'test-id',
      project_id: 'project-1',
      name: 'feature-branch',
      status: 'active',
      model: 'sonnet',
      worktree_path: mockWorktreePath,
      branch_name: 'session/feature-branch',
      created_at: new Date(),
      project: {
        id: 'project-1',
        name: 'test-project',
        path: mockProjectPath,
        created_at: new Date(),
        updated_at: new Date(),
      },
    } as any);

    const mockCommits = [
      {
        hash: 'abc123def456',
        short_hash: 'abc123d',
        message: 'Add authentication',
        author: 'Claude',
        date: '2025-12-08T10:05:00Z',
        files_changed: 3,
      },
      {
        hash: 'def456ghi789',
        short_hash: 'def456g',
        message: 'Fix bug in login',
        author: 'Claude',
        date: '2025-12-08T11:00:00Z',
        files_changed: 1,
      },
    ];

    const mockGitService = {
      getCommits: vi.fn().mockReturnValue(mockCommits),
    };
    vi.mocked(GitService).mockImplementation(() => mockGitService as any);

    const request = new Request('http://localhost:3000/api/sessions/test-id/commits', {
      headers: { cookie: `sessionId=${mockSessionId}` },
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: 'test-id' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ commits: mockCommits });
    expect(mockGitService.getCommits).toHaveBeenCalledWith('feature-branch');
  });
});
```

**1.2 GitServiceのgetCommitsメソッドのテスト作成**

ファイル: `src/services/__tests__/git-service.commits.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitService } from '../git-service';
import { execSync } from 'child_process';

vi.mock('child_process');

describe('GitService.getCommits', () => {
  let gitService: GitService;
  const mockProjectPath = '/path/to/project';
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    gitService = new GitService(mockProjectPath, mockLogger as any);
  });

  it('コミット履歴を正しく取得する', () => {
    const mockGitLog = `abc123def456|abc123d|Add authentication|Claude|2025-12-08T10:05:00Z|3
def456ghi789|def456g|Fix bug in login|Claude|2025-12-08T11:00:00Z|1`;

    vi.mocked(execSync).mockReturnValue(Buffer.from(mockGitLog));

    const commits = gitService.getCommits('feature-branch');

    expect(commits).toEqual([
      {
        hash: 'abc123def456',
        short_hash: 'abc123d',
        message: 'Add authentication',
        author: 'Claude',
        date: '2025-12-08T10:05:00Z',
        files_changed: 3,
      },
      {
        hash: 'def456ghi789',
        short_hash: 'def456g',
        message: 'Fix bug in login',
        author: 'Claude',
        date: '2025-12-08T11:00:00Z',
        files_changed: 1,
      },
    ]);

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('git worktree list'),
      expect.any(Object)
    );
  });

  it('コミットがない場合は空配列を返す', () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));

    const commits = gitService.getCommits('empty-branch');

    expect(commits).toEqual([]);
  });
});
```

**1.3 テストの実行と失敗確認**

```bash
npm test src/app/api/sessions/[id]/commits/__tests__/route.test.ts
npm test src/services/__tests__/git-service.commits.test.ts
```

テストが失敗することを確認します（まだ実装していないため）。

**1.4 テストコミット**

```bash
git add src/app/api/sessions/[id]/commits/__tests__/route.test.ts
git add src/services/__tests__/git-service.commits.test.ts
git commit -m "test: コミット履歴取得APIのテストを追加"
```

#### ステップ2: GitServiceの実装（Green）

**2.1 getCommitsメソッドの実装**

ファイル: `src/services/git-service.ts`

```typescript
/**
 * セッションのコミット履歴を取得
 * @param sessionName - セッション名
 * @returns コミット履歴の配列
 */
getCommits(sessionName: string): Array<{
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  date: string;
  files_changed: number;
}> {
  try {
    const worktreePath = this.getWorktreePath(sessionName);

    // git logでコミット履歴を取得
    // フォーマット: hash|short_hash|message|author|date|files_changed
    const format = '%H|%h|%s|%an|%aI|';
    const command = `git -C "${worktreePath}" log --pretty=format:"${format}" --numstat`;

    const output = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
    }).trim();

    if (!output) {
      return [];
    }

    const commits: Array<{
      hash: string;
      short_hash: string;
      message: string;
      author: string;
      date: string;
      files_changed: number;
    }> = [];

    const lines = output.split('\n');
    let currentCommit: any = null;
    let filesChanged = 0;

    for (const line of lines) {
      if (line.includes('|')) {
        // コミット情報行
        if (currentCommit) {
          currentCommit.files_changed = filesChanged;
          commits.push(currentCommit);
          filesChanged = 0;
        }

        const [hash, short_hash, message, author, date] = line.split('|');
        currentCommit = {
          hash,
          short_hash,
          message,
          author,
          date,
          files_changed: 0,
        };
      } else if (line.trim() && currentCommit) {
        // numstat行（ファイル変更情報）
        filesChanged++;
      }
    }

    // 最後のコミットを追加
    if (currentCommit) {
      currentCommit.files_changed = filesChanged;
      commits.push(currentCommit);
    }

    return commits;
  } catch (error) {
    this.logger.error('Failed to get commits', { error, sessionName });
    return [];
  }
}
```

**2.2 GitServiceテストの実行とパス確認**

```bash
npm test src/services/__tests__/git-service.commits.test.ts
```

テストが通過することを確認します。

#### ステップ3: APIエンドポイントの実装（Green）

**3.1 route.tsの作成**

ファイル: `src/app/api/sessions/[id]/commits/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { GitService } from '@/services/git-service';
import { logger } from '@/lib/logger';
import { basename } from 'path';

/**
 * GET /api/sessions/[id]/commits - セッションのコミット履歴取得
 *
 * 指定されたセッションのGitコミット履歴を取得します。
 * 認証が必要です。
 *
 * @param request - sessionIdクッキーを含むリクエスト
 * @param params.id - セッションID
 *
 * @returns
 * - 200: コミット履歴（統一形式）
 * - 401: 認証されていない
 * - 404: セッションが見つからない
 * - 500: サーバーエラー
 *
 * @example
 * ```typescript
 * // リクエスト
 * GET /api/sessions/session-uuid/commits
 * Cookie: sessionId=<uuid>
 *
 * // レスポンス
 * {
 *   "commits": [
 *     {
 *       "hash": "abc123def456",
 *       "short_hash": "abc123d",
 *       "message": "Add authentication",
 *       "author": "Claude",
 *       "date": "2025-12-08T10:05:00Z",
 *       "files_changed": 3
 *     }
 *   ]
 * }
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const targetSession = await prisma.session.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!targetSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionName = basename(targetSession.worktree_path);
    const gitService = new GitService(targetSession.project.path, logger);
    const commits = gitService.getCommits(sessionName);

    logger.info('Got commits for session', { id, count: commits.length });
    return NextResponse.json({ commits });
  } catch (error) {
    const { id: errorId } = await params;
    logger.error('Failed to get commits', { error, session_id: errorId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**3.2 APIテストの実行とパス確認**

```bash
npm test src/app/api/sessions/[id]/commits/__tests__/route.test.ts
```

すべてのテストが通過することを確認します。

**3.3 実装コミット**

```bash
git add src/services/git-service.ts
git add src/app/api/sessions/[id]/commits/route.ts
git commit -m "feat: コミット履歴取得APIを実装

- GitService.getCommitsメソッドを追加
- GET /api/sessions/{id}/commits エンドポイントを実装
- 統一レスポンス形式（{ commits: [...] }）で返却"
```

#### ステップ4: 統合テストと動作確認

**4.1 すべてのテストの実行**

```bash
npm test
```

すべてのテストが通過することを確認します。

**4.2 ESLintチェック**

```bash
npm run lint
```

エラーがないことを確認します。

**4.3 開発サーバーでの動作確認**

```bash
npm run dev
```

以下の手順で動作確認：
1. ブラウザでセッション詳細ページにアクセス
2. ブラウザの開発者ツールで `/api/sessions/{id}/commits` にリクエストを送信
3. レスポンスが `{ commits: [...] }` 形式で返ることを確認

### 受入基準

**実装コード**:
- [ ] `src/services/git-service.ts`に`getCommits`メソッドが実装されている
- [ ] GET /api/sessions/{id}/commitsエンドポイントが実装されている
- [ ] レスポンス形式が統一ポリシーに準拠（`{ commits: [...] }` 形式）
- [ ] コミット情報に必要なフィールド（hash, short_hash, message, author, date, files_changed）が含まれている

**テスト**:
- [ ] GitService.getCommitsのテストが実装され、通過する
- [ ] APIエンドポイントのテスト（認証、404、正常系）が実装され、通過する
- [ ] `npm test`がエラーなく完了する

**JSDoc**:
- [ ] APIエンドポイントのJSDocが記載されている
- [ ] レスポンス例が統一形式で記載されている

**品質**:
- [ ] `npm run lint`がエラーなく完了する
- [ ] 開発サーバーでコミット履歴が正しく取得できる
- [ ] TDDサイクル（テスト→GitService実装→API実装）に従っている
- [ ] 各ステップでコミットが作成されている（最低2コミット：テスト、実装）

### 依存関係

- Phase 11（統一ポリシーの定義）が完了していること
- タスク15.1（他のAPIの統一）が完了していること
- GitServiceが正常に動作すること
- 開発環境が正しく設定されていること（`.env`ファイル、データベース）

### 技術的文脈

**プロジェクト構成**:
- フレームワーク: Next.js 15 (App Router)
- 状態管理: Zustand
- データベース: Prisma + SQLite
- テスト: Vitest

**既存のコーディングパターン**:
- 非同期Route Handler: `{ params }: { params: Promise<{...}> }`
- エラーハンドリング: try-catchでラップし、適切なHTTPステータスを返す
- レスポンス形式: `NextResponse.json({ commits: [...] })`
- Git操作: GitServiceを使用

**参照すべきファイル**:
- 類似API: `src/app/api/sessions/[id]/diff/route.ts`
- Git操作: `src/services/git-service.ts` の getDiffDetails メソッド
- テストパターン: `src/app/api/sessions/[id]/diff/__tests__/route.test.ts`

### 情報の明確性

**明示された情報**:
- 実装対象のAPIエンドポイント（GET /api/sessions/{id}/commits）
- レスポンス形式（docs/design.md line 618-635）
- 必要なコミット情報のフィールド
- 統一レスポンス形式のポリシー
- TDDアプローチの手順

**確認済みの情報（ユーザーからの回答）**:
- 新規タスクとして実装する ⭐⭐⭐⭐
- Phase 15に統合
- 統一レスポンス形式に準拠

**不明/要確認の情報**:
- なし（すべての必要情報が揃っています）

---

## 実装上の注意事項

1. **破壊的変更**: タスク15.1は破壊的変更を含むため、バックエンドとフロントエンドは同時に修正する必要があります
2. **テストファースト**: 必ずテストを先に更新し、失敗を確認してから実装を修正してください
3. **コミット分割**: タスク15.1は4コミット（テスト、バックエンド、設計書、フロントエンド）、タスク15.2は2コミット（テスト、実装）に分けてください
4. **既存の正しい実装**: `fetchSessions`メソッドはすでに正しい形式を使用しているため、変更しないでください
5. **JSDocの更新**: APIエンドポイントのJSDocも必ず更新してください
6. **実装順序**: タスク15.1を完了してからタスク15.2に進んでください
