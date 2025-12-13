## フェーズ5: 拡張機能（セッション管理強化）
*推定期間: 180分（AIエージェント作業時間）*
*MVP: No*

## タスク5.1: セッションテンプレート（一括作成）実装

**説明**:
複数セッションの一括作成機能を実装する
- セッション数選択（1〜10）
- 番号付きセッション名自動生成

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Zustand 4.xで一括作成ロジック
- Headless UI 2.x でフォーム
- Tailwind CSSでスタイリング

**必要なパッケージ**:
```bash
# 追加パッケージなし
```

**実装ファイル**:
- `src/components/sessions/CreateSessionForm.tsx`更新 - セッション数選択追加
- `src/store/sessions.ts`更新 - 一括作成ロジック追加
- `src/components/sessions/__tests__/bulk-create.test.tsx` - 一括作成テスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/sessions/__tests__/bulk-create.test.tsx`作成
     - セッション数選択（1〜10）
     - 一括作成実行
     - 番号付き名前生成（feature-1, feature-2, ...）
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add bulk session creation tests"

2. **実装フェーズ**:
   - `src/store/sessions.ts`更新
     - `createBulkSessions(projectId: string, baseName: string, prompt: string, count: number): Promise<void>`追加
     - ループで`createSession()`を`count`回呼び出し
     - セッション名: `${baseName}-${i + 1}`
   - `src/components/sessions/CreateSessionForm.tsx`更新
     - セッション数選択: `<select>`（1〜10）
     - デフォルト: 1
     - フォーム送信時: `count > 1`なら`createBulkSessions()`、そうでなければ`createSession()`
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement bulk session creation"

**UI仕様**:
- セッション数選択: `<select>`ドロップダウン、オプション1〜10
- ラベル: "作成するセッション数"
- デフォルト値: 1

**createBulkSessions仕様**:
```typescript
async createBulkSessions(
  projectId: string,
  baseName: string,
  prompt: string,
  count: number
): Promise<void> {
  for (let i = 0; i < count; i++) {
    const name = count > 1 ? `${baseName}-${i + 1}` : baseName;
    await this.createSession(projectId, { name, prompt });
  }
}
```

**エラーハンドリング**:
- 一括作成中にエラー: 既に作成されたセッションはそのまま、エラー表示
- count < 1 または count > 10: バリデーションエラー

**受入基準**:
- [ ] `CreateSessionForm`にセッション数選択がある
- [ ] 1〜10の選択肢がある
- [ ] デフォルト値が1である
- [ ] count=1で単一セッション作成
- [ ] count>1で複数セッション同時作成
- [ ] セッション名が`baseName-1`, `baseName-2`, ...になる
- [ ] テストファイルが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- フェーズ4完了（MVP完成）
- タスク3.4（セッション管理画面実装）完了

**推定工数**: 30分（AIエージェント作業時間）
- テスト作成・コミット: 10分
- 実装・テスト通過・コミット: 20分

**ステータス**: `TODO`

---

## タスク5.2: プロンプト履歴実装

**説明**:
プロンプト履歴の保存・再利用機能を実装する
- プロンプト履歴テーブル
- 履歴API
- 履歴ドロップダウンUI

**技術的文脈**:
- Next.js 14 API Routes
- Prisma 5.x で`prompts`テーブル管理
- Zustand 4.xで履歴状態管理
- Headless UI 2.x でドロップダウン
- Tailwind CSSでスタイリング

**必要なパッケージ**:
```bash
# 追加パッケージなし（Prisma既存）
```

**実装ファイル**:
- `src/app/api/prompts/route.ts` - プロンプト履歴API（GET/DELETE）
- `src/store/prompts.ts` - プロンプト履歴Zustandストア
- `src/components/sessions/PromptHistoryDropdown.tsx` - 履歴ドロップダウン
- `src/components/sessions/CreateSessionForm.tsx`更新 - 履歴ドロップダウン統合
- `src/app/api/prompts/__tests__/route.test.ts` - APIテスト
- `src/components/sessions/__tests__/PromptHistoryDropdown.test.tsx` - UIテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/app/api/prompts/__tests__/route.test.ts`作成
     - GET: プロンプト履歴取得
     - POST: プロンプト保存（`used_count`インクリメント）
     - DELETE: プロンプト削除
   - `src/components/sessions/__tests__/PromptHistoryDropdown.test.tsx`作成
     - ドロップダウン表示
     - 履歴選択でプロンプト挿入
     - 削除ボタンクリック
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add prompt history tests"

