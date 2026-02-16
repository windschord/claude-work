# タスク: 設定ページのナビゲーション改善

> このドキュメントは実装完了後の逆順レビューにより作成されました。

## 情報の明確性チェック（全体）

### ユーザーから明示された情報

- [x] 実装対象: `/settings` ページをカード形式のナビゲーションハブに変更
- [x] 導線追加対象: GitHub PAT設定ページ
- [x] UI要件: 環境設定と同様の導線を提供
- [x] 既存設定の扱い: `/settings/app` に移動
- [x] 実装ファイル: `src/app/settings/page.tsx`, `src/app/settings/app/page.tsx`

### 不明/要確認の情報（全体）

なし（実装完了時に全て確認済み）

---

## 実装計画

### フェーズ1: 要件分析と設計

#### タスク1.1: 現状分析と要件整理

**説明**:
- 現在の設定ページの構造を確認
- PAT設定への導線が不足していることを特定
- 環境設定の導線パターンを分析

**技術的文脈**:
- 環境設定は `/settings/environments` に配置済み
- PAT設定は `/settings/github-pat` に配置済み（導線なし）
- 現在の `/settings` は直接設定フォームを表示

**受入基準**:
- [x] 現状の問題点が特定されている
- [x] ユーザー要件が明確化されている
- [x] 実装方針が決定されている

**依存関係**: なし
**ステータス**: `DONE`
**完了サマリー**: 問題特定完了。カード形式ナビゲーションハブへの変更を決定。

#### タスク1.2: UI設計とカード構成の決定

**説明**:
- 設定ページに配置するカードの構成を決定
- レスポンシブグリッドレイアウトの仕様を確定
- アイコンとカラースキームの選定

**技術的文脈**:
- lucide-react のアイコンを使用
- Tailwind CSS でグリッドレイアウトを実装
- ダークモード対応が必須

**設計決定**:
- 3つのカード: アプリケーション設定、実行環境、GitHub PAT
- グリッドレイアウト: モバイル1列、タブレット2列、デスクトップ3列
- ホバーエフェクト: シャドウ強調、ボーダーカラー変更、アイコン拡大

**受入基準**:
- [x] カード構成が確定している
- [x] レスポンシブ仕様が明確化されている
- [x] UIデザインが決定されている

**依存関係**: タスク1.1
**ステータス**: `DONE`
**完了サマリー**: 3カード構成、レスポンシブグリッド、ホバーエフェクトの仕様確定。

### フェーズ2: 実装

#### タスク2.1: アプリケーション設定ページの作成

**説明**:
- `/settings/app/page.tsx` を作成
- 既存の `/settings/page.tsx` の内容を移動
- ページタイトルを「アプリケーション設定」に変更

**対象ファイル**:
- 作成: `src/app/settings/app/page.tsx`

**実装内容**:
- Git Clone タイムアウト設定（1-30分）
- デバッグモード設定（Dockerボリューム保持）
- 設定の取得・保存API連携（`/api/settings/config`）
- ローディング状態とエラーハンドリング

**受入基準**:
- [x] `src/app/settings/app/page.tsx` が作成されている
- [x] 既存の設定機能が全て動作する
- [x] TypeScriptコンパイルエラーがない
- [x] ダークモード対応されている

**依存関係**: タスク1.2
**ステータス**: `DONE`
**完了サマリー**: アプリケーション設定ページ作成完了。164行、全機能動作確認済み。

#### タスク2.2: カード形式ナビゲーションハブの実装

**説明**:
- `/settings/page.tsx` をカード形式ナビゲーションハブに全面変更
- SettingCard コンポーネントの実装
- 3つの設定カードの配置

**対象ファイル**:
- 修正: `src/app/settings/page.tsx`

**実装内容**:

**SettingCard コンポーネント**:
```typescript
interface SettingCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}
```

**3つのカード**:
1. **アプリケーション設定** (`/settings/app`)
   - アイコン: `Settings` (lucide-react)
   - 説明: Git Cloneタイムアウトやデバッグモード設定

