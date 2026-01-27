# タスク: リモートGitリポジトリ直接登録機能

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。

## 情報の明確性チェック（全体）

### ユーザーから明示された情報

- [x] 実装対象のディレクトリ構造: 既存のClaudeWorkプロジェクト構造に準拠
- [x] 使用するパッケージマネージャー: npm
- [x] テストフレームワーク: Vitest
- [x] リンター/フォーマッター: ESLint
- [x] ブランチ戦略: main直接、またはfeatureブランチ

### 不明/要確認の情報（全体）

| 項目 | 現状の理解 | 確認状況 |
|------|-----------|----------|
| すべての項目 | ユーザーとの対話で確認済み | [x] 確認済み |

---

## 実装計画

### フェーズ1: データベースとサービス層

#### タスク1.1: Prismaスキーマ拡張

**説明**:
- 対象ファイル: `prisma/schema.prisma`
- Projectモデルに`remote_url`フィールドを追加
- マイグレーション実行

**技術的文脈**:
- Prismaを使用したSQLiteデータベース
- `npx prisma db push`でスキーマ適用

**受入基準**:
- [ ] Projectモデルに`remote_url String?`フィールドが追加されている
- [ ] `npx prisma db push`が成功する
- [ ] `npx prisma generate`が成功する

**依存関係**: なし
**ステータス**: `TODO`

#### タスク1.2: RemoteRepoService実装

**説明**:
- 対象ファイル: `src/services/remote-repo-service.ts`（新規作成）
- リモートリポジトリ操作のサービスクラスを実装

**技術的文脈**:
- `child_process.spawn`を使用してGitコマンド実行
- 既存の`git-service.ts`を参考にする
- SSH認証はシステム設定を利用（GIT_TERMINAL_PROMPT=0）

**実装詳細**:

```typescript
// 実装すべきメソッド
export class RemoteRepoService {
  // URLの形式検証（SSH/HTTPS Git URL）
  validateRemoteUrl(url: string): { valid: boolean; error?: string }

  // リポジトリ名をURLから抽出
  extractRepoName(url: string): string

  // リポジトリをclone
  async clone(options: CloneOptions): Promise<CloneResult>

  // リポジトリをpull（fast-forward only）
  async pull(repoPath: string): Promise<PullResult>

  // ローカル＋リモートブランチ一覧を取得
  async getBranches(repoPath: string): Promise<Branch[]>

  // デフォルトブランチを取得
  async getDefaultBranch(repoPath: string): Promise<string>
}
```

**受入基準**:
- [ ] `validateRemoteUrl`がSSH URL（git@...）を正しく検証する
- [ ] `validateRemoteUrl`がHTTPS URL（https://...）を正しく検証する
- [ ] `extractRepoName`が`git@github.com:user/repo.git`から`repo`を抽出する
- [ ] `clone`が指定ディレクトリにリポジトリをcloneする
- [ ] `pull`がfast-forward onlyでpullする
- [ ] `getBranches`がローカル・リモートブランチ一覧を返す
- [ ] ユニットテストが存在し、パスする

**依存関係**: なし
**ステータス**: `TODO`

#### タスク1.3: RemoteRepoServiceユニットテスト

**説明**:
- 対象ファイル: `src/services/__tests__/remote-repo-service.test.ts`（新規作成）
- TDDに基づき、テストを先に作成

**技術的文脈**:
- Vitestを使用
- child_processをモック
- 既存の`git-service.test.ts`を参考にする

**受入基準**:
- [ ] URL検証のテストケースが存在する（有効/無効パターン）
- [ ] リポジトリ名抽出のテストケースが存在する
- [ ] cloneのテストケースが存在する（成功/失敗）
- [ ] pullのテストケースが存在する（成功/競合）
- [ ] ブランチ取得のテストケースが存在する
- [ ] `npm test`でテストがパスする

**依存関係**: タスク1.2
**ステータス**: `TODO`

### フェーズ2: APIエンドポイント

