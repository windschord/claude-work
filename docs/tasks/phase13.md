# フェーズ13: Phase 12マージ後の不具合修正

推定期間: 120分（AIエージェント作業時間）
MVP: Yes

## 概要

Phase 12マージ後の動作検証で発見された不具合を修正します。
Next.jsビルド問題とDATABASE_URL設定問題を優先的に解決し、その後Dialogキャンセルボタンの問題を修正します。

**参照**: `docs/verification-report-phase12-post-merge.md`

---

## タスク13.1: Next.jsビルドプロセスの追加

**優先度**: Critical
**推定工数**: 30分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

Next.jsアプリケーションが起動しない問題を修正します。開発サーバー起動時に自動的にビルドが実行されるようにpackage.jsonのdevスクリプトを変更します。

**現在の問題**:
- `.next/server/pages/_document.js`が見つからず、404エラーが発生
- ルートページにアクセスすると「missing required error components, refreshing...」が表示され続ける

**修正内容**:
- `package.json`の`dev`スクリプトを修正
- Next.jsのビルドを実行してから開発サーバーを起動するように変更

### 実装手順

1. **package.jsonの確認**: 現在のdevスクリプトを確認
   ```bash
   # 現在の設定を確認
   cat package.json | grep -A 5 "scripts"
   ```

2. **devスクリプトの修正**: ビルドを含めるように変更
   ```json
   {
     "scripts": {
       "dev": "next build && ts-node -r tsconfig-paths/register --project tsconfig.server.json server.ts",
       "build": "next build",
       "start": "ts-node -r tsconfig-paths/register --project tsconfig.server.json server.ts"
     }
   }
   ```

3. **動作確認**:
   ```bash
   # 既存の.nextディレクトリを削除
   rm -rf .next

   # 開発サーバーを起動（バックグラウンド）
   npm run dev &

   # ビルド完了を待機（約30秒）
   sleep 30

   # ルートページにアクセスして確認
   curl -I http://localhost:3000/
   ```

4. **ビルド成果物の確認**: `.next`ディレクトリが正しく生成されているか確認
   ```bash
   # .next/server/pages/が存在するか確認
   ls -la .next/server/pages/ || echo "Pages directory not found"

   # .next/server/app/が存在するか確認（App Router使用時）
   ls -la .next/server/app/ || echo "App directory not found"
   ```

5. **変更をコミット**:
   ```bash
   git add package.json
   git commit -m "fix: Next.jsビルドプロセスをdevスクリプトに追加

- npm run devでnext buildを自動実行
- .next/server/pages/_document.jsのENOENTエラーを解決
- 参照: docs/verification-report-phase12-post-merge.md 問題1"
   ```

### 受入基準

- [ ] `package.json`の`dev`スクリプトが`next build`を含んでいる
- [ ] `rm -rf .next && npm run dev`を実行後、`.next`ディレクトリが生成される
- [ ] `.next/server/`ディレクトリにビルド成果物が存在する
- [ ] `http://localhost:3000/`にアクセスして404エラーが発生しない
- [ ] ブラウザで「missing required error components」エラーが表示されない
- [ ] 変更がコミットされている

### 依存関係

なし

### 情報の明確性

**明示された情報**:
- 問題: `.next/server/pages/_document.js`が見つからない（docs/verification-report-phase12-post-merge.md:53-58）
- 現在のdevスクリプト: `ts-node -r tsconfig-paths/register --project tsconfig.server.json server.ts`
- 使用技術: Next.js 15、TypeScript、カスタムサーバー（server.ts）
- 修正方針: ビルドプロセスの追加（ユーザー確認済み）

**不明/要確認の情報**:
- なし（ユーザーに確認済み）

---

## タスク13.2: DATABASE_URL環境変数の設定必須化

**優先度**: Critical
**推定工数**: 40分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

環境変数`DATABASE_URL`が未設定の場合にアプリケーションを起動させず、明確なエラーメッセージを表示します。読み取り専用のテスト用データベースが誤って使用されることを防ぎます。

