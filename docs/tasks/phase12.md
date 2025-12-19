# フェーズ12: Phase 11マージ後の不具合修正

推定期間: 90分（AIエージェント作業時間）
MVP: Yes

## 概要

Phase 11マージ後の動作検証で発見された不具合を修正します。
セッション作成エラーの原因調査、Dialogキャンセルボタンの動作確認、設計書のAPIレスポンス形式統一を実施します。

**参照**: `docs/verification-report-phase11-post-merge.md`

---

## タスク12.1: セッション作成エラーの原因調査

**優先度**: Critical
**推定工数**: 20分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

セッション作成が失敗する問題の原因を調査します。

**現在の症状**:
- セッション作成フォームから送信すると、約10秒後に「セッションの作成に失敗しました」エラーメッセージが表示される
- データベースにはセッションが作成されるが、`status: 'error'`になっている
- 検証レポート（docs/verification-report-phase11-post-merge.md:39-121）で詳細が記録されている

**推定原因**:
- ProcessManager.startClaudeCode()の失敗（src/app/api/projects/[project_id]/sessions/route.ts:192）
- Claude Codeパスの設定が正しくない可能性
- 環境変数CLAUDE_CODE_PATHが設定されていない可能性

**調査の目的**:
- エラーログを確認して原因を特定する
- CLAUDE_CODE_PATHの設定状況を確認する
- ProcessManagerのエラーハンドリングが正しく動作しているか確認する
- 修正方針を明確にする（実際の修正は次のフェーズで実施）

### 実装手順

1. **サーバーログの確認**: 開発サーバーのログを確認
   ```bash
   # 開発サーバーを起動（既に起動している場合はスキップ）
   npm run dev

   # ログレベルをdebugに設定して詳細ログを確認
   # .envファイルで LOG_LEVEL=debug が設定されていることを確認
   ```

2. **セッション作成を実行してエラーログを記録**:
   - ブラウザで `http://localhost:3000/` にアクセス
   - 既存プロジェクトを開く
   - セッション作成フォームに入力:
     - 名前: エラー調査テスト
     - プロンプト: Claude Codeパス設定の調査です
     - モデル: Auto
     - 作成数: 1
   - 「セッション作成」ボタンをクリック
   - サーバーログに出力されたエラーメッセージを記録する

3. **ProcessManagerのエラーハンドリングを確認**:
   - `src/services/process-manager.ts`を読んで、エラーハンドリングのロジックを確認
   - 100行目の`claudeCodePath`変数の値を確認
   - 108-114行目のエラーハンドリング（ENOENT検出）が動作しているか確認

4. **環境変数CLAUDE_CODE_PATHの確認**:
   ```bash
   # 環境変数を確認
   printenv CLAUDE_CODE_PATH || echo "未設定"

   # .envファイルの内容を確認
   cat .env

   # .env.exampleと比較
   cat .env.example
   ```

5. **Claude Codeの実行可能性を確認**:
   ```bash
   # システムPATHでclaudeコマンドが見つかるか確認
   which claude

   # claudeコマンドが実行できるか確認
   claude --version
   ```

6. **調査結果をまとめる**:
   - エラーメッセージの内容
   - CLAUDE_CODE_PATHの設定状況
   - Claude Codeのインストール状況
   - 問題の原因（特定できた場合）
   - 修正方針の提案

7. **調査結果をファイルに記録してコミット**:
   ```bash
   # 調査結果をファイルに記録
   mkdir -p docs/investigation
   cat > docs/investigation/session-creation-error.md << 'EOF'
# セッション作成エラーの調査結果

## 調査日時
[実施日時]

## エラーメッセージ
[記録したエラー内容]

## CLAUDE_CODE_PATH設定状況
[設定状況]

## Claude Codeインストール状況
[確認結果]

## 原因
[特定できた原因]

## 修正方針
[提案する修正方法]

## 参照
- docs/verification-report-phase11-post-merge.md:39-121
EOF

   git add docs/investigation/session-creation-error.md
   git commit -m "investigate: セッション作成エラーの原因調査完了"
   ```

### 受入基準

- [ ] 開発サーバーのログを確認し、エラーメッセージを記録した
- [ ] セッション作成を実行し、エラーの再現を確認した
- [ ] ProcessManager.tsのエラーハンドリングコード（100-114行目）を確認した
- [ ] 環境変数CLAUDE_CODE_PATHの設定状況を確認した
- [ ] Claude Codeのインストール状況を確認した（`which claude`, `claude --version`）
- [ ] 調査結果がコミットメッセージに記録されている
- [ ] 問題の原因が特定されている（または仮説が立てられている）
- [ ] 修正方針が提案されている

