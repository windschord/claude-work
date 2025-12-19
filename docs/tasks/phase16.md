# フェーズ16: 検証後の修正と未実装機能の追加

推定期間: 4-6時間（AIエージェント作業時間）
MVP: Yes

## 概要

nodejs-architectureブランチにおいてPhase 15までのマージ完了後に実施した検証で発見された問題を修正し、未実装機能を追加します。

**検証日時**: 2025-12-18
**検証レポート**: `docs/verification-report-nodejs-architecture.md`

**発見された問題**:
1. テストの失敗（25件） - worktree内の重複とタイムアウト
2. 設計書とデータベーススキーマの不一致
3. 未実装機能（5つのAPIエンドポイント）
4. 統合テストの未実施

**対応の優先順位**:
1. テストの修正（高優先度）
2. 設計書の更新（高優先度）
3. 未実装機能の実装（中優先度）
4. 統合テストの実施（中優先度）

---

## タスク16.1: テスト環境の修正（worktree除外設定）

**優先度**: High
**推定工数**: 15分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

`.worktrees/`ディレクトリ内に複製されたテストファイルがvitest実行時に含まれ、21件のテストが失敗しています。vitest.config.tsの`exclude`設定に`.worktrees/**`を追加して、これらのテストを除外します。

**問題の詳細**:
- `.worktrees/session-*/src/hooks/__tests__/useTerminal.test.ts`: 21件失敗（3ファイル × 7テスト）
- 原因: Git worktreeがテストファイルも複製し、モックWebSocketサーバーの起動に失敗

**影響**:
- CI/CDパイプラインでテストが失敗する
- 開発者の混乱を招く

### 実装手順

#### ステップ1: vitest.config.tsの修正

ファイル: `vitest.config.ts`

**修正内容**:
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      '.worktrees/**',  // 👈 この行を追加
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.worktrees/',  // 👈 この行を追加
        '**/*.config.ts',
        '**/__tests__/**',
        '**/tests/**',
      ],
    },
  },
});
```

#### ステップ2: テストの実行と確認

```bash
npm test
```

`.worktrees/`内のテストが実行されないことを確認します。

#### ステップ3: コミット

```bash
git add vitest.config.ts
git commit -m "fix: vitestの設定でworktreeディレクトリを除外

