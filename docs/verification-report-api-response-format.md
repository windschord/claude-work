# APIレスポンス形式 検証レポート

**検証日時**: 2025-12-18
**対象ブランチ**: nodejs-architecture
**検証者**: Claude (AI Agent)

## 概要

Phase 11で定義され、Phase 12 Task 12.3で設計書（docs/design.md）が更新された統一APIレスポンス形式について、実際の実装コードと仕様書の整合性を検証しました。

**統一レスポンス形式のポリシー** (Phase 11で定義):
- GET（単一リソース）: `{ resourceName: {...} }`
- POST/PUT: `{ resourceName: {...} }`
- GET（複数リソース）: `{ resourceNames: [...] }`

## 検証結果サマリー

| エンドポイント | 実装 | 仕様書 | 統一ポリシー | 状態 |
|--------------|------|--------|------------|------|
| GET /api/projects | `{ projects }` ✅ | `{ projects }` ✅ | 一致 | ✅ 正常 |
| POST /api/projects | `{ project }` ✅ | `{ id, name, path }` ❌ | 不一致 | ⚠️ 仕様書更新必要 |
| GET /api/projects/{id}/sessions | `sessions` ❌ | `{ sessions }` ✅ | 不一致 | ❌ 実装修正必要 |
| GET /api/sessions/{id} | `targetSession` ❌ | `{ id, name, ... }` ❌ | 不一致 | ❌ 両方修正必要 |
| POST /api/sessions/{id}/input | `message` ❌ | 記載なし | 不一致 | ❌ 実装修正必要 |
| POST /api/sessions/{id}/stop | `updatedSession` ❌ | 記載なし | 不一致 | ❌ 実装修正必要 |

## 詳細な検証結果

### 1. GET /api/projects - プロジェクト一覧取得

**ファイル**: `src/app/api/projects/route.ts:59`

**実装**:
```typescript
return NextResponse.json({ projects });
```

