# タスク: Issue #101 PTY Architecture Refactor

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。
> **不明な情報が1つでもある場合は、実装前に必ず確認を取ってください。**

## 情報の明確性チェック（全体）

### ユーザーから明示された情報
- [x] 実装対象のディレクトリ構造: src/services/adapters/
- [x] 使用するパッケージマネージャー: npm
- [x] テストフレームワーク: Vitest
- [x] リンター/フォーマッター: ESLint, TypeScript tsc
- [x] コーディング規約: TypeScript strict mode, 設計原則(docs/design-principles-pty-session-management.md)
- [x] ブランチ戦略: GitHub Flow (fix/issue-101-docker-pty-terminal)

### 不明/要確認の情報（全体）

| 項目 | 現状の理解 | 確認状況 |
|------|-----------|----------|
| テストカバレッジツール | Vitest coverage(c8/istanbul) | [x] 確認済み(NFR-MNT-002) |
| コミット粒度 | テストコミット→実装コミット | [x] 確認済み(TDD方式) |
| CI/CD設定変更要否 | GitHub Actions既存設定を使用 | [x] 確認済み(変更なし) |

### 実装前に確認すべき質問
なし（全ての必要情報が明示されている）

---

## 進捗サマリ

| フェーズ | 完了 | 進行中 | 未着手 | ブロック | 詳細リンク |
|---------|------|--------|--------|----------|-----------|
| Phase 1: 基盤構築 | 0 | 0 | 3 | 0 | [詳細](phase-1/) @phase-1/ |
| Phase 2: アダプター変更 | 0 | 0 | 4 | 0 | [詳細](phase-2/) @phase-2/ |
| Phase 3: クリーンアップ・統合 | 0 | 0 | 3 | 0 | [詳細](phase-3/) @phase-3/ |

**合計推定工数**: 420分(AIエージェント作業時間)
**並列実行時推定**: 360分(Phase 2で60分短縮)

---

## 並列実行グループ

### グループ1: Phase 1(順次実行)
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-001 | src/services/adapters/**/__tests__/base-adapter.test.ts | なし |
| TASK-002 | src/services/adapters/base-adapter.ts | TASK-001 |
| TASK-003 | 統合確認(テスト実行) | TASK-002 |

### グループ2: Phase 2(2グループ並列実行可能)

**グループ2A: HostAdapter系**
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-004 | src/services/adapters/**/__tests__/host-adapter.test.ts | TASK-003 |
| TASK-005 | src/services/adapters/host-adapter.ts | TASK-004 |

**グループ2B: DockerAdapter系**
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-006 | src/services/adapters/**/__tests__/docker-adapter.test.ts | TASK-003 |
| TASK-007 | src/services/adapters/docker-adapter.ts | TASK-006 |

**注**: TASK-004とTASK-006は並列実行可能(異なるファイル)。TASK-005とTASK-007も並列実行可能。

### グループ3: Phase 3(順次実行)
| タスク | 対象ファイル | 依存 |
|--------|-------------|------|
| TASK-008 | src/services/claude-pty-manager.ts(削除) | Phase 2 |
| TASK-009 | 統合テスト作成・実行 | TASK-008 |
| TASK-010 | GitHub Actions確認・修正 | TASK-009 |

---

## タスク一覧

### Phase 1: 基盤構築
*推定期間: 120分（AIエージェント作業時間）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-001 | BasePTYAdapterユニットテスト作成 | TODO | - | 40min | [詳細](phase-1/TASK-001.md) @phase-1/TASK-001.md |
| TASK-002 | BasePTYAdapter実装 | TODO | TASK-001 | 40min | [詳細](phase-1/TASK-002.md) @phase-1/TASK-002.md |
| TASK-003 | BasePTYAdapter統合確認 | TODO | TASK-002 | 20min | [詳細](phase-1/TASK-003.md) @phase-1/TASK-003.md |

### Phase 2: アダプター変更
*推定期間: 180分（順次実行）/ 120分（並列実行）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-004 | HostAdapterテスト作成 | TODO | TASK-003 | 40min | [詳細](phase-2/TASK-004.md) @phase-2/TASK-004.md |
| TASK-005 | HostAdapter実装(ClaudePTYManager依存削除) | TODO | TASK-004 | 50min | [詳細](phase-2/TASK-005.md) @phase-2/TASK-005.md |
| TASK-006 | DockerAdapterテスト作成 | TODO | TASK-003 | 40min | [詳細](phase-2/TASK-006.md) @phase-2/TASK-006.md |
| TASK-007 | DockerAdapter実装(共通ロジック移動) | TODO | TASK-006 | 50min | [詳細](phase-2/TASK-007.md) @phase-2/TASK-007.md |