**現在の問題**:
- `src/lib/db.ts`がデフォルト値として読み取り専用のテスト用DB（`file:./data/test.db`）を設定している
- セッション作成時に書き込みエラーが発生する
- エラーメッセージが不明確で原因特定が困難

**修正内容**:
- `src/lib/db.ts`のデフォルト値設定を削除
- 環境変数チェック機能を追加
- 明確なエラーメッセージを表示

### 実装手順

1. **TDD: テストの作成**

   `src/lib/db.test.ts`を作成し、以下のテストケースを実装：

   ```typescript
   import { describe, it, expect, afterEach, vi } from 'vitest';

   describe('Database Configuration', () => {
     const originalEnv = process.env.DATABASE_URL;

     afterEach(() => {
       // 環境変数を元に戻す
       if (originalEnv) {
         process.env.DATABASE_URL = originalEnv;
       } else {
         delete process.env.DATABASE_URL;
       }
       vi.resetModules();
     });

     it('DATABASE_URLが設定されていない場合、エラーをスローする', async () => {
       delete process.env.DATABASE_URL;

       await expect(async () => {
         // db.tsを再読み込みしてチェック
         vi.resetModules();
         await import('./db');
       }).rejects.toThrow('DATABASE_URL environment variable is not set');
     });

     it('DATABASE_URLが設定されている場合、エラーをスローしない', () => {
       process.env.DATABASE_URL = 'file:./prisma/data/claudework.db';

       expect(() => {
         vi.resetModules();
         require('./db');
       }).not.toThrow();
     });

     it('DATABASE_URLが空文字の場合、エラーをスローする', () => {
       process.env.DATABASE_URL = '';

       expect(() => {
         vi.resetModules();
         require('./db');
       }).toThrow('DATABASE_URL environment variable is not set');
     });
   });
   ```

2. **テストの実行と失敗確認**:
   ```bash
   npm test src/lib/db.test.ts
   ```

3. **テストのコミット**:
   ```bash
   git add src/lib/db.test.ts
   git commit -m "test: DATABASE_URL環境変数チェックのテストを追加

- DATABASE_URL未設定時のエラーテスト
- DATABASE_URL設定時の正常動作テスト
- 空文字チェックのテスト

参照: docs/verification-report-phase12-post-merge.md 問題2"
   ```

4. **src/lib/db.tsの修正**:

   現在のコード（4-5行目）:
   ```typescript
   const databaseUrl = process.env.DATABASE_URL || 'file:./data/test.db';
   export const prisma = new PrismaClient({
   ```

   修正後:
   ```typescript
   const databaseUrl = process.env.DATABASE_URL;

   if (!databaseUrl || databaseUrl.trim() === '') {
     throw new Error(
       'DATABASE_URL environment variable is not set. ' +
       'Please set it in your .env file. ' +
       'Example: DATABASE_URL=file:./prisma/data/claudework.db'
     );
   }

   export const prisma = new PrismaClient({
   ```

5. **テストの再実行と通過確認**:
   ```bash
   npm test src/lib/db.test.ts
   ```

6. **実装のコミット**:
   ```bash
   git add src/lib/db.ts
   git commit -m "fix: DATABASE_URL環境変数の設定を必須化

- デフォルト値（file:./data/test.db）を削除
- 未設定時に明確なエラーメッセージを表示
- 読み取り専用DBの誤使用を防止

参照: docs/verification-report-phase12-post-merge.md 問題2"
   ```

7. **.env.exampleの確認と更新**:

   `.env.example`ファイルを確認し、DATABASE_URLの説明を明確にする：

   ```bash
   # .env.exampleの該当箇所を確認
   grep -A 2 "DATABASE_URL" .env.example
   ```

   必要に応じて説明を追加：
   ```
   # Database URL (REQUIRED)
   # This is required for the application to start
   # For development: file:./prisma/data/claudework.db
   # For production: postgresql://user:password@host:port/database
   DATABASE_URL=file:./prisma/data/claudework.db
   ```

