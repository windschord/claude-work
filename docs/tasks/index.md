# 実装タスク一覧: セッション管理の包括的改善

## 概要

本ドキュメントは、要件定義書（[docs/requirements/index.md](../requirements/index.md) @../requirements/index.md）と技術設計書（[docs/design/index.md](../design/index.md) @../design/index.md）に基づいて分解された実装タスクの一覧です。

## 進捗サマリ

| フェーズ | タスク数 | 完了 | 進行中 | 未着手 | 推定工数 |
|---------|---------|------|--------|--------|---------|
| Phase 1 | 5 | 1 | 0 | 4 | 4時間 |
| Phase 2 | 6 | 0 | 0 | 6 | 6時間 |
| Phase 3 | 4 | 0 | 0 | 4 | 3.5時間 |
| Phase 4 | 4 | 0 | 0 | 4 | 3時間 |
| **合計** | **19** | **1** | **0** | **18** | **16.5時間** |

## フェーズ構成

### Phase 1: WebSocket接続管理の統一

**目的**: ConnectionManagerを拡張し、すべてのWebSocketタイプで使用

**依存**: なし

**期間**: 4時間

| ID | タスク | ステータス | 依存 | 工数 | リンク |
|----|-------|----------|------|------|--------|
| TASK-001 | ConnectionManagerの拡張 | DONE | - | 50分 | [詳細](phase-1/TASK-001.md) @phase-1/TASK-001.md |
| TASK-002 | Claude WebSocketのConnectionManager統合 | TODO | TASK-001 | 50分 | 未作成（後日追加予定） |
| TASK-003 | Terminal WebSocketのConnectionManager統合 | TODO | TASK-001 | 50分 | 未作成（後日追加予定） |
| TASK-004 | WebSocket接続管理の統合テスト | TODO | TASK-002, TASK-003 | 50分 | 未作成（後日追加予定） |
| TASK-005 | 複数ブラウザE2Eテスト | TODO | TASK-004 | 40分 | 未作成（後日追加予定） |

### Phase 2: PTYSessionManagerの導入

**目的**: PTYセッションとWebSocket接続を統合管理

**依存**: Phase 1完了

**期間**: 6時間

| ID | タスク | ステータス | 依存 | 工数 | リンク |
|----|-------|----------|------|------|--------|
| TASK-006 | PTYSessionManagerの基本構造作成 | DONE | TASK-005 | 60分 | [詳細](phase-2/TASK-006.md) @phase-2/TASK-006.md |
| TASK-007 | セッション作成・取得・破棄メソッド実装 | DONE | TASK-006 | 60分 | [詳細](phase-2/TASK-007.md) @phase-2/TASK-007.md |
| TASK-008 | PTYイベントハンドラー登録の実装 | DONE | TASK-007 | 50分 | [詳細](phase-2/TASK-008.md) @phase-2/TASK-008.md |
| TASK-009 | ClaudePTYManagerのリファクタリング | DONE | TASK-008 | 50分 | [詳細](phase-2/TASK-009.md) @phase-2/TASK-009.md |
| TASK-010 | WebSocketハンドラーのPTYSessionManager統合 | DONE | TASK-009 | 50分 | [詳細](phase-2/TASK-010.md) @phase-2/TASK-010.md |
| TASK-011 | PTYSessionManagerの統合テスト | DONE | TASK-010 | 50分 | [詳細](phase-2/TASK-011.md) @phase-2/TASK-011.md |

### Phase 3: Docker環境の安定化

**目的**: Dockerコンテナライフサイクル管理の改善

**依存**: Phase 1完了（Phase 2と並行可能）

**期間**: 3.5時間

| ID | タスク | ステータス | 依存 | 工数 | リンク |
|----|-------|----------|------|------|--------|
| TASK-012 | DockerAdapterのコンテナ起動待機実装 | DONE | TASK-005 | 60分 | [詳細](phase-3/TASK-012.md) @phase-3/TASK-012.md |
| TASK-013 | docker stopのPromise化とエラーハンドリング | DONE | TASK-012 | 40分 | [詳細](phase-3/TASK-013.md) @phase-3/TASK-013.md |
| TASK-014 | 親コンテナIDの永続化と孤立コンテナクリーンアップ | DONE | TASK-013 | 60分 | [詳細](phase-3/TASK-014.md) @phase-3/TASK-014.md |
| TASK-015 | DockerAdapterの統合テスト | DONE | TASK-014 | 50分 | [詳細](phase-3/TASK-015.md) @phase-3/TASK-015.md |

