# タスク

> このドキュメントはAIエージェント（Claude Code等）が実装を行うことを前提としています。
> タスクは具体的なファイルパス、技術仕様、検証可能な受入基準を含めて記載してください。

## 実装計画概要

### MVP範囲（フェーズ1〜4）

以下の機能をMVPとして実装:
- プロジェクト管理（CRUD）
- セッション作成と管理（単一セッション）
- Claude Codeとの対話（入出力、権限確認）
- 変更差分の確認（基本diff）
- Git操作（worktree作成/削除、rebase、squash merge）
- 認証（トークンベース）
- 基本的なレスポンシブ対応
- Docker Composeによるデプロイ

### 拡張機能（フェーズ5〜7）

MVP後に実装:
- セッションテンプレート（一括作成）
- プロンプト履歴
- ランスクリプト実行
- コミット履歴と復元
- リッチ出力（マークダウン/シンタックスハイライト）
- ターミナル統合（XTerm.js）
- サブエージェント出力の可視化
- モデル選択
- ライト/ダークモード

---

## フェーズ別タスク詳細

### [フェーズ1: 基盤構築](@docs/tasks/phase1.md)
*推定期間: 120分（AIエージェント作業時間）*
*MVP: Yes*

- タスク1.1: プロジェクト初期化
- タスク1.2: フロントエンド基本設定
- タスク1.3: API Routes基本設定
- タスク1.4: データベース設定

### [フェーズ2: バックエンドコア機能](@docs/tasks/phase2.md)
*推定期間: 240分（AIエージェント作業時間）*
*MVP: Yes*

- タスク2.1: 認証API実装
- タスク2.2: プロジェクトAPI実装
- タスク2.3: Git操作サービス実装
- タスク2.4: プロセスマネージャー実装
- タスク2.5: セッションAPI実装
- タスク2.6: Git操作API実装

### [フェーズ3: フロントエンドコア機能](@docs/tasks/phase3.md)
*推定期間: 210分（AIエージェント作業時間）*
*MVP: Yes*

- タスク3.1: 認証画面実装
- タスク3.2: レイアウトとナビゲーション実装
- タスク3.3: プロジェクト管理画面実装
- タスク3.4: セッション管理画面実装
- タスク3.5: セッション詳細画面実装
- タスク3.6: Diff表示画面実装
- タスク3.7: Git操作UI実装

### [フェーズ4: リアルタイム通信とMVP統合](@docs/tasks/phase4.md)
*推定期間: 185分（AIエージェント作業時間）*
*MVP: Yes*

- タスク4.1: WebSocketサーバー実装
- タスク4.2: WebSocketクライアント実装
- タスク4.3: リアルタイム更新統合
- タスク4.4: npxパッケージ設定
- タスク4.5: MVP E2Eテスト

### [フェーズ5: 拡張機能（セッション管理強化）](@docs/tasks/phase5.md)
*推定期間: 180分（AIエージェント作業時間）*
*MVP: No*

- タスク5.1: セッションテンプレート（一括作成）実装
- タスク5.2: プロンプト履歴実装
- タスク5.3: モデル選択実装
- タスク5.4: コミット履歴と復元実装
- タスク5.5: Git状態インジケーター実装
- タスク5.6: 詳細ステータスインジケーター実装

### [フェーズ6: 拡張機能（高度な機能）](@docs/tasks/phase6.md)
*推定期間: 240分（AIエージェント作業時間）*
*MVP: No*

- タスク6.1: ランスクリプト設定実装
- タスク6.2: ランスクリプト実行実装
- タスク6.3: ログフィルタリング/検索実装
- タスク6.4: リッチ出力実装
- タスク6.5: サブエージェント出力表示実装
- タスク6.6: ターミナル統合（バックエンド）実装
- タスク6.7: ターミナル統合（フロントエンド）実装

### [フェーズ7: UI/UX改善とドキュメント](@docs/tasks/phase7.md)
*推定期間: 85分（AIエージェント作業時間）*
*MVP: No*

- タスク7.1: ライト/ダークモード実装
- タスク7.2: モバイルUI最適化
- タスク7.3: ドキュメント作成

### [フェーズ8: バグ修正（PR#2レビュー結果対応）](@docs/tasks/phase8.md)
*推定期間: 120分（AIエージェント作業時間）*
*MVP: Yes*

