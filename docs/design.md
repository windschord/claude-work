# 設計書: Claudeターミナル操作性改善

## 1. アーキテクチャ概要

### 変更対象コンポーネント

```
┌─────────────────────────────────────────────────────────┐
│  フロントエンド                                         │
│                                                          │
│  ClaudeTerminalPanel.tsx                                 │
│  ├─ フォーカス状態CSS (REQ-001)                         │
│  └─ フォーカス状態管理 state                            │
│                                                          │
│  useClaudeTerminal.ts                                    │
│  ├─ attachCustomKeyEventHandler (REQ-002,003,004,005)   │
│  ├─ クリップボード読み取り (REQ-003,005)                │
│  ├─ 画像バイナリ送信 (REQ-005)                          │
│  └─ onFocus/onBlur コールバック公開                     │
│                                                          │
├──────────────── WebSocket ────────────────────────────────┤
│                                                          │
│  サーバーサイド                                          │
│                                                          │
│  claude-ws.ts                                            │
│  ├─ 'paste-image' メッセージハンドラ (REQ-005)          │
│  └─ 画像保存 → パス返却                                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### データフロー

#### コピー (CTRL+C + テキスト選択)
```
ユーザー CTRL+C → attachCustomKeyEventHandler
  → 選択テキストあり? → navigator.clipboard.writeText() → return false (イベント消費)
  → 選択テキストなし? → return true (XTerm.jsデフォルト=SIGINT送信)
```

#### テキストペースト (CTRL+V)
```
ユーザー CTRL+V → attachCustomKeyEventHandler → return false (イベント消費)
  → navigator.clipboard.read()
  → テキストのみ? → term.onData経由でWebSocket送信 (input メッセージ)
  → 画像あり? → WebSocket (paste-image メッセージ) → サーバーでファイル保存 → パスを返却 → term入力
```

#### 改行 (SHIFT+ENTER)
```
ユーザー SHIFT+ENTER → attachCustomKeyEventHandler → return false (イベント消費)
  → WebSocket送信 { type: 'input', data: '\n' }
```

## 2. コンポーネント詳細設計

### 2.1 useClaudeTerminal.ts の変更

#### 2.1.1 フォーカスコールバック

```typescript
// 追加するReturn型
export interface UseClaudeTerminalReturn {
  // ... 既存フィールド
  isFocused: boolean;  // 追加: フォーカス状態
}
```

ターミナル初期化時に `term.onFocus` / `term.onBlur` イベントをリスニングし、`isFocused` stateを更新する。

#### 2.1.2 カスタムキーイベントハンドラ

`attachCustomKeyEventHandler` をターミナル初期化後に設定する。

**ハンドラロジック:**

```typescript
term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
  // CTRL+C: コピー（選択テキストあり時）
  if (event.ctrlKey && event.key === 'c' && event.type === 'keydown') {
    const selection = term.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
      term.clearSelection();
      return false; // イベント消費（SIGINTを送らない）
    }
    return true; // 選択なし: XTerm.jsデフォルト（SIGINT）
  }

  // CTRL+V: ペースト/画像添付
  if (event.ctrlKey && event.key === 'v' && event.type === 'keydown') {
    handlePaste(); // 非同期処理を別関数で実行
    return false;  // イベント消費
  }

  // SHIFT+ENTER: 改行
  if (event.shiftKey && event.key === 'Enter' && event.type === 'keydown') {
    // WebSocket経由で改行文字を送信
    ws.send(JSON.stringify({ type: 'input', data: '\n' }));
    return false;
  }

  return true; // その他: XTerm.jsデフォルト
});
```

#### 2.1.3 ペースト処理関数

```typescript
async function handlePaste() {
  try {
    const clipboardItems = await navigator.clipboard.read();

    for (const item of clipboardItems) {
      // 画像チェック（画像を優先）
      const imageType = item.types.find(t => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        await sendImageToServer(blob, imageType);
        return;
      }
    }

    // テキストのみの場合
    const text = await navigator.clipboard.readText();
    if (text) {
      ws.send(JSON.stringify({ type: 'input', data: text }));
    }
  } catch (err) {
    console.error('Paste failed:', err);
    // フォールバック: テキストのみ試行
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        ws.send(JSON.stringify({ type: 'input', data: text }));
      }
    } catch {
      // クリップボードアクセス不可
    }
  }
}
```

#### 2.1.4 画像送信関数

```typescript
async function sendImageToServer(blob: Blob, mimeType: string) {
  // Blobをbase64に変換
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte), ''
    )
  );

  // WebSocket経由でJSON送信
  ws.send(JSON.stringify({
    type: 'paste-image',
    data: base64,
    mimeType,
  }));
}
```

### 2.2 ClaudeTerminalPanel.tsx の変更

#### 2.2.1 フォーカスインジケーター

```tsx
// useClaudeTerminalから isFocused を取得
const { terminal, isConnected, fit, restart, reconnect, error, isFocused } =
  useClaudeTerminal(sessionId);

