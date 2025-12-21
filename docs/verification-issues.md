# 動作検証で発見された不具合

## 検証日時
2025-12-21

## 検証ブランチ
`nodejs-architecture`

## 不具合一覧

### Issue #1: ログイン機能が動作しない（Critical）

**画面**: ログインページ (`/login`)

**要件**: REQ-055, REQ-056

**現象**:
- 正しいトークン`your-secure-token-here`を入力してもログインが失敗する
- エラーメッセージ「トークンが無効です」が表示される
- サーバーログに`Login attempt with invalid token`が記録される

**期待される動作**:
- .envファイルで設定された`CLAUDE_WORK_TOKEN=your-secure-token-here`と一致するトークンでログインできる
- ログイン成功後、プロジェクト一覧ページにリダイレクトされる（REQ-056）

**調査結果**:

1. **トークンハッシュの確認**:
   - データベースには正しいハッシュが保存されている
   - `your-secure-token-here`のSHA-256ハッシュ: `cefc2a085280eb0bab47812888db693fe916baca02d4e8c41950cec5fda49abf`
   - データベース内に同一ハッシュが存在する

2. **ログイン処理の確認**:
   - `src/app/api/auth/login/route.ts`: `validateToken(token)`を呼び出し
   - `src/lib/auth.ts`: `validateToken`関数は`process.env.CLAUDE_WORK_TOKEN`と入力トークンを直接比較

3. **環境変数の確認**:
   - `.env`ファイルには`CLAUDE_WORK_TOKEN=your-secure-token-here`が設定されている
   - サーバー起動時に`dotenv/config`でロードされているはず（`server.ts:1`）

**推定原因**:
- サーバー起動時に環境変数が正しくロードされていない可能性
- または、.envファイルのパースエラー
- または、nodejs-architectureブランチで環境変数ロードの仕組みが変更された可能性

**影響範囲**:
- ログイン機能全体が使用不可
- 新規ユーザーがアプリケーションにアクセスできない
- **重要**: 既存のセッションCookieがあればログイン画面をスキップしてアクセス可能

**再現手順**:
1. `npm run dev:pm2`でサーバーを起動
2. ブラウザで`http://localhost:3000/login`を開く
3. トークン入力フィールドに`your-secure-token-here`を入力
4. 「ログイン」ボタンをクリック
5. エラーメッセージ「トークンが無効です」が表示される

**関連ファイル**:
- `src/app/api/auth/login/route.ts:54` - validateToken呼び出し
- `src/lib/auth.ts:51-56` - validateToken関数の実装
- `.env:3` - CLAUDE_WORK_TOKEN設定
- `server.ts:1` - dotenv/configインポート

**ワークアラウンド**:
- 既存のセッションCookieを使用すれば、ログインをスキップして各画面にアクセス可能
- データベースに直接セッションを作成することも可能（一時的な回避策）

---

### Issue #2: セッション認証が機能しない（Critical）

**画面**: 全画面（認証が必要なすべてのページ）

**要件**: REQ-054, REQ-055, REQ-056, REQ-057

**現象**:
- データベースに有効なセッションが存在するが、`/api/auth/session`が`{"authenticated": false}`を返す
- セッションCookieを手動で設定しても認証されない
- Prismaクライアントが`AuthSession`テーブルからデータを取得できない（`findUnique`がnullを返す）

**期待される動作**:
- 有効なセッションCookieがある場合、`/api/auth/session`は`{"authenticated": true}`を返す
- 認証済みユーザーはプロジェクト一覧やその他のページにアクセスできる

**調査結果**:

1. **データベース確認**:
   - セッション`50659c5c-bf82-4b1f-be63-59f5bfd28a93`がAuthSessionテーブルに存在する
   - expires_at: `1766412983852` (2025-12-22 14:16:23 UTC) - 有効
   - created_at: `1766326583852` (2025-12-21 14:16:23 UTC)

2. **Prismaクライアント確認**:
   - `prisma.authSession.findUnique({ where: { id: '50659c5c-bf82-4b1f-be63-59f5bfd28a93' } })`がnullを返す
   - データベースには存在するのにPrismaで取得できない

3. **テーブルスキーマ確認**:
   - `AuthSession`テーブルは正しく作成されている
   - カラム構成: id (TEXT PRIMARY KEY), token_hash (TEXT), expires_at (DATETIME), created_at (DATETIME)