- vitest.config.tsのexcludeに.worktrees/**を追加
- coverageのexcludeにも.worktrees/を追加
- 21件のテスト失敗を解消"
```

### 受入基準

- [ ] `vitest.config.ts`の`exclude`に`.worktrees/**`が追加されている
- [ ] `vitest.config.ts`の`coverage.exclude`に`.worktrees/`が追加されている
- [ ] `npm test`実行時に`.worktrees/`内のテストが実行されない
- [ ] 以前失敗していた21件のテストが実行されなくなっている
- [ ] 既存のテストが引き続き正常に動作する

### 依存関係

なし

### 技術的文脈

**プロジェクト構成**:
- テストフレームワーク: Vitest
- 設定ファイル: `vitest.config.ts`

**既存のコーディングパターン**:
- globパターンで除外設定: `'**/pattern/**'`

### 情報の明確性

**明示された情報**:
- 除外対象のパス: `.worktrees/**`
- 設定ファイル: `vitest.config.ts`
- 問題の原因: worktree内の重複テストファイル

**不明/要確認の情報**:
- なし

---

## タスク16.2: タイムアウトするテストケースの修正

**優先度**: High
**推定工数**: 60分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

4件のテストケースが1秒でタイムアウトしています。モックの実装を修正し、Reactのテストベストプラクティスに従ってact()でラップすることで、これらのテストを修正します。

**失敗しているテスト**:
1. `src/components/__tests__/AuthGuard.test.tsx`: 1件失敗
   - checkAuthがエラーになっても適切に処理される
2. `.worktrees/session-1766012432642/src/app/projects/__tests__/[id].test.tsx`: 3件失敗
   - 名前とプロンプト入力でセッション作成が成功する
   - 名前未入力でバリデーションエラーが表示される
   - プロンプト未入力でバリデーションエラーが表示される

**注意**: タスク16.1でworktree内のテストを除外するため、[id].test.tsxの3件は実行されなくなりますが、`src/app/projects/__tests__/[id].test.tsx`にも同じ問題があれば修正が必要です。

### 実装手順（TDDアプローチ）

#### ステップ1: 問題の調査

##### AuthGuard.test.tsxのテスト実行

```bash
npm test src/components/__tests__/AuthGuard.test.tsx
```

失敗するテストを確認し、エラーメッセージを分析します。

##### [id].test.tsxの確認

`src/app/projects/__tests__/[id].test.tsx`に同じ問題があるか確認します。

```bash
npm test src/app/projects/__tests__/[id].test.tsx
```

#### ステップ2: AuthGuard.test.tsxの修正

ファイル: `src/components/__tests__/AuthGuard.test.tsx`

**修正内容**:
- タイムアウト設定を延長（必要に応じて）
- モックの実装を修正
- act()でラップ
- 非同期処理の待機を追加

**例**:
```typescript
it('checkAuthがエラーになっても適切に処理される', async () => {
  const mockCheckAuth = vi.fn().mockRejectedValue(new Error('Network error'));
  vi.mocked(useAuthStore).mockReturnValue({
    checkAuth: mockCheckAuth,
    isAuthenticated: false,
    // ...
  });

  await act(async () => {
    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );
  });

  // 適切な待機時間を設ける
  await waitFor(() => {
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  }, { timeout: 3000 });
});
```

#### ステップ3: [id].test.tsxの修正（必要に応じて）

ファイル: `src/app/projects/__tests__/[id].test.tsx`

同様の問題があれば、AuthGuard.test.tsxと同じアプローチで修正します。

#### ステップ4: テストの実行と確認

```bash
npm test src/components/__tests__/AuthGuard.test.tsx
npm test src/app/projects/__tests__/[id].test.tsx
```

すべてのテストが通過することを確認します。

#### ステップ5: コミット

```bash
git add src/components/__tests__/AuthGuard.test.tsx
git add src/app/projects/__tests__/[id].test.tsx  # 修正した場合
git commit -m "fix: タイムアウトするテストケースを修正

- AuthGuard.test.tsxのタイムアウトを修正
- act()でReact状態更新をラップ
- waitForでタイムアウト設定を延長
- モック実装を改善"
```

### 受入基準

- [ ] `npm test src/components/__tests__/AuthGuard.test.tsx`がすべて通過する
- [ ] `npm test src/app/projects/__tests__/[id].test.tsx`がすべて通過する（修正が必要な場合）
- [ ] `npm test`がエラーなく完了する
- [ ] act()を適切に使用している
- [ ] waitForでタイムアウト設定が適切に行われている

### 依存関係

- タスク16.1が完了していること（worktreeテストの除外）

### 技術的文脈

**プロジェクト構成**:
- テストフレームワーク: Vitest
- UIライブラリ: React 19
- テストユーティリティ: @testing-library/react

**Reactテストのベストプラクティス**:
- 状態更新はact()でラップ
- 非同期処理はwaitForで待機
- タイムアウトは適切に設定

### 情報の明確性

**明示された情報**:
- 失敗しているテストファイルとケース
- 原因: モック実装の問題、act()の未使用

**不明/要確認の情報**:
- なし（実装中に詳細なエラーメッセージを確認して対応）

---

## タスク16.3: 設計書の更新（データベーススキーマの整合性）

**優先度**: High
**推定工数**: 20分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

設計書（`docs/design.md`）のデータベーススキーマの記載が実装と一致していません。`projects.run_scripts`がTEXT型（JSON形式）と記載されていますが、実装では`RunScript`テーブルとして正規化されています。設計書を実装に合わせて更新します。

**問題の詳細**:
- 設計書 (design.md:804-806): `run_scripts | TEXT | | JSON形式のランスクリプト配列`
- 実装 (schema.prisma:67-79): `RunScript`テーブルとして正規化

**影響**:
- ドキュメントと実装の乖離
- 新規参加者の混乱

### 実装手順

#### ステップ1: design.mdの該当箇所を確認

ファイル: `docs/design.md` (line 794-841)

現在のデータベーススキーマセクションを確認します。

#### ステップ2: Projectsテーブルの記載を修正

**修正前**:
```markdown
### テーブル: projects

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| name | TEXT | NOT NULL | プロジェクト名 |
| path | TEXT | NOT NULL UNIQUE | Gitリポジトリパス |
| default_model | TEXT | DEFAULT 'auto' | デフォルトモデル |
| run_scripts | TEXT | | JSON形式のランスクリプト配列 |
| created_at | TEXT | NOT NULL | 作成日時（ISO 8601） |
| updated_at | TEXT | NOT NULL | 更新日時（ISO 8601） |
```

**修正後**:
```markdown
### テーブル: projects

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| name | TEXT | NOT NULL | プロジェクト名 |
| path | TEXT | NOT NULL UNIQUE | Gitリポジトリパス |
| default_model | TEXT | DEFAULT 'auto' | デフォルトモデル |
| created_at | TEXT | NOT NULL | 作成日時（ISO 8601） |
| updated_at | TEXT | NOT NULL | 更新日時（ISO 8601） |

**リレーション**:
- `RunScript` テーブルと1対多のリレーション（project_id経由）
```

#### ステップ3: RunScriptテーブルを追加

**追加する内容**:
```markdown
### テーブル: run_scripts

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID |
| project_id | TEXT | FOREIGN KEY | プロジェクトID |
| name | TEXT | NOT NULL | スクリプト名 |
| description | TEXT | | スクリプトの説明 |
| command | TEXT | NOT NULL | 実行するコマンド |
| created_at | TEXT | NOT NULL | 作成日時（ISO 8601） |
| updated_at | TEXT | NOT NULL | 更新日時（ISO 8601） |

**インデックス**:
- `project_id` にインデックス

**リレーション**:
- `Project` テーブルと多対1のリレーション（project_id経由）
```

#### ステップ4: APIレスポンス形式の記載を確認

`docs/design.md`のAPIレスポンス例でrun_scriptsが配列形式で返されていることを確認します。実装では、ProjectにRunScriptの配列が含まれる形で返されるため、APIレスポンス形式の記載は修正不要です。

#### ステップ5: コミット

```bash
git add docs/design.md
git commit -m "docs: データベーススキーマをRunScriptテーブルの実装に合わせて更新

- projectsテーブルからrun_scriptsカラムを削除
- run_scriptsテーブルの定義を追加
- リレーション情報を明記
- 実装（schema.prisma）との整合性を確保"
```

### 受入基準

- [ ] `docs/design.md`の`projects`テーブルから`run_scripts`カラムが削除されている
- [ ] `docs/design.md`に`run_scripts`テーブルの定義が追加されている
- [ ] テーブル間のリレーション情報が記載されている
- [ ] `schema.prisma`の実装と一致している
- [ ] APIレスポンス形式（配列形式）の記載は維持されている

### 依存関係

なし

### 技術的文脈

**参照ファイル**:
- `prisma/schema.prisma`: RunScriptモデルの実装
- `docs/design.md`: データベーススキーマの記載

### 情報の明確性

**明示された情報**:
- 修正対象ファイル: `docs/design.md`
- 実装の内容: `prisma/schema.prisma`のRunScriptモデル
- 修正箇所: projectsテーブルとrun_scriptsテーブル

**不明/要確認の情報**:
- なし

---

## タスク16.4: 未実装機能の実装（ランスクリプト実行API）

**優先度**: Medium
**推定工数**: 90分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

ランスクリプト実行機能のAPIエンドポイントを実装します。プロジェクトに登録されたランスクリプトをセッションのworktree内で実行し、出力をリアルタイムで返します。

**実装対象のエンドポイント**:
1. POST /api/sessions/{id}/run - ランスクリプト実行
2. POST /api/sessions/{id}/run/{run_id}/stop - ランスクリプト停止

**設計書の参照**:
- `docs/design.md` (line 695-720)

**ユーザーストーリーの対応**:
- ストーリー6: ランスクリプト実行 (requirements.md)

### 実装手順（TDDアプローチ）

#### ステップ1: テストの作成（Red）

##### ランスクリプト実行APIのテスト作成

ファイル: `src/app/api/sessions/[id]/run/__tests__/route.test.ts`

テストケース:
- 認証されていない場合は401を返す
- セッションが見つからない場合は404を返す
- スクリプトが見つからない場合は404を返す
- ランスクリプトを正常に実行し、run_idを返す
- レスポンス形式が`{ run_id: "uuid" }`である

##### ランスクリプト停止APIのテスト作成

ファイル: `src/app/api/sessions/[id]/run/[run_id]/stop/__tests__/route.test.ts`

テストケース:
- 認証されていない場合は401を返す
- 実行中のランスクリプトを停止できる
- 存在しないrun_idの場合は404を返す

##### RunScriptManagerのテスト作成

ファイル: `src/services/__tests__/run-script-manager.test.ts`

テストケース:
- スクリプトを実行し、run_idを返す
- 出力をリアルタイムで取得できる
- プロセスを停止できる
- 終了コードと実行時間を取得できる

##### テストの実行と失敗確認

```bash
npm test src/app/api/sessions/[id]/run/__tests__/route.test.ts
npm test src/app/api/sessions/[id]/run/[run_id]/stop/__tests__/route.test.ts
npm test src/services/__tests__/run-script-manager.test.ts
```

##### テストコミット

```bash
git add src/app/api/sessions/[id]/run/__tests__/route.test.ts
git add src/app/api/sessions/[id]/run/[run_id]/stop/__tests__/route.test.ts
git add src/services/__tests__/run-script-manager.test.ts
git commit -m "test: ランスクリプト実行APIのテストを追加"
```

#### ステップ2: RunScriptManagerの実装（Green）

##### RunScriptManagerクラスの実装

ファイル: `src/services/run-script-manager.ts`

実装内容:
- スクリプト実行: child_processでコマンドを実行
- 出力ストリーミング: stdoutとstderrをリアルタイムで取得
- プロセス管理: 実行中のプロセスをrun_idで管理
- 停止機能: プロセスをkillする

##### RunScriptManagerテストの実行とパス確認

```bash
npm test src/services/__tests__/run-script-manager.test.ts
```

#### ステップ3: APIエンドポイントの実装（Green）

##### POST /api/sessions/{id}/run の実装

ファイル: `src/app/api/sessions/[id]/run/route.ts`

実装内容:
- セッションとプロジェクトの取得
- RunScriptの取得
- RunScriptManagerでスクリプトを実行
- run_idを返却

##### POST /api/sessions/{id}/run/{run_id}/stop の実装

ファイル: `src/app/api/sessions/[id]/run/[run_id]/stop/route.ts`

実装内容:
- 実行中のランスクリプトを停止
- 成功/失敗を返却

##### APIテストの実行とパス確認

```bash
npm test src/app/api/sessions/[id]/run/__tests__/route.test.ts
npm test src/app/api/sessions/[id]/run/[run_id]/stop/__tests__/route.test.ts
```

##### 実装コミット

```bash
git add src/services/run-script-manager.ts
git add src/app/api/sessions/[id]/run/route.ts
git add src/app/api/sessions/[id]/run/[run_id]/stop/route.ts
git commit -m "feat: ランスクリプト実行APIを実装

- RunScriptManagerクラスを追加
- POST /api/sessions/{id}/run エンドポイントを実装
- POST /api/sessions/{id}/run/{run_id}/stop エンドポイントを実装
- リアルタイム出力とプロセス停止に対応"
```

#### ステップ4: WebSocket統合（オプション）

リアルタイム出力をWebSocket経由で送信する場合は、WebSocketサーバーに統合します。

##### WebSocketハンドラーの追加

ファイル: `server.ts`

実装内容:
- `/ws/run/{run_id}` パスを追加
- RunScriptManagerから出力を取得してクライアントに送信

##### 統合テストの実行

```bash
npm test
```

##### コミット

```bash
git add server.ts
git commit -m "feat: ランスクリプト出力のWebSocket統合を追加"
```

#### ステップ5: 統合テストと動作確認

##### すべてのテストの実行

```bash
npm test
```

##### ESLintチェック

```bash
npm run lint
```

##### 開発サーバーでの動作確認

```bash
npm run dev
```

手動で確認:
1. ランスクリプトを実行
2. 出力がリアルタイムで取得できることを確認
3. プロセスを停止できることを確認

### 受入基準

**実装コード**:
- [ ] `src/services/run-script-manager.ts`が実装されている
- [ ] POST /api/sessions/{id}/runエンドポイントが実装されている
- [ ] POST /api/sessions/{id}/run/{run_id}/stopエンドポイントが実装されている
- [ ] レスポンス形式が設計書通り（`{ run_id: "uuid" }`）

**テスト**:
- [ ] RunScriptManagerのテストが実装され、通過する
- [ ] APIエンドポイントのテスト（認証、404、正常系）が実装され、通過する
- [ ] `npm test`がエラーなく完了する

**機能**:
- [ ] ランスクリプトをworktree内で実行できる
- [ ] 出力をリアルタイムで取得できる
- [ ] 実行中のプロセスを停止できる
- [ ] 終了コードと実行時間が取得できる

**品質**:
- [ ] `npm run lint`がエラーなく完了する
- [ ] TDDサイクル（テスト→実装）に従っている
- [ ] 各ステップでコミットが作成されている

### 依存関係

- RunScriptテーブルが実装されていること（既存）
- ProcessManagerが実装されていること（既存）

### 技術的文脈

**プロジェクト構成**:
- フレームワーク: Next.js 15 (App Router)
- WebSocketサーバー: カスタムサーバー（server.ts）
- プロセス管理: child_process

**参照すべきファイル**:
- 類似実装: `src/services/process-manager.ts`（Claude Code プロセス管理）
- WebSocket統合: `server.ts`

### 情報の明確性

**明示された情報**:
- 実装対象のAPIエンドポイント
- 設計書の仕様（docs/design.md line 695-720）
- ユーザーストーリー（requirements.md ストーリー6）

**不明/要確認の情報**:
- なし（設計書に十分な情報が記載されている）

---

## タスク16.5: 未実装機能の実装（プロンプト履歴API）

**優先度**: Medium
**推定工数**: 60分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

プロンプト履歴機能のAPIエンドポイントを実装します。ユーザーが過去に使用したプロンプトを保存・取得・削除できるようにします。

**実装対象のエンドポイント**:
1. GET /api/prompts - プロンプト履歴取得
2. DELETE /api/prompts/{id} - プロンプト履歴削除

**設計書の参照**:
- `docs/design.md` (line 722-745)

**ユーザーストーリーの対応**:
- ストーリー3: プロンプト履歴 (requirements.md)

### 実装手順（TDDアプローチ）

#### ステップ1: テストの作成（Red）

##### プロンプト履歴取得APIのテスト作成

ファイル: `src/app/api/prompts/__tests__/route.test.ts`

テストケース:
- 認証されていない場合は401を返す
- プロンプト履歴を統一形式で返す（`{ prompts: [...] }`）
- used_countと最終使用日時が含まれている
- 使用回数の多い順にソートされている

##### プロンプト履歴削除APIのテスト作成

ファイル: `src/app/api/prompts/[id]/__tests__/route.test.ts`

テストケース:
- 認証されていない場合は401を返す
- プロンプトを削除できる
- 存在しないIDの場合は404を返す

##### プロンプト保存機能のテスト追加

ファイル: `src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts`

セッション作成時にプロンプトが保存されることをテストに追加します。

**1.4 テストの実行と失敗確認**

```bash
npm test src/app/api/prompts/__tests__/route.test.ts
npm test src/app/api/prompts/[id]/__tests__/route.test.ts
```

**1.5 テストコミット**

```bash
git add src/app/api/prompts/__tests__/route.test.ts
git add src/app/api/prompts/[id]/__tests__/route.test.ts
git add src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts
git commit -m "test: プロンプト履歴APIのテストを追加"
```

#### ステップ2: APIエンドポイントの実装（Green）

##### GET /api/prompts の実装

ファイル: `src/app/api/prompts/route.ts`

実装内容:
- 認証チェック
- Prismaでプロンプト履歴を取得（used_count降順）
- 統一形式で返却（`{ prompts: [...] }`）

##### DELETE /api/prompts/{id} の実装

ファイル: `src/app/api/prompts/[id]/route.ts`

実装内容:
- 認証チェック
- プロンプトの削除
- 成功/失敗を返却

##### セッション作成時のプロンプト保存機能の追加

ファイル: `src/app/api/projects/[project_id]/sessions/route.ts`

実装内容:
- セッション作成時にプロンプトをPromptテーブルに保存
- 既存のプロンプトがあればused_countをインクリメント
- last_used_atを更新

##### APIテストの実行とパス確認

```bash
npm test src/app/api/prompts/__tests__/route.test.ts
npm test src/app/api/prompts/[id]/__tests__/route.test.ts
npm test src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts
```

##### 実装コミット

```bash
git add src/app/api/prompts/route.ts
git add src/app/api/prompts/[id]/route.ts
git add src/app/api/projects/[project_id]/sessions/route.ts
git commit -m "feat: プロンプト履歴APIを実装

- GET /api/prompts エンドポイントを実装
- DELETE /api/prompts/{id} エンドポイントを実装
- セッション作成時にプロンプトを自動保存
- 統一レスポンス形式（{ prompts: [...] }）で返却"
```

#### ステップ3: フロントエンドの統合（オプション）

##### プロンプト履歴コンポーネントの作成

ファイル: `src/components/prompts/PromptHistory.tsx`

実装内容:
- プロンプト履歴の表示
- プロンプトの選択と削除
- セッション作成フォームへの挿入

##### CreateSessionFormへの統合

ファイル: `src/components/sessions/CreateSessionForm.tsx`

実装内容:
- プロンプト履歴ドロップダウンの追加
- 選択されたプロンプトをフォームに挿入

##### 統合テストの実行

```bash
npm test
```

##### コミット

```bash
git add src/components/prompts/PromptHistory.tsx
git add src/components/sessions/CreateSessionForm.tsx
git commit -m "feat: プロンプト履歴のフロントエンド統合を追加"
```

#### ステップ4: 統合テストと動作確認

##### すべてのテストの実行

```bash
npm test
```

##### ESLintチェック

```bash
npm run lint
```

##### 開発サーバーでの動作確認

```bash
npm run dev
```

手動で確認:
1. セッションを作成してプロンプトが保存されることを確認
2. プロンプト履歴が取得できることを確認
3. プロンプトを削除できることを確認
4. CreateSessionFormでプロンプト履歴が使用できることを確認

### 受入基準

**実装コード**:
- [ ] GET /api/promptsエンドポイントが実装されている
- [ ] DELETE /api/prompts/{id}エンドポイントが実装されている
- [ ] セッション作成時にプロンプトが自動保存される
- [ ] レスポンス形式が統一形式（`{ prompts: [...] }`）

**テスト**:
- [ ] APIエンドポイントのテスト（認証、404、正常系）が実装され、通過する
- [ ] プロンプト保存のテストが実装され、通過する
- [ ] `npm test`がエラーなく完了する

**機能**:
- [ ] プロンプト履歴を取得できる
- [ ] プロンプトを削除できる
- [ ] セッション作成時にプロンプトが自動保存される
- [ ] used_countと最終使用日時が正しく管理される

**品質**:
- [ ] `npm run lint`がエラーなく完了する
- [ ] TDDサイクル（テスト→実装）に従っている
- [ ] 各ステップでコミットが作成されている

### 依存関係

- Promptテーブルが実装されていること（既存）

### 技術的文脈

**プロジェクト構成**:
- フレームワーク: Next.js 15 (App Router)
- データベース: Prisma + SQLite
- UIライブラリ: Headless UI

**参照すべきファイル**:
- 類似API: `src/app/api/projects/route.ts`（GET一覧取得パターン）
- セッション作成: `src/app/api/projects/[project_id]/sessions/route.ts`

### 情報の明確性

**明示された情報**:
- 実装対象のAPIエンドポイント
- 設計書の仕様（docs/design.md line 722-745）
- ユーザーストーリー（requirements.md ストーリー3）

**不明/要確認の情報**:
- なし

---

## タスク16.6: 未実装機能の実装（コミットリセットAPI）

**優先度**: Low
**推定工数**: 40分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

特定のコミットにリセットするAPIエンドポイントを実装します。セッション内で過去のコミットに戻る機能を提供します。

**実装対象のエンドポイント**:
- POST /api/sessions/{id}/reset - 特定コミットへのリセット

**設計書の参照**:
- `docs/design.md` (line 657-667)

**ユーザーストーリーの対応**:
- ストーリー7: コミット履歴と復元 (requirements.md)

### 実装手順（TDDアプローチ）

#### ステップ1: テストの作成（Red）

##### コミットリセットAPIのテスト作成

ファイル: `src/app/api/sessions/[id]/reset/__tests__/route.test.ts`

テストケース:
- 認証されていない場合は401を返す
- セッションが見つからない場合は404を返す
- commit_hashが指定されていない場合は400を返す
- コミットを正常にリセットし、成功を返す

##### GitServiceのresetメソッドのテスト作成

ファイル: `src/services/__tests__/git-service.reset.test.ts`

テストケース:
- 指定されたコミットにリセットできる
- git reset --hard が正しく実行される
- エラー時に適切に処理される

**1.3 テストの実行と失敗確認**

```bash
npm test src/app/api/sessions/[id]/reset/__tests__/route.test.ts
npm test src/services/__tests__/git-service.reset.test.ts
```

**1.4 テストコミット**

```bash
git add src/app/api/sessions/[id]/reset/__tests__/route.test.ts
git add src/services/__tests__/git-service.reset.test.ts
git commit -m "test: コミットリセットAPIのテストを追加"
```

#### ステップ2: GitServiceの実装（Green）

##### resetメソッドの実装

ファイル: `src/services/git-service.ts`

実装内容:
```typescript
/**
 * 指定されたコミットにリセット
 * @param sessionName - セッション名
 * @param commitHash - コミットハッシュ
 * @returns 成功/失敗
 */