// ターミナルコンテナにフォーカス状態のスタイルを適用
<div
  ref={containerRef}
  className={`flex-1 p-2 min-h-0 w-full h-full transition-all duration-200
    ${isFocused
      ? 'ring-2 ring-green-500 ring-inset rounded'
      : 'ring-0'
    }`}
  role="application"
  aria-label="Claude Code Terminal"
/>
```

**スタイル仕様:**
- フォーカス時: `ring-2 ring-green-500 ring-inset rounded` (Tailwind CSS ring utility)
- 非フォーカス時: `ring-0`
- トランジション: `transition-all duration-200` (200ms)

### 2.3 claude-ws.ts の変更

#### 2.3.1 新メッセージ型

```typescript
// クライアント → サーバー（画像ペースト）
interface ClaudePasteImageMessage {
  type: 'paste-image';
  data: string;      // base64エンコードされた画像データ
  mimeType: string;  // 'image/png', 'image/jpeg' 等
}

export type ClaudeClientMessage =
  | ClaudeInputMessage
  | ClaudeResizeMessage
  | ClaudeRestartMessage
  | ClaudePasteImageMessage;  // 追加

// サーバー → クライアント（画像保存結果）
interface ClaudeImageSavedMessage {
  type: 'image-saved';
  filePath: string;  // 保存された画像のファイルパス
}

interface ClaudeImageErrorMessage {
  type: 'image-error';
  message: string;
}

export type ClaudeServerMessage =
  | ClaudeDataMessage
  | ClaudeExitMessage
  | ClaudeErrorMessage
  | ClaudeImageSavedMessage   // 追加
  | ClaudeImageErrorMessage;  // 追加
```

#### 2.3.2 画像保存処理

メッセージハンドラに `paste-image` 型の処理を追加:

```typescript
if (data.type === 'paste-image') {
  await handlePasteImage(data, sessionId, session.worktree_path, ws, isLegacy, adapter);
}
```

**画像保存関数:**

```typescript
import path from 'path';
import fs from 'fs';