**推定原因**:
- Prismaクライアントが古いまたは不一致のスキーマを使用している可能性
- `npx prisma generate`が実行されていない可能性
- DATABASE_URL環境変数が異なるデータベースファイルを指している可能性
- Prisma migrationが正しく実行されていない可能性

**影響範囲**:
- Issue #1と組み合わせて、アプリケーション全体が使用不可
- 新規ログイン不可 + 既存セッションも認証されない = 完全にアクセス不可
- **Blocker**: この問題が解決されない限り、他の画面のテストが不可能

**再現手順**:
1. データベースに有効なセッションを作成
2. ブラウザでCookieに`sessionId=<セッションID>`を設定
3. `/api/auth/session`にGETリクエスト
4. `{"authenticated": false}`が返される

**関連ファイル**:
- `src/app/api/auth/session/route.ts:47` - getSession呼び出し
- `src/lib/auth.ts:68-82` - getSession関数の実装
- `prisma/schema.prisma:51-56` - AuthSessionモデル定義
- `prisma/data/claudework.db` - データベースファイル

**ワークアラウンド**:
- なし（この問題は回避不可能）

---

### Issue #3: Git状態インジケーターが未実装（High）

**画面**: プロジェクト詳細ページ、セッション一覧

**要件**: REQ-016

**現象**:
- セッション一覧でGit状態（clean/dirty）を示すインジケーターが表示されない
- `GitStatusBadge.tsx` 実装ファイルが存在しない
- テストファイルのみ存在: `src/components/sessions/__tests__/GitStatusBadge.test.tsx`

**期待される動作**:
- セッション一覧で各セッションのGit状態が視覚的に表示される
- 未コミット変更がある場合「変更あり」、クリーンな場合「クリーン」と表示される（REQ-016）

**影響範囲**:
- ユーザーはセッションのGit状態を視覚的に確認できない
- worktreeに変更があるかどうかを把握しづらい

**関連ファイル**:
- `src/components/sessions/__tests__/GitStatusBadge.test.tsx` - テスト仕様（実装の雛形）
- `src/components/sessions/SessionCard.tsx` - GitStatusBadgeを表示すべき箇所
- `src/components/sessions/SessionList.tsx` - セッション一覧コンポーネント

---

### Issue #4: プロンプト履歴ドロップダウンが未実装（High）

**画面**: 新規セッション作成フォーム

**要件**: REQ-018, REQ-019

**現象**:
- プロンプト入力時に履歴ドロップダウンが表示されない
- `PromptHistoryDropdown.tsx` 実装ファイルが存在しない
- テストファイルのみ存在: `src/components/sessions/__tests__/PromptHistoryDropdown.test.tsx`
- プロンプト履歴APIは実装済み（`src/app/api/prompts/route.ts`）

**期待される動作**:
- プロンプト入力時、過去のプロンプト履歴がドロップダウンで表示される（REQ-018）
- 履歴を選択すると、プロンプト入力欄に挿入される（REQ-019）

**影響範囲**:
- ユーザーは過去のプロンプトを再利用できない
- 同じプロンプトを毎回手入力する必要がある
- プロンプト履歴APIが活用されていない

**関連ファイル**:
- `src/components/sessions/__tests__/PromptHistoryDropdown.test.tsx` - テスト仕様
- `src/components/sessions/CreateSessionForm.tsx` - ドロップダウンを統合すべきコンポーネント
- `src/app/api/prompts/route.ts` - プロンプト履歴API（実装済み）

---

### Issue #5: コミット履歴UIが未実装（High）

**画面**: セッション詳細ページ

**要件**: REQ-039, REQ-040, REQ-041, REQ-042

**現象**:
- セッション詳細ページにコミット履歴タブが存在しない
- `CommitHistory.tsx` 実装ファイルが存在しない
- テストファイルのみ存在: `src/components/git/__tests__/CommitHistory.test.tsx`
- コミット取得API（GET `/api/sessions/:id/commits`）は実装済み
- リセットAPI（POST `/api/sessions/:id/reset`）も実装済み

**期待される動作**:
- worktree内のコミット履歴が時系列で表示される（REQ-039）
- 各コミットのハッシュ、メッセージ、日時、変更ファイル数が表示される（REQ-040）
- コミット選択時、変更内容（diff）が表示される（REQ-041）
- 「このコミットに戻る」ボタンで確認ダイアログが表示される（REQ-042）