reset(sessionName: string, commitHash: string): { success: boolean; error?: string } {
  try {
    const worktreePath = this.getWorktreePath(sessionName);

    execSync(`git -C "${worktreePath}" reset --hard ${commitHash}`, {
      encoding: 'utf-8',
    });

    this.logger.info('Reset to commit', { sessionName, commitHash });
    return { success: true };
  } catch (error) {
    this.logger.error('Failed to reset', { error, sessionName, commitHash });
    return { success: false, error: String(error) };
  }
}
```

**2.2 GitServiceテストの実行とパス確認**

```bash
npm test src/services/__tests__/git-service.reset.test.ts
```

#### ステップ3: APIエンドポイントの実装（Green）

##### route.tsの作成

ファイル: `src/app/api/sessions/[id]/reset/route.ts`

実装内容:
- 認証チェック
- セッションの取得
- commit_hashのバリデーション
- GitService.resetの呼び出し
- 成功/失敗を返却

**3.2 APIテストの実行とパス確認**

```bash
npm test src/app/api/sessions/[id]/reset/__tests__/route.test.ts
```

**3.3 実装コミット**

```bash
git add src/services/git-service.ts
git add src/app/api/sessions/[id]/reset/route.ts
git commit -m "feat: コミットリセットAPIを実装