2. **実行環境** (`/settings/environments`)
   - アイコン: `Server` (lucide-react)
   - 説明: Claude Code実行環境の管理（HOST、DOCKER、SSH）

3. **GitHub PAT** (`/settings/github-pat`)
   - アイコン: `Key` (lucide-react)
   - 説明: GitHubリポジトリアクセス用のPersonal Access Token管理

**受入基準**:
- [x] カード形式ナビゲーションハブが実装されている
- [x] 3つのカードが正しく配置されている
- [x] 各カードから対応するページに遷移できる
- [x] TypeScriptコンパイルエラーがない

**依存関係**: タスク2.1
**ステータス**: `DONE`
**完了サマリー**: カード形式ナビゲーションハブ実装完了。90行、3カード配置。

#### タスク2.3: レスポンシブレイアウトの実装

**説明**:
- グリッドレイアウトのレスポンシブ対応
- ブレークポイントの設定

**技術的文脈**:
- Tailwind CSS のレスポンシブユーティリティを使用
- モバイルファースト設計

**実装内容**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* カード配置 */}
</div>
```

**ブレークポイント**:
- デフォルト（モバイル）: 1列（`grid-cols-1`）
- タブレット（md: 768px〜）: 2列（`md:grid-cols-2`）
- デスクトップ（lg: 1024px〜）: 3列（`lg:grid-cols-3`）

**受入基準**:
- [x] モバイルで1列表示される
- [x] タブレットで2列表示される
- [x] デスクトップで3列表示される

**依存関係**: タスク2.2
**ステータス**: `DONE`
**完了サマリー**: レスポンシブグリッド実装完了。3ブレークポイント対応。

#### タスク2.4: ホバーエフェクトとダークモード対応

**説明**:
- カードのホバーエフェクト実装
- ダークモード対応のカラースキーム適用

**実装内容**:

**ホバーエフェクト**:
- シャドウ強調: `hover:shadow-lg`
- ボーダーカラー変更: `hover:border-blue-500 dark:hover:border-blue-400`
- アイコン拡大: `group-hover:scale-110 transition-transform`
- トランジション: `transition-all duration-200`

**ダークモード対応**:
- 背景: `bg-white dark:bg-gray-800`
- ボーダー: `border-gray-200 dark:border-gray-700`
- テキスト: `text-gray-900 dark:text-gray-100`
- アイコン: `text-blue-600 dark:text-blue-400`

**受入基準**:
- [x] ホバー時にシャドウが強調される
- [x] ホバー時にボーダーが青色に変化する
- [x] ホバー時にアイコンが拡大される
- [x] ライトモードで正しく表示される
- [x] ダークモードで正しく表示される

**依存関係**: タスク2.3
**ステータス**: `DONE`
**完了サマリー**: ホバーエフェクトとダークモード対応完了。スムーズなトランジション実装。

### フェーズ3: 検証とコミット

#### タスク3.1: 動作確認

**説明**:
- ブラウザで実際の動作を確認
- 全ての遷移パスをテスト
- レスポンシブ動作の確認

**確認項目**:
- [x] `/settings` にアクセスして3つのカードが表示される
- [x] 各カードをクリックして正しいページに遷移する
- [x] アプリケーション設定が正常に動作する
- [x] ホバーエフェクトが動作する
- [x] レスポンシブレイアウトが動作する
- [x] ダークモード切り替えが動作する

**依存関係**: タスク2.4
**ステータス**: `DONE`
**完了サマリー**: 全ての動作確認完了。問題なし。

#### タスク3.2: コミット作成

**説明**:
- 変更をコミット
- 詳細なコミットメッセージを作成

**コミット内容**:
```text
commit 1fd3d3b
feat: 設定ページをカード形式のナビゲーションハブに変更

- `/settings/app/page.tsx` を作成し、既存のアプリケーション設定を移動
- `/settings/page.tsx` をカード形式のナビゲーションハブに変更
- 3つの設定カード（アプリケーション設定、実行環境、GitHub PAT）を配置
- レスポンシブグリッドレイアウト実装（モバイル: 1列、タブレット: 2列、デスクトップ: 3列）
- ホバーエフェクトとトランジション追加
- ダークモード対応

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**変更ファイル**:
- `src/app/settings/app/page.tsx` - 164行追加（新規作成）
- `src/app/settings/page.tsx` - 149行削除、74行追加（全面変更）

