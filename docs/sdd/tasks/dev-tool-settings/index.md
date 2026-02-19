# タスク: 開発ツール設定管理機能

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。
> **不明な情報が1つでもある場合は、実装前に必ず確認を取ってください。**

## 情報の明確性チェック（全体）

### ユーザーから明示された情報
- [x] 実装対象のディレクトリ構造: Next.js App Router（`src/app/`, `src/components/`, `src/lib/`, `src/services/`）
- [x] 使用するパッケージマネージャー: npm
- [x] テストフレームワーク: Vitest（単体・統合）、Playwright（E2E）
- [x] リンター/フォーマッター: ESLint
- [x] コーディング規約: TypeScript strict mode、既存コードスタイルに準拠
- [x] ブランチ戦略: Git worktree使用（メインリポジトリで直接作業せず）

### 不明/要確認の情報（全体）

なし（すべて確認済み）

### 実装前に確認すべき質問

すべて確認済みのため、実装可能です。

---

## 進捗サマリ

| フェーズ | 完了 | 進行中 | 未着手 | ブロック | 詳細リンク |
|---------|------|--------|--------|----------|-----------|
| Phase 1: データベース・基盤 | 0 | 0 | 4 | 0 | [詳細](phase-1/) @phase-1/ |
| Phase 2: API実装 | 0 | 0 | 2 | 0 | [詳細](phase-2/) @phase-2/ |
| Phase 3: Docker統合 | 0 | 0 | 3 | 0 | [詳細](phase-3/) @phase-3/ |
| Phase 4: UI実装 | 0 | 0 | 3 | 0 | [詳細](phase-4/) @phase-4/ |

**全体進捗**: 0/12タスク完了（0%）

---

## 並列実行グループ

### グループA（Phase 1 - 並列実行可能）
Drizzleスキーマ追加後、以下の3つのServiceを並列実装可能：

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-002 | src/services/encryption-service.ts | TASK-001 |
| TASK-003 | src/services/developer-settings-service.ts | TASK-001 |
| TASK-004 | src/services/ssh-key-service.ts | TASK-001 |