### 依存関係

なし

### 情報の明確性

**明示された情報**:
- エラーが発生する箇所: ProcessManager.startClaudeCode() (src/app/api/projects/[project_id]/sessions/route.ts:192)
- エラーハンドリングのコード: src/services/process-manager.ts:100-114
- 環境変数: CLAUDE_CODE_PATH（.env.example:30-35）
- データベースの状態: セッションが作成されるが status='error'
- エラーメッセージ: 「セッションの作成に失敗しました」

**不明/要確認の情報**:
- なし（調査タスクのため、調査によって明らかにする）

---

## タスク12.2: Dialogキャンセルボタンの実ブラウザ確認

**優先度**: Medium
**推定工数**: 10分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

プロジェクト追加Dialogのキャンセルボタンが動作しない問題を実ブラウザで確認します。

**現在の症状（Chrome DevToolsでの検証時）**:
- 「キャンセル」ボタンをクリックすると、5秒後にタイムアウトエラーが発生する
- Escキーでは正常に閉じられる
- 検証レポート（docs/verification-report-phase11-post-merge.md:124-170）で詳細が記録されている

**考えられる原因**:
- Headless UIのDialogコンポーネントとボタンイベントの競合
- transition-colorsアニメーションによるクリックイベントの遅延
- Chrome DevToolsのクリック処理の問題（実際のブラウザでは動作する可能性）

**確認の目的**:
- 実際のブラウザ（Chrome/Firefox/Safari）で問題が再現するか確認する
- DevTools特有の問題か、実際の問題かを判別する
- 問題が存在する場合は、次のフェーズで修正方針を検討する

### 実装手順

1. **開発サーバーの起動確認**:
   ```bash
   # 必要に応じて開発サーバーを起動
   npm run dev
   ```

2. **実ブラウザ（Chrome）でテスト**:
   - ブラウザで `http://localhost:3000/` にアクセス
   - ログイン
   - プロジェクト一覧ページで「プロジェクト追加」ボタンをクリック
   - Dialogが表示されることを確認
   - 「キャンセル」ボタンをクリック
   - Dialogが閉じるかどうかを確認
   - 結果を記録:
     - ✅ 正常に閉じる
     - ❌ 閉じない（タイムアウトまたは反応なし）

3. **実ブラウザ（Firefox）でテスト**（可能な場合）:
   - 同様の手順でテスト
   - 結果を記録

4. **実ブラウザ（Safari）でテスト**（可能な場合）:
   - 同様の手順でテスト
   - 結果を記録

5. **該当コンポーネントの確認**:
   ```bash
   # AddProjectModalコンポーネントを確認
   cat src/components/projects/AddProjectModal.tsx | grep -A 10 "キャンセル"
   ```
   - 123行目のキャンセルボタンの実装を確認
   - onClick={handleClose}が正しく設定されているか確認

6. **確認結果をファイルに記録してコミット**:
   ```bash
   # 確認結果をファイルに記録
   mkdir -p docs/investigation
   cat > docs/investigation/dialog-cancel-button-check.md << 'EOF'
# Dialogキャンセルボタンの実ブラウザ確認結果

## 確認日時
[実施日時]

## 確認結果
- Chrome: [✅正常 / ❌問題あり]
- Firefox: [✅正常 / ❌問題あり / 未確認]
- Safari: [✅正常 / ❌問題あり / 未確認]

## 結論
[DevTools特有の問題 / 実際に問題が存在する]

## 修正方針（問題が存在する場合）
[提案する修正方法]

## 参照
- docs/verification-report-phase11-post-merge.md:124-170
- 該当コード: src/components/projects/AddProjectModal.tsx:123
EOF

   git add docs/investigation/dialog-cancel-button-check.md
   git commit -m "verify: Dialogキャンセルボタンの実ブラウザ確認完了"
   ```

### 受入基準

- [ ] 実ブラウザ（最低1つ）でテストを実施した
- [ ] Chrome、Firefox、Safariのうち利用可能なブラウザでテストした
- [ ] 「キャンセル」ボタンをクリックしてDialogが閉じるか確認した
- [ ] Escキーでも閉じられることを確認した（既存動作の維持確認）
- [ ] AddProjectModal.tsx:123のコードを確認した
- [ ] 確認結果がコミットメッセージに記録されている
- [ ] 問題が存在するか、DevTools特有の問題かが判別されている
- [ ] 問題が存在する場合は、修正方針が提案されている

### 依存関係

なし

### 情報の明確性

