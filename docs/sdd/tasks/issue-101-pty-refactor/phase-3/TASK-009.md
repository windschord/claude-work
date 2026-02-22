# TASK-009: 統合テスト作成・実行

> **サブエージェント実行指示**

---

## あなたのタスク

**統合テスト作成・実行** を実装してください。

### 実装の目標

Circular delegation解消、destroySession無限再帰解消、cols/rows伝播を検証する統合テストを作成・実行する。

### 作成/変更するファイル

| 操作 | ファイルパス | 説明 |
|------|-------------|------|
| 作成 | `src/services/adapters/__tests__/integration.test.ts` | 統合テスト |

---

## 受入基準

- [ ] Circular delegation解消の検証テスト(REQ-001-007)
- [ ] destroySession無限再帰解消の検証テスト(REQ-002-005)
- [ ] HOST環境cols/rows伝播の検証テスト(REQ-003-005)
- [ ] DOCKER環境cols/rows伝播の回帰テスト(REQ-003-007)
- [ ] 全テスト通過
- [ ] カバレッジ80%以上確認
- [ ] コミット: `test: 統合テスト追加(Circular delegation解消等) [TASK-009]`

---

## 実装の詳細仕様

### テストケース

1. **Circular delegation解消**:
   - HOST環境でセッション作成時、createSession()が1回のみ呼び出されること
   - "Session already exists"エラーが発生しないこと

2. **destroySession無限再帰解消**:
   - セッション破棄時、スタックオーバーフローエラーが発生しないこと
   - destroySession()が1回のみ呼び出されること

3. **cols/rows伝播**:
   - HOST環境でブラウザのターミナルサイズとPTYサイズが一致すること
   - DOCKER環境でも同様に一致すること

---

## 推定工数
60分

## ステータス

`DONE`

**完了サマリー**: integration.test.ts(11テスト)を作成。Circular delegation解消(REQ-001-007)、destroySession無限再帰解消(REQ-002-005)、HOST/DOCKER環境のcols/rows伝播(REQ-003-005, REQ-003-007)を検証。カバレッジ: base-adapter 80%, docker-adapter 80.33%。コミット118da90。