8. **READMEの更新**:

   `README.md`のセットアップ手順に環境変数設定の注意書きを追加：

   ```markdown
   ### 環境変数の設定

   **重要**: `.env`ファイルで`DATABASE_URL`を必ず設定してください。未設定の場合、アプリケーションは起動しません。

   1. `.env.example`をコピーして`.env`ファイルを作成
      ```bash
      cp .env.example .env
      ```

   2. `.env`ファイルで`DATABASE_URL`を確認・設定
      ```
      DATABASE_URL=file:./prisma/data/claudework.db
      ```
   ```

9. **ドキュメント更新のコミット**:
   ```bash
   git add .env.example README.md
   git commit -m "docs: DATABASE_URL設定の重要性を明記

- .env.exampleにコメントを追加
- READMEにセットアップ手順を追加
- 環境変数が必須であることを強調

参照: docs/verification-report-phase12-post-merge.md 問題2"
   ```

10. **動作確認**:
    ```bash
    # DATABASE_URLを未設定にして起動を試みる
    unset DATABASE_URL
    npm run dev
    # エラーメッセージが表示されることを確認

    # DATABASE_URLを設定して起動
    export DATABASE_URL=file:./prisma/data/claudework.db
    npm run dev
    # 正常に起動することを確認
    ```

### 受入基準

- [ ] `src/lib/db.test.ts`が作成されている
- [ ] テストが3つ含まれている（未設定、設定済み、空文字）
- [ ] テストのみのコミットが存在する
- [ ] `src/lib/db.ts`のデフォルト値設定が削除されている
- [ ] 環境変数未設定時に明確なエラーメッセージが表示される
- [ ] すべてのテストが通過する（`npm test`）
- [ ] `.env.example`にDATABASE_URLの説明が追加されている
- [ ] READMEに環境変数設定の手順が追加されている
- [ ] 実装とドキュメント更新のコミットが存在する
- [ ] DATABASE_URL未設定で起動するとエラーが発生する
- [ ] DATABASE_URL設定済みで正常に起動する

### 依存関係

- タスク13.1（Next.jsビルドプロセスの追加）が完了していること

### 情報の明確性

**明示された情報**:
- 問題箇所: `src/lib/db.ts` 4-5行目
- 現在のデフォルト値: `file:./data/test.db`（読み取り専用）
- 正しいデフォルト値: なし（環境変数を必須とする）
- エラーの内容: Prismaエラー「attempt to write a readonly database」
- 推定原因: Phase 12タスク12.1で調査済み
- 修正方針: .envファイルの設定を必須化（ユーザー確認済み）
- 使用技術: Prisma、SQLite

**不明/要確認の情報**:
- なし（ユーザーに確認済み）

---

## タスク13.3: Dialogキャンセルボタンの修正

**優先度**: Medium
**推定工数**: 50分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

プロジェクト追加Dialogのキャンセルボタンが正常に動作しない問題を修正します。クリック時に即座にDialogが閉じるようにします。

**現在の問題**:
- キャンセルボタンをクリックすると5秒後にタイムアウトエラーが発生
- Escキーでは正常に閉じる
- クリックイベントハンドリングに問題がある可能性

**修正内容**:
- `src/components/projects/AddProjectModal.tsx`のキャンセルボタン実装を修正
- クリックイベントハンドラを見直す

### 実装手順