**明示された情報**:
- 該当コンポーネント: src/components/projects/AddProjectModal.tsx
- 該当コード: 123行目のキャンセルボタン
- DevToolsでの症状: タイムアウトエラー（5秒）
- 回避方法: Escキーでは閉じられる
- 使用ライブラリ: Headless UI

**不明/要確認の情報**:
- なし（確認タスクのため、確認によって明らかにする）

---

## タスク12.3: 設計書APIレスポンス形式の全体統一

**優先度**: Low
**推定工数**: 60分（AIエージェント作業時間）
**ステータス**: `TODO`

### 説明

docs/design.mdのAPIレスポンス形式を実装と一致させて統一します。

**現在の問題**:
- POST /api/projects の設計書（380-387行目）が古い
  - 設計書: オブジェクトを直接返す形式 `{"id": "uuid", "name": "repo-name", ...}`
  - 実装: ラップされた形式 `{"project": {...}}`（Phase 11で修正済み）
- 他のAPIエンドポイントも同様の不一致がある可能性

**統一方針**（Phase 11で確立された形式）:
- GETエンドポイント: `{ リソース名（複数形）: [...] }`
  - 例: `{ projects: [...] }`, `{ sessions: [...] }`
- POST/PUTエンドポイント: `{ リソース名（単数形）: {...} }`
  - 例: `{ project: {...} }`, `{ session: {...} }`
- 一括作成エンドポイント: `{ リソース名（複数形）: [...] }`
  - 例: `{ sessions: [...] }` (POST /api/projects/{id}/sessions/bulk)

**更新対象**:
すべてのAPIエンドポイントのレスポンス形式（GET含む）

### 実装手順

1. **実装コードを確認してレスポンス形式を整理**:
   ```bash
   # 認証API
   grep -A 5 "NextResponse.json" src/app/api/auth/login/route.ts
   grep -A 5 "NextResponse.json" src/app/api/auth/logout/route.ts

   # プロジェクトAPI
   grep -A 5 "NextResponse.json" src/app/api/projects/route.ts
   grep -A 5 "NextResponse.json" src/app/api/projects/[project_id]/route.ts

   # セッションAPI
   grep -A 5 "NextResponse.json" src/app/api/projects/[project_id]/sessions/route.ts
   grep -A 5 "NextResponse.json" src/app/api/sessions/[id]/route.ts
   grep -A 5 "NextResponse.json" src/app/api/sessions/[id]/input/route.ts
   grep -A 5 "NextResponse.json" src/app/api/sessions/[id]/approve/route.ts
   grep -A 5 "NextResponse.json" src/app/api/sessions/[id]/stop/route.ts

   # Git操作API
   grep -A 5 "NextResponse.json" src/app/api/sessions/[id]/diff/route.ts
   grep -A 5 "NextResponse.json" src/app/api/sessions/[id]/commits/route.ts
   grep -A 5 "NextResponse.json" src/app/api/sessions/[id]/rebase/route.ts
   grep -A 5 "NextResponse.json" src/app/api/sessions/[id]/reset/route.ts
   grep -A 5 "NextResponse.json" src/app/api/sessions/[id]/merge/route.ts

   # ランスクリプトAPI
   grep -A 5 "NextResponse.json" src/app/api/sessions/[id]/run/route.ts

   # プロンプト履歴API
   grep -A 5 "NextResponse.json" src/app/api/prompts/route.ts
   grep -A 5 "NextResponse.json" src/app/api/prompts/[id]/route.ts
   ```

2. **実装と設計書の差分をリストアップ**:
   - 各APIエンドポイントについて、実装のレスポンス形式を記録
   - 設計書（docs/design.md）の記述と比較
   - 不一致がある箇所をリストアップ

3. **設計書を更新**:
   - docs/design.mdを編集
   - 各APIエンドポイントのレスポンス例を実装に合わせて修正
   - 統一方針に従っているか確認

4. **変更内容の確認**:
   ```bash
   # 変更内容を確認
   git diff docs/design.md
   ```

5. **設計書の更新をコミット**:
   ```bash
   git add docs/design.md
   git commit -m "docs: 設計書のAPIレスポンス形式を実装と一致させて統一

更新内容:
- 認証API: [更新内容]
- プロジェクトAPI: [更新内容]
- セッションAPI: [更新内容]
- Git操作API: [更新内容]
- ランスクリプトAPI: [更新内容]
- プロンプト履歴API: [更新内容]

統一方針:
- GETエンドポイント: { リソース名（複数形）: [...] }
- POST/PUTエンドポイント: { リソース名（単数形）: {...} }
- 一括作成エンドポイント: { リソース名（複数形）: [...] }

参照: docs/verification-report-phase11-post-merge.md:173-197"
   ```