- タスク8.1: プロジェクト一覧APIレスポンス形式の修正
- タスク8.2: ALLOWED_PROJECT_DIRS空文字列処理の修正
- タスク8.3: プロジェクト追加エラー時のクライアント側エラーハンドリング強化
- タスク8.4: 重複プロジェクト追加時のエラーハンドリング改善

### [フェーズ9: マージ後バグ修正](@docs/tasks/phase9.md)
*推定期間: 95分（AIエージェント作業時間）*
*MVP: Yes*

- タスク9.1: トースト通知の表示修正
- タスク9.2: プロジェクト「開く」ボタンの修正
- タスク9.3: Claude Codeパス設定機能の追加

### [フェーズ10: 動作確認で発見されたバグ修正](@docs/tasks/phase10.md)
*推定期間: 120分（AIエージェント作業時間）*
*MVP: Yes*

- タスク10.1: セッション作成500エラーの原因調査
- タスク10.2: セッション作成機能の修正
- タスク10.3: /projectsから/へのリダイレクト実装
- タスク10.4: 設定ページのレイアウト修正

### [フェーズ19: Critical Issue修正](@docs/tasks/phase19.md)
*推定期間: 190分（AIエージェント作業時間）*
*MVP: Yes*

- タスク19.1.1: Process Manager修正のテスト作成
- タスク19.1.2: Process Managerの実装修正
- タスク19.1.3: Process Manager修正の動作確認
- タスク19.2.1: WebSocket認証修正のテスト作成
- タスク19.2.2: WebSocket認証ミドルウェアの実装修正
- タスク19.2.3: WebSocket認証修正の動作確認
- タスク19.3.1: 全機能の統合動作確認
- タスク19.3.2: 受入基準の達成状況レポート作成

---

## タスクステータスの凡例

- `TODO` - 未着手
- `IN_PROGRESS` - 作業中
- `BLOCKED` - 依存関係や問題によりブロック中
- `REVIEW` - レビュー待ち
- `DONE` - 完了

## リスクと軽減策

### リスク1: Claude Code CLIの仕様変更

**影響度**: 高
**発生確率**: 中
**軽減策**:
- Claude Code出力パーサーを抽象化し、仕様変更に対応しやすくする
- バージョン固定と定期的な互換性確認

### リスク2: WebSocket接続の不安定性

**影響度**: 中
**発生確率**: 中
**軽減策**:
- 自動再接続機能の実装
- REST APIへのフォールバック機能

### リスク3: 並列セッションによるリソース枯渇

**影響度**: 高
**発生確率**: 低
**軽減策**:
- 最大セッション数の制限（10セッション）
- リソース監視とアラート

### リスク4: Gitコンフリクトの複雑化

**影響度**: 中
**発生確率**: 中
**軽減策**:
- コンフリクト発生時の明確な通知
- 手動解決を促すUI（ターミナル統合で対応可能）

## 備考

### 技術スタック

**フロントエンド**:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Zustand
- react-diff-viewer-continued
- XTerm.js（フェーズ6）
- Playwright（E2E）

**バックエンド（Next.js統合）**:
- Next.js 15.1 API Routes
- Next.jsカスタムサーバー（WebSocket統合）
- TypeScript
- Prisma 7.x
- better-sqlite3
- ws / socket.io（WebSocket）
- winston（ロギング）
- Vitest（テスト）

**インフラ**:
- Node.js 20+
- SQLite
- npxで実行可能（グローバルインストール不要）
- リバースプロキシ（Caddy/nginx推奨、本番環境のみ）

### コーディング規約

- TypeScript: strict mode有効
- ESLint + Prettier for linting/formatting
- コミットメッセージ: Conventional Commits
- ブランチ戦略: GitHub Flow

---

## セキュリティ・品質改善タスク

以下はCodeRabbitレビュー（#3574391877）で指摘された技術的負債・改善項目です。
優先度に応じて別PRで対応してください。

### タスク: パストラバーサル対策の強化
**優先度**: 高
**ファイル**: `src/app/api/projects/route.ts` (124-145行)

**問題**:
現在は`resolve()`で絶対パス化しているが、許可ベースディレクトリの検証がない。
任意のディレクトリをプロジェクトとして登録できる状態。

**実装内容**:
1. 環境変数`ALLOWED_PROJECT_BASE_DIRS`を追加（カンマ区切り）
2. リクエストされたパスが許可ディレクトリ配下にあることを検証
3. 許可外のパスの場合は403エラーを返す

**受入基準**:
- 許可ディレクトリ外のパスでプロジェクト作成を試みると403エラー
- 許可ディレクトリ内のパスでは正常に作成できる
- テストケースを追加