- GitService.resetメソッドを追加
- POST /api/sessions/{id}/reset エンドポイントを実装
- git reset --hard によるコミットリセット機能"
```

#### ステップ4: 統合テストと動作確認

##### すべてのテストの実行

```bash
npm test
```

##### ESLintチェック

```bash
npm run lint
```

##### 開発サーバーでの動作確認

```bash
npm run dev
```

### 受入基準

**実装コード**:
- [ ] `src/services/git-service.ts`に`reset`メソッドが実装されている
- [ ] POST /api/sessions/{id}/resetエンドポイントが実装されている
- [ ] commit_hashのバリデーションが実装されている

**テスト**:
- [ ] GitService.resetのテストが実装され、通過する
- [ ] APIエンドポイントのテスト（認証、400、404、正常系）が実装され、通過する
- [ ] `npm test`がエラーなく完了する

**機能**:
- [ ] 指定されたコミットにリセットできる
- [ ] エラー時に適切なメッセージが返される

**品質**:
- [ ] `npm run lint`がエラーなく完了する
- [ ] TDDサイクル（テスト→実装）に従っている
- [ ] 各ステップでコミットが作成されている

### 依存関係

- GitServiceが実装されていること（既存）
- GET /api/sessions/{id}/commits が実装されていること（Phase 15）

### 技術的文脈

**プロジェクト構成**:
- フレームワーク: Next.js 15 (App Router)
- Git操作: GitService

**参照すべきファイル**:
- 類似実装: `src/services/git-service.ts`のrebaseメソッド
- 類似API: `src/app/api/sessions/[id]/rebase/route.ts`

### 情報の明確性

**明示された情報**:
- 実装対象のAPIエンドポイント
- 設計書の仕様（docs/design.md line 657-667）
- Git操作: git reset --hard

**不明/要確認の情報**:
- なし

---

## タスク16.7: 統合テストの実施（Claude Codeプロセスでの動作確認）

**優先度**: Medium
**推定工数**: 60分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

実際のClaude Codeプロセスを起動して、統合的な動作確認を行います。これまでユニットテストで確認してきた機能が、実際の環境で正しく動作するかを検証します。

**確認項目**:
1. セッション作成とClaude Codeプロセスの起動
2. WebSocketによるリアルタイム通信
3. プロンプト送信と応答の受信
4. Git操作（diff、commit、rebase、merge）
5. ターミナル統合
6. ランスクリプト実行（タスク16.4実装後）

### 実装手順

#### ステップ1: 統合テストスクリプトの作成

##### テストスクリプトの作成

ファイル: `scripts/integration-test.ts`

実装内容:
```typescript
/**
 * 統合テスト: 実際のClaude Codeプロセスでの動作確認
 *
 * 使用方法:
 * npx tsx scripts/integration-test.ts
 */

