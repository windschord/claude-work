# タスク: ENCRYPTION_KEY自動生成

## 概要

| 項目 | 内容 |
|------|------|
| フィーチャー名 | ENCRYPTION_KEY自動生成・永続化 |
| 関連設計 | [design](../../design/encryption-key-auto-gen/design.md) |
| 関連要件 | [requirements](../../requirements/encryption-key-auto-gen/index.md) |
| 総推定工数 | 30分 |

## 実装計画

### フェーズ1: テストとコア実装

#### タスク1.1: ensureEncryptionKey テスト作成

**説明**: `src/lib/encryption-key-init.ts` のユニットテストを作成する

**技術的文脈**:
- `fs`, `crypto` をモックする
- `process.env.ENCRYPTION_KEY` の操作をテストごとにリセット
- `getDataDir()` をモックしてテスト用パスを使用

**実装手順（TDD）**:
1. `src/lib/__tests__/encryption-key-init.test.ts` を作成
2. テストケース:
   - 環境変数が設定済みの場合、ファイル読み書きせずにそのまま使用
   - キーファイルが存在する場合、読み込んで`process.env`に設定
   - どちらもない場合、キーを生成してファイルに書き込み、`process.env`に設定
   - 生成されたキーがBase64エンコードされた32バイトであること
   - ファイルのパーミッションが0o600であること
3. テスト実行して失敗を確認

**受入基準**:
- 5つのテストケースが定義されている
- すべてのテストが（実装前なので）失敗する

**依存関係**: なし
**推定工数**: 10分
**ステータス**: DONE
**完了サマリー**: 5つのテストケースを作成。fs/crypto/data-dirをモック。TDD red phase確認済み。
**要件対応**: FR-001, FR-002, FR-003, FR-004, NFR-001

#### タスク1.2: ensureEncryptionKey 実装

**説明**: `src/lib/encryption-key-init.ts` を実装する

**技術的文脈**:
- `getDataDir()` を使ってキーファイルパスを解決
- `crypto.randomBytes(32)` でAES-256-GCM用の鍵を生成
- `fs.writeFileSync` で `mode: 0o600` を指定して書き込み
- `process.env.ENCRYPTION_KEY` に設定

**実装手順**:
1. `src/lib/encryption-key-init.ts` を作成
2. `ensureEncryptionKey()` 関数を実装
3. テスト実行してすべてパスすることを確認

**受入基準**:
- タスク1.1のテストがすべてパスする
- 環境変数優先、ファイル読み込み、新規生成の3パスが正しく動作する

**依存関係**: タスク1.1
**推定工数**: 10分
**ステータス**: DONE
**完了サマリー**: ensureEncryptionKey()を実装。環境変数優先、ファイル読み込み、新規生成の3パスが正常動作。全5テストパス。
**要件対応**: FR-001, FR-002, FR-003, FR-004, NFR-001, NFR-002

### フェーズ2: サーバー統合

#### タスク2.1: server.ts への統合

**説明**: `server.ts` の起動シーケンスに `ensureEncryptionKey()` を追加する

**技術的文脈**:
- `ensureDataDirs()` の直後に配置（`data/`ディレクトリの存在が保証される）
- エラー時はサーバー起動を中止（暗号化キーがないとPAT機能が使えない）
- 成功時にログ出力（キーソースを記録: env/file/generated）

**実装手順**:
1. `server.ts` に `ensureEncryptionKey` をインポート
2. `ensureDataDirs()` の後に呼び出しを追加
3. エラーハンドリングを追加

**受入基準**:
- サーバー起動時に`ensureEncryptionKey()`が呼ばれる
- 起動ログにキーソースが記録される

**依存関係**: タスク1.2
**推定工数**: 5分
**ステータス**: DONE
**完了サマリー**: server.tsのensureDataDirs()直後にensureEncryptionKey()を追加。戻り値でキーソース(env/file/generated)をログ出力。
**要件対応**: FR-001, FR-002, FR-003, FR-004

#### タスク2.2: 動作確認

**説明**: Docker環境でPAT登録が正常に動作することを確認する

**実装手順**:
1. 既存テストの実行確認
2. ビルド確認

**受入基準**:
- 既存テストが全パスする
- ビルドが成功する

**依存関係**: タスク2.1
**推定工数**: 5分
**ステータス**: TODO
**要件対応**: AC-004

## タスクサマリー

| タスクID | タイトル | フェーズ | 推定工数 | 依存 | ステータス |
|---------|---------|---------|---------|------|----------|
| 1.1 | テスト作成 | 1 | 10分 | - | TODO |
| 1.2 | ensureEncryptionKey実装 | 1 | 10分 | 1.1 | TODO |
| 2.1 | server.ts統合 | 2 | 5分 | 1.2 | TODO |
| 2.2 | 動作確認 | 2 | 5分 | 2.1 | TODO |

## 逆順レビュー

### タスク -> 設計の整合性

| 設計コンポーネント | 対応タスク | 状況 |
|------------------|----------|------|
| `src/lib/encryption-key-init.ts` | 1.1, 1.2 | OK |
| `server.ts` 修正 | 2.1 | OK |
| テスト | 1.1 | OK |

### 設計 -> 要件の整合性

| 要件ID | 設計要素 | タスク | 状況 |
|--------|---------|-------|------|
| FR-001 | 自動生成 | 1.2 | OK |
| FR-002 | ファイル永続化 | 1.2 | OK |
| FR-003 | ファイル読み込み | 1.2 | OK |
| FR-004 | 環境変数優先 | 1.2 | OK |
| NFR-001 | パーミッション0600 | 1.1, 1.2 | OK |
| NFR-002 | data/配下に保存 | 1.2 | OK |