### タスク: Git操作の非同期化とタイムアウト設定
**優先度**: 中
**ファイル**: `src/app/api/projects/route.ts` (127-136行), `src/services/git-service.ts`

**問題**:
`spawnSync`はイベントループをブロックし、大規模リポジトリで応答が遅延する。

**実装内容**:
1. GitServiceの全メソッドを非同期化（`spawn` + Promise化）
2. タイムアウト設定を追加（デフォルト30秒、環境変数で調整可能）
3. API Routeを`async/await`に対応

**受入基準**:
- 全てのGit操作がノンブロッキングで実行される
- タイムアウト時にエラーが返される
- 既存テストが全て通る

### タスク: プロジェクトpath重複登録の防止
**優先度**: 中
**ファイル**: `prisma/schema.prisma`, `src/app/api/projects/route.ts` (138-145行)

**問題**:
同一pathで複数のプロジェクトを登録できる。

**実装内容**:
1. Prismaスキーマで`path`フィールドに`@unique`制約を追加
2. マイグレーション実行
3. POST /api/projectsでUniqueConstraintErrorをハンドリング（409 Conflict）

**受入基準**:
- 同一pathで2回目の登録を試みると409エラー
- エラーメッセージが明確（"Project already exists at this path"）
- テストケースを追加

### タスク: プロジェクト所有権チェックの実装
**優先度**: 高
**ファイル**: `src/app/api/projects/[project_id]/route.ts` (53-60, 132-138行)

**問題**:
認証済みユーザーなら誰でも全てのプロジェクトを更新・削除できる。
マルチユーザー環境でセキュリティリスク。

**実装内容**:
1. Prismaスキーマで`Project`モデルに`owner_id`フィールドを追加
2. `AuthSession`と`Project`の関連を定義
3. PUT/DELETEハンドラーで所有権チェックを実装（所有者のみ許可）
4. プロジェクト作成時に`owner_id`を自動設定

**受入基準**:
- 他人のプロジェクトを更新/削除しようとすると403エラー
- 自分のプロジェクトは正常に更新/削除できる
- GET /api/projectsは自分のプロジェクトのみ返す
- テストケースを追加

### タスク: ログ出力の機密情報対策
**優先度**: 低
**ファイル**: `src/app/api/sessions/[id]/merge/route.ts` (103-109行)

**問題**:
`commitMessage`全体をログ出力しており、意図せず機密情報が含まれる可能性。

**実装内容**:
1. ログ出力時にcommitMessageを先頭80文字に制限
2. 全体の文字数も記録（デバッグ用）

**実装例**:
```typescript
logger.info('Merged session successfully', {
  id,
  commitMessagePreview: sanitizedMessage.slice(0, 80),
  commitMessageLength: sanitizedMessage.length,
});
```

**受入基準**:
- ログに出力されるcommitMessageが80文字以内
- 文字数情報が記録される

---

## Phase 20: セッション詳細ページSSRエラー修正

**検証レポート**: docs/verification-report-nodejs-architecture-phase20.md
**実施期間**: 2025-12-20
**優先度**: Critical
**推定期間**: 150分（AIエージェント作業時間）
**MVP**: Yes

### 背景

Phase 19のCritical Issue修正後、nodejs-architectureブランチの動作検証を実施したところ、セッション詳細ページで新たなCritical Issueを発見しました。

**Critical Issue #1: セッション詳細ページでSSRエラー**
- `@xterm/addon-fit`パッケージがSSR時に`self`オブジェクトを参照してエラー
- セッション詳細ページが「読み込み中...」のまま表示されない
- Claude Codeとの対話、ターミナル統合など全ての機能が使用不可

**影響範囲**:
- REQ-014, REQ-021~REQ-028 (Claude Codeとの対話)
- REQ-033~REQ-038 (ランスクリプト実行)
- REQ-039~REQ-047 (コミット履歴、diff確認)
- REQ-048~REQ-053 (Git操作)
- REQ-058~REQ-062 (ターミナル統合)

### タスク一覧

#### タスク20.1: SSRエラー修正のE2Eテスト作成

**説明**:
セッション詳細ページが正常にレンダリングされ、XTermコンポーネントがクライアントサイドでのみ読み込まれることを検証するE2Eテストを作成する。

**実装手順（TDD）**:
1. テスト作成: `tests/e2e/session-detail-ssr.spec.ts`に以下のテストケースを作成
   - セッション詳細ページが正常にレンダリングされる
   - ページに「読み込み中...」が表示されない
   - セッション名が表示される
   - タブ（対話、ターミナル、Diff、Git）が表示される
   - SSRエラーがコンソールに出力されない
