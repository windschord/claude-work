# TASK-005: DockerAdapter拡張 (createSession / destroySession)

## 説明

DockerAdapterの`createSession`と`destroySession`を拡張し、ChromeSidecarServiceとの統合を行う。サイドカー起動、.mcp.json注入、ネットワーク接続、サイドカー停止のフローを既存のセッションライフサイクルに組み込む。

**対象ファイル**:
- `src/services/adapters/docker-adapter.ts` - createSession / destroySession 拡張、injectBrowserUrl メソッド追加
- `src/services/pty-session-manager.ts` - chromeSidecar設定の読み取り・転送
- `src/services/adapters/__tests__/docker-adapter-chrome-sidecar.test.ts` - テスト

**設計書**: `docs/sdd/design/chrome-sidecar/components/docker-adapter.md`

## 技術的文脈

- createSession: サイドカー起動フェーズを既存処理の前段に追加
- サイドカー成功時: .mcp.json注入（Entrypointをshell経由に変更）、ネットワーク接続、DB更新
- サイドカー失敗時（CDPタイムアウト等）: サイドカーなしでClaude Code起動（graceful degradation）
- ネットワーク作成失敗時: セッション作成自体をエラーとして中止（NFR-SEC-002）
- destroySession: Claude Code停止後にChromeサイドカー停止（best-effort）
- .mcp.json注入は既存のregistry-firewallパターン（Entrypointをshell経由に変更）を踏襲
- PTYSessionManager: 環境configからchromeSidecar設定を読み取りCreateSessionOptionsに渡す

## TDD手順

### テストファイル

`src/services/adapters/__tests__/docker-adapter-chrome-sidecar.test.ts`

### テストケース

#### createSession 拡張

1. **サイドカー無効時: 既存動作と同一**
   - chromeSidecarオプションなしの場合、ChromeSidecarServiceが呼ばれないこと
   - 既存のコンテナ作成フローが変わらないこと

2. **サイドカー有効・起動成功: フルフロー**
   - startSidecar -> buildContainerOptions + injectBrowserUrl -> コンテナ作成 -> connectClaudeContainer -> DB更新の順で実行されること
   - DB に chrome_container_id, chrome_debug_port が設定されること

3. **サイドカー有効・CDPタイムアウト: graceful degradation**
   - startSidecar が success: false を返した場合、サイドカーなしでClaude Codeが起動すること
   - 警告ログが出力されること
   - DB の chrome_container_id は NULL のままであること

4. **ネットワーク作成失敗: セッション作成中止**
   - ChromeSidecarService.startSidecarがネットワーク作成失敗を返した場合
   - セッション作成がエラーとして中止されること（NFR-SEC-002）

5. **connectClaudeContainer失敗: Claude Code起動は続行**
   - ネットワーク接続失敗時、Claude Code自体は起動済みなので続行すること
   - 警告ログが出力されること

#### injectBrowserUrl

6. **新規Entrypoint設定（shell経由への変換）**
   - 元のEntrypoint/Cmdがshell経由でない場合、`/bin/sh -c` に変換されること
   - `__CHROME_BROWSER_URL` 環境変数が追加されること
   - .mcp.json更新スクリプトが Cmd に含まれること

7. **既存shell Entrypoint拡張（registry-firewall等で変換済み）**
   - 元のEntrypointが `/bin/sh -c` の場合、既存スクリプトの前段にmcp注入を追加すること

#### destroySession 拡張

8. **サイドカー付きセッション破棄: 正常系**
   - Claude Code停止後にstopSidecarが呼ばれること
   - DB の chrome_container_id, chrome_debug_port が NULL に更新されること

9. **サイドカーなしセッション破棄: 既存動作と同一**
   - chrome_container_id が NULL のセッションでは stopSidecar が呼ばれないこと

10. **Chrome停止失敗: セッション破棄は続行**
    - stopSidecar失敗時も例外がスローされないこと
    - 警告ログが出力されること
    - chrome_container_id は保持されること（次回クリーンアップで回収）

#### PTYSessionManager

11. **chromeSidecar設定の転送**
    - 環境configから `chromeSidecar.enabled: true` の場合、CreateSessionOptionsに設定が渡されること
    - `chromeSidecar.enabled: false` または未設定の場合、undefinedが渡されること

### 実装手順

1. テストファイル作成（ChromeSidecarService, DockerClient, db をモック）
2. テスト実行（RED確認）
3. `docker-adapter.ts` を拡張:
   - createSession にサイドカー起動フェーズ追加
   - injectBrowserUrl private メソッド追加
   - destroySession にサイドカー停止フェーズ追加
4. `pty-session-manager.ts` にchromeSidecar設定読み取りロジック追加
5. テスト実行（GREEN確認）

## 受入基準

- [ ] サイドカー無効時に既存動作が変わらないこと
- [ ] サイドカー有効時にChromeコンテナ起動 -> .mcp.json注入 -> ネットワーク接続の完全フローが動作すること
- [ ] CDPタイムアウト時にサイドカーなしでClaude Codeが起動すること
- [ ] ネットワーク作成失敗時にセッション作成が中止されること
- [ ] destroySessionでChromeサイドカーがbest-effortで停止されること
- [ ] 既存のDockerAdapter テストが壊れていないこと
- [ ] 全テストケースがパスすること

**依存関係**: TASK-001 (DBスキーマ), TASK-002 (型定義), TASK-003 (ChromeSidecarService)
**推定工数**: 50分
**ステータス**: `TODO`
