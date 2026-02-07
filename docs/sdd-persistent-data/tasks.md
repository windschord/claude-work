# タスク管理書: データディレクトリ永続化

## タスク一覧

| ID | タスク | 状態 | 要件ID |
|----|--------|------|--------|
| T-001 | data-dir.tsユーティリティの実装 | DONE | REQ-001, REQ-002, REQ-003, REQ-004 |
| T-002 | remote-repo-service.tsのパス外部化 | DONE | REQ-001 |
| T-003 | clone/route.tsのパス外部化 | DONE | REQ-001 |
| T-004 | auth-directory-manager.tsのパス外部化 | DONE | REQ-002 |
| T-005 | server.tsの起動時初期化 | DONE | REQ-004 |
| T-006 | ドキュメント更新 | DONE | REQ-005, REQ-006 |

## タスク詳細

---

### T-001: data-dir.tsユーティリティの実装

**状態:** DONE
**完了サマリー:** getDataDir/getReposDir/getEnvironmentsDir/ensureDataDirsを実装。7テスト全てパス。
**要件:** REQ-001, REQ-002, REQ-003, REQ-004
**ファイル:** `src/lib/data-dir.ts`, `src/lib/__tests__/data-dir.test.ts`
**依存:** なし

**実装内容:**

1. `src/lib/data-dir.ts` を新規作成
   - `getDataDir()`: DATA_DIR環境変数またはprocess.cwd()/dataを返す
   - `getReposDir()`: getDataDir()/repos を返す
   - `getEnvironmentsDir()`: getDataDir()/environments を返す
   - `ensureDataDirs()`: 上記ディレクトリを作成する

2. `src/lib/__tests__/data-dir.test.ts` を新規作成
   - DATA_DIR設定時のパス解決テスト
   - DATA_DIR未設定時のデフォルト値テスト
   - ensureDataDirsのディレクトリ作成テスト
   - 相対パス・絶対パスの両方のテスト

**受入基準:**
- [ ] DATA_DIR設定時に指定パスが返される
- [ ] DATA_DIR未設定時にprocess.cwd()/dataが返される
- [ ] ensureDataDirsで3ディレクトリが作成される
- [ ] テストが全てパスする

---

### T-002: remote-repo-service.tsのパス外部化

**状態:** DONE
**完了サマリー:** getReposDir()をインポートし、join(process.cwd(), 'data', 'repos')を置換。既存29テスト全パス。
**要件:** REQ-001
**ファイル:** `src/services/remote-repo-service.ts`
**依存:** T-001

**実装内容:**

1. `getReposDir` をインポート
2. 行167の `join(process.cwd(), 'data', 'repos')` を `getReposDir()` に置換
3. ディレクトリ作成ロジック（行170-172）は `ensureDataDirs` で対応するため簡略化可能

**受入基準:**
- [ ] getReposDir()が使用されている
- [ ] process.cwd()/data/reposへの直接参照がない
- [ ] 既存テストがパスする

---

### T-003: clone/route.tsのパス外部化

**状態:** DONE
**完了サマリー:** getReposDir()をインポートし、join(process.cwd(), 'data', 'repos')を置換。tscチェック通過。
**要件:** REQ-001
**ファイル:** `src/app/api/projects/clone/route.ts`
**依存:** T-001

**実装内容:**

1. `getReposDir` をインポート
2. 行102の `join(process.cwd(), 'data', 'repos')` を `getReposDir()` に置換
3. ディレクトリ作成ロジック（行103-105）は `ensureDataDirs` で対応するため簡略化可能

**受入基準:**
- [ ] getReposDir()が使用されている
- [ ] process.cwd()/data/reposへの直接参照がない
- [ ] 既存テストがパスする

---

### T-004: auth-directory-manager.tsのパス外部化

**状態:** DONE
**完了サマリー:** getEnvironmentsDir()をインポートし、path.resolve(process.cwd(), 'data', 'environments')を置換。既存24テスト全パス。
**要件:** REQ-002
**ファイル:** `src/services/auth-directory-manager.ts`
**依存:** T-001

**実装内容:**

1. `getEnvironmentsDir` をインポート
2. コンストラクタ（行18-21）のデフォルト値を `getEnvironmentsDir()` に変更
3. シングルトン（行155）はそのまま維持

**受入基準:**
- [ ] getEnvironmentsDir()が使用されている
- [ ] process.cwd()/data/environmentsへの直接参照がない
- [ ] 既存テストがパスする

---

### T-005: server.tsの起動時初期化

**状態:** DONE
**完了サマリー:** ensureDataDirs/getDataDirをインポートし、起動時のDATA_DIRログ出力とディレクトリ初期化を追加。ビルド成功。
**要件:** REQ-004
**ファイル:** `server.ts`
**依存:** T-001

**実装内容:**

1. `ensureDataDirs`と`getDataDir`をインポート
2. 環境変数ログ出力にDATA_DIRを追加
3. 環境変数検証の直後に`ensureDataDirs()`を呼び出す

**受入基準:**
- [ ] DATA_DIR環境変数がログ出力される
- [ ] 起動時にensureDataDirsが呼ばれる
- [ ] ビルドが成功する

---

### T-006: ドキュメント更新

**状態:** DONE
**完了サマリー:** ENV_VARS.mdにDATA_DIRの説明を追加。SYSTEMD_SETUP.mdにDATA_DIR推奨設定と解説を追加。
**要件:** REQ-005, REQ-006
**ファイル:** `docs/ENV_VARS.md`, `docs/SYSTEMD_SETUP.md`
**依存:** T-001

**実装内容:**

1. `docs/ENV_VARS.md` に DATA_DIR 環境変数の説明を追加
2. `docs/SYSTEMD_SETUP.md` に DATA_DIR の推奨設定を追加
3. `src/components/projects/RemoteRepoForm.tsx` のプレースホルダーテキストを確認（変更不要の可能性）

**受入基準:**
- [ ] ENV_VARS.mdにDATA_DIRの説明がある
- [ ] SYSTEMD_SETUP.mdにDATA_DIR設定の説明がある
- [ ] textlintがパスする