2. テスト実行: すべてのテストが失敗することを確認（現在SSRエラーで失敗する）
3. テストコミット: テストのみをコミット

**受入基準**:
- [ ] `tests/e2e/session-detail-ssr.spec.ts`が作成されている
- [ ] 5つ以上のテストケースが含まれている
- [ ] テスト実行で期待通りに失敗する（SSRエラー検出）
- [ ] コミットメッセージが適切（例: "test: セッション詳細ページSSRエラー修正のE2Eテスト追加"）

**依存関係**:
- Phase 19の完了（WebSocket認証修正済み）
- Playwrightのセットアップ完了

**推定工数**: 30分（AIエージェント作業時間）

**ステータス**: `TODO`

#### タスク20.2: useTerminal.tsの動的インポート化

**説明**:
`src/hooks/useTerminal.ts`フック内のXTermライブラリインポートを、クライアントサイドでのみ実行されるように動的インポート化する。

**実装手順**:
1. `@xterm/xterm`と`@xterm/addon-fit`のインポートを削除
2. フック内で`useEffect`を使用し、クライアントサイドで動的インポート
3. ローディング状態とエラー状態を管理
4. TypeScript型定義を適切に設定

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- XTermライブラリ: @xterm/xterm@5.5.0, @xterm/addon-fit@0.10.0
- 既存のパターン: `'use client'`ディレクティブ使用済み

**実装例**:
```typescript
'use client';

import { useEffect, useRef, useState } from 'react';

export function useTerminal(sessionId: string) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // クライアントサイドでのみ実行
    if (typeof window === 'undefined') return;

    let mounted = true;

    const loadTerminal = async () => {
      try {
        const { Terminal } = await import('@xterm/xterm');
        const { FitAddon } = await import('@xterm/addon-fit');

        if (!mounted || !terminalRef.current) return;

        const term = new Terminal({
          // 設定...
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        setTerminal(term);
        setIsLoading(false);
      } catch (err) {
        setError(err as Error);
        setIsLoading(false);
      }
    };

    loadTerminal();

    return () => {
      mounted = false;
      terminal?.dispose();
    };
  }, [sessionId]);

  return { terminal, terminalRef, isLoading, error };
}
```

**受入基準**:
- [ ] `src/hooks/useTerminal.ts`でXTermライブラリが動的インポートされている
- [ ] `typeof window !== 'undefined'`チェックが含まれている
- [ ] ローディング状態とエラー状態が管理されている
- [ ] TypeScript型エラーがない
- [ ] 既存のテストが通過する
- [ ] コミットメッセージが適切（例: "fix: useTerminal.tsをSSR対応に修正（動的インポート化）"）

**依存関係**:
- タスク20.1の完了（テスト作成済み）

**推定工数**: 40分（AIエージェント作業時間）

**ステータス**: `TODO`

#### タスク20.3: TerminalPanelコンポーネントの動的インポート化

**説明**:
`src/components/sessions/TerminalPanel.tsx`コンポーネントを、`next/dynamic`を使用してクライアントサイドでのみ読み込まれるように修正する。

**実装手順**:
1. TerminalPanelの実装ロジックを維持
2. SSR時のフォールバックUIを追加（ローディングスピナー）
3. エラーハンドリングを追加

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- 既存のパターン: 他のコンポーネントは通常のインポート

**実装方針**:
TerminalPanel自体は通常のコンポーネントとして維持し、useTerminalフックが動的インポートを処理するため、このコンポーネントでは追加の動的インポート処理は不要。ただし、ローディングとエラー状態の表示を追加する。

**受入基準**:
- [ ] `src/components/sessions/TerminalPanel.tsx`がuseTerminalフックのローディング状態を表示する
- [ ] エラー状態が適切に表示される
- [ ] TypeScript型エラーがない
- [ ] 既存のテストが通過する
- [ ] コミットメッセージが適切（例: "fix: TerminalPanelにローディング・エラー表示を追加"）

**依存関係**:
- タスク20.2の完了（useTerminal修正済み）

**推定工数**: 30分（AIエージェント作業時間）

**ステータス**: `TODO`

#### タスク20.4: SessionDetailページでのTerminalPanel動的インポート

**説明**:
`src/app/sessions/[id]/page.tsx`でTerminalPanelを動的インポートし、SSR時にはレンダリングしないように修正する。