async function handlePasteImage(
  data: ClaudePasteImageMessage,
  sessionId: string,
  worktreePath: string,
  ws: WebSocket,
  isLegacy: boolean,
  adapter: EnvironmentAdapter | null,
) {
  try {
    // MIMEタイプから拡張子を決定
    const extMap: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    const ext = extMap[data.mimeType] || '.png';

    // 保存先ディレクトリ
    const imageDir = path.join(worktreePath, '.claude-images');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    // パストラバーサル防止: resolvedPathがimageDir配下であることを検証
    const resolvedDir = path.resolve(imageDir);
    const resolvedWorktree = path.resolve(worktreePath);
    if (!resolvedDir.startsWith(resolvedWorktree)) {
      throw new Error('Invalid image directory path');
    }

    // ファイル名生成（タイムスタンプ + ランダム文字列）
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `clipboard-${timestamp}-${random}${ext}`;
    const filePath = path.join(imageDir, filename);

    // Base64デコードして保存
    const buffer = Buffer.from(data.data, 'base64');
    fs.writeFileSync(filePath, buffer);

    // ファイルパスをターミナル入力として送信
    if (isLegacy) {
      claudePtyManager.write(sessionId, filePath);
    } else {
      adapter!.write(sessionId, filePath);
    }

    // 成功メッセージを送信
    const msg: ClaudeImageSavedMessage = {
      type: 'image-saved',
      filePath,
    };
    ws.send(JSON.stringify(msg));

    logger.info('Claude WebSocket: Image saved', {
      sessionId,
      filePath,
      mimeType: data.mimeType,
      size: buffer.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to save image';
    logger.error('Claude WebSocket: Failed to save image', {
      sessionId,
      error: errorMessage,
    });

    const msg: ClaudeImageErrorMessage = {
      type: 'image-error',
      message: errorMessage,
    };
    ws.send(JSON.stringify(msg));
  }
}
```

## 3. ファイル変更一覧

| ファイル | 変更内容 |
|----------|----------|
| `src/hooks/useClaudeTerminal.ts` | attachCustomKeyEventHandler追加、isFocused state追加、handlePaste関数追加、sendImageToServer関数追加 |
| `src/components/sessions/ClaudeTerminalPanel.tsx` | フォーカス状態によるring-green-500スタイル適用 |
| `src/lib/websocket/claude-ws.ts` | paste-imageメッセージ型追加、画像保存ハンドラ追加、image-saved/image-errorメッセージ型追加 |

## 4. 技術的決定事項

### TD-001: 画像送信方式 - WebSocket JSON (base64)
**選択:** WebSocket経由でbase64エンコードしたJSONを送信
**理由:** 既存のWebSocketプロトコルと一貫性がある。別途HTTP APIを用意する必要がない。性能面では5MB程度を推奨し、セキュリティ制限として10MB上限を設定。

### TD-002: 画像保存場所 - worktree内 `.claude-images/`
**選択:** 各セッションのworktreeパス配下に `.claude-images/` ディレクトリを作成
**理由:** Claude Codeが直接ファイルパスでアクセスできる。セッションごとに分離される。worktree削除時に自動でクリーンアップされる。

### TD-003: フォーカスインジケーター - Tailwind CSS ring utility
**選択:** `ring-2 ring-green-500 ring-inset` を使用
**理由:** borderと異なりレイアウトに影響しない。Tailwindの標準ユーティリティで一貫性がある。

### TD-004: キーイベントハンドリング - attachCustomKeyEventHandler
**選択:** XTerm.jsの `attachCustomKeyEventHandler` API
**理由:** XTerm.jsが推奨するカスタムキーイベント処理方法。`return false`でイベント消費、`return true`でデフォルト動作を使い分けられる。

### TD-005: CTRL+V処理 - Clipboard API (navigator.clipboard.read)
**選択:** `navigator.clipboard.read()` で画像とテキストを自動判別
**理由:** `readText()`ではテキストしか読めない。`read()`なら画像の有無を確認してから処理を分岐できる。画像優先で判別する。

## 5. セキュリティ考慮事項

### SEC-001: パストラバーサル防止
画像保存先パスを `path.resolve()` で正規化し、worktreeパス配下であることを検証する。

### SEC-002: ファイルサイズ制限
base64デコード後のバッファサイズを検証し、10MBを超える場合はエラーを返す。

### SEC-003: MIMEタイプ制限
許可するMIMEタイプを `image/png`, `image/jpeg`, `image/gif`, `image/webp` に限定する。

### SEC-004: ファイル名サニタイズ
ファイル名はサーバー側で生成し、クライアントからの入力は含めない。

## 6. テスト戦略

### ユニットテスト

| テスト対象 | テスト内容 |
|-----------|-----------|
| カスタムキーハンドラ | CTRL+C(選択あり/なし)、CTRL+V、SHIFT+ENTERの分岐 |
| 画像保存処理 | 正常保存、パストラバーサル防止、サイズ制限、不正MIMEタイプ |
| フォーカス状態管理 | onFocus/onBlurイベントでの状態変化 |

### E2Eテスト

| テスト対象 | テスト内容 |
|-----------|-----------|
| フォーカスインジケーター | クリック時のring表示/非表示 |
| コピペ | テキストのコピー&ペースト動作 |
