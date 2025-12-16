# PR#2 動作確認レビュー結果

## 実施日時
2025-12-16

## 確認環境
- ブランチ: nodejs-architecture
- Node.js: >=20
- データベース: SQLite (./data/claudework.db)

## 修正した問題

### 1. Edge Runtimeでloggerが使用できない問題
**ファイル**: `src/middleware.ts`
**問題**: winstonを使用したloggerがEdge Runtimeで動作しない（process.nextTickが使用不可）
**修正内容**: `logger.warn`を`console.warn`に変更
**修正コミット**: middleware.tsのlogger使用を削除

### 2. 環境変数が読み込まれない問題
**ファイル**: `server.ts`, `package.json`
**問題**: dotenvパッケージがインストールされておらず、.envファイルが読み込まれない
**修正内容**:
- dotenvパッケージをインストール
- server.tsの先頭に`import 'dotenv/config';`を追加
**修正コミット**: dotenvパッケージを追加

### 3. tsconfig-pathsが動作しない問題
**ファイル**: `tsconfig.server.json`
**問題**: baseUrlとpathsの設定が不足しており、`@/`パスエイリアスが解決できない
**修正内容**: tsconfig.server.jsonにbaseUrlとpathsを追加
**コミット**: tsconfig.server.jsonを修正

### 4. .envファイルが存在しない問題
**ファイル**: `.env`
**問題**: .envファイルが存在せず、環境変数が設定されていない
**修正内容**: .env.exampleから.envを作成
**注意**: .envファイルは.gitignoreに含まれているため、各環境で作成が必要

### 5. ALLOWED_PROJECT_DIRSの設定
**ファイル**: `.env`
**問題**: デフォルトで空文字列の場合、すべてのディレクトリが拒否される
**修正内容**: `/Users/tsk/Sync/git`を設定
**注意**: 本番環境では適切なパスに変更が必要

## 未修正の設計差異

### 1. ALLOWED_PROJECT_DIRSの空文字列処理
**ファイル**: `src/app/api/projects/route.ts` (135-159行)
**問題**: ALLOWED_PROJECT_DIRSが空文字列の場合、「すべて許可」ではなく「すべて拒否」になる
**影響**: デフォルト設定でプロジェクトを追加できない
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
**期待される動作**: 空文字列または未設定の場合は、すべてのディレクトリを許可するべき
**推奨修正**:
```typescript
const allowedDirsStr = process.env.ALLOWED_PROJECT_DIRS?.trim();
if (allowedDirsStr) {
  const allowedDirs = allowedDirsStr.split(',').map((dir) => dir.trim()).filter(Boolean);
  if (allowedDirs.length > 0) {
    // チェック処理
  }
}
```

### 2. プロジェクト追加後のクライアント側エラー
**問題**: プロジェクト追加APIが403を返した後、クライアント側で「Cannot read properties of undefined (reading 'id')」エラーが発生
**エラー箇所**: `src/components/layout/Sidebar.tsx:74` - `selectedProjectId === project.id`
**原因**: エラーハンドリングが不完全で、`project`がundefinedの状態でアクセスしている可能性
**影響**: アプリケーション全体がクラッシュし、エラー画面が表示される
**推奨**: エラーハンドリングとnullチェックの強化

### 3. プロジェクト一覧が表示されない問題（APIレスポンス形式の不一致）
**問題**: APIでプロジェクトを1件取得できているが、画面には「プロジェクトがありません」と表示される
**ファイル**: `src/app/api/projects/route.ts:58`
**原因**: 設計書と実装のレスポンス形式が異なる
**設計書の期待値** (`docs/design.md:348-356`):
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
**実際のAPIレスポンス**:
```json
[
  {
    "id": "bb75e609-4e1a-4167-a11e-0e461a878934",
    "name": "claude-work",
    ...
  }
]
```
**フロントエンドの期待** (`src/store/index.ts:424-425`):
```typescript
const data = await response.json();
set({ projects: data.projects || [] });
```
**影響**: プロジェクトを追加してもUIに表示されない（致命的なバグ）
**推奨修正**: `src/app/api/projects/route.ts:58`を以下のように修正:
```typescript
return NextResponse.json({ projects });
```

### 4. 重複プロジェクト追加時のエラーハンドリング
**問題**: 同じパスのプロジェクトを追加しようとすると500エラーが返される
**エラー**: `Unique constraint failed on the fields: (path)`
**期待される動作**: 400エラーで「既に登録されています」などのメッセージを返すべき
**影響**: ユーザーフレンドリーでないエラーメッセージ

## 動作確認状況

### 確認済み機能
- ✅ ログイン画面の表示
- ✅ 認証機能（トークンベース）
- ✅ プロジェクト一覧画面の表示
- ✅ プロジェクト追加ダイアログの表示
- ✅ 許可ディレクトリチェック機能
- ✅ プロジェクトAPIの動作（データベースへの保存）

### 確認できなかった機能（バグにより）
- ❌ プロジェクト一覧の表示（APIレスポンス形式の不一致により）
- ❌ セッション作成（プロジェクトが選択できないため）
- ❌ その他すべての機能（プロジェクト選択が前提のため）

### 未確認機能
- ⏳ セッション管理
- ⏳ リアルタイム出力表示
- ⏳ Git操作（diff, merge, rebase）
- ⏳ ターミナル機能
- ⏳ ランスクリプト機能
- ⏳ テーマ切り替え

## 優先度付け

### 致命的（Blocker）
1. **プロジェクト一覧が表示されない問題**（問題3） - アプリケーション全体が使用不可
2. **ALLOWED_PROJECT_DIRSの空文字列処理**（問題1） - デフォルト設定でプロジェクトを追加できない

### 高（High）
3. **プロジェクト追加後のクライアント側エラー**（問題2） - エラー時にアプリがクラッシュ
4. **重複プロジェクト追加時のエラーハンドリング**（問題4） - ユーザビリティの問題

### 中（Medium）
5. Edge Runtimeでloggerが使用できない問題（修正済み）
6. 環境変数が読み込まれない問題（修正済み）
7. tsconfig-pathsが動作しない問題（修正済み）

## 次のステップ
1. 致命的なバグ（問題1, 3）をSDDスキルでタスク化
2. バグ修正後、残りの機能確認を継続
3. すべての設計書との差異を洗い出し