#### タスク2.1: Clone API実装

**説明**:
- 対象ファイル: `src/app/api/projects/clone/route.ts`（新規作成）
- POST /api/projects/clone エンドポイントを実装

**技術的文脈**:
- Next.js App Router API
- 既存の`src/app/api/projects/route.ts`を参考にする
- ALLOWED_PROJECT_DIRSの制限を適用

**リクエスト仕様**:
```typescript
interface CloneRequest {
  url: string;           // 必須: Git URL
  targetDir?: string;    // 任意: clone先
  name?: string;         // 任意: プロジェクト名
}
```

**受入基準**:
- [ ] POST /api/projects/clone が201でプロジェクトを返す
- [ ] 無効なURLで400エラーを返す
- [ ] clone失敗時に適切なエラーメッセージを返す
- [ ] 既存パスで409エラーを返す
- [ ] ALLOWED_PROJECT_DIRS制限が機能する

**依存関係**: タスク1.2
**ステータス**: `TODO`

#### タスク2.2: Pull API実装

**説明**:
- 対象ファイル: `src/app/api/projects/[project_id]/pull/route.ts`（新規作成）
- POST /api/projects/:id/pull エンドポイントを実装

**技術的文脈**:
- プロジェクトのremote_urlがnullの場合は400エラー
- fast-forward onlyでpull

**受入基準**:
- [ ] POST /api/projects/:id/pull が200で結果を返す
- [ ] remote_urlがnullのプロジェクトで400エラーを返す
- [ ] プロジェクトが存在しない場合404エラーを返す
- [ ] pull失敗時に適切なエラーメッセージを返す

**依存関係**: タスク1.2, タスク1.1
**ステータス**: `TODO`

#### タスク2.3: Branches API実装

**説明**:
- 対象ファイル: `src/app/api/projects/[project_id]/branches/route.ts`（新規作成）
- GET /api/projects/:id/branches エンドポイントを実装

**技術的文脈**:
- ローカルブランチとリモート追跡ブランチの両方を返す
- デフォルトブランチにはisDefault=trueを設定

**受入基準**:
- [ ] GET /api/projects/:id/branches がブランチ一覧を返す
- [ ] 各ブランチにname, isDefault, isRemoteが含まれる
- [ ] プロジェクトが存在しない場合404エラーを返す

**依存関係**: タスク1.2
**ステータス**: `TODO`

#### タスク2.4: API ユニットテスト

**説明**:
- 対象ファイル:
  - `src/app/api/projects/clone/__tests__/route.test.ts`
  - `src/app/api/projects/[project_id]/pull/__tests__/route.test.ts`
  - `src/app/api/projects/[project_id]/branches/__tests__/route.test.ts`

**技術的文脈**:
- Vitestを使用
- RemoteRepoServiceをモック
- 既存のAPIテストを参考にする

**受入基準**:
- [ ] 各エンドポイントのテストファイルが存在する
- [ ] 成功ケースと失敗ケースがテストされている
- [ ] `npm test`でテストがパスする

**依存関係**: タスク2.1, タスク2.2, タスク2.3
**ステータス**: `TODO`

### フェーズ3: フロントエンド実装

#### タスク3.1: RemoteRepoFormコンポーネント

**説明**:
- 対象ファイル: `src/components/projects/RemoteRepoForm.tsx`（新規作成）
- リモートリポジトリURL入力フォームを実装

**技術的文脈**:
- Tailwind CSSを使用
- Headless UIを使用
- 既存のフォームコンポーネントのスタイルに合わせる

**UI仕様**:
- URL入力フィールド（必須）
- Clone先ディレクトリ入力フィールド（任意、折りたたみ可能）
- 登録ボタン、キャンセルボタン
- ローディング表示
- エラーメッセージ表示

**受入基準**:
- [ ] URLを入力して送信できる
- [ ] Clone先ディレクトリをオプションで指定できる
- [ ] ローディング中は入力が無効化される
- [ ] エラーメッセージが表示される