import { spawn } from 'child_process';

async function runIntegrationTests() {
  console.log('🚀 統合テスト開始');

  // 1. サーバー起動
  console.log('1. サーバー起動...');
  const server = spawn('npm', ['run', 'dev'], {
    env: { ...process.env, CLAUDE_WORK_TOKEN: 'test-token' },
  });

  await new Promise(resolve => setTimeout(resolve, 5000));

  // 2. ログインテスト
  console.log('2. ログインテスト...');
  // ... API呼び出しテスト

  // 3. セッション作成テスト
  console.log('3. セッション作成テスト...');
  // ... Claude Codeプロセス起動テスト

  // 4. WebSocket通信テスト
  console.log('4. WebSocket通信テスト...');
  // ... リアルタイム通信テスト

  // 5. Git操作テスト
  console.log('5. Git操作テスト...');
  // ... diff、commit、rebase、merge テスト

  // 6. クリーンアップ
  console.log('6. クリーンアップ...');
  server.kill();

  console.log('✅ 統合テスト完了');
}

runIntegrationTests().catch(console.error);
```

##### package.jsonにスクリプトを追加

```json
{
  "scripts": {
    "integration-test": "tsx scripts/integration-test.ts"
  }
}
```

#### ステップ2: 手動での統合テスト

##### サーバーの起動

```bash
CLAUDE_WORK_TOKEN=test-token SESSION_SECRET=test-session-secret-32-characters-long npm run dev
```

##### ログインテスト

ブラウザで `http://localhost:3000` にアクセスし、test-tokenでログインします。

