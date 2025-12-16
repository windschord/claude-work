# フェーズ8: バグ修正（PR#2レビュー結果対応）

*推定期間: 120分（AIエージェント作業時間）*
*MVP: Yes*

## 概要

PR#2（nodejs-architecture）の動作確認レビューで発見された4つの問題を修正します。
すべてのタスクはTDD（テスト駆動開発）で実装します。

**参照**: `review-findings.md`

---

## タスク8.1: プロジェクト一覧APIレスポンス形式の修正

**優先度**: Blocker
**推定工数**: 20分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

プロジェクト一覧API（GET /api/projects）のレスポンス形式が設計書と異なり、フロントエンドが期待する形式と不一致です。

**ファイル**: `src/app/api/projects/route.ts:58`

**現在のレスポンス**:
```json
[
  {
    "id": "uuid",
    "name": "project-name",
    ...
  }
]
```

**設計書の期待値** (`docs/design.md:348-356`):
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "project-name",
      ...
    }
  ]
}
```

**フロントエンドの期待** (`src/store/index.ts:424-425`):
```typescript
const data = await response.json();
set({ projects: data.projects || [] });
```

### 実装手順（TDD）

1. **テスト作成**: `src/app/api/projects/route.test.ts`にテストケースを作成
   - GET /api/projectsのレスポンス形式が`{projects: [...]}`であることを検証
   - 空の場合は`{projects: []}`を返すことを検証
2. **テスト実行**: テストが失敗することを確認
3. **テストコミット**: テストのみをコミット（`test: プロジェクト一覧APIレスポンス形式のテストを追加`）
4. **実装**: `src/app/api/projects/route.ts:58`を修正
   ```typescript
   return NextResponse.json({ projects });
   ```
5. **テスト実行**: すべてのテストが通過することを確認
6. **実装コミット**: 実装をコミット（`fix: プロジェクト一覧APIのレスポンス形式を修正`）

### 受入基準

- [ ] `src/app/api/projects/route.test.ts`が存在する
- [ ] テストが2つ以上含まれている（プロジェクトあり/なしのケース）
- [ ] テストのみのコミットが存在する
- [ ] GET /api/projectsのレスポンスが`{projects: [...]}`形式になっている
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ブラウザでプロジェクト一覧が正しく表示される
- [ ] 実装のコミットが存在する

### 依存関係

なし

---

## タスク8.2: ALLOWED_PROJECT_DIRS空文字列処理の修正

**優先度**: Blocker
**推定工数**: 35分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

`ALLOWED_PROJECT_DIRS`環境変数が空文字列の場合、「すべて許可」ではなく「すべて拒否」になる問題を修正します。

**ファイル**: `src/app/api/projects/route.ts` (135-159行)

**現在の動作**:
```typescript
const allowedDirs = process.env.ALLOWED_PROJECT_DIRS?.split(',').map((dir) => dir.trim());
if (allowedDirs && allowedDirs.length > 0) {
  // 空文字列でも配列長は1になるため、このブロックが実行される
  // "".split(',') → [""] となり、allowedDirs = [""] になる
  // 結果として空文字列との比較が行われ、すべてのパスが拒否される
}
```

**実際のログ**:
```
Path not in allowed directories {
  path: "/Users/tsk/Sync/git/claude-work",
  allowedDirs: [""]
}
```

**期待される動作**: 空文字列または未設定の場合は、すべてのディレクトリを許可する

### 実装手順（TDD）

1. **テスト作成**: `src/app/api/projects/route.test.ts`にテストケースを追加
   - `ALLOWED_PROJECT_DIRS=""`（空文字列）の場合、すべてのパスが許可される
   - `ALLOWED_PROJECT_DIRS`が未設定の場合、すべてのパスが許可される
   - `ALLOWED_PROJECT_DIRS="/path1,/path2"`の場合、許可されたパスのみ許可される
   - 許可されていないパスの場合、403エラーが返される
2. **テスト実行**: 新しいテストが失敗することを確認
3. **テストコミット**: テストのみをコミット（`test: ALLOWED_PROJECT_DIRS空文字列処理のテストを追加`）
4. **実装**: `src/app/api/projects/route.ts` (135-159行)を修正
   ```typescript
   const allowedDirsStr = process.env.ALLOWED_PROJECT_DIRS?.trim();
   if (allowedDirsStr) {
     const allowedDirs = allowedDirsStr.split(',').map((dir) => dir.trim()).filter(Boolean);
     if (allowedDirs.length > 0) {
       // チェック処理
       const isAllowed = allowedDirs.some((allowedDir) =>
         resolvedPath.startsWith(resolve(allowedDir))
       );
       if (!isAllowed) {
         logger.warn('Path not in allowed directories', { path: resolvedPath, allowedDirs });
         return NextResponse.json(
           { error: '指定されたパスは許可されていません' },
           { status: 403 }
         );
       }
     }
   }
   // allowedDirsStrが空または未設定の場合、チェックをスキップ（すべて許可）
   ```
5. **テスト実行**: すべてのテストが通過することを確認
6. **実装コミット**: 実装をコミット（`fix: ALLOWED_PROJECT_DIRS空文字列時にすべてのパスを許可`）

### 受入基準

- [ ] `src/app/api/projects/route.test.ts`にテストケースが4つ以上追加されている
- [ ] テストのみのコミットが存在する
- [ ] `ALLOWED_PROJECT_DIRS=""`の場合、すべてのパスが許可される
- [ ] `ALLOWED_PROJECT_DIRS`未設定の場合、すべてのパスが許可される
- [ ] `ALLOWED_PROJECT_DIRS="/path1,/path2"`の場合、指定パスのみ許可される
- [ ] 許可外パスの場合、403エラーと日本語メッセージが返される
- [ ] すべてのテストが通過する（`npm test`）
- [ ] 実装のコミットが存在する

### 依存関係

なし

---

## タスク8.3: プロジェクト追加エラー時のクライアント側エラーハンドリング強化

**優先度**: High
**推定工数**: 35分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

プロジェクト追加APIが403を返した後、クライアント側で「Cannot read properties of undefined (reading 'id')」エラーが発生する問題を修正します。

**エラー箇所**: `src/components/layout/Sidebar.tsx:74` - `selectedProjectId === project.id`
**関連ファイル**: `src/store/index.ts:437-476` - `addProject`関数

**原因**:
- 403エラーのハンドリングが不足している
- エラー時にトースト通知が表示されていない
- データのバリデーションが不足している（undefinedチェック）

### 実装手順（TDD）

1. **テスト作成**: `src/store/index.test.ts`にテストケースを追加
   - プロジェクト追加が403エラーの場合、適切なエラーメッセージがスローされる
   - エラー後もstateのprojects配列にundefinedが含まれない
   - エラー後もstateのprojects配列が破壊されない
2. **テスト実行**: テストが失敗することを確認
3. **テストコミット**: テストのみをコミット（`test: プロジェクト追加エラーハンドリングのテストを追加`）
4. **実装**: `src/store/index.ts:437-476`を修正
   - 403エラーのハンドリングを追加（447行目の`if (!response.ok)`ブロック内）
   ```typescript
   if (response.status === 403) {
     throw new Error('指定されたパスは許可されていません');
   }
   ```
   - 464-467行目のデータ検証を強化
   ```typescript
   const data = await response.json();
   if (!data.project || !data.project.id) {
     throw new Error('プロジェクトの追加に失敗しました');
   }
   set((state) => ({
     projects: [...state.projects, data.project],
   }));
   ```
5. **UI実装**: トースト通知コンポーネントの統合（エラー発生時にトースト表示）
   - 既存のトースト実装がある場合はそれを使用
   - ない場合は簡易的なトースト実装を追加
6. **テスト実行**: すべてのテストが通過することを確認
7. **実装コミット**: 実装をコミット（`fix: プロジェクト追加エラー時のハンドリングとトースト通知を追加`）

### 受入基準

- [ ] `src/store/index.test.ts`にテストケースが3つ以上追加されている
- [ ] テストのみのコミットが存在する
- [ ] 403エラーのハンドリングが実装されている
- [ ] エラー時に適切な日本語メッセージがスローされる
- [ ] データのバリデーション（undefinedチェック）が実装されている
- [ ] エラー時にトースト通知が表示される
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ブラウザで403エラー時にトースト通知が表示される
- [ ] 実装のコミットが存在する

### 依存関係

なし

---

## タスク8.4: 重複プロジェクト追加時のエラーハンドリング改善

**優先度**: High
**推定工数**: 30分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

同じパスのプロジェクトを追加しようとすると500エラーが返される問題を修正します。
Prismaの`Unique constraint failed on the fields: (path)`エラーを適切にハンドリングし、409 Conflictエラーを返すようにします。

**ファイル**: `src/app/api/projects/route.ts` (POST /api/projects)
**Prismaエラーコード**: P2002

**現在の動作**: 500 Internal Server Error
**期待される動作**: 409 Conflict + 日本語メッセージ「既に登録されています」

### 実装手順（TDD）

1. **テスト作成**: `src/app/api/projects/route.test.ts`にテストケースを追加
   - 同じパスで2回プロジェクトを作成すると409エラーが返される
   - エラーメッセージが「このパスは既に登録されています」である
2. **テスト実行**: テストが失敗することを確認
3. **テストコミット**: テストのみをコミット（`test: 重複プロジェクト追加のテストを追加`）
4. **実装**: `src/app/api/projects/route.ts`のPOSTハンドラーにPrismaエラーハンドリングを追加
   ```typescript
   import { Prisma } from '@prisma/client';

   // POSTハンドラーのtry-catchブロック内
   try {
     // ... プロジェクト作成処理 ...
   } catch (error) {
     // Prisma P2002エラー（Unique constraint violation）のハンドリング
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
       if (error.code === 'P2002') {
         logger.warn('Duplicate project path', { error });
         return NextResponse.json(
           { error: 'このパスは既に登録されています' },
           { status: 409 }
         );
       }
     }

     logger.error('Failed to create project', { error });
     return NextResponse.json(
       { error: 'プロジェクトの追加に失敗しました' },
       { status: 500 }
     );
   }
   ```
5. **クライアント側対応**: `src/store/index.ts`のaddProject関数に409エラーハンドリングを追加
   ```typescript
   if (response.status === 409) {
     throw new Error('このパスは既に登録されています');
   }
   ```
6. **テスト実行**: すべてのテストが通過することを確認
7. **実装コミット**: 実装をコミット（`fix: 重複プロジェクト追加時に409エラーを返す`）

### 受入基準

- [ ] `src/app/api/projects/route.test.ts`にテストケースが2つ以上追加されている
- [ ] テストのみのコミットが存在する
- [ ] Prismaエラーコード`P2002`のハンドリングが実装されている
- [ ] 重複パスで409エラーが返される
- [ ] エラーメッセージが「このパスは既に登録されています」である
- [ ] クライアント側で409エラーのハンドリングが実装されている
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ブラウザで重複プロジェクト追加時にトースト通知が表示される
- [ ] 実装のコミットが存在する

### 依存関係

- タスク8.3（トースト通知の実装）

---

## フェーズ完了条件

- [ ] すべてのタスク（8.1〜8.4）が完了している
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ブラウザでプロジェクト一覧が正しく表示される
- [ ] プロジェクト追加が正常に動作する
- [ ] エラー時にトースト通知が表示される
- [ ] 各タスクのコミットメッセージがConventional Commitsに従っている
- [ ] TDDサイクル（テストコミット→実装コミット）が守られている

## 備考

### TDDの重要性

このフェーズではすべてのタスクでTDD（テスト駆動開発）を採用します。
バグ修正において、テストを先に書くことで：
- バグの再現条件を明確にできる
- 修正後の回帰を防げる
- 修正の妥当性を検証できる

### エラーメッセージの一貫性

すべてのエラーメッセージは日本語で統一します。
ユーザー向けメッセージとして分かりやすさを重視します。

### HTTP ステータスコード

- 400 Bad Request: クライアント側のバリデーションエラー
- 403 Forbidden: 権限エラー（許可されていないパス）
- 409 Conflict: リソースの競合（重複登録）
- 500 Internal Server Error: サーバー側の予期しないエラー
