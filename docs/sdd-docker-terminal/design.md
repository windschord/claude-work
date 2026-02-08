# 設計書: Docker環境ターミナル描画不具合修正

## 問題分析

### 症状

- Docker環境でClaude Codeターミナルが起動時のASCIIアートのみ表示
- 入力プロンプトやその後のUIが描画されない
- WebSocketは"connected"状態
- HOST環境では正常に動作する

### 調査で判明した事実

ブラウザおよびコンテナ内での実地調査から以下が判明:

1. **WebSocket接続は正常**: 接続確立、scrollbackデータ送受信は正しく動作
2. **PTYリサイズは伝播する**: `stty -a < /dev/pts/0` で確認済み、node-ptyのresizeはコンテナ内に正しく伝播
3. **データはブラウザに届く**: WebSocketメッセージでdataが受信されている
4. **Claude Codeの初回セットアップが表示される**: 認証ディレクトリが空のため、テーマ選択ウィザードが起動

### 根本原因

**原因1: 初回リサイズのタイミング問題**

Docker環境ではPTY起動からClaude Code描画開始までのフローが以下の通り:

```
1. DockerAdapter: pty.spawn('docker', args, { cols: 80, rows: 24 })
2. docker run: コンテナ起動
3. Claude Code: 80x24で起動画面(ASCIIアート)を描画
4. Claude Code: 80x24で入力プロンプト/セットアップUIを描画
5. (ここまで高速に完了)
---
6. クライアント: XTerm.js open() → fit() → resize(139x40)送信
7. サーバー: adapter.resize() → node-pty resize → コンテナPTYリサイズ
8. Claude Code: SIGWINCHを受信し画面を再描画
```

HOST環境ではステップ1(pty.spawn)で直接claudeコマンドを起動するため、
`pty.spawn` → クライアントの `fit()` → `resize` が同一プロセスに対して
高速に実行され、Claude Codeが描画を始める前にリサイズが適用される。

Docker環境ではコンテナ起動のオーバーヘッド(数秒)があるため、
Claude Codeが描画を開始する前にクライアントのresize WSメッセージが
到着するが、**Docker PTYへのresize()はコンテナ起動完了前に実行される
ため効果がない**。コンテナ内のClaude Codeは初期値の80x24で描画開始し、
その後のfitによるリサイズで画面が一度再描画されるが、**描画タイミングと
リサイズのレースコンディション**により表示が崩れる。

具体的には、Claude Codeの対話UIフレームワーク(Ink/React)が
80x24のサイズで初回レンダリングを行い、入力プロンプトの位置計算が
80x24ベースで行われた後、リサイズイベントで139x40に拡大される。
このとき、UIフレームワークがカーソル位置を再計算するが、
既に描画済みのASCIIアート部分と入力プロンプト部分の位置関係がずれ、
入力プロンプトが画面外に押し出されるか、透明な状態になる。

実際に手動でresizeを送り直すとWelcome画面が再描画され、さらに
Enterキーを送るとセットアップウィザードが正しく表示されることを確認済み。

**原因2: Claude Codeの初回セットアップウィザード(補助的原因)**

Docker環境では`/home/node/.claude/`が空のため、Claude Codeが
初回起動時のセットアップフロー（テーマ選択等）に入る。
このセットアップUIは通常のプロンプトとは異なる描画ロジックを使用しており、
リサイズとの相性が悪い。

## 設計方針

### 修正方針

**修正A: DockerAdapter.createSession()での遅延リサイズ (主要修正)**

コンテナ内のClaude Codeが起動画面を描画した後に、クライアントから
受信した最新のターミナルサイズでリサイズを再送する仕組みを追加。

具体的には、`DockerAdapter`でセッション作成後に一定時間待機し、
保存済みのクライアントサイズで自動リサイズを実行する。

**修正B: Docker環境セットアップ改善の注意喚起 (ドキュメント)**

Docker環境では事前に認証設定(`claude setup-token`等)を
行うことを推奨するドキュメントを追加。

### 具体的な修正内容

#### 修正1: DockerAdapterにクライアントサイズ追跡を追加

```typescript
interface DockerSession {
  ptyProcess: pty.IPty;
  workingDir: string;
  containerId: string;
  claudeSessionId?: string;
  errorBuffer: string;
  hasReceivedOutput: boolean;
  shellMode: boolean;
  lastKnownCols?: number;  // 新規追加
  lastKnownRows?: number;  // 新規追加
}
```