2. **実装フェーズ**:
   - `src/app/api/prompts/route.ts`作成
     - GET: Prismaで`prompts`テーブルから取得（`used_count`降順、最大50件）
     - POST: `content`で検索、存在すれば`used_count`インクリメント、なければ新規作成
     - DELETE: Prismaで削除
   - `src/store/prompts.ts`作成
     - `prompts: Prompt[]`ステート
     - `fetchPrompts(): Promise<void>` - GET /api/prompts
     - `savePrompt(content: string): Promise<void>` - POST /api/prompts
     - `deletePrompt(id: string): Promise<void>` - DELETE /api/prompts/{id}
   - `src/components/sessions/PromptHistoryDropdown.tsx`作成
     - Headless UI `Listbox`使用
     - プロンプト履歴表示（最大10件）
     - 選択で`onSelect(prompt.content)`コールバック
     - 削除ボタン（ゴミ箱アイコン）
   - `src/components/sessions/CreateSessionForm.tsx`更新
     - `PromptHistoryDropdown`追加
     - `onSelect`でプロンプト入力フィールド更新
     - セッション作成時に`savePrompt()`呼び出し
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement prompt history feature"

**API仕様**:

**GET /api/prompts**:
```json
{
  "prompts": [
    {
      "id": "uuid",
      "content": "Implement user authentication",
      "used_count": 5,
      "last_used_at": "2025-12-08T10:00:00Z"
    }
  ]
}
```

**POST /api/prompts**:
リクエスト:
```json
{
  "content": "Implement user authentication"
}
```
レスポンス201:
```json
{
  "id": "uuid",
  "content": "Implement user authentication",
  "used_count": 1
}
```

**DELETE /api/prompts/{id}**:
レスポンス200:
```json
{
  "message": "Deleted successfully"
}
```

**Zustandストア仕様**:
```typescript
interface PromptState {
  prompts: Prompt[];
  isLoading: boolean;
  error: string | null;
  fetchPrompts: () => Promise<void>;
  savePrompt: (content: string) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
}

interface Prompt {
  id: string;
  content: string;
  used_count: number;
  last_used_at: string;
}
```

**UI仕様**:
- ドロップダウン: プロンプト入力フィールドの下に配置
- 履歴項目: 最大10件表示、それ以上はスクロール
- 削除ボタン: 各項目の右側、ゴミ箱アイコン
- 選択: クリックでプロンプト挿入

**エラーハンドリング**:
- プロンプト取得失敗: エラーメッセージ表示
- プロンプト保存失敗: エラーログ出力（ユーザーには通知しない）
- プロンプト削除失敗: エラーメッセージ表示

**受入基準**:
- [ ] `src/app/api/prompts/route.ts`が存在する
- [ ] `src/store/prompts.ts`が存在する
- [ ] `src/components/sessions/PromptHistoryDropdown.tsx`が存在する
- [ ] プロンプトが履歴に保存される
- [ ] プロンプト入力時に履歴が表示される
- [ ] 履歴から選択してプロンプトを挿入できる
- [ ] 履歴を削除できる
- [ ] 最大50件まで保存される
- [ ] `used_count`降順でソートされる
- [ ] テストファイル2つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク1.4（データベース設定）完了
- タスク5.1（セッションテンプレート実装）完了
- Prisma `prompts`テーブルが存在すること

**推定工数**: 40分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 25分

**ステータス**: `TODO`

---

## タスク5.3: モデル選択実装

**説明**:
Claude Codeモデル選択機能を実装する
- セッション作成時のモデル選択UI
- プロジェクトデフォルトモデル設定
- Claude Code起動時のモデル指定

**技術的文脈**:
- Next.js 14 App Router
- React 18、TypeScript strict mode
- Zustand 4.xでモデル状態管理
- Claude Codeモデル: Auto, Opus, Sonnet, Haiku
- ProcessManager更新（モデルパラメータ追加）

