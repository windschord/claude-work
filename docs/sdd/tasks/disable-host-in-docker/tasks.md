# タスク: Docker環境でのHOST機能無効化

## 概要

| 項目 | 内容 |
|------|------|
| フィーチャー名 | disable-host-in-docker |
| 関連設計 | [design](../../design/disable-host-in-docker/design.md) |
| 関連要件 | [requirements](../../requirements/disable-host-in-docker/index.md) |
| 作成日 | 2026-02-26 |

## 実装計画

### フェーズ1: 基盤 - 環境検出ユーティリティ

*推定期間: 30分*

#### タスク1.1: 環境検出ユーティリティのテスト作成

**説明**:
- 対象ファイルパス: `src/lib/__tests__/environment-detect.test.ts`（新規）
- Docker内動作検出とHOST環境許可判定のテストを作成

**技術的文脈**:
- テストフレームワーク: vitest
- `fs.existsSync` のモック
- `process.env` のモック
- テスト間でモジュールキャッシュをリセットする必要がある

**実装手順（TDD）**:
1. テスト作成: `src/lib/__tests__/environment-detect.test.ts`
   - `/.dockerenv` 存在時にDocker内と判定
   - `RUNNING_IN_DOCKER=true` でDocker内と判定
   - 両方ない場合はDocker外と判定
   - Docker内でHOST環境がデフォルト不許可
   - `ALLOW_HOST_ENVIRONMENT=true` でHOST許可
   - 非Docker環境ではHOST常に許可
   - `initializeEnvironmentDetection()` でキャッシュされること
2. テスト実行: 失敗を確認
3. テストコミット

**受入基準**:
- [ ] 7つ以上のテストケースが作成されている
- [ ] `npx vitest run src/lib/__tests__/environment-detect.test.ts` でテストが失敗する（実装なし）
- [ ] テストがコミットされている

**依存関係**: なし
**推定工数**: 15分
**ステータス**: `DONE`
**完了サマリー**: 8つのテストケースを作成。全て通過確認済み。

---

#### タスク1.2: 環境検出ユーティリティの実装

**説明**:
- 対象ファイルパス: `src/lib/environment-detect.ts`（新規）
- 設計書のコンポーネント1に基づく実装
- `isRunningInDocker()`, `isHostEnvironmentAllowed()`, `initializeEnvironmentDetection()` を実装

**技術的文脈**:
- `fs.existsSync('/.dockerenv')` で存在チェック
- `process.env.RUNNING_IN_DOCKER` と `process.env.ALLOW_HOST_ENVIRONMENT` を参照
- モジュールレベル変数でキャッシュ
- テスト用の `_resetForTesting()` 関数も追加（キャッシュクリア）

**実装手順（TDD）**:
1. 実装: `src/lib/environment-detect.ts` を作成
2. テスト実行: タスク1.1のテストが全て通過することを確認
3. 実装コミット

**受入基準**:
- [ ] `src/lib/environment-detect.ts` が存在する
- [ ] `isRunningInDocker()` が正しく動作する
- [ ] `isHostEnvironmentAllowed()` が正しく動作する
- [ ] `initializeEnvironmentDetection()` が結果をキャッシュする
- [ ] タスク1.1のテストが全て通過する
- [ ] `npm run lint` でエラーなし

**依存関係**: タスク1.1
**推定工数**: 15分
**ステータス**: `DONE`
**完了サマリー**: environment-detect.ts実装。initializeEnvironmentDetection, isRunningInDocker, isHostEnvironmentAllowed, _resetForTesting を実装。全テスト通過。
**要件対応**: FR-004, FR-005, FR-006, FR-007, NFR-001

---

### フェーズ2: バックエンド - サービス・API制限

*推定期間: 40分*

#### タスク2.1: EnvironmentServiceの制限テスト作成

**説明**:
- 対象ファイルパス: `src/services/__tests__/environment-service.test.ts`（既存に追加）
- HOST制限ガードのテストを追加

**技術的文脈**:
- 既存テストファイルに追加
- `environment-detect` モジュールをモック
- `create()`, `checkStatus()`, `ensureDefaultExists()` のテストケース

**実装手順（TDD）**:
1. テスト追加:
   - `create()`: HOST環境が不許可の時にエラーをスロー
   - `create()`: HOST環境が許可の時は正常作成
   - `create()`: DOCKER環境は制限なし
   - `checkStatus()`: HOST不許可時にavailable=false
   - `ensureDefaultExists()`: HOST不許可時にDOCKERデフォルト作成
2. テスト実行: 新規テストが失敗を確認
3. テストコミット