#### 修正2: resize()でクライアントサイズを記憶

```typescript
resize(sessionId: string, cols: number, rows: number): void {
  const session = this.sessions.get(sessionId);
  if (!session) return;

  // クライアントサイズを記憶
  session.lastKnownCols = cols;
  session.lastKnownRows = rows;

  session.ptyProcess.resize(cols, rows);
}
```

#### 修正3: createSession()で初回出力受信後に遅延リサイズ

Claude Codeの起動画面描画完了を検知し、保存済みのクライアントサイズで
リサイズを再実行する。

```typescript
// PTY出力を受信したとき（onDataハンドラ内）
ptyProcess.onData((data: string) => {
  const session = this.sessions.get(sessionId);
  if (session) {
    if (!session.hasReceivedOutput && data.length > 0) {
      session.hasReceivedOutput = true;

      // 初回出力受信後、遅延リサイズを実行
      // Claude Codeの起動画面描画が完了するまで待機
      setTimeout(() => {
        const s = this.sessions.get(sessionId);
        if (s && s.lastKnownCols && s.lastKnownRows) {
          logger.info('DockerAdapter: Applying deferred resize after first output', {
            sessionId, cols: s.lastKnownCols, rows: s.lastKnownRows,
          });
          s.ptyProcess.resize(s.lastKnownCols, s.lastKnownRows);
        }
      }, 1000);
    }
    // ... 既存の処理
  }
});
```

**ポイント**:
- クライアントがWebSocket接続直後にresizeを送信(onopen)
- その値がsession.lastKnownCols/Rowsに保存される
- コンテナ内のClaude Codeが最初の出力を生成した後、1秒待ってリサイズを再適用
- これにより、Claude Codeの初期描画が80x24で完了した後、正しいサイズで再描画される

### タイミング図

```
時間 →

クライアント側:
  │ XTerm.js open()
  │ fit() → cols=139, rows=40
  │ WS: resize { cols: 139, rows: 40 }
  │
  ▼

サーバー側 (DockerAdapter):
  │ createSession() → pty.spawn('docker', ..., { cols: 80, rows: 24 })
  │
  │ WS: resize受信 → session.lastKnownCols=139, lastKnownRows=40
  │                   ptyProcess.resize(139, 40)  ← コンテナ未起動のため効果なし
  │
  │ ... (コンテナ起動中、1-3秒) ...
  │
  │ PTY onData: Claude Codeの起動画面データ受信
  │   hasReceivedOutput = true
  │   → 1秒後に遅延リサイズ実行
  │     ptyProcess.resize(139, 40)  ← コンテナ起動済みなので効果あり
  │
  │ PTY onData: Claude Codeが139x40で画面を再描画
  │   → WS経由でクライアントに送信
  │
  ▼

クライアント側:
  │ WS: data受信 → XTerm.jsに表示
  │ → 正しいサイズで描画された画面が表示される
```

## 影響範囲

### 変更ファイル

1. `src/services/adapters/docker-adapter.ts`
   - DockerSession interfaceにlastKnownCols/Rows追加
   - resize()でクライアントサイズを記憶
   - createSession()のonDataで遅延リサイズを実行
2. `src/services/adapters/__tests__/docker-adapter.test.ts` - テスト追加

### 変更なし

- `src/services/adapters/host-adapter.ts` - HOST環境は変更不要
- `src/hooks/useClaudeTerminal.ts` - フロントエンドは変更不要
- `src/lib/websocket/claude-ws.ts` - WebSocketハンドラは変更不要
- `docker/Dockerfile` - Dockerイメージは変更不要

## リスク

1. **遅延リサイズのタイミング**: 1秒が不十分な場合、Claude Codeの描画がまだ完了
   していない可能性。→ hasReceivedOutput後の1秒待機は保守的な値で通常は十分。
   必要に応じてタイミングを調整可能。

2. **画面のちらつき**: 80x24で描画 → 139x40で再描画するため一瞬ちらつく。
   → HOST環境でも同様のちらつきがあるため許容範囲。

3. **リサイズの重複**: クライアントからのresizeとサーバーの遅延リサイズが
   競合する可能性。→ 同じサイズでのリサイズは無害で、Claude Codeが再描画するだけ。