**並列実行**: TASK-004とTASK-006を並列実行可能(60分短縮)

### Phase 3: クリーンアップ・統合
*推定期間: 120分（AIエージェント作業時間）*

| タスクID | タイトル | ステータス | 依存 | 見積 | 詳細リンク |
|----------|---------|-----------|------|------|-----------|
| TASK-008 | ClaudePTYManager削除 | TODO | Phase 2 | 20min | [詳細](phase-3/TASK-008.md) @phase-3/TASK-008.md |
| TASK-009 | 統合テスト作成・実行 | TODO | TASK-008 | 60min | [詳細](phase-3/TASK-009.md) @phase-3/TASK-009.md |
| TASK-010 | GitHub Actions確認・修正対応 | TODO | TASK-009 | 40min | [詳細](phase-3/TASK-010.md) @phase-3/TASK-010.md |

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
| Circular delegation解消の副作用 | 高 | 中 | TASK-009で包括的な統合テスト実施 |
| テストカバレッジ80%未達 | 中 | 低 | 各タスクでカバレッジ測定、不足箇所を追加 |
| GitHub Actions失敗 | 中 | 低 | TASK-010で全テスト実行・修正対応 |
| HOST/DOCKER環境の不整合 | 高 | 低 | BasePTYAdapterで共通化、両環境で同一ロジック |

## TDD原則

全てのタスクでTDD(テスト駆動開発)を適用:

1. **テスト作成**: テストケースを先に作成
2. **テスト実行**: 失敗を確認
3. **テストコミット**: テストのみをコミット
4. **実装**: テストを通過させる最小限の実装
5. **実装コミット**: 全テスト通過後にコミット

**カバレッジ目標**: 80%以上(NFR-MNT-002)

## 設計原則の遵守

全てのタスクで以下の設計原則を遵守:
- **A1**: 各レイヤーは1つの責務のみを持つ
- **A2**: 依存は常に上位から下位へ(一方向)
- **A3**: レイヤー間のインターフェースは明示的に定義
- **C1**: 呼び出しチェーンを明示的に文書化
- **C2**: レイヤー境界を明確にする
- **C3**: EventEmitterによる逆方向通信

詳細: [docs/design-principles-pty-session-management.md](../../design-principles-pty-session-management.md)

## 備考

### コミット戦略
- 各タスクで最低2回のコミット(テスト→実装)
- コミットメッセージ例:
  - `test: BasePTYAdapterユニットテスト追加 [TASK-001]`
  - `feat: BasePTYAdapter実装 [TASK-002]`

### レビューポイント
- Circular delegation完全解消(REQ-001-007)
- destroySession無限再帰解消(REQ-002-005)
- cols/rows伝播の一貫性(REQ-003-005, REQ-003-007)
- コード重複率30%以下(NFR-MNT-001)
- テストカバレッジ80%以上(NFR-MNT-002)

---

## リンク形式について

詳細ファイルへのリンクは、マークダウン形式と`@`形式の両方を記載してください：
- **マークダウン形式**: `[詳細](phase-1/TASK-001.md)` - GitHub等での閲覧用
- **@形式**: `@phase-1/TASK-001.md` - Claude Codeがファイルを参照する際に使用

---

## ドキュメント構成

```
docs/sdd-issue-101-pty-refactor/tasks/
├── index.md                     # このファイル（目次）
├── phase-1/
│   ├── TASK-001.md             # BasePTYAdapterテスト
│   ├── TASK-002.md             # BasePTYAdapter実装
│   └── TASK-003.md             # 統合確認
├── phase-2/
│   ├── TASK-004.md             # HostAdapterテスト
│   ├── TASK-005.md             # HostAdapter実装
│   ├── TASK-006.md             # DockerAdapterテスト
│   └── TASK-007.md             # DockerAdapter実装
└── phase-3/
    ├── TASK-008.md             # ClaudePTYManager削除
    ├── TASK-009.md             # 統合テスト
    └── TASK-010.md             # GitHub Actions確認
```