1. **TDD: テストの作成**

   `src/components/projects/AddProjectModal.test.tsx`に新しいテストケースを追加：

   ```typescript
   import { describe, it, expect, vi } from 'vitest';
   import { render, screen, fireEvent, waitFor } from '@testing-library/react';
   import AddProjectModal from './AddProjectModal';

   describe('AddProjectModal - キャンセルボタン', () => {
     it('キャンセルボタンをクリックするとonCloseが呼ばれる', async () => {
       const onClose = vi.fn();
       const onSuccess = vi.fn();

       render(
         <AddProjectModal
           isOpen={true}
           onClose={onClose}
           onSuccess={onSuccess}
         />
       );

       // キャンセルボタンを取得
       const cancelButton = screen.getByRole('button', { name: /キャンセル/i });

       // クリック
       fireEvent.click(cancelButton);

       // onCloseが即座に呼ばれることを確認
       await waitFor(() => {
         expect(onClose).toHaveBeenCalledTimes(1);
       }, { timeout: 1000 }); // 1秒以内に呼ばれるべき
     });

     it('キャンセルボタンをクリックするとフォームがリセットされる', async () => {
       const onClose = vi.fn();
       const onSuccess = vi.fn();

       render(
         <AddProjectModal
           isOpen={true}
           onClose={onClose}
           onSuccess={onSuccess}
         />
       );

       // フォームに入力
       const pathInput = screen.getByLabelText(/プロジェクトパス/i);
       fireEvent.change(pathInput, { target: { value: '/test/path' } });

       // キャンセルボタンをクリック
       const cancelButton = screen.getByRole('button', { name: /キャンセル/i });
       fireEvent.click(cancelButton);

       // フォームがリセットされることを確認
       await waitFor(() => {
         expect(pathInput).toHaveValue('');
       });
     });

     it('Escキーでもダイアログが閉じる', async () => {
       const onClose = vi.fn();
       const onSuccess = vi.fn();

       render(
         <AddProjectModal
           isOpen={true}
           onClose={onClose}
           onSuccess={onSuccess}
         />
       );

       // Escキーを押す
       fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

       // onCloseが呼ばれることを確認
       await waitFor(() => {
         expect(onClose).toHaveBeenCalledTimes(1);
       });
     });
   });
   ```

2. **テストの実行と失敗確認**:
   ```bash
   npm test src/components/projects/AddProjectModal.test.tsx
   ```

3. **テストのコミット**:
   ```bash
   git add src/components/projects/AddProjectModal.test.tsx
   git commit -m "test: Dialogキャンセルボタンのテストを追加

- クリック時のonClose呼び出しテスト
- フォームリセットのテスト
- Escキーでの閉じるテスト

参照: docs/verification-report-phase12-post-merge.md 問題3"
   ```

4. **src/components/projects/AddProjectModal.tsxの確認**:

   現在の実装（123行目付近）を確認：
   ```bash
   sed -n '120,130p' src/components/projects/AddProjectModal.tsx
   ```

5. **キャンセルボタンの修正**:

   可能性のある問題と修正案：

   **パターンA: イベント伝播の問題**
   ```typescript
   <button
     type="button"
     onClick={(e) => {
       e.preventDefault();
       e.stopPropagation();
       handleClose();
     }}
     className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
     disabled={isLoading}
   >
     キャンセル
   </button>
   ```

   **パターンB: Headless UI Dialogとの統合**

   Dialogのボタンとして正しく認識されるよう、Headless UIのコンポーネントを使用：
   ```typescript
   import { Dialog } from '@headlessui/react';

   // ...

   <Dialog.Panel>
     {/* ... */}
     <div className="mt-4 flex justify-end gap-2">
       <button
         type="button"
         onClick={handleClose}
         className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
       >
         キャンセル
       </button>
       {/* ... */}
     </div>
   </Dialog.Panel>
   ```

   **パターンC: handleClose関数の修正**
   ```typescript
   const handleClose = useCallback(() => {
     setPath('');
     setError('');
     onClose();
   }, [onClose]);
   ```

6. **テストの再実行と通過確認**:
   ```bash
   npm test src/components/projects/AddProjectModal.test.tsx
   ```

7. **実装のコミット**:
   ```bash
   git add src/components/projects/AddProjectModal.tsx
   git commit -m "fix: Dialogキャンセルボタンのクリックイベント修正

- イベント伝播の停止を追加
- handleClose関数をuseCallbackでメモ化
- クリック時に即座にDialogが閉じるよう修正

参照: docs/verification-report-phase12-post-merge.md 問題3"
   ```

8. **E2Eテストでの動作確認**:

   Chrome DevToolsを使用して実際のブラウザで動作を確認：

   ```bash
   # 開発サーバーを起動
   npm run dev

   # 別のターミナルでE2Eテストを実行
   npx playwright test --headed --project=chromium
   ```

   手動でも確認：
   - ブラウザで`http://localhost:3000/`にアクセス
   - 「プロジェクト追加」ボタンをクリック
   - Dialogが表示されることを確認
   - 「キャンセル」ボタンをクリック
   - **即座に**Dialogが閉じることを確認（タイムアウトなし）
   - Escキーでも閉じることを確認