**受入基準**:
- [x] コミットが作成されている
- [x] コミットメッセージが詳細である
- [x] 全ての変更が含まれている

**依存関係**: タスク3.1
**ステータス**: `DONE`
**完了サマリー**: コミット `1fd3d3b` 作成完了。

### フェーズ4: 戻るボタンと未保存変更警告の実装

#### タスク4.1: BackButtonコンポーネントの実装

**説明**:
- 全設定詳細ページで使用される共通の戻るボタンコンポーネントを実装
- TDD（テスト駆動開発）で実装

**対象ファイル**:
- 作成: `src/components/settings/BackButton.tsx`
- 作成: `src/components/settings/__tests__/BackButton.test.tsx`

**受入基準**:
- [x] BackButtonコンポーネントが作成されている
- [x] テストが6つ以上ある
- [x] 全テスト通過
- [x] ArrowLeftアイコン + 「設定に戻る」テキスト
- [x] onBeforeNavigateコールバック対応

**詳細**: [TASK-4.1.md](phase-4/TASK-4.1.md) @phase-4/TASK-4.1.md

**依存関係**: なし
**推定工数**: 30分
**ステータス**: `DONE`

#### タスク4.2: UnsavedChangesDialogコンポーネントの実装

**説明**:
- 未保存の変更がある場合に警告ダイアログを表示するコンポーネントを実装
- TDD（テスト駆動開発）で実装

**対象ファイル**:
- 作成: `src/components/settings/UnsavedChangesDialog.tsx`
- 作成: `src/components/settings/__tests__/UnsavedChangesDialog.test.tsx`

**受入基準**:
- [x] UnsavedChangesDialogコンポーネントが作成されている
- [x] テストが9つ以上ある
- [x] 全テスト通過
- [x] キーボード操作対応（ESC/Enter）
- [x] 破棄ボタンは赤色

**詳細**: [TASK-4.2.md](phase-4/TASK-4.2.md) @phase-4/TASK-4.2.md

**依存関係**: なし
**推定工数**: 40分
**ステータス**: `DONE`

#### タスク4.3: /settings/appページでの統合

**説明**:
- `/settings/app` ページに BackButton と UnsavedChangesDialog を統合
- フォーム変更検知機能を実装

**対象ファイル**:
- 修正: `src/app/settings/app/page.tsx`
- 修正: `src/app/settings/app/__tests__/page.test.tsx`

**受入基準**:
- [x] BackButtonがページ上部に表示される
- [x] フォーム変更時に未保存フラグが立つ
- [x] 未保存変更時にダイアログが表示される
- [x] 保存後にフラグがリセットされる

**詳細**: [TASK-4.3.md](phase-4/TASK-4.3.md) @phase-4/TASK-4.3.md

**依存関係**: タスク4.1, タスク4.2
**推定工数**: 40分
**ステータス**: `DONE`

#### タスク4.4: /settings/environmentsページへのBackButton追加

**説明**:
- `/settings/environments` ページに BackButton を追加

**対象ファイル**:
- 修正: `src/app/settings/environments/page.tsx`

**受入基準**:
- [x] BackButtonがページ上部に表示される
- [x] クリック時に `/settings` に遷移する

**詳細**: [TASK-4.4.md](phase-4/TASK-4.4.md) @phase-4/TASK-4.4.md

**依存関係**: タスク4.1
**推定工数**: 15分
**ステータス**: `DONE`

#### タスク4.5: /settings/github-patページへのBackButton追加

**説明**:
- `/settings/github-pat` ページに BackButton を追加

**対象ファイル**:
- 修正: `src/app/settings/github-pat/page.tsx`

**受入基準**:
- [x] BackButtonがページ上部に表示される
- [x] クリック時に `/settings` に遷移する

**詳細**: [TASK-4.5.md](phase-4/TASK-4.5.md) @phase-4/TASK-4.5.md

