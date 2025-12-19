# Phase 18: ブラウザUI動作確認後の修正

## 概要

ブラウザ操作での動作確認（verification-report-browser-ui.md）で発見された問題を修正します。

## フェーズの目標

- テーマ切り替え機能を正常に動作させる
- ブラウザUIの全機能が仕様書通りに動作することを確認する

## タスク一覧

### Phase 18.1: テーマ切り替え機能の修正

#### タスク18.1.1: テーマ切り替えボタンの動作修正

**説明**:
`src/components/common/ThemeToggle.tsx`のテーマ切り替え機能を修正し、ボタンクリック時に正しくテーマが切り替わるようにする。

**現在の問題**:
- テーマ切り替えボタンは表示されるが、クリックしてもテーマが切り替わらない
- HTMLの`class`属性が変更されない（`light`/`dark`の切り替えがない）
- ブラウザテストで確認済み（verification-report-browser-tests.md）

**関連要件**: REQ-067

**実装手順（TDD）**:
1. テスト作成: `src/components/common/__tests__/ThemeToggle.test.tsx`を確認
   - 既存テストが正しく動作しているか確認
   - 必要に応じてテストを追加
2. 問題調査: ThemeToggleコンポーネントの実装を確認
   - `next-themes`の`useTheme`フックが正しく使用されているか
   - イベントハンドラが正しく設定されているか
   - ブラウザのコンソールログでJavaScriptエラーをチェック
3. 修正実装: 問題箇所を修正
4. テスト実行: すべてのテストが通過することを確認
5. ブラウザ確認: 実際のブラウザでテーマ切り替えが動作することを確認

**受入基準**:
- [ ] `src/components/common/ThemeToggle.tsx`でテーマ切り替えが正しく実装されている
- [ ] `useTheme`フックが正しく使用されている
- [ ] ボタンクリック時にテーマが切り替わる（light → dark → system → light）
- [ ] HTMLの`class`属性が正しく変更される（`light`/`dark`）
- [ ] すべてのユニットテストが通過する（`npm test`）
- [ ] ブラウザテスト（browser-test.ts）でテーマ切り替えテストが通過する
- [ ] JavaScriptエラーが発生しない

**依存関係**: なし

**推定工数**: 30分（AIエージェント作業時間）

**ステータス**: `TODO`

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- テーマライブラリ: next-themes
- テストフレームワーク: Vitest + @testing-library/react
- 既存実装: `src/components/common/ThemeToggle.tsx`
- 既存テスト: `src/components/common/__tests__/ThemeToggle.test.tsx`
- ブラウザテスト: `browser-test.ts`の`testThemeToggle`関数

**参考情報**:
- ブラウザテスト結果: `docs/verification-report-browser-tests.md`
- ブラウザUI確認レポート: `docs/verification-report-browser-ui.md`
- スクリーンショット: `test-screenshots/theme-toggle-*.png`, `test-screenshots/theme-after-toggle-*.png`

---

#### タスク18.1.2: テーマ切り替えのE2Eテスト追加

**説明**:
テーマ切り替え機能が正しく動作することを確認するE2Eテストを追加する。

**実装手順（TDD）**:
1. テスト作成: `browser-test.ts`の`testThemeToggle`関数を強化
   - 初期テーマの確認
   - テーマ切り替え後のclass属性変更を確認
   - 3段階ローテーション（light → dark → system）を確認
   - ローカルストレージへの保存を確認
2. テスト実行: 修正前のコードでテストが失敗することを確認
3. 修正後のテスト: タスク18.1.1の修正後、テストが通過することを確認

**受入基準**:
- [ ] `browser-test.ts`にテーマ切り替えの包括的なテストが追加されている
- [ ] テストが3段階ローテーション（light → dark → system）を確認する
- [ ] テストがローカルストレージへの保存を確認する
- [ ] テストがHTMLのclass属性変更を確認する
- [ ] すべてのE2Eテストが通過する（`npx tsx browser-test.ts`）
- [ ] テスト結果レポートが更新されている

**依存関係**: タスク18.1.1が完了していること

**推定工数**: 20分（AIエージェント作業時間）

**ステータス**: `TODO`

**技術的文脈**:
- E2Eテストフレームワーク: Playwright
- テストスクリプト: `browser-test.ts`
- レポート出力先: `docs/verification-report-browser-tests.md`

---

## フェーズ完了の定義

以下がすべて完了した時、Phase 18は完了とみなされます：

- [ ] すべてのタスクのステータスが`DONE`である
- [ ] テーマ切り替え機能が正常に動作する
- [ ] すべてのテスト（ユニット・E2E）が通過する
- [ ] JavaScriptエラーが発生しない
- [ ] verification-report-browser-tests.mdのテーマ切り替えテストが成功している

## 推定総工数

- タスク18.1.1: 30分
- タスク18.1.2: 20分
- **合計**: 50分（AIエージェント作業時間）

## 備考

### 問題の詳細

**テーマ切り替えボタンが動作しない**:
- 症状: ボタンは存在するが、クリックしてもテーマが切り替わらない
- 影響: ユーザーはテーマを手動で切り替えることができない
- 影響度: 中（機能は存在するが動作しない）
- 検証方法: ブラウザテストで確認済み

**推定原因**:
- テーマ切り替えボタンのイベントハンドラが正しく設定されていない
- `next-themes`ライブラリの統合に問題がある
- JavaScriptエラーが発生している

**関連ファイル**:
- `src/components/common/ThemeToggle.tsx`
- `src/components/common/__tests__/ThemeToggle.test.tsx`
- `src/app/providers.tsx`
- `browser-test.ts`

### 関連要件

- REQ-066: ユーザーが初めてアクセスした時、システムはOSのテーマ設定に従ってライト/ダークモードを適用しなければならない
- REQ-067: ユーザーがテーマ切り替えボタンをクリックした時、システムはライト/ダークモードを切り替えなければならない
- REQ-068: システムはユーザーのテーマ選択をローカルストレージに保存しなければならない
- REQ-069: ユーザーが再アクセスした時、システムは保存されたテーマ設定を適用しなければならない
