# タスク管理書: Claudeターミナル操作性改善

## タスク一覧

| ID | タスク | 状態 | 要件ID |
|----|--------|------|--------|
| T-001 | フォーカス状態管理の実装 | DONE | REQ-001 |
| T-002 | フォーカスインジケーターUI | DONE | REQ-001 |
| T-003 | CTRL+Cコピー実装 | DONE | REQ-002 |
| T-004 | CTRL+Vテキストペースト実装 | DONE | REQ-003 |
| T-005 | SHIFT+ENTER改行実装 | DONE | REQ-004 |
| T-006 | 画像保存APIの実装 | DONE | REQ-005 |
| T-007 | CTRL+V画像添付のフロントエンド実装 | DONE | REQ-005 |
| T-008 | 統合テスト・動作確認 | IN_PROGRESS | 全体 |

## タスク詳細

---

### T-001: フォーカス状態管理の実装

**状態:** DONE
**要件:** REQ-001
**ファイル:** `src/hooks/useClaudeTerminal.ts`
**依存:** なし
**完了サマリー:** isFocused stateとonFocus/onBlurイベントリスナーを追加。jsdom環境でのtypeof安全ガード付き。

**受入基準:**
- [x] isFocused stateがフォーカス状態に連動する
- [x] クリーンアップでイベントリスナーが解除される

---

### T-002: フォーカスインジケーターUI

**状態:** DONE
**要件:** REQ-001
**ファイル:** `src/components/sessions/ClaudeTerminalPanel.tsx`
**依存:** T-001
**完了サマリー:** isFocused状態に基づくring-2 ring-green-500 ring-inset CSSクラスの動的適用を実装。

**受入基準:**
- [x] フォーカス時に緑色のring borderが表示される
- [x] 非フォーカス時にborderが消える
- [x] トランジションが適用される

---

### T-003: CTRL+Cコピー実装

**状態:** DONE
**要件:** REQ-002
**ファイル:** `src/hooks/useClaudeTerminal.ts`
**依存:** なし
**完了サマリー:** attachCustomKeyEventHandlerでCTRL+C処理を実装。選択テキストありでコピー+return false、なしでreturn true(SIGINT)。

**受入基準:**
- [x] 選択テキストがクリップボードにコピーされる
- [x] 未選択時はSIGINTが送信される
- [x] コピー後に選択が解除される

---

### T-004: CTRL+Vテキストペースト実装

**状態:** DONE
**要件:** REQ-003
**ファイル:** `src/hooks/useClaudeTerminal.ts`
**依存:** T-003 (attachCustomKeyEventHandlerの枠組み)
**完了サマリー:** handlePaste関数を実装。clipboard.read()で判別、テキストはWebSocket inputとして送信。read()失敗時のreadText()フォールバック付き。

**受入基準:**
- [x] テキストがPTYに送信される
- [x] クリップボードAPIエラー時にフォールバックが動作する

---

### T-005: SHIFT+ENTER改行実装

**状態:** DONE
**要件:** REQ-004
**ファイル:** `src/hooks/useClaudeTerminal.ts`
**依存:** T-003 (attachCustomKeyEventHandlerの枠組み)
**完了サマリー:** SHIFT+ENTER検出時にWebSocket経由で改行文字を送信、return falseで実装。

**受入基準:**
- [x] SHIFT+ENTERで改行文字がPTYに送信される
- [x] 通常ENTERの動作は変更されない

---

### T-006: 画像保存APIの実装

**状態:** DONE
**要件:** REQ-005
**ファイル:** `src/lib/websocket/claude-ws.ts`
**依存:** なし
**完了サマリー:** handlePasteImage関数を実装。MIME検証、10MBサイズ制限、パストラバーサル防止付き。.claude-images/ディレクトリへの自動保存とPTYパス入力を実装。

**受入基準:**
- [x] 画像がworktree配下に保存される
- [x] パストラバーサルが防止される
- [x] サイズ制限が適用される
- [x] 不正なMIMEタイプが拒否される
- [x] ファイルパスがPTY入力として送信される

---

### T-007: CTRL+V画像添付のフロントエンド実装

**状態:** DONE
**要件:** REQ-005
**ファイル:** `src/hooks/useClaudeTerminal.ts`
**依存:** T-004 (handlePaste関数), T-006 (サーバー側API)
**完了サマリー:** handlePaste内で画像判定(画像優先)、sendImageToServer関数でblob→base64→WebSocket送信、image-errorメッセージハンドラを実装。

**受入基準:**
- [x] 画像がbase64でサーバーに送信される
- [x] 画像がテキストより優先される
- [x] エラー時にターミナルにメッセージが表示される

---

### T-008: 統合テスト・動作確認

**状態:** pending
**要件:** 全体
**依存:** T-001〜T-007

**実施内容:**

1. 全ユニットテスト実行
2. lint / build確認
3. ブラウザでの手動動作確認:
   - フォーカスインジケーターの表示/非表示
   - CTRL+C: テキスト選択時コピー、未選択時SIGINT
   - CTRL+V: テキストペースト
   - CTRL+V: 画像添付
   - SHIFT+ENTER: 改行入力
4. 既存機能のリグレッション確認