**受入基準**:
- [ ] HOST制限関連のテストケースが5つ以上追加されている
- [ ] 新規テストが失敗する（実装前）
- [ ] テストがコミットされている

**依存関係**: タスク1.2
**推定工数**: 15分
**ステータス**: `DONE`
**完了サマリー**: 5つのテストケース追加。全39テスト通過。

---

#### タスク2.2: EnvironmentServiceへのHOST制限実装

**説明**:
- 対象ファイルパス: `src/services/environment-service.ts`（既存変更）
- `create()`, `checkStatus()`, `ensureDefaultExists()` にHOST制限ロジック追加

**技術的文脈**:
- `isHostEnvironmentAllowed()` を import して使用
- `create()` にガード追加
- `checkStatus()` の HOST ケースに条件追加
- `ensureDefaultExists()` の分岐変更

**実装手順（TDD）**:
1. 実装: `environment-service.ts` を変更
2. テスト実行: タスク2.1のテストが全て通過することを確認
3. 既存テストも全て通過することを確認
4. 実装コミット

**受入基準**:
- [ ] `create()` がHOST不許可時にエラーをスロー
- [ ] `checkStatus()` がHOST不許可時にavailable=falseを返す
- [ ] `ensureDefaultExists()` がHOST不許可時にDocker環境をデフォルトに設定
- [ ] 既存テストが全て通過する
- [ ] `npm run lint` でエラーなし

**依存関係**: タスク2.1
**推定工数**: 15分
**ステータス**: `DONE`
**完了サマリー**: create()にガード追加、checkStatus()にHOST不許可判定追加、ensureDefaultExists()にDocker内分岐追加。全テスト通過。
**要件対応**: FR-001, FR-002, FR-003, NFR-002

---

#### タスク2.3: 環境APIの制限テスト作成と実装

**説明**:
- 対象ファイルパス:
  - `src/app/api/environments/__tests__/route.test.ts`（既存に追加）
  - `src/app/api/environments/route.ts`（既存変更）
- GET: HOST環境に `disabled` フラグ、`meta.hostEnvironmentDisabled` 追加
- POST: HOST作成時に403返却

**技術的文脈**:
- `environment-detect` モジュールをモック
- 既存テストパターンに合わせる

**実装手順（TDD）**:
1. テスト追加:
   - GET: HOST不許可時にdisabled=trueとmeta.hostEnvironmentDisabled=true
   - GET: HOST許可時にdisabledなし
   - POST: HOST不許可時にHOST作成で403
   - POST: HOST許可時にHOST作成で201
2. テスト実行: 新規テストが失敗を確認
3. テストコミット
4. 実装: `route.ts` のGET/POSTを変更
5. テスト実行: 全テスト通過を確認
6. 実装コミット

**受入基準**:
- [ ] GETレスポンスに `meta.hostEnvironmentDisabled` が含まれる
- [ ] HOST環境に `disabled: true` が付与される（不許可時）
- [ ] POST HOST作成で403が返る（不許可時）
- [ ] 既存テストが全て通過する
- [ ] `npm run lint` でエラーなし

**依存関係**: タスク1.2
**推定工数**: 20分
**ステータス**: `DONE`
**完了サマリー**: GET/POSTにHOST制限追加。GETにmeta.hostEnvironmentDisabled、disabled付与。POSTにHOST作成403。テスト4件追加、全23テスト通過。
**要件対応**: FR-008, FR-009, NFR-002

---

#### タスク2.4: セッション作成APIのHOST制限

**説明**:
- 対象ファイルパス: `src/app/api/projects/[project_id]/sessions/route.ts`（既存変更）
- HOST環境でのセッション作成を制限

**技術的文脈**:
- 環境取得後、`isHostEnvironmentAllowed()` で判定
- HOST環境かつ不許可の場合は403を返す

**実装手順（TDD）**:
1. テスト追加: `src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts`
   - HOST環境不許可時のセッション作成で403
2. テストコミット
3. 実装: `route.ts` に制限追加
4. 実装コミット

**受入基準**:
- [ ] HOST環境不許可時にセッション作成が403を返す
- [ ] DOCKER環境のセッション作成は影響なし
- [ ] 既存テストが全て通過する

**依存関係**: タスク1.2
**推定工数**: 10分
**ステータス**: `DONE`
**完了サマリー**: セッション作成APIにHOST環境制限ガード追加。effectiveEnvironmentId設定時とHOSTフォールバック時の2ケースをカバー。
**要件対応**: FR-002, NFR-002

---

### フェーズ3: フロントエンド - UI制限

*推定期間: 30分*

#### タスク3.1: useEnvironmentsフックの変更