### グループB（Phase 2 - 並列実行可能）
Phase 1完了後、以下の2つのAPIエンドポイントを並列実装可能：

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-005 | src/app/api/developer-settings/** | Phase 1 |
| TASK-006 | src/app/api/ssh-keys/** | Phase 1 |

### グループC（Phase 4 - 一部並列実行可能）
Phase 3完了後、UI実装の一部を並列実行可能：

| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-010 | src/app/settings/developer/** | Phase 3 |
| TASK-011 | src/store/developer-settings-store.ts | Phase 3 |

---

## タスク一覧

### Phase 1: データベース・基盤
*推定期間: 140分（AIエージェント作業時間）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-001 | Drizzleスキーマ追加（DeveloperSettings, SshKey） | TODO | - | 20min | [詳細](phase-1/TASK-001.md) @phase-1/TASK-001.md |
| TASK-002 | EncryptionService実装（TDD） | TODO | TASK-001 | 40min | [詳細](phase-1/TASK-002.md) @phase-1/TASK-002.md |
| TASK-003 | DeveloperSettingsService実装（TDD） | TODO | TASK-001 | 40min | [詳細](phase-1/TASK-003.md) @phase-1/TASK-003.md |
| TASK-004 | SshKeyService実装（TDD） | TODO | TASK-001 | 40min | [詳細](phase-1/TASK-004.md) @phase-1/TASK-004.md |

**並列実行**: TASK-002, TASK-003, TASK-004 は TASK-001 完了後に並列実行可能

### Phase 2: API実装
*推定期間: 70分（AIエージェント作業時間）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-005 | /api/developer-settings/* エンドポイント実装（TDD） | TODO | Phase 1 | 35min | [詳細](phase-2/TASK-005.md) @phase-2/TASK-005.md |
| TASK-006 | /api/ssh-keys エンドポイント実装（TDD） | TODO | Phase 1 | 35min | [詳細](phase-2/TASK-006.md) @phase-2/TASK-006.md |

**並列実行**: TASK-005, TASK-006 は並列実行可能

### Phase 3: Docker統合
*推定期間: 110分（AIエージェント作業時間）*

| タスクID | タスクタイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|-------------|-----------|------|------|-----------|
| TASK-007 | DockerAdapter拡張（injectDeveloperSettings）実装（TDD） | TODO | Phase 2 | 50min | [詳細](phase-3/TASK-007.md) @phase-3/TASK-007.md |
| TASK-008 | SSH鍵一時ファイル管理とクリーンアップ実装 | TODO | TASK-007 | 30min | [詳細](phase-3/TASK-008.md) @phase-3/TASK-008.md |
| TASK-009 | Docker統合テスト | TODO | TASK-008 | 30min | [詳細](phase-3/TASK-009.md) @phase-3/TASK-009.md |

### Phase 4: UI実装
*推定期間: 110分（AIエージェント作業時間）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-010 | DeveloperSettingsPage UI実装 | TODO | Phase 3 | 50min | [詳細](phase-4/TASK-010.md) @phase-4/TASK-010.md |
| TASK-011 | Zustand Store実装 | TODO | Phase 3 | 30min | [詳細](phase-4/TASK-011.md) @phase-4/TASK-011.md |
| TASK-012 | E2Eテスト（Playwright） | TODO | TASK-010, TASK-011 | 30min | [詳細](phase-4/TASK-012.md) @phase-4/TASK-012.md |

**並列実行**: TASK-010, TASK-011 は並列実行可能

---

## 全体推定時間

- **Phase 1**: 140分（約2.3時間）
- **Phase 2**: 70分（約1.2時間）
- **Phase 3**: 110分（約1.8時間）
- **Phase 4**: 110分（約1.8時間）
- **合計**: 430分（約7.2時間）

**注**: AIエージェントの作業時間であり、レビュー・修正時間は含まれていません。

---

## タスクステータスの凡例
- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - 依存関係や問題によりブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

## リスクと軽減策

| リスク | 影響度 | 発生確率 | 軽減策 |
|--------|--------|----------|--------|
| SSH鍵暗号化の実装ミス | 高 | 中 | TDDで包括的なテストを先に作成、暗号化ライブラリのドキュメント参照 |
| Docker統合のデバッグ困難 | 中 | 中 | 統合テストで段階的に検証、ログ出力を充実させる |
| UI/UXのユーザビリティ問題 | 中 | 低 | E2Eテストで実際の操作フローを検証 |
| 既存システムへの影響 | 高 | 低 | 互換性テスト（既存プロジェクト/セッションで動作確認） |

## 備考

### TDD方針
- **Phase 1-3**: 各タスクでテストを先に作成し、失敗を確認してからコミット、実装後に再度コミット
- **Phase 4**: E2Eテストを先に作成し、UIコンポーネントを実装

### Git Worktree運用
- 新しいブランチとworktreeを作成: `git worktree add -b feat/dev-tool-settings ../claude-work-feat-dev-tool-settings main`
- 作業完了後にworktreeを削除: `git worktree remove ../claude-work-feat-dev-tool-settings`

### 環境変数
- 実装開始前に `.env` に `ENCRYPTION_MASTER_KEY` を追加（32文字以上のランダム文字列）

---

## リンク形式について

詳細ファイルへのリンクは、マークダウン形式と`@`形式の両方を記載してください：
- **マークダウン形式**: `[詳細](phase-1/TASK-001.md)` - GitHub等での閲覧用
- **@形式**: `@phase-1/TASK-001.md` - Claude Codeがファイルを参照する際に使用

---

## ドキュメント構成

```
docs/sdd/tasks/dev-tool-settings/
├── index.md                 # このファイル（目次）
├── phase-1/
│   ├── TASK-001.md          # Drizzleスキーマ追加
│   ├── TASK-002.md          # EncryptionService実装
│   ├── TASK-003.md          # DeveloperSettingsService実装
│   └── TASK-004.md          # SshKeyService実装
├── phase-2/
│   ├── TASK-005.md          # /api/developer-settings/* 実装
│   └── TASK-006.md          # /api/ssh-keys 実装
├── phase-3/
│   ├── TASK-007.md          # DockerAdapter拡張
│   ├── TASK-008.md          # SSH鍵一時ファイル管理
│   └── TASK-009.md          # Docker統合テスト
└── phase-4/
    ├── TASK-010.md          # DeveloperSettingsPage UI
    ├── TASK-011.md          # Zustand Store
    └── TASK-012.md          # E2Eテスト
```