##### プロジェクト登録テスト

1. プロジェクト追加ボタンをクリック
2. テスト用のGitリポジトリパスを入力
3. プロジェクトが正常に登録されることを確認

##### セッション作成テスト

1. プロジェクトを開く
2. セッション作成フォームにプロンプトを入力
3. セッションが作成され、Claude Codeプロセスが起動することを確認
4. WebSocket接続が確立されることを確認

##### プロンプト送信テスト

1. セッション詳細ページでプロンプトを送信
2. Claude Codeからの応答がリアルタイムで表示されることを確認
3. マークダウンレンダリングとシンタックスハイライトを確認

##### Git操作テスト

1. Diffタブで変更差分が表示されることを確認
2. Commitsタブでコミット履歴が表示されることを確認
3. Rebase操作が正常に動作することを確認
4. Merge操作が正常に動作することを確認

##### ターミナルテスト

1. ターミナルタブを開く
2. コマンドを入力して実行
3. 出力がリアルタイムで表示されることを確認

##### ランスクリプトテスト（タスク16.4実装後）

1. プロジェクト設定でランスクリプトを追加
2. セッションでランスクリプトを実行
3. 出力がリアルタイムで表示されることを確認
4. プロセスを停止できることを確認

#### ステップ3: 問題の記録と報告