**説明**:
- 対象ファイルパス: `src/hooks/useEnvironments.ts`（既存変更）
- `Environment` interfaceに `disabled` フィールド追加
- `UseEnvironmentsReturn` に `hostEnvironmentDisabled` フィールド追加
- APIレスポンスの `meta` からフラグを取得

**技術的文脈**:
- APIレスポンス形式: `{ environments: [...], meta: { hostEnvironmentDisabled: boolean } }`
- `fetchEnvironments` 内で `meta` を解析

**実装手順**:
1. `Environment` interfaceに `disabled?: boolean` 追加
2. `UseEnvironmentsReturn` に `hostEnvironmentDisabled: boolean` 追加
3. `fetchEnvironments` でmetaからフラグ取得
4. テスト実行: 全テスト通過を確認
5. コミット

**受入基準**:
- [ ] `disabled` フィールドが型定義に含まれる
- [ ] `hostEnvironmentDisabled` がフックから返される
- [ ] 既存テストが通過する

**依存関係**: タスク2.3
**推定工数**: 10分
**ステータス**: `DONE`
**完了サマリー**: Environment interfaceにdisabled追加、UseEnvironmentsReturnにhostEnvironmentDisabled追加、fetchEnvironmentsでmeta取得。
**要件対応**: FR-009

---

#### タスク3.2: EnvironmentFormのHOSTオプション無効化

**説明**:
- 対象ファイルパス: `src/components/environments/EnvironmentForm.tsx`（既存変更）
- `hostEnvironmentDisabled` propを追加
- HOSTオプションをdisabledにする
- HOSTが無効な場合のデフォルト選択をDOCKERに変更

**技術的文脈**:
- `Listbox.Option` の `disabled` propを利用
- 作成モード時の初期type選択をDOCKERに変更（HOST無効時）

**実装手順**:
1. `EnvironmentFormProps` に `hostEnvironmentDisabled?: boolean` 追加
2. `Listbox.Option` のdisabled条件を変更
3. 作成モード初期化でHOST無効時にDOCKERを初期値に設定
4. HOSTが無効な理由をUIで表示（tooltipまたは説明テキスト）
5. コミット

**受入基準**:
- [ ] HOST無効時にHOSTタイプが選択不可
- [ ] HOST無効時にデフォルト選択がDOCKER
- [ ] HOST無効時に理由が表示される
- [ ] HOST有効時は既存動作と同じ

**依存関係**: タスク3.1
**推定工数**: 10分
**ステータス**: `DONE`
**完了サマリー**: hostEnvironmentDisabled prop追加、HOST無効時にDOCKERをデフォルト選択、Listbox.OptionでHOST無効化、説明テキスト変更。
**要件対応**: FR-010

---

#### タスク3.3: EnvironmentCardの無効化表示

**説明**:
- 対象ファイルパス:
  - `src/components/environments/EnvironmentCard.tsx`（既存変更）
  - `src/components/environments/EnvironmentList.tsx`（既存変更）
- HOST環境カードに無効化バッジとグレーアウト表示を追加
- EnvironmentListから `hostEnvironmentDisabled` をパススルー

**技術的文脈**:
- `environment.disabled` フラグに基づく条件分岐
- Tailwind CSSの `opacity-60` でグレーアウト
- 赤色バッジで「無効」表示

**実装手順**:
1. `EnvironmentCard` に `disabled` に基づく表示ロジック追加
2. 無効化バッジのスタイル実装
3. `EnvironmentList` でpropsパススルー
4. コミット

**受入基準**:
- [ ] HOST環境カードが無効時にグレーアウト表示
- [ ] 「無効」バッジが表示される
- [ ] 無効時にステータスが「利用不可」表示
- [ ] 通常時は既存動作と同じ

**依存関係**: タスク3.1
**推定工数**: 10分
**ステータス**: `DONE`
**完了サマリー**: EnvironmentCardにグレーアウト、無効バッジ、ボタン無効化を追加。EnvironmentListとpage.tsxにhostEnvironmentDisabledのパススルー実装。
**要件対応**: FR-011

---

### フェーズ4: 設定・統合

*推定期間: 15分*

#### タスク4.1: server.tsの初期化追加とdocker-compose.yml変更

**説明**:
- 対象ファイルパス:
  - `server.ts`（既存変更）
  - `docker-compose.yml`（既存変更）
- サーバー起動時に `initializeEnvironmentDetection()` を呼び出し
- docker-compose.ymlに `RUNNING_IN_DOCKER=true` を追加

**技術的文脈**:
- `server.ts` の起動処理の早い段階で呼び出す（デフォルト環境初期化の前）
- docker-compose.ymlの `environment` セクションに追加
- `ALLOW_HOST_ENVIRONMENT` はコメントアウトした状態で記載