**依存関係**: なし
**ステータス**: `TODO`

#### タスク3.2: AddProjectModalタブUI追加

**説明**:
- 対象ファイル: `src/components/projects/AddProjectModal.tsx`（変更）
- 「ローカル」「リモート」タブを追加

**技術的文脈**:
- Headless UI Tabを使用
- 既存のローカルパス入力フォームは「ローカル」タブに配置

**受入基準**:
- [ ] モーダルにタブUIが表示される
- [ ] 「ローカル」タブで既存の機能が動作する
- [ ] 「リモート」タブでRemoteRepoFormが表示される
- [ ] リモートからのcloneが成功するとモーダルが閉じる

**依存関係**: タスク3.1, タスク2.1
**ステータス**: `TODO`

#### タスク3.3: ProjectCardにリモートバッジと更新ボタン追加

**説明**:
- 対象ファイル: `src/components/projects/ProjectCard.tsx`（変更）
- リモートリポジトリの視覚的表示と更新機能を追加

**技術的文脈**:
- remote_urlがnullでない場合にバッジを表示
- 更新ボタンクリックでPull APIを呼び出し

**受入基準**:
- [ ] remote_urlがあるプロジェクトに「Remote」バッジが表示される
- [ ] remote_urlがあるプロジェクトに「更新」ボタンが表示される
- [ ] 更新ボタンクリックでpullが実行される
- [ ] 更新中はローディング表示される
- [ ] 更新結果がトーストで通知される

**依存関係**: タスク2.2
**ステータス**: `TODO`

#### タスク3.4: セッション作成時のブランチ選択

**説明**:
- 対象ファイル: `src/components/sessions/CreateSessionModal.tsx`（変更）
- ブランチ選択ドロップダウンを追加

**技術的文脈**:
- プロジェクト選択時にBranches APIを呼び出し
- git-service.tsの`createWorktree`は既にブランチ指定をサポート

**受入基準**:
- [ ] プロジェクト選択後にブランチ一覧が取得される
- [ ] ブランチをドロップダウンで選択できる
- [ ] デフォルトブランチが初期選択される
- [ ] 選択したブランチでworktreeが作成される

**依存関係**: タスク2.3
**ステータス**: `TODO`

### フェーズ4: 統合テスト

#### タスク4.1: E2Eテスト作成

**説明**:
- 対象ファイル: `e2e/remote-repo.spec.ts`（新規作成）
- Playwrightを使用したE2Eテスト

**テストシナリオ**:
1. リモートタブでpublicリポジトリをclone
2. cloneしたプロジェクトが一覧に表示される
3. 更新ボタンでpullが実行される
4. セッション作成時にブランチを選択できる

**受入基準**:
- [ ] E2Eテストファイルが存在する
- [ ] 主要なユースケースがテストされている
- [ ] `npm run e2e`でテストがパスする（publicリポジトリ使用）

**依存関係**: フェーズ3完了
**ステータス**: `TODO`

## タスクステータスの凡例

- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - 依存関係や問題によりブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

## リスクと軽減策

### リスク1: 大規模リポジトリのclone時間

**影響度**: 中
**発生確率**: 中
**軽減策**: clone処理を非同期化し、進捗表示を提供。タイムアウトは設けない（ユーザーがキャンセル可能）

### リスク2: SSH認証エラー

**影響度**: 高
**発生確率**: 中
**軽減策**: エラーメッセージを明確にし、SSH設定のトラブルシューティングガイドを提供

### リスク3: ディスク容量不足

**影響度**: 高
**発生確率**: 低
**軽減策**: clone前のディスク容量チェックは行わない（ユーザーの責任）。エラー発生時は明確なメッセージを表示

## 備考

- TDDに従い、各タスクでテストを先に作成してから実装を行う
- 既存のコードスタイルとパターンに従う
- APIエンドポイントの追加後は`docs/API.md`を更新する