**仕様書** (docs/design.md:335-351):
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "my-project",
      ...
    }
  ]
}
```

**JSDoc** (src/app/api/projects/route.ts:30-39):
```json
[
  {
    "id": "uuid",
    "name": "my-project",
    ...
  }
]
```

**評価**:
- 実装と仕様書: ✅ 一致
- 統一ポリシー: ✅ 準拠
- 問題: ⚠️ JSDocが古い（配列を直接返すように記載されている）

**推奨対応**: JSDocを実装に合わせて更新

---

### 2. POST /api/projects - プロジェクト追加

**ファイル**: `src/app/api/projects/route.ts:187`

**実装**:
```typescript
return NextResponse.json({ project }, { status: 201 });
```

**仕様書** (docs/design.md:366-373):
```json
{
  "id": "uuid",
  "name": "repo-name",
  "path": "/path/to/git/repo"
}
```

**JSDoc** (src/app/api/projects/route.ts:90-99):
```json
{
  "project": {
    "id": "uuid",
    "name": "repo",
    "path": "/path/to/git/repo",
    ...
  }
}
```

**評価**:
- 実装とJSDoc: ✅ 一致
- 統一ポリシー: ✅ 準拠
- 実装と仕様書: ❌ 不一致

**問題**: 仕様書が統一ポリシーに準拠していない（プロジェクトオブジェクトを直接返すように記載）

**推奨対応**: 仕様書を実装に合わせて更新（`{ project: {...} }` 形式に変更）

---

### 3. GET /api/projects/{project_id}/sessions - セッション一覧取得

**ファイル**: `src/app/api/projects/[project_id]/sessions/route.ts:68`

**実装**:
```typescript
return NextResponse.json(sessions);
```

**仕様書** (docs/design.md:403-417):
```json
{
  "sessions": [
    {
      "id": "uuid",
      "name": "feature-auth",
      ...
    }
  ]
}
```

**JSDoc** (src/app/api/projects/[project_id]/sessions/route.ts:31-42):
```json
[
  {
    "id": "session-uuid",
    ...
  }
]
```

**評価**:
- 実装とJSDoc: ✅ 一致
- 実装と仕様書: ❌ 不一致
- 統一ポリシー: ❌ 実装が違反

**問題**: 実装が配列を直接返しており、統一ポリシーに違反している

**推奨対応**: 実装を `{ sessions }` に修正（Phase 15で対応予定）

---

### 4. GET /api/sessions/{id} - セッション詳細取得

**ファイル**: `src/app/api/sessions/[id]/route.ts:70`

**実装**:
```typescript
return NextResponse.json(targetSession);
```

**仕様書** (docs/design.md:447-471):
```json
{
  "id": "uuid",
  "name": "feature-auth",
  "status": "waiting_input",
  ...
}
```

**JSDoc** (src/app/api/sessions/[id]/route.ts:32-41):
```json
{
  "id": "session-uuid",
  ...
}
```

**評価**:
- 実装、JSDoc、仕様書: ✅ すべて一致
- 統一ポリシー: ❌ すべて違反

**問題**: 実装、JSDoc、仕様書のすべてが統一ポリシーに違反している（セッションオブジェクトを直接返している）

**推奨対応**: 実装、JSDoc、仕様書のすべてを `{ session: {...} }` 形式に修正（Phase 15で対応予定）

---

### 5. POST /api/sessions/{id}/input - メッセージ送信

**ファイル**: `src/app/api/sessions/[id]/input/route.ts:91`

**実装**:
```typescript
return NextResponse.json(message);
```

**仕様書** (docs/design.md:474-482):
- レスポンス形式の記載なし

**JSDoc** (src/app/api/sessions/[id]/input/route.ts:32-39):
```json
{
  "id": "message-uuid",
  "session_id": "session-uuid",
  "role": "user",
  "content": "Hello, Claude!",
  ...
}
```

**評価**:
- 実装とJSDoc: ✅ 一致
- 統一ポリシー: ❌ 実装が違反
- 仕様書: ⚠️ レスポンス形式の記載なし

**問題**:
1. 実装がメッセージオブジェクトを直接返しており、統一ポリシーに違反
2. 仕様書にレスポンス形式の記載がない

**推奨対応**:
1. 実装を `{ message }` 形式に修正（Phase 15で対応予定）
2. 仕様書にレスポンス形式を追加

---

### 6. POST /api/sessions/{id}/stop - セッション停止

**ファイル**: `src/app/api/sessions/[id]/stop/route.ts:86`

**実装**:
```typescript
return NextResponse.json(updatedSession);
```

**仕様書** (docs/design.md:494-496):
- レスポンス形式の記載なし

**JSDoc** (src/app/api/sessions/[id]/stop/route.ts:31-40):
```json
{
  "id": "session-uuid",
  "project_id": "uuid-1234",
  "name": "新機能実装",
  "status": "completed",
  ...
}
```

**評価**:
- 実装とJSDoc: ✅ 一致
- 統一ポリシー: ❌ 実装が違反
- 仕様書: ⚠️ レスポンス形式の記載なし

**問題**:
1. 実装がセッションオブジェクトを直接返しており、統一ポリシーに違反
2. 仕様書にレスポンス形式の記載がない

**推奨対応**:
1. 実装を `{ session: updatedSession }` 形式に修正（Phase 15で対応予定）
2. 仕様書にレスポンス形式を追加

---

## 発見された問題の分類

### A. 実装が統一ポリシーに違反（Phase 15で修正予定）

1. **GET /api/projects/{project_id}/sessions** - 配列を直接返している
   - 実装: `sessions`
   - 期待: `{ sessions }`

2. **GET /api/sessions/{id}** - オブジェクトを直接返している
   - 実装: `targetSession`
   - 期待: `{ session: targetSession }`

3. **POST /api/sessions/{id}/input** - オブジェクトを直接返している
   - 実装: `message`
   - 期待: `{ message }`

4. **POST /api/sessions/{id}/stop** - オブジェクトを直接返している
   - 実装: `updatedSession`
   - 期待: `{ session: updatedSession }`

### B. 仕様書が統一ポリシーに違反

1. **POST /api/projects** - ラップされたレスポンスを期待していない
   - 仕様書: `{ "id": "uuid", "name": "repo-name", ... }`
   - 実装: `{ project: {...} }` ✅ 正しい
   - 対応: 仕様書を修正

2. **GET /api/sessions/{id}** - ラップされたレスポンスを期待していない
   - 仕様書: `{ "id": "uuid", "name": "feature-auth", ... }`
   - 期待: `{ session: {...} }`
   - 対応: 仕様書を修正

### C. JSDocが実装と不一致

1. **GET /api/projects** - JSDocが古い形式
   - JSDoc: 配列を直接返すと記載
   - 実装: `{ projects }` ✅ 正しい
   - 対応: JSDocを更新

2. **GET /api/projects/{project_id}/sessions** - JSDocが古い形式
   - JSDoc: 配列を直接返すと記載
   - 実装: `sessions` ❌ 修正必要
   - 対応: 実装修正後、JSDocも統一ポリシーに合わせて更新

### D. 仕様書にレスポンス形式の記載がない

1. **POST /api/sessions/{id}/input** - レスポンス形式が未記載
2. **POST /api/sessions/{id}/stop** - レスポンス形式が未記載

---

## 推奨される対応順序

### フェーズ1: 実装の修正（Phase 15）

Phase 15のタスクで以下の4つのエンドポイントを修正：

1. GET /api/projects/{project_id}/sessions → `{ sessions }`
2. GET /api/sessions/{id} → `{ session: targetSession }`
3. POST /api/sessions/{id}/input → `{ message }`
4. POST /api/sessions/{id}/stop → `{ session: updatedSession }`

併せて、フロントエンド（src/store/index.ts）の対応するメソッドも修正。

### フェーズ2: 仕様書の修正

docs/design.mdを以下のように更新：

1. **POST /api/projects** (line 366-373) のレスポンス例を修正：
   ```json
   {
     "project": {
       "id": "uuid",
       "name": "repo-name",
       "path": "/path/to/git/repo"
     }
   }
   ```

2. **GET /api/sessions/{id}** (line 447-471) のレスポンス例を修正：
   ```json
   {
     "session": {
       "id": "uuid",
       "name": "feature-auth",
       "status": "waiting_input",
       ...
     }
   }
   ```

3. **POST /api/sessions/{id}/input** (line 474-482) にレスポンス形式を追加：
   ```json
   {
     "message": {
       "id": "message-uuid",
       "session_id": "session-uuid",
       "role": "user",
       "content": "...",
       ...
     }
   }
   ```

4. **POST /api/sessions/{id}/stop** (line 494-496) にレスポンス形式を追加：
   ```json
   {
     "session": {
       "id": "session-uuid",
       "status": "completed",
       ...
     }
   }
   ```

### フェーズ3: JSDocの更新

実装修正後、以下のJSDocを更新：

1. **GET /api/projects** (src/app/api/projects/route.ts:30-39)
2. **GET /api/projects/{project_id}/sessions** (src/app/api/projects/[project_id]/sessions/route.ts:31-42)

---

## その他の発見事項

### 1. ログイン機能の動作

**エンドポイント**: POST /api/auth/login
**状態**: ✅ 正常動作

- テスト: `test-token` でログイン試行
- 結果: 401 Unauthorized（期待通り）
- レスポンス: `{"error":"Invalid authentication token. Please check your token and try again. You can find the correct token in your .env file (CLAUDE_WORK_TOKEN)."}`
- 評価: 認証機能は仕様通りに動作している

### 2. フロントエンドの動作

**状態**: ✅ 基本的に正常動作

- ログインページの表示: 正常
- JavaScriptの読み込み: 正常（再起動後）
- フォームの動作: 正常
- エラーメッセージの表示: 正常

**注意事項**:
- 初回起動時にJavaScriptの404エラーが発生（Next.jsのビルド問題）
- サーバー再起動後は正常に動作

---

## 追加検証結果（2025-12-18 続き）

### 7. GET /api/sessions/{id}/diff - 差分取得

**ファイル**: `src/app/api/sessions/[id]/diff/route.ts:77`

**実装**:
```typescript
return NextResponse.json(diff);
```

**仕様書** (docs/design.md:593-616):
```json
{
  "files": [...],
  "total_additions": 45,
  "total_deletions": 12
}
```

**JSDoc** (src/app/api/sessions/[id]/diff/route.ts:30-43):
```json
{
  "files": [...],
  "totalAdditions": 5,
  "totalDeletions": 3
}
```

**評価**:
- 実装、JSDoc、仕様書: すべて一致（オブジェクトを直接返す）
- 統一ポリシー: ❌ すべて違反

**問題**: GET（単一リソース）は `{ diff: {...} }` 形式であるべき

**推奨対応**: 実装、JSDoc、仕様書のすべてを `{ diff: {...} }` 形式に修正（Phase 15で対応予定）

---

### 8. POST /api/sessions/{id}/rebase - リベース

**ファイル**: `src/app/api/sessions/[id]/rebase/route.ts:77`

**実装**:
```typescript
return NextResponse.json(result);
// result = { success: false, conflicts: [...] } (コンフリクト時)
```

**仕様書** (docs/design.md:647-653):
```json
{
  "error": "Conflict detected",
  "conflicting_files": ["src/auth.ts"]
}
```

**評価**:
- コンフリクト時のレスポンス形式が異なる
- mergeエンドポイントは実装と同じ形式（`{ success: false, conflicts: [...] }`）

**問題**: 仕様書の記載が実装と異なる

**推奨対応**: 仕様書を実装に合わせて修正（mergeとの一貫性のため）

---

### 9. GET /api/sessions/{id}/commits - コミット履歴取得

**ファイル**: 存在しない（未実装）

**仕様書** (docs/design.md:618-635):
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

**評価**:
- 仕様書に記載されているが、実装ファイルが存在しない
- レスポンス形式は統一ポリシーに準拠している ✅

**問題**: 実装漏れ

**推奨対応**: Phase 16で新規実装

---

### 10. その他の検証済みエンドポイント

以下のエンドポイントは問題なし：

- **GET /api/sessions/{id}/messages**: `{ messages: [...] }` ✅ 統一ポリシー準拠
- **POST /api/sessions/{id}/approve**: `{ success: true, action }` ✅ 実装と仕様書が一致
- **POST /api/sessions/{id}/merge**: `{ success: true }` / `{ success: false, conflicts: [...] }` ✅ 実装と仕様書が一致

---

## まとめ

### 重要度: High

Phase 11で定義された統一APIレスポンス形式のポリシーが、実装と仕様書の両方で部分的にしか適用されていません。

**主な問題**:
1. 5つのエンドポイントの実装が統一ポリシーに違反（Phase 15で修正予定）
2. 仕様書の3つのエンドポイントが統一ポリシーに準拠していない
3. 2つのエンドポイントのレスポンス形式が仕様書に記載されていない
4. JSDocと実装が不一致の箇所がある
5. 1つのエンドポイントが未実装（Phase 16で実装予定）

**影響**:
- フロントエンドとバックエンドの統合に混乱が生じる可能性
- APIの一貫性が損なわれている
- 開発者がAPIを使用する際に仕様を誤解する可能性
- 仕様書に記載された機能が実際には使えない

**推奨対応**:
1. Phase 15のタスクを実行して5つのエンドポイントの実装を修正
2. 仕様書（docs/design.md）を統一ポリシーに合わせて更新（4箇所）
3. すべてのJSDocを実装と一致させる
4. Phase 16でcommitsエンドポイントを実装

---

## 参照

- Phase 11: API Response Format Unification
- Phase 12 Task 12.3: docs/design.mdの更新（コミット: eb0050f）
- Phase 15: APIレスポンス形式の統一実装（docs/tasks/phase15.md）
- docs/design.md: API設計仕様書