**実装手順**:
1. `server.ts` に環境検出初期化を追加
2. `docker-compose.yml` に環境変数を追加
3. テスト実行: 全テスト通過を確認
4. コミット

**受入基準**:
- [ ] サーバー起動時に環境検出が実行される
- [ ] 検出結果がログに出力される
- [ ] `docker-compose.yml` に `RUNNING_IN_DOCKER=true` が含まれる
- [ ] `ALLOW_HOST_ENVIRONMENT` がコメントアウトされた状態で記載
- [ ] 全テストが通過する

**依存関係**: タスク2.2
**推定工数**: 10分
**ステータス**: `DONE`
**完了サマリー**: server.tsにinitializeEnvironmentDetection()追加（ensureDefaultExistsの前）。docker-compose.ymlにRUNNING_IN_DOCKER=true追加、ALLOW_HOST_ENVIRONMENTをコメントアウトで記載。
**要件対応**: FR-012, NFR-001

---

#### タスク4.2: ドキュメント更新

**説明**:
- 対象ファイルパス: `docs/ENV_VARS.md`（既存変更）
- 新しい環境変数 `RUNNING_IN_DOCKER` と `ALLOW_HOST_ENVIRONMENT` のドキュメント追加

**実装手順**:
1. `docs/ENV_VARS.md` に環境変数の説明を追加
2. コミット

**受入基準**:
- [ ] `RUNNING_IN_DOCKER` の説明が記載されている
- [ ] `ALLOW_HOST_ENVIRONMENT` の説明が記載されている
- [ ] 使用例が記載されている

**依存関係**: なし
**推定工数**: 5分
**ステータス**: `DONE`
**完了サマリー**: ENV_VARS.mdにRUNNING_IN_DOCKERとALLOW_HOST_ENVIRONMENT環境変数のドキュメントを追加。

---

## タスクサマリー

| タスクID | タイトル | フェーズ | 推定工数 | 依存 | ステータス |
|---------|---------|---------|---------|------|-----------|
| 1.1 | 環境検出テスト作成 | 1 | 15分 | - | DONE |
| 1.2 | 環境検出実装 | 1 | 15分 | 1.1 | DONE |
| 2.1 | EnvironmentService制限テスト | 2 | 15分 | 1.2 | DONE |
| 2.2 | EnvironmentService制限実装 | 2 | 15分 | 2.1 | DONE |
| 2.3 | 環境API制限テスト・実装 | 2 | 20分 | 1.2 | DONE |
| 2.4 | セッション作成API制限 | 2 | 10分 | 1.2 | DONE |
| 3.1 | useEnvironmentsフック変更 | 3 | 10分 | 2.3 | DONE |
| 3.2 | EnvironmentForm無効化 | 3 | 10分 | 3.1 | DONE |
| 3.3 | EnvironmentCard無効化表示 | 3 | 10分 | 3.1 | DONE |
| 4.1 | server.ts・docker-compose変更 | 4 | 10分 | 2.2 | DONE |
| 4.2 | ドキュメント更新 | 4 | 5分 | - | DONE |

**合計推定工数: 135分**

## 逆順レビュー

### タスク -> 設計の整合性

| 設計コンポーネント | 対応タスク | 状況 |
|------------------|-----------|------|
| 環境検出ユーティリティ | 1.1, 1.2 | 対応済 |
| EnvironmentService変更 | 2.1, 2.2 | 対応済 |
| 環境API変更 (GET/POST) | 2.3 | 対応済 |
| セッション作成API変更 | 2.4 | 対応済 |
| server.ts変更 | 4.1 | 対応済 |
| docker-compose.yml変更 | 4.1 | 対応済 |
| useEnvironmentsフック | 3.1 | 対応済 |
| EnvironmentForm変更 | 3.2 | 対応済 |
| EnvironmentCard変更 | 3.3 | 対応済 |
| EnvironmentList変更 | 3.3 | 対応済 |
| docs/ENV_VARS.md変更 | 4.2 | 対応済 |

### 設計 -> 要件の整合性

全FR/NFR要件に対応するタスクが存在することを確認済み（設計書の整合性チェック表参照）。

## リスクと軽減策

| リスク | 軽減策 |
|--------|--------|
| 既存テストの破損 | `environment-detect` をモックして既存テストに影響を与えない |
| 非Docker環境での動作変更 | `isHostEnvironmentAllowed()` が非Docker時に常にtrueを返すことを保証 |
| セッション作成APIの複雑さ | 最小限の制限追加で既存ロジックに影響しない |