**必要なパッケージ**:
```bash
# 追加パッケージなし
```

**実装ファイル**:
- `src/components/sessions/CreateSessionForm.tsx`更新 - モデル選択追加
- `src/components/projects/ProjectSettings.tsx` - プロジェクト設定画面（新規）
- `src/services/process-manager.ts`更新 - モデルパラメータ追加
- `src/components/sessions/__tests__/model-selection.test.tsx` - モデル選択テスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/sessions/__tests__/model-selection.test.tsx`作成
     - モデル選択UI表示
     - デフォルトモデル適用
     - モデル指定でセッション作成
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add model selection tests"

2. **実装フェーズ**:
   - `src/services/process-manager.ts`更新
     - `startClaudeCode()`に`model`パラメータ追加
     - `model`が指定されている場合: `claude --model ${model} --print`
     - `model`が`auto`または未指定: `claude --print`
   - `src/components/sessions/CreateSessionForm.tsx`更新
     - モデル選択: `<select>`ドロップダウン
     - オプション: Auto, Opus, Sonnet, Haiku
     - デフォルト: プロジェクトのデフォルトモデルまたはAuto
   - `src/components/projects/ProjectSettings.tsx`作成
     - プロジェクト名表示
     - デフォルトモデル設定: `<select>`
     - 保存ボタン
     - `updateProject()`呼び出し
   - `src/app/projects/[id]/settings/page.tsx`作成
     - `ProjectSettings`表示
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement model selection feature"

**モデル選択肢**:
- `auto`: Claude Codeが自動選択（デフォルト）
- `opus`: Claude Opus（最高性能）
- `sonnet`: Claude Sonnet（バランス型）
- `haiku`: Claude Haiku（高速・軽量）

**ProcessManager更新**:
```typescript
async startClaudeCode(
  worktreePath: string,
  prompt: string,
  model?: string
): Promise<ChildProcess> {
  const args = ['--print'];
  if (model && model !== 'auto') {
    args.push('--model', model);
  }

  const process = spawn('claude', args, {
    cwd: worktreePath,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // ... 残りの実装
}
```

**UI仕様**:

**CreateSessionForm**:
- モデル選択: `<select>`、ラベル"モデル"
- デフォルト値: プロジェクトのデフォルトモデル

**ProjectSettings**:
- レイアウト: フォーム形式
- デフォルトモデル: `<select>`、ラベル"デフォルトモデル"
- 保存ボタン: プライマリカラー

**エラーハンドリング**:
- 無効なモデル指定: バリデーションエラー
- プロジェクト設定更新失敗: エラーメッセージ表示

**受入基準**:
- [ ] `src/components/sessions/CreateSessionForm.tsx`にモデル選択がある
- [ ] `src/components/projects/ProjectSettings.tsx`が存在する
- [ ] `src/app/projects/[id]/settings/page.tsx`が存在する
- [ ] `src/services/process-manager.ts`にモデルパラメータがある
- [ ] セッション作成時にモデルを選択できる
- [ ] プロジェクト設定でデフォルトモデルを設定できる
- [ ] 選択したモデルでClaude Codeが起動する
- [ ] `--model`オプションが正しく渡される
- [ ] テストファイルが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク2.4（プロセスマネージャー実装）完了
- タスク5.2（プロンプト履歴実装）完了

**推定工数**: 35分（AIエージェント作業時間）
- テスト作成・コミット: 12分
- 実装・テスト通過・コミット: 23分

**ステータス**: `TODO`

---

## タスク5.4: コミット履歴と復元実装

**説明**:
コミット履歴表示とリセット機能を実装する
- コミット履歴API
- コミット履歴表示UI
- コミットへのリセット機能

**技術的文脈**:
- Next.js 14 API Routes
- Git操作: `git log`、`git reset`
- Zustand 4.xでコミット履歴状態管理
- Tailwind CSSでスタイリング

**必要なパッケージ**:
```bash
# 追加パッケージなし
```

**実装ファイル**:
- `src/app/api/sessions/[id]/commits/route.ts` - コミット履歴API
- `src/app/api/sessions/[id]/reset/route.ts` - リセットAPI
- `src/services/git-service.ts`更新 - `getCommits()`、`resetToCommit()`追加
- `src/components/git/CommitHistory.tsx` - コミット履歴コンポーネント
- `src/components/git/ResetCommitDialog.tsx` - リセット確認ダイアログ
- `src/app/sessions/[id]/page.tsx`更新 - コミット履歴タブ追加
- `src/app/api/sessions/[id]/commits/__tests__/route.test.ts` - APIテスト
- `src/components/git/__tests__/CommitHistory.test.tsx` - UIテスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/app/api/sessions/[id]/commits/__tests__/route.test.ts`作成
     - GET: コミット履歴取得
   - `src/app/api/sessions/[id]/reset/__tests__/route.test.ts`作成
     - POST: コミットへのリセット
   - `src/components/git/__tests__/CommitHistory.test.tsx`作成
     - コミット一覧表示
     - コミット選択
     - リセットボタンクリック
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add commit history tests"

2. **実装フェーズ**:
   - `src/services/git-service.ts`更新
     - `getCommits(worktreePath: string): Promise<Commit[]>` - `git log --pretty=format:'%H|%h|%an|%ae|%ai|%s' --numstat`実行、パース
     - `resetToCommit(worktreePath: string, commitHash: string): Promise<void>` - `git reset --hard ${commitHash}`実行
   - `src/app/api/sessions/[id]/commits/route.ts`作成
     - GET: セッション取得、`getCommits()`呼び出し、レスポンス
   - `src/app/api/sessions/[id]/reset/route.ts`作成
     - POST: リクエストから`commit_hash`取得、`resetToCommit()`呼び出し
   - `src/components/git/CommitHistory.tsx`作成
     - コミット一覧表示（テーブル形式）
     - カラム: ハッシュ（短縮）、メッセージ、作成者、日時、変更ファイル数
     - 「リセット」ボタン
   - `src/components/git/ResetCommitDialog.tsx`作成
     - Headless UI `Dialog`使用
     - 確認メッセージ: "コミット{hash}にリセットしますか？それ以降の変更は失われます。"
     - 「リセット」ボタン（赤）、「キャンセル」ボタン
   - `src/app/sessions/[id]/page.tsx`更新
     - タブ追加: 「対話」「Diff」「コミット履歴」
     - コミット履歴タブ: `CommitHistory`表示
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement commit history and reset feature"

**API仕様**:

**GET /api/sessions/{id}/commits**:
```json
{
  "commits": [
    {
      "hash": "abc123def456",
      "shortHash": "abc123",
      "message": "Add authentication",
      "author": "Claude",
      "email": "claude@anthropic.com",
      "date": "2025-12-08T10:05:00Z",
      "filesChanged": 3
    }
  ]
}
```

**POST /api/sessions/{id}/reset**:
リクエスト:
```json
{
  "commit_hash": "abc123def456"
}
```
レスポンス200:
```json
{
  "success": true
}
```

**Git操作**:
```typescript
async getCommits(worktreePath: string): Promise<Commit[]> {
  const output = execSync(
    'git log --pretty=format:"%H|%h|%an|%ae|%ai|%s" --numstat',
    { cwd: worktreePath, encoding: 'utf-8' }
  );
  // パース処理
}

async resetToCommit(worktreePath: string, commitHash: string): Promise<void> {
  execSync(`git reset --hard ${commitHash}`, { cwd: worktreePath });
}
```

**UI仕様**:

**CommitHistory**:
- テーブル形式
- カラム: ハッシュ、メッセージ、作成者、日時、「リセット」ボタン
- ホバー: 行全体をハイライト

**ResetCommitDialog**:
- タイトル: "コミットにリセット"
- メッセージ: "コミット{shortHash}にリセットしますか？それ以降の変更は失われます。"
- ボタン: 「リセット」（赤）、「キャンセル」

**エラーハンドリング**:
- コミット履歴取得失敗: エラーメッセージ表示
- リセット失敗: エラーメッセージ表示、ロールバック不可を警告
- 無効なコミットハッシュ: 400エラー

**受入基準**:
- [ ] `src/app/api/sessions/[id]/commits/route.ts`が存在する
- [ ] `src/app/api/sessions/[id]/reset/route.ts`が存在する
- [ ] `src/services/git-service.ts`に`getCommits`、`resetToCommit`がある
- [ ] `src/components/git/CommitHistory.tsx`が存在する
- [ ] `src/components/git/ResetCommitDialog.tsx`が存在する
- [ ] セッション詳細ページに「コミット履歴」タブがある
- [ ] コミット履歴が表示される
- [ ] 各コミットのdiffが表示される（既存のDiffビューワー使用）
- [ ] 「リセット」ボタンで確認ダイアログが表示される
- [ ] リセット実行で指定コミットの状態に戻る
- [ ] テストファイル2つが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク2.3（Git操作サービス実装）完了
- タスク5.3（モデル選択実装）完了

**推定工数**: 45分（AIエージェント作業時間）
- テスト作成・コミット: 15分
- 実装・テスト通過・コミット: 30分

**ステータス**: `TODO`

---

## タスク5.5: Git状態インジケーター実装

**説明**:
セッション一覧にGit状態インジケーターを追加する
- 未コミット変更あり/クリーンの判定
- インジケーターUI

**技術的文脈**:
- Git操作: `git status --porcelain`
- Zustand 4.xでGit状態管理
- アイコン表示: lucide-react
- ポーリング: セッション一覧表示時に1回取得

**必要なパッケージ**:
```bash
# lucide-reactは既にインストール済み（タスク3.2）
```

**実装ファイル**:
- `src/services/git-service.ts`更新 - `getGitStatus()`追加
- `src/app/api/sessions/[id]/git-status/route.ts` - Git状態API
- `src/components/sessions/GitStatusBadge.tsx` - Git状態バッジ
- `src/components/sessions/SessionCard.tsx`更新 - バッジ追加
- `src/services/__tests__/git-service-status.test.ts` - Git状態テスト

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/services/__tests__/git-service-status.test.ts`作成
     - クリーン状態判定
     - 未コミット変更あり判定
   - `src/components/sessions/__tests__/GitStatusBadge.test.tsx`作成
     - クリーンバッジ表示
     - ダーティバッジ表示
   - テスト実行: `npm test` → すべて失敗することを確認
   - コミット: "Add git status indicator tests"

2. **実装フェーズ**:
   - `src/services/git-service.ts`更新
     - `getGitStatus(worktreePath: string): Promise<'clean' | 'dirty'>` - `git status --porcelain`実行、出力が空ならclean、そうでなければdirty
   - `src/app/api/sessions/[id]/git-status/route.ts`作成
     - GET: セッション取得、`getGitStatus()`呼び出し、レスポンス
   - `src/components/sessions/GitStatusBadge.tsx`作成
     - clean: 緑色バッジ、チェックアイコン、"クリーン"
     - dirty: 黄色バッジ、警告アイコン、"未コミット変更あり"
   - `src/components/sessions/SessionCard.tsx`更新
     - `GitStatusBadge`追加
     - `useEffect`で`GET /api/sessions/{id}/git-status`呼び出し
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement git status indicator"

**API仕様**:

**GET /api/sessions/{id}/git-status**:
```json
{
  "status": "clean" | "dirty"
}
```

**Git操作**:
```typescript
async getGitStatus(worktreePath: string): Promise<'clean' | 'dirty'> {
  const output = execSync('git status --porcelain', {
    cwd: worktreePath,
    encoding: 'utf-8'
  });
  return output.trim() === '' ? 'clean' : 'dirty';
}
```

**UI仕様**:

**GitStatusBadge**:
- clean: `bg-green-100 text-green-800 rounded-full px-2 py-1 text-xs`、チェックアイコン
- dirty: `bg-yellow-100 text-yellow-800 rounded-full px-2 py-1 text-xs`、警告アイコン

**エラーハンドリング**:
- Git状態取得失敗: エラーログ出力、バッジ非表示

**受入基準**:
- [ ] `src/services/git-service.ts`に`getGitStatus`がある
- [ ] `src/app/api/sessions/[id]/git-status/route.ts`が存在する
- [ ] `src/components/sessions/GitStatusBadge.tsx`が存在する
- [ ] 各セッションにGit状態インジケーターが表示される
- [ ] クリーン状態で緑色バッジが表示される
- [ ] 未コミット変更ありで黄色バッジが表示される
- [ ] テストファイルが存在する
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク2.3（Git操作サービス実装）完了
- タスク5.4（コミット履歴と復元実装）完了

**推定工数**: 25分（AIエージェント作業時間）
- テスト作成・コミット: 8分
- 実装・テスト通過・コミット: 17分

**ステータス**: `TODO`

---

## タスク5.6: 詳細ステータスインジケーター実装

**説明**:
セッションステータスを詳細化する
- ステータス: 初期化中/実行中/入力待ち/完了/エラー
- ステータスに応じたアイコンと色

**技術的文脈**:
- タスク3.4で実装済みの`SessionStatusIcon`を拡張
- アイコン: lucide-react
- Tailwind CSSで色指定

**必要なパッケージ**:
```bash
# 追加パッケージなし
```

**実装ファイル**:
- `src/components/sessions/SessionStatusIcon.tsx`更新 - アイコンと色を詳細化
- `src/components/sessions/__tests__/SessionStatusIcon.test.tsx`更新 - 5種類のテスト追加

**実装手順（TDD）**:
1. **テスト作成フェーズ**:
   - `src/components/sessions/__tests__/SessionStatusIcon.test.tsx`更新
     - initializing: スピナーアイコン、青色
     - running: 再生アイコン、緑色
     - waiting_input: 一時停止アイコン、黄色
     - completed: チェックアイコン、グレー
     - error: エラーアイコン、赤色
   - テスト実行: `npm test` → すべて失敗することを確認（既に一部実装済みのため、新規テストのみ失敗）
   - コミット: "Add detailed status indicator tests"

2. **実装フェーズ**:
   - `src/components/sessions/SessionStatusIcon.tsx`更新
     - initializing: `<Loader2 className="animate-spin text-blue-500" />`
     - running: `<Play className="text-green-500" />`
     - waiting_input: `<Pause className="text-yellow-500" />`
     - completed: `<Check className="text-gray-500" />`
     - error: `<AlertCircle className="text-red-500" />`
   - テスト実行: `npm test` → すべて通過することを確認
   - コミット: "Implement detailed status indicators"

**SessionStatusIcon仕様**:
```typescript
interface SessionStatusIconProps {
  status: 'initializing' | 'running' | 'waiting_input' | 'completed' | 'error';
  size?: number; // デフォルト: 16
}

const SessionStatusIcon: React.FC<SessionStatusIconProps> = ({ status, size = 16 }) => {
  switch (status) {
    case 'initializing':
      return <Loader2 size={size} className="animate-spin text-blue-500" />;
    case 'running':
      return <Play size={size} className="text-green-500" />;
    case 'waiting_input':
      return <Pause size={size} className="text-yellow-500" />;
    case 'completed':
      return <Check size={size} className="text-gray-500" />;
    case 'error':
      return <AlertCircle size={size} className="text-red-500" />;
  }
};
```

**ステータス定義**:
- initializing: セッション作成中、worktree作成中、Claude Code起動中
- running: Claude Code実行中
- waiting_input: ユーザー入力待ち、権限確認待ち
- completed: セッション完了
- error: エラー発生

**エラーハンドリング**:
- 無効なステータス: デフォルトアイコン（グレー円）表示

**受入基準**:
- [ ] `src/components/sessions/SessionStatusIcon.tsx`が更新されている
- [ ] 5種類のステータスが区別できる
- [ ] 各ステータスに適切なアイコンが表示される
- [ ] 各ステータスに適切な色が適用される
- [ ] initializingでアニメーション（スピン）する
- [ ] テストファイルが更新されている
- [ ] 全テストが通過する（`npm test`）
- [ ] ESLintエラーがゼロである（`npm run lint`）
- [ ] テストのみのコミットと実装のコミットが分かれている

**依存関係**:
- タスク3.4（セッション管理画面実装）完了
- タスク5.5（Git状態インジケーター実装）完了

**推定工数**: 20分（AIエージェント作業時間）
- テスト作成・コミット: 7分
- 実装・テスト通過・コミット: 13分

**ステータス**: `TODO`