##### 問題点のリストアップ

統合テストで発見した問題をリストアップします。

ファイル: `docs/integration-test-report.md`

内容:
```markdown
# 統合テストレポート

**実施日**: 2025-12-XX
**実施者**: AIエージェント

## テスト結果

### 成功した機能
- [✅] ログイン
- [✅] プロジェクト登録
- [✅] セッション作成
...

### 失敗した機能
- [❌] WebSocket通信（タイムアウト）
- [❌] ターミナル統合（エラー）
...

### 発見された問題
1. **問題1**: WebSocket接続がタイムアウトする
   - 深刻度: 高
   - 原因: ...
   - 推奨対応: ...

2. **問題2**: ...
```

##### コミット

```bash
git add scripts/integration-test.ts
git add docs/integration-test-report.md
git commit -m "test: 統合テストスクリプトとレポートを追加

- 実際のClaude Codeプロセスでの動作確認
- 手動テストの実施記録
- 発見された問題のリストアップ"
```

#### ステップ4: フィードバックと改善

統合テストで発見された問題に基づいて、追加の修正タスクを作成します（必要に応じて）。

### 受入基準

**統合テスト**:
- [ ] 統合テストスクリプトが作成されている
- [ ] 手動での統合テストが実施されている
- [ ] テスト結果がレポートに記録されている