### 受入基準

- [ ] すべてのAPIエンドポイントの実装コードを確認した
- [ ] 実装と設計書の差分をリストアップした
- [ ] docs/design.mdの以下のセクションを更新した:
  - [ ] 認証API（308-341行目）
  - [ ] プロジェクトAPI（345-424行目）
  - [ ] セッションAPI（428-526行目）
  - [ ] Git操作API（530-614行目）
  - [ ] ランスクリプトAPI（618-636行目）
  - [ ] プロンプト履歴API（640-658行目）
- [ ] すべてのレスポンス例が実装と一致している
- [ ] 統一方針に従ったレスポンス形式になっている
- [ ] 設計書の更新がコミットされている

### 依存関係

なし

### 情報の明確性

**明示された情報**:
- 設計書ファイル: docs/design.md
- 統一方針: Phase 11で確立された形式（GET: 複数形、POST/PUT: 単数形）
- 既知の不一致: POST /api/projects (380-387行目)
- APIエンドポイント一覧: docs/design.md:304以降に記載
- 実装ファイルのパターン: src/app/api/**/route.ts

**不明/要確認の情報**:
- なし（設計書更新タスクのため、実装を確認して更新する）

---

## フェーズ完了条件

- [ ] すべてのタスク（12.1〜12.3）が完了している
- [ ] タスク12.1: セッション作成エラーの原因が特定され、修正方針が提案されている
- [ ] タスク12.2: Dialogキャンセルボタンの動作確認が完了し、問題の有無が判別されている
- [ ] タスク12.3: docs/design.mdのすべてのAPIレスポンス形式が実装と一致している
- [ ] 各タスクのコミットメッセージがConventional Commitsに従っている
- [ ] 調査・確認結果が適切に記録されている

## 備考

### タスクの性質

このフェーズのタスクは調査・確認・ドキュメント更新が中心です：

- **タスク12.1（調査）**: コードを修正せず、原因を特定して修正方針を提案する
- **タスク12.2（確認）**: 実ブラウザで動作を確認し、問題の有無を判別する
- **タスク12.3（ドキュメント）**: 設計書を実装に合わせて更新する

実際のコード修正は、調査結果に基づいて次のフェーズ（Phase 13）で実施します。

### 優先順位

タスクは以下の優先順位で実施してください：

1. **Critical**: タスク12.1（セッション作成エラー調査）- アプリケーションのコア機能が動作しないため最優先
2. **Medium**: タスク12.2（Dialogキャンセルボタン確認）- UX関連
3. **Low**: タスク12.3（設計書更新）- ドキュメントの一貫性

### セッション作成エラーの調査について

タスク12.1では、以下の点に注目して調査してください：

1. **エラーメッセージ**: ProcessManagerが出力するエラーメッセージの内容
2. **CLAUDE_CODE_PATH**: 環境変数が設定されているか、正しいパスか
3. **Claude Codeのインストール**: コマンドが実行可能か
4. **ProcessManagerのエラーハンドリング**: ENOENTエラーが正しく検出されているか

調査結果に基づいて、次のフェーズで以下のような修正を検討します：
- CLAUDE_CODE_PATHの設定方法をREADMEに追加
- ProcessManagerのエラーメッセージを改善
- セットアップスクリプトの追加

### Dialogキャンセルボタンの確認について

タスク12.2では、DevTools特有の問題か実際の問題かを判別することが重要です：

- **DevTools特有の問題**: 実ブラウザで正常に動作する場合、修正不要
- **実際の問題**: 実ブラウザでも問題が発生する場合、次のフェーズで修正

### 設計書の更新について

タスク12.3では、すべてのAPIエンドポイントのレスポンス形式を統一します。
Phase 11で確立された統一方針に従って、一貫性のあるドキュメントにします。

### Next.js 15の注意点

このプロジェクトはNext.js 15を使用しています。
以下の点に注意してください：

- App Routerを使用している
- `params`は非同期（Promise）として扱う必要がある
- API Routeのテストでは`NextRequest`を使用する

### 参照ドキュメント

- 検証レポート: `docs/verification-report-phase11-post-merge.md`
- Phase 11タスク: `docs/tasks/phase11.md`
- 設計書: `docs/design.md`
- ProcessManager実装: `src/services/process-manager.ts`
- セッション作成API: `src/app/api/projects/[project_id]/sessions/route.ts`
- AddProjectModal: `src/components/projects/AddProjectModal.tsx`
