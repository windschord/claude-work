# TASK-002: 型定義拡張 (DockerEnvironmentConfig, CreateSessionOptions)

## 説明

`DockerEnvironmentConfig` に `chromeSidecar` 設定オブジェクトの型定義を追加し、`CreateSessionOptions` にサイドカー設定フィールドを追加する。

**対象ファイル**:
- `src/types/environment.ts` - DockerEnvironmentConfigにchromeSidecar型追加
- `src/services/environment-adapter.ts` - CreateSessionOptionsにchromeSidecarフィールド追加

**設計書**:
- `docs/sdd/design/chrome-sidecar/components/db-schema.md` (型定義部分)
- `docs/sdd/design/chrome-sidecar/components/docker-adapter.md` (CreateSessionOptions部分)

## 技術的文脈

- `ChromeSidecarConfig` インターフェース: `{ enabled: boolean; image: string; tag: string; }`
- `DockerEnvironmentConfig.chromeSidecar` はオプショナル（後方互換性）
- `CreateSessionOptions.chromeSidecar` もオプショナル
- `chromeSidecar` キーが存在しない場合は `enabled: false` として扱う

## TDD手順

### テストファイル

`src/types/__tests__/chrome-sidecar-config.test.ts`

### テストケース

1. **ChromeSidecarConfig型の検証**
   - enabled, image, tagフィールドを持つオブジェクトが型に適合すること
   - 必須フィールドが欠けている場合のTypeScriptコンパイルエラー確認（型テスト）

2. **DockerEnvironmentConfig後方互換性の検証**
   - chromeSidecarキーなしのconfigが有効であること
   - chromeSidecarキーありのconfigが有効であること
   - 既存のimageName, imageTag等のフィールドが影響を受けないこと

3. **CreateSessionOptions拡張の検証**
   - chromeSidecarフィールドなしのオプションが有効であること
   - chromeSidecarフィールドありのオプションが有効であること

### 実装手順

1. テストファイル作成・テスト実行（RED確認）
2. `src/types/environment.ts` に `ChromeSidecarConfig` インターフェースを追加
3. `DockerEnvironmentConfig` に `chromeSidecar?: ChromeSidecarConfig` を追加
4. `src/services/environment-adapter.ts` の `CreateSessionOptions` に `chromeSidecar?: ChromeSidecarConfig` を追加
5. テスト実行（GREEN確認）

## 受入基準

- [ ] `ChromeSidecarConfig` インターフェースがexportされている
- [ ] `DockerEnvironmentConfig.chromeSidecar` がオプショナルフィールドとして追加されている
- [ ] `CreateSessionOptions.chromeSidecar` がオプショナルフィールドとして追加されている
- [ ] 既存のDockerEnvironmentConfig利用箇所でコンパイルエラーが発生しないこと
- [ ] 既存テストが壊れていないこと

**依存関係**: なし
**推定工数**: 15分
**ステータス**: `TODO`
