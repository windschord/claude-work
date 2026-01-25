# 要件定義: JSON表示問題の修正

## 概要

セッション画面のチャットでClaude Codeからの応答がJSONの生データとして表示される問題を修正する。

## 背景

### 現在の問題

1. セッション画面でユーザーメッセージやアシスタントメッセージがJSON文字列として表示される
2. 例: `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"...`
3. 本来はテキストのみが整形されて表示されるべき

### 根本原因

`process-manager.ts`の`handleStreamJsonMessage`メソッドで：
- 認識されないメッセージタイプ（`'user'`など）が`default`ケースで処理される
- `JSON.stringify(json)`で丸ごと文字列化されて`'output'`イベントで発火される
- クライアントにJSON文字列がそのまま送信され、画面に表示される

## ユーザーストーリー

### ストーリー1: チャット画面でのメッセージ表示

**私は** ClaudeWorkのユーザーとして
**〜したい** Claude Codeとのチャットを読みやすい形式で閲覧したい
**なぜなら** JSON形式の生データは理解しにくく、作業効率が下がるから

#### 受入基準（EARS記法）

- REQ-001: Claude Codeから`'user'`タイプのstream-jsonメッセージを受信した時、システムはそれを画面に表示してはならない
- REQ-002: Claude Codeから認識されないタイプのstream-jsonメッセージを受信した時、システムはJSON文字列をチャット画面に表示してはならない
- REQ-003: Claude Codeから`'assistant'`タイプのメッセージを受信した時、システムはテキストコンテンツのみを抽出して表示しなければならない

## 非機能要件

- NFR-001: 認識されないメッセージタイプはデバッグログに記録しなければならない（トラブルシューティングのため）
- NFR-002: 既存のメッセージ処理（`'assistant'`、`'content_block_delta'`、`'system'`、`'error'`）の動作を変更してはならない

## スコープ外

- WebSocketの通信プロトコル変更
- フロントエンドのメッセージ表示コンポーネント変更
- データベースのメッセージ保存形式変更

## 影響範囲

- `src/services/process-manager.ts`: `handleStreamJsonMessage`メソッドの修正