**依存関係**: タスク4.1
**推定工数**: 15分
**ステータス**: `DONE`

#### タスク4.6: 動作確認とコミット

**説明**:
- Story 7（戻るボタン）とStory 8（未保存変更警告）の全機能を確認
- 最終コミットを作成

**受入基準**:
- [x] 全設定ページで戻るボタンが動作する
- [x] 未保存変更警告が正しく動作する
- [x] 全テスト通過
- [x] ESLintエラーゼロ
- [x] ビルド成功

**詳細**: [TASK-4.6.md](phase-4/TASK-4.6.md) @phase-4/TASK-4.6.md

**依存関係**: タスク4.1, タスク4.2, タスク4.3, タスク4.4, タスク4.5
**推定工数**: 30分
**ステータス**: `DONE`

## 並列実行グループ

### グループA（並列実行可能）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-4.1 | src/components/settings/BackButton.tsx | なし |
| TASK-4.2 | src/components/settings/UnsavedChangesDialog.tsx | なし |

### グループB（グループA完了後に並列実行可能）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-4.3 | src/app/settings/app/page.tsx | TASK-4.1, TASK-4.2 |
| TASK-4.4 | src/app/settings/environments/page.tsx | TASK-4.1 |
| TASK-4.5 | src/app/settings/github-pat/page.tsx | TASK-4.1 |

### グループC（グループB完了後）

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-4.6 | - | TASK-4.1〜4.5 |

## タスクステータスの凡例

- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - 依存関係や問題によりブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

## 進捗サマリー

**全体進捗**: 14/14 タスク完了（100%）

| フェーズ | 完了/全体 | 進捗率 |
|---------|----------|--------|
| フェーズ1: 要件分析と設計 | 2/2 | 100% |
| フェーズ2: 実装 | 4/4 | 100% |
| フェーズ3: 検証とコミット | 2/2 | 100% |
| フェーズ4: 戻るボタンと未保存変更警告 | 6/6 | 100% |

## 実装サマリー

### フェーズ1-3（完了）

- **作成ファイル**: 1ファイル（`src/app/settings/app/page.tsx`）
- **修正ファイル**: 1ファイル（`src/app/settings/page.tsx`）
- **追加行数**: 238行
- **削除行数**: 149行
- **コミット**: `1fd3d3b`
- **実装期間**: 約3時間（要件確認→実装→検証）

### フェーズ4（完了）

- **作成ファイル**: 4ファイル
  - `src/components/settings/BackButton.tsx` - 28行
  - `src/components/settings/__tests__/BackButton.test.tsx` - 122行（6テスト）
  - `src/components/settings/UnsavedChangesDialog.tsx` - 60行
  - `src/components/settings/__tests__/UnsavedChangesDialog.test.tsx` - 123行（9テスト）
- **修正ファイル**: 3ファイル
  - `src/app/settings/app/page.tsx` - BackButton/UnsavedChangesDialog統合
  - `src/app/settings/environments/page.tsx` - BackButton追加
  - `src/app/settings/github-pat/page.tsx` - BackButton追加
- **テスト結果**: 15個全てのテスト通過
- **ブラウザ検証**: 全機能正常動作確認
- **実装期間**: 約2.5時間（TDD実装→ブラウザ検証）

## リスクと軽減策

### リスク1: 既存設定へのアクセス断絶

**影響度**: 高
**発生確率**: 低
**軽減策**:
- `/settings/app` に明確にリダイレクト導線を配置
- カード形式で視覚的にわかりやすく表示
- **結果**: 問題なし。カードから明確にアクセス可能。

### リスク2: レスポンシブレイアウトの表示崩れ

**影響度**: 中
**発生確率**: 低
**軽減策**:
- Tailwind CSS の標準ブレークポイントを使用
- 各画面サイズで動作確認
- **結果**: 問題なし。全画面サイズで正常表示。

## 備考

- 実装は要件定義と設計を経て、段階的に実施
- 既存の設定機能は一切変更せず、UIのみ改善
- ダークモード対応により、全テーマで統一感のあるデザインを実現
- 今後の設定追加時も、カードを追加するだけで対応可能な拡張性を確保