### 受入基準

- [ ] `src/components/projects/AddProjectModal.test.tsx`に新しいテストが追加されている
- [ ] テストが3つ含まれている（クリック、リセット、Escキー）
- [ ] テストのみのコミットが存在する
- [ ] `src/components/projects/AddProjectModal.tsx`のキャンセルボタンが修正されている
- [ ] すべてのテストが通過する（`npm test`）
- [ ] 実装のコミットが存在する
- [ ] 実ブラウザでキャンセルボタンをクリックすると即座にDialogが閉じる
- [ ] タイムアウトエラーが発生しない
- [ ] Escキーでも正常に閉じる（既存動作の維持）
- [ ] フォームの値がリセットされる

### 依存関係

- タスク13.1（Next.jsビルドプロセスの追加）が完了していること
- タスク13.2（DATABASE_URL環境変数の設定必須化）が完了していること

### 情報の明確性

**明示された情報**:
- 問題箇所: `src/components/projects/AddProjectModal.tsx` 123行目
- 症状: クリック時に5秒後タイムアウト、Escキーでは正常動作
- 使用ライブラリ: Headless UI Dialog
- 既存のhandleClose関数: 55-59行目
- 推定原因: Phase 12タスク12.2で確認済み
- 使用技術: React、TypeScript、Headless UI、Tailwind CSS

**不明/要確認の情報**:
- なし（Phase 12で確認済み）

---

## フェーズ完了条件

- [ ] すべてのタスク（13.1〜13.3）が完了している
- [ ] タスク13.1: Next.jsアプリケーションが正常に起動する
- [ ] タスク13.2: DATABASE_URL未設定時にエラーメッセージが表示される
- [ ] タスク13.3: Dialogキャンセルボタンが即座に動作する
- [ ] 各タスクのコミットメッセージがConventional Commitsに従っている
- [ ] すべてのテストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである
- [ ] 実ブラウザでの動作確認が完了している

## 備考

### タスクの実行順序

**必ず以下の順序で実行してください**:

1. タスク13.1（Next.jsビルドプロセス）
2. タスク13.2（DATABASE_URL設定必須化）
3. タスク13.3（Dialogキャンセルボタン）

タスク13.1と13.2はアプリケーションの起動に必須のため、これらが完了しないとタスク13.3の動作確認ができません。

### TDDの徹底

すべてのタスクでテスト駆動開発（TDD）を採用しています：

1. まずテストを書く
2. テストが失敗することを確認
3. テストをコミット
4. 実装してテストを通す
5. 実装をコミット

この順序を守ることで、品質の高いコードと信頼性の高いテストスイートを構築できます。

### 環境変数の管理

タスク13.2完了後、開発者は以下を実施する必要があります：

1. `.env.example`をコピーして`.env`を作成
2. `DATABASE_URL`を適切に設定
3. アプリケーションを起動して動作確認

### 動作確認の重要性

タスク13.3では、自動テストだけでなく実ブラウザでの動作確認が必須です。Chrome DevToolsを使用したE2Eテストや手動確認を行い、実際のユーザー体験を確認してください。

### Next.js 15の注意点

このプロジェクトはNext.js 15を使用しています：

- App Routerを使用
- カスタムサーバー（server.ts）を使用
- TypeScriptで記述
- ビルドプロセスが必須

### コミットメッセージの規約

すべてのコミットはConventional Commits形式に従ってください：

- `test:` - テストの追加・修正
- `fix:` - バグ修正
- `docs:` - ドキュメントの更新

### 参照ドキュメント

- 検証レポート: `docs/verification-report-phase12-post-merge.md`
- Phase 12タスク: `docs/tasks/phase12.md`
- 設計書: `docs/design.md`
- Next.js設定: `next.config.ts`
- TypeScript設定: `tsconfig.json`、`tsconfig.server.json`
- カスタムサーバー: `server.ts`