**実装手順**:
1. `next/dynamic`をインポート
2. TerminalPanelを動的インポート化（`ssr: false`オプション使用）
3. ローディングフォールバックを設定
4. 他のコンポーネントは通常通りインポート

**技術的文脈**:
- フレームワーク: Next.js 15 (App Router)
- 既存のパターン: `'use client'`ディレクティブ使用済み

**実装例**:
```typescript
'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
// 他の通常のインポート...

// TerminalPanelを動的インポート（SSR無効化）
const TerminalPanel = dynamic(
  () => import('@/components/sessions/TerminalPanel').then(mod => ({ default: mod.TerminalPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">ターミナルを読み込み中...</div>
      </div>
    ),
  }
);

export default function SessionDetailPage() {
  // 既存のロジック...

  return (
    <div>
      {/* 既存のUI */}
      <TerminalPanel sessionId={sessionId} />
    </div>
  );
}
```

**受入基準**:
- [ ] `src/app/sessions/[id]/page.tsx`でTerminalPanelが動的インポートされている
- [ ] `ssr: false`オプションが設定されている
- [ ] ローディングフォールバックが実装されている
- [ ] TypeScript型エラーがない
- [ ] タスク20.1のE2Eテストが通過する
- [ ] コミットメッセージが適切（例: "fix: SessionDetailページのTerminalPanelを動的インポート化"）

**依存関係**:
- タスク20.3の完了（TerminalPanel修正済み）

**推定工数**: 25分（AIエージェント作業時間）

**ステータス**: `TODO`

#### タスク20.5: 動作確認とレポート更新

**説明**:
修正後のセッション詳細ページが正常に動作することを確認し、検証レポートを更新する。

**検証項目**:
1. セッション詳細ページのレンダリング
   - ページが「読み込み中...」から正常に遷移する
   - セッション名、ステータス、Git情報が表示される
   - タブ（対話、ターミナル、Diff、Git）が表示される
2. Claude Codeとの対話
   - WebSocket接続が「connected」状態になる
   - メッセージ入力フィールドが表示される
   - メッセージ送信が可能
3. ターミナル統合
   - ターミナルタブが表示される
   - XTermコンポーネントがロードされる
   - ターミナル入力が可能
4. Diff表示
   - Diffタブが表示される
   - 変更内容が表示される
5. エラーがないこと
   - ブラウザコンソールにSSRエラーが出力されない
   - サーバーログにSSRエラーが記録されない

**実装手順**:
1. Chrome DevTools MCPを使用してブラウザ動作確認
2. サーバーログを確認
3. E2Eテストを実行
4. `docs/verification-report-nodejs-architecture-phase20.md`を更新
   - Critical Issue #1のステータスを「解決済み」に更新
   - 検証結果を追記
   - 達成された要件を更新

**受入基準**:
- [ ] セッション詳細ページが正常にレンダリングされる
- [ ] WebSocket接続が成功する
- [ ] ターミナルが表示される
- [ ] Diffが表示される
- [ ] SSRエラーがコンソール・ログに出力されない
- [ ] タスク20.1のE2Eテストがすべて通過する
- [ ] `docs/verification-report-nodejs-architecture-phase20.md`が更新されている
- [ ] コミットメッセージが適切（例: "docs: Phase 20検証完了、SSRエラー解決を報告"）

**依存関係**:
- タスク20.4の完了（すべての実装完了）

**推定工数**: 25分（AIエージェント作業時間）

**ステータス**: `TODO`

### Phase 20 完了後の状態

**解決されるIssue**:
- Critical Issue #1: セッション詳細ページのSSRエラー

**達成される要件**:
- REQ-014: セッション選択時の出力表示
- REQ-021~REQ-028: Claude Codeとの対話
- REQ-058~REQ-062: ターミナル統合
- その他、セッション詳細ページに依存する全要件

**残課題**:
- REQ-033~REQ-038: ランスクリプト実行（未検証、Phase 20で検証可能になる）
- REQ-039~REQ-043: コミット履歴と復元（未検証、Phase 20で検証可能になる）
- REQ-044~REQ-047: 変更差分の確認（未検証、Phase 20で検証可能になる）
- REQ-048~REQ-053: Git操作（未検証、Phase 20で検証可能になる）

**技術的な学び**:
- Next.js App RouterでのSSR対策
- ブラウザ専用ライブラリの動的インポート
- `next/dynamic`の使用方法
- XTermライブラリのクライアントサイド限定読み込み