### Phase 4: 状態管理の統一

**目的**: セッション状態のデータベース永続化と復元

**依存**: Phase 2完了

**期間**: 3時間

| ID | タスク | ステータス | 依存 | 工数 | リンク |
|----|-------|----------|------|------|--------|
| TASK-016 | データベーススキーマの拡張 | DONE | TASK-011 | 30分 | [詳細](phase-4/TASK-016.md) @phase-4/TASK-016.md |
| TASK-017 | セッション状態の永続化ロジック実装 | DONE | TASK-016 | 60分 | [詳細](phase-4/TASK-017.md) @phase-4/TASK-017.md |
| TASK-018 | サーバー起動時の状態復元処理 | DONE | TASK-017 | 60分 | [詳細](phase-4/TASK-018.md) @phase-4/TASK-018.md |
| TASK-019 | 状態管理の統合テスト | DONE | TASK-018 | 50分 | [詳細](phase-4/TASK-019.md) @phase-4/TASK-019.md |

## タスク実行の原則

### TDD（テスト駆動開発）

すべてのタスクはTDDで実装します：

1. **テスト作成**: 期待される動作のテストを先に作成
2. **テスト実行**: 失敗を確認（Red）
3. **テストコミット**: テストのみをコミット
4. **実装**: テストを通過させる最小限の実装（Green）
5. **実装コミット**: すべてのテストが通過したらコミット
6. **リファクタリング**: 必要に応じてコードを改善（Refactor）

### コミット規則

```bash
# テストコミット
git add <test-file>
git commit -m "test(TASK-XXX): [テストの説明]"

# 実装コミット
git add <impl-file>
git commit -m "feat(TASK-XXX): [機能の説明]" \
  -m "Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 並行実行の可能性

- **Phase 1完了後**: Phase 2とPhase 3は並行実行可能
- **Phase 2完了後**: Phase 4を実行

## 成果物の検証

各フェーズ完了時に以下を確認：

### Phase 1完了時

- [ ] すべてのWebSocketタイプでConnectionManagerを使用
- [ ] イベントハンドラーがセッション単位で1つのみ
- [ ] 複数ブラウザで同一のターミナル内容が表示
- [ ] テストカバレッジ > 80%

### Phase 2完了時

- [ ] PTYSessionManagerでセッション管理が一元化
- [ ] WebSocketハンドラーがPTYSessionManager経由でアクセス
- [ ] 既存のセッション管理機能が正常動作
- [ ] テストカバレッジ > 80%

### Phase 3完了時

- [ ] Dockerコンテナが安定して起動・停止
- [ ] リサイズ操作が正しく動作
- [ ] 孤立コンテナが適切にクリーンアップ
- [ ] テストカバレッジ > 80%

### Phase 4完了時

- [ ] セッション状態がデータベースに永続化
- [ ] サーバー再起動後に状態が復元
- [ ] タイマーが正しく再設定
- [ ] テストカバレッジ > 80%

## リスク管理

| リスク | 影響度 | 対策 | 担当タスク |
|-------|--------|------|-----------|
| 既存機能の破壊 | 高 | TDDで既存機能のテストを先に作成 | 全タスク |
| パフォーマンス低下 | 中 | ベンチマークテストの実施 | TASK-004, TASK-011 |
| Docker環境での予期しない挙動 | 中 | 手動テストの強化、ログ充実 | TASK-015 |
| 実装期間の長期化 | 低 | 各タスクの工数を厳守 | 全タスク |

## 参照ドキュメント

- [要件定義書](../requirements/index.md) @../requirements/index.md
- [技術設計書](../design/index.md) @../design/index.md
- [既存CLAUDE.md](../../CLAUDE.md) @../../CLAUDE.md

## 変更履歴

| 日付 | バージョン | 変更内容 | 作成者 |
|-----|----------|---------|--------|
| 2026-02-11 | 1.0 | 初版作成 | Claude |