**動作確認**:
- [ ] ログインが正常に動作する
- [ ] プロジェクト登録が正常に動作する
- [ ] セッション作成とClaude Codeプロセス起動が正常に動作する
- [ ] WebSocket通信が正常に動作する
- [ ] プロンプト送信と応答受信が正常に動作する
- [ ] Git操作（diff、commit、rebase、merge）が正常に動作する
- [ ] ターミナル統合が正常に動作する

**レポート**:
- [ ] 統合テストレポートが作成されている
- [ ] 成功/失敗した機能がリストアップされている
- [ ] 発見された問題が詳細に記録されている

### 依存関係

- すべての実装タスク（16.1〜16.6）が完了していること
- Claude Code CLIがインストールされ、認証済みであること

### 技術的文脈

**実行環境**:
- Node.js 20以上
- Claude Code CLI
- Gitリポジトリ

**参照ファイル**:
- 既存のテスト: `src/**/__tests__/**`
- 開発サーバー: `server.ts`

### 情報の明確性

**明示された情報**:
- 統合テストの確認項目
- 手動テストの手順

**不明/要確認の情報**:
- なし（実施中に発見された問題は随時記録）

---

## 実装上の注意事項

1. **TDDの遵守**: すべてのタスクでテストファーストアプローチを守る
2. **統一レスポンス形式**: 新規APIは統一形式に準拠する
3. **エラーハンドリング**: 適切なHTTPステータスコードとエラーメッセージを返す
4. **コミット粒度**: 各ステップ（テスト、実装）で適切にコミットを作成する
5. **既存パターンの踏襲**: 既存のコードベースのパターンに従う
6. **ドキュメント更新**: 実装後は必要に応じて設計書を更新する

---

## 完了条件

Phase 16は以下の条件をすべて満たした時点で完了とします：

- [ ] タスク16.1: テスト環境の修正が完了している
- [ ] タスク16.2: タイムアウトするテストケースの修正が完了している
- [ ] タスク16.3: 設計書の更新が完了している
- [ ] タスク16.4: ランスクリプト実行APIが実装されている
- [ ] タスク16.5: プロンプト履歴APIが実装されている
- [ ] タスク16.6: コミットリセットAPIが実装されている
- [ ] タスク16.7: 統合テストが実施され、レポートが作成されている
- [ ] `npm test`がエラーなく完了する
- [ ] `npm run lint`がエラーなく完了する
- [ ] 統合テストで主要な機能が正常に動作することが確認されている