**影響範囲**:
- ユーザーはコミット履歴を閲覧できない
- 過去のコミットに戻す機能がUIから利用不可
- APIは実装済みだが、フロントエンドが欠落

**関連ファイル**:
- `src/components/git/__tests__/CommitHistory.test.tsx` - テスト仕様
- `src/app/api/sessions/[id]/commits/route.ts` - コミット取得API（実装済み）
- `src/app/api/sessions/[id]/reset/route.ts` - リセットAPI（実装済み）
- `src/app/sessions/[id]/page.tsx` - セッション詳細ページ（タブ追加が必要）

---

### Issue #6: ランスクリプトログ表示UIが未実装（High）

**画面**: セッション詳細ページ

**要件**: REQ-034, REQ-035, REQ-036

**現象**:
- ランスクリプト実行時の出力を表示する専用ログタブが存在しない
- ログフィルター機能（info/warn/error）が未実装
- ログのテキスト検索機能が未実装
- RunScriptManager（バックエンド）は実装済み（`src/services/run-script-manager.ts`）
- ランスクリプト実行API（POST `/api/sessions/:id/run`）も実装済み

**期待される動作**:
- ランスクリプト実行中、出力がリアルタイムで専用ログタブに表示される（REQ-034）
- ログをログレベル（info/warn/error）でフィルターできる（REQ-035）
- ログをテキスト検索できる（REQ-036）

**影響範囲**:
- ユーザーはランスクリプトの出力を確認できない
- テスト、ビルドなどの実行結果が見えない
- デバッグが困難

**関連ファイル**:
- `src/services/run-script-manager.ts` - ランスクリプト実行管理（実装済み）
- `src/app/api/sessions/[id]/run/route.ts` - 実行API（実装済み）
- `src/app/sessions/[id]/page.tsx` - セッション詳細ページ（ログタブ追加が必要）

---

### Issue #7: サブエージェント出力の折りたたみ表示が部分実装（Medium）

**画面**: セッション詳細ページ（Chatタブ）

**要件**: REQ-024

**現象**:
- データモデル（Zustand store）に `sub_agents` フィールドは存在する（`src/store/index.ts:85-86`）
- UI上でサブエージェント出力が折りたたみ可能かどうか未確認
- MessageDisplayコンポーネントでの処理が不明

**期待される動作**:
- サブエージェントタスクの出力が折りたたみ可能なUIで表示される（REQ-024）
- ユーザーが必要に応じて展開・折りたたみできる

**影響範囲**:
- サブエージェント出力が適切に整理されない可能性
- 長い出力がUIを圧迫する可能性

**関連ファイル**:
- `src/store/index.ts:85-86` - sub_agentsフィールド定義
- `src/components/sessions/MessageDisplay.tsx` - メッセージ表示コンポーネント（要確認）

---

### Issue #8: ランスクリプト終了コードと実行時間の表示が部分実装（Medium）

**画面**: セッション詳細ページ（ランスクリプトログ）

**要件**: REQ-037

**現象**:
- RunScriptManagerでイベント発火は実装されている（`src/services/run-script-manager.ts:191-198`）
- UI上での終了コード・実行時間表示が未確認
- Issue #6のログUIが未実装のため、この機能も利用不可

**期待される動作**:
- ランスクリプト終了時、終了コードと実行時間が表示される（REQ-037）

**影響範囲**:
- ユーザーはランスクリプトの成功/失敗を視覚的に確認できない
- 実行時間が不明で、パフォーマンス把握が困難

**関連ファイル**:
- `src/services/run-script-manager.ts:191-198` - イベント発火（実装済み）
- セッション詳細ページのログUI（未実装、Issue #6に関連）

---

## 検証の進行状況

### ✅ 検証完了
- ログインページの表示
- トークン入力フィールド
- ログインボタン
- テーマ切り替えボタン（ログインページ）

### ❌ 検証不可（Issue #1の影響）
- ログイン成功フロー
- ログイン後のリダイレクト

### 🔄 検証中
- プロジェクト一覧ページ（既存セッション使用）
- プロジェクト詳細ページ
- セッション詳細ページ

### ⏸️ 未検証
- モバイル対応
- テーマ設定（全画面での動作）
- 非機能要件
