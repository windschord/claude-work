# 技術設計書: Docker環境のポートマッピング・ボリュームマウント設定

## 要件参照

- [要件定義書](../../requirements/docker-port-volume/index.md)

## アーキテクチャ概要

既存のDocker環境設定（config JSON）にポートマッピングとボリュームマウントのフィールドを追加し、DockerAdapterのdocker runコマンド構築時にこれらを反映する。UIでは動的リスト形式の入力フォームを提供し、バリデーションをフロントエンド・バックエンドの両方で実施する。

```mermaid
graph TD
    A[EnvironmentForm UI] -->|portMappings, volumeMounts| B[API: PUT /api/environments/:id]
    B -->|config JSON保存| C[ExecutionEnvironment DB]
    C -->|config読み込み| D[AdapterFactory]
    D -->|DockerAdapterConfig| E[DockerAdapter.buildDockerArgs]
    E -->|"-p", "-v" 引数追加| F[docker run コマンド]

    G[環境編集後] -->|今すぐ適用| H[API: POST /api/environments/:id/apply]
    H -->|対象セッション取得| I[セッション再起動]
    I -->|destroySession + createSession| E
```

## コンポーネント設計

### 1. データ型定義

**ファイル**: `src/types/environment.ts`（新規）

```typescript
/** ポートマッピング設定 */
export interface PortMapping {
  hostPort: number;          // 1-65535
  containerPort: number;     // 1-65535
  protocol?: 'tcp' | 'udp';  // 省略時のデフォルト: 'tcp'
}

/** ボリュームマウント設定 */
export interface VolumeMount {
  hostPath: string;          // 絶対パス
  containerPath: string;     // 絶対パス
  accessMode?: 'rw' | 'ro';  // 省略時のデフォルト: 'rw'
}

/** Docker環境の拡張config */
export interface DockerEnvironmentConfig {
  imageSource: 'existing' | 'dockerfile';
  imageName?: string;
  imageTag?: string;
  dockerfilePath?: string;
  dockerfileUploaded?: boolean;
  skipPermissions?: boolean;
  portMappings?: PortMapping[];
  volumeMounts?: VolumeMount[];
}
```

### 2. バリデーションモジュール

**ファイル**: `src/lib/docker-config-validator.ts`（新規）

ポートマッピングとボリュームマウントのバリデーションロジックを共通モジュールとして切り出す。フロントエンド（リアルタイムバリデーション）とバックエンド（API受付時）の両方で使用する。

```typescript
/** 危険パスのリスト */
export const DANGEROUS_HOST_PATHS = [
  '/',
  '/etc', '/proc', '/sys', '/dev', '/root',
  '/boot', '/sbin', '/bin', '/usr/sbin', '/var',
];

/** システムが自動マウントするコンテナパス */
export const SYSTEM_CONTAINER_PATHS = [
  '/workspace',
  '/home/node/.claude',
  '/home/node/.config/claude',
  '/home/node/.ssh',
  '/home/node/.gitconfig',
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];  // 危険パスの警告
}

/** ポートマッピングのバリデーション */
export function validatePortMappings(mappings: PortMapping[]): ValidationResult;

/** ボリュームマウントのバリデーション */
export function validateVolumeMounts(mounts: VolumeMount[]): ValidationResult;

/** パスが危険かどうかを判定 */
export function isDangerousPath(hostPath: string): boolean;

/** パスがシステムボリュームと重複するか判定 */
export function isSystemContainerPath(containerPath: string): boolean;
```

**バリデーションルール**:

| 対象 | ルール | エラー/警告 |
|------|--------|------------|
| ポート番号 | 1-65535の整数 | エラー |
| ポート重複 | 同一hostPort+protocol | エラー |
| ホストパス | 絶対パス（`/`開始） | エラー |
| コンテナパス | 絶対パス（`/`開始） | エラー |
| コンテナパス重複 | 同一containerPath | エラー |
| 危険パス | DANGEROUS_HOST_PATHSに該当 | 警告（同意で許可） |
| システムパス | SYSTEM_CONTAINER_PATHSに該当 | エラー |
| パストラバーサル | `../`を含む | エラー |

### 3. DockerAdapter拡張

**ファイル**: `src/services/adapters/docker-adapter.ts`（既存修正）

`buildDockerArgs()`メソッドにポートマッピングとボリュームマウントの引数生成を追加する。

**変更箇所**: `buildDockerArgs()`メソッド内、イメージ指定の直前に追加

```typescript
// --- 追加: ポートマッピング ---
if (this.config.portMappings && this.config.portMappings.length > 0) {
  for (const pm of this.config.portMappings) {
    args.push('-p', `${pm.hostPort}:${pm.containerPort}/${pm.protocol || 'tcp'}`);
  }
}

// --- 追加: カスタムボリュームマウント ---
// システムボリュームの後、イメージ指定の前に配置
if (this.config.volumeMounts && this.config.volumeMounts.length > 0) {
  for (const vm of this.config.volumeMounts) {
    const volumeArg = vm.accessMode === 'ro'
      ? `${vm.hostPath}:${vm.containerPath}:ro`
      : `${vm.hostPath}:${vm.containerPath}`;
    args.push('-v', volumeArg);
  }
}
```

**DockerAdapterConfigの拡張**:

```typescript
export interface DockerAdapterConfig {
  environmentId: string;
  imageName: string;
  imageTag: string;
  authDirPath: string;
  portMappings?: PortMapping[];    // 追加
  volumeMounts?: VolumeMount[];    // 追加
}
```

**docker runコマンド引数の順序**（REQ-118対応）:

1. `run -it --rm`
2. `--name`
3. `--cap-drop ALL`, `--security-opt`
4. `-v` ワークスペース（システム）
5. `-v` 認証ディレクトリ（システム）
6. `-v` SSH鍵、Git設定（システム）
7. **`-p` ポートマッピング（カスタム）** ← 追加
8. **`-v` ボリュームマウント（カスタム）** ← 追加
9. `-e` 環境変数
10. `--entrypoint`
11. イメージ名:タグ
12. claudeコマンド引数

### 4. AdapterFactory拡張

**ファイル**: `src/services/adapter-factory.ts`（既存修正）

DockerAdapterの生成時にconfig JSONからportMappingsとvolumeMountsを読み取り、DockerAdapterConfigに渡す。

```typescript
// config JSONのパース時
const config = JSON.parse(environment.config);
const adapterConfig: DockerAdapterConfig = {
  environmentId: environment.id,
  imageName: config.imageName,
  imageTag: config.imageTag,
  authDirPath: environment.auth_dir_path,
  portMappings: config.portMappings || [],    // 追加
  volumeMounts: config.volumeMounts || [],    // 追加
};
```

### 5. API拡張

**ファイル**: `src/app/api/environments/route.ts`（既存修正）

POST/PUTリクエストでportMappingsとvolumeMountsのバリデーションを追加。

```typescript
// POST /api/environments
// PUT /api/environments/:id
// configオブジェクト内のportMappings, volumeMountsをバリデーション
if (config.portMappings) {
  const portResult = validatePortMappings(config.portMappings);
  if (!portResult.valid) {
    return NextResponse.json({ error: portResult.errors.join(', ') }, { status: 400 });
  }
}
if (config.volumeMounts) {
  const volResult = validateVolumeMounts(config.volumeMounts);
  if (!volResult.valid) {
    return NextResponse.json({ error: volResult.errors.join(', ') }, { status: 400 });
  }
}
```

**新規API**: `POST /api/environments/:id/apply`

設定変更を実行中のセッションに即時適用するためのエンドポイント。

```typescript
// POST /api/environments/:id/apply
// 1. 該当環境を使用している実行中セッションを取得
// 2. 各セッションのコンテナを停止→新設定で再作成
// レスポンス:
{
  applied: number;        // 適用成功数
  failed: number;         // 適用失敗数
  sessions: {
    id: string;
    name: string;
    status: 'restarted' | 'failed';
    error?: string;
  }[];
}
```

**新規API**: `GET /api/environments/:id/sessions`

該当環境を使用している実行中セッションの一覧を取得。

```typescript
// GET /api/environments/:id/sessions
// レスポンス:
{
  sessions: {
    id: string;
    name: string;
    status: string;
    container_id: string | null;
  }[];
}
```

### 6. UI設計

**ファイル**: `src/components/environments/PortMappingList.tsx`（新規）

ポートマッピングの動的リスト入力コンポーネント。

```typescript
interface PortMappingListProps {
  portMappings: PortMapping[];
  onChange: (mappings: PortMapping[]) => void;
  disabled?: boolean;
  errors?: Record<number, string>;  // インデックスごとのエラー
}
```

**UI構成**:
```text
ポートマッピング
+--------------------------------------------------+
| ホストポート | コンテナポート | プロトコル | 削除 |
| [3000     ]  | [3000       ]  | [TCP ▼ ]  | [x]  |
| [8080     ]  | [80         ]  | [TCP ▼ ]  | [x]  |
+--------------------------------------------------+
[+ ポートを追加]
```

**ファイル**: `src/components/environments/VolumeMountList.tsx`（新規）

ボリュームマウントの動的リスト入力コンポーネント。

```typescript
interface VolumeMountListProps {
  volumeMounts: VolumeMount[];
  onChange: (mounts: VolumeMount[]) => void;
  disabled?: boolean;
  errors?: Record<number, string>;
}
```

**UI構成**:
```text
ボリュームマウント
+---------------------------------------------------------------+
| ホストパス          | コンテナパス    | モード  | 削除 |
| [/home/user/data ]  | [/data       ]  | [RW ▼] | [x]  |
| [/home/user/config]  | [/config     ]  | [RO ▼] | [x]  |
+---------------------------------------------------------------+
[+ ボリュームを追加]
```

**ファイル**: `src/components/environments/DangerousPathWarning.tsx`（新規）

危険パス入力時の警告ダイアログ。

```typescript
interface DangerousPathWarningProps {
  isOpen: boolean;
  path: string;
  onConfirm: () => void;   // 「同意して設定」
  onCancel: () => void;    // 「キャンセル」
}
```

**ファイル**: `src/components/environments/ApplyChangesButton.tsx`（新規）

設定変更の即時適用ボタンと確認ダイアログ。

```typescript
interface ApplyChangesButtonProps {
  environmentId: string;
  onApplied: () => void;   // 適用完了時のコールバック
}
```

### 7. EnvironmentForm拡張

**ファイル**: `src/components/environments/EnvironmentForm.tsx`（既存修正）

Docker設定セクション内にPortMappingListとVolumeMountListを追加。

**追加state**:
```typescript
const [portMappings, setPortMappings] = useState<PortMapping[]>([]);
const [volumeMounts, setVolumeMounts] = useState<VolumeMount[]>([]);
const [portErrors, setPortErrors] = useState<Record<number, string>>({});
const [volumeErrors, setVolumeErrors] = useState<Record<number, string>>({});
const [dangerousPathWarning, setDangerousPathWarning] = useState<{
  isOpen: boolean;
  path: string;
  index: number;
} | null>(null);
```

**buildDockerConfig()の拡張**:
```typescript
const buildDockerConfig = (): object => {
  const base = /* 既存のconfig生成ロジック */;
  return {
    ...base,
    portMappings: portMappings.length > 0 ? portMappings : undefined,
    volumeMounts: volumeMounts.length > 0 ? volumeMounts : undefined,
  };
};
```

**編集モードでの復元**:
```typescript
// useEffect内
if (config.portMappings) setPortMappings(config.portMappings);
if (config.volumeMounts) setVolumeMounts(config.volumeMounts);
```

## API設計

### 既存APIの変更

#### PUT /api/environments/:id

**リクエストbody config内の追加フィールド**:

```typescript
{
  config: {
    // 既存フィールド...
    portMappings?: PortMapping[];
    volumeMounts?: VolumeMount[];
  }
}
```

#### POST /api/environments

**リクエストbody config内の追加フィールド**: PUTと同様

### 新規API

#### POST /api/environments/:id/apply

設定変更を実行中セッションに即時適用する。

**リクエスト**: なし（URLパラメータのみ）

**レスポンス**: 200 OK

```json
{
  "applied": 2,
  "failed": 0,
  "sessions": [
    { "id": "sess-1", "name": "Session 1", "status": "restarted" },
    { "id": "sess-2", "name": "Session 2", "status": "restarted" }
  ]
}
```

**エラーレスポンス**: 404（環境未存在）, 500（内部エラー）

#### GET /api/environments/:id/sessions

該当環境の実行中セッション一覧。

**レスポンス**: 200 OK

```json
{
  "sessions": [
    { "id": "sess-1", "name": "Session 1", "status": "ACTIVE", "container_id": "claude-env-xxx" }
  ],
  "count": 1
}
```

## データベース設計

データベーススキーマの変更は不要。ポートマッピングとボリュームマウントはExecutionEnvironmentテーブルの既存`config`カラム（JSON文字列）に格納する。

**config JSONの拡張後の例**:

```json
{
  "imageSource": "existing",
  "imageName": "ghcr.io/windschord/claude-work",
  "imageTag": "latest",
  "skipPermissions": false,
  "portMappings": [
    { "hostPort": 3000, "containerPort": 3000, "protocol": "tcp" },
    { "hostPort": 8080, "containerPort": 80, "protocol": "tcp" }
  ],
  "volumeMounts": [
    { "hostPath": "/home/user/data", "containerPath": "/data", "accessMode": "rw" },
    { "hostPath": "/home/user/config", "containerPath": "/config", "accessMode": "ro" }
  ]
}
```

## セキュリティ設計

### 入力値のサニタイズ（NFR-005）

- ポートマッピング: `hostPort`と`containerPort`はparseInt()で整数変換し、NaN/範囲外を拒否
- ボリュームマウント: `hostPath`と`containerPath`はパストラバーサルを文字列操作（startsWith, includes）で検出し、`../`を含む場合は拒否。このモジュールはフロントエンドとバックエンドで共有されるため、Node固有のAPIは意図的に使用しない
- docker runコマンドは既存と同様にspawn()で引数を配列として渡し、shell経由を避ける

### 危険パスの警告（NFR-002）

- フロントエンドでリアルタイム検出し、警告ダイアログを表示
- バックエンドでも二重チェック（ログに警告記録、設定自体は許可）

### システムボリューム保護（NFR-004）

- フロントエンドとバックエンドの両方でSYSTEM_CONTAINER_PATHSとの重複チェック
- 完全一致だけでなく、サブパス（例: `/workspace/sub`）も検出

## 技術的決定事項

### 決定1: config JSON内に格納（DBスキーマ変更なし）

**検討した選択肢**:
- A) 新規テーブル（PortMapping, VolumeMount）を作成
- B) ExecutionEnvironmentテーブルに個別カラムを追加
- C) 既存のconfig JSONに追加

**決定**: C

**根拠**: ポートマッピングとボリュームマウントはDocker環境の設定の一部であり、既存のconfig JSONに自然に収まる。DB移行が不要で既存のCRUDロジックをそのまま利用できる。検索やフィルタリングの必要がないため、JSON内に格納しても問題ない。

### 決定2: バリデーションの共通モジュール化

**検討した選択肢**:
- A) フロントエンドとバックエンドで個別にバリデーション実装
- B) 共通モジュールとして切り出し

**決定**: B

**根拠**: バリデーションルールの一貫性を保証するため。Next.jsのプロジェクト構造ではフロントエンドとバックエンドで同一のTypeScriptモジュールをインポートできるため、コードの重複を避けられる。

### 決定3: 即時適用はセッション単位でのコンテナ再作成

**検討した選択肢**:
- A) docker updateコマンド（ポート変更不可）
- B) コンテナ再作成（stop → new run）
- C) docker commitで状態を保存して再作成

**決定**: B

**根拠**: docker updateコマンドではポートマッピングの変更ができない。docker commitは不要な状態を引き継ぐリスクがある。既存のrestartSession()メソッドがコンテナ再作成のロジックを持っているため、これを活用する。

## CI/CD設計

既存のCI/CDパイプラインに変更は不要。新規ファイルは既存のESLint/Vitest設定に自動的に含まれる。

### テスト方針

| テスト種別 | 対象 | ファイル |
|-----------|------|---------|
| ユニット | docker-config-validator | `src/lib/__tests__/docker-config-validator.test.ts` |
| ユニット | DockerAdapter.buildDockerArgs | `src/services/adapters/__tests__/docker-adapter.test.ts` |
| ユニット | PortMappingList | `src/components/environments/__tests__/PortMappingList.test.tsx` |
| ユニット | VolumeMountList | `src/components/environments/__tests__/VolumeMountList.test.tsx` |
| ユニット | API route (environments) | `src/app/api/environments/__tests__/route.test.ts` |
| ユニット | API route (apply) | `src/app/api/environments/[id]/apply/__tests__/route.test.ts` |

## 要件との整合性チェック

| 要件ID | 設計要素 | 対応状況 |
|--------|---------|---------|
| REQ-001〜004 | EnvironmentForm + PortMappingList | 対応済み |
| REQ-005〜006 | EnvironmentForm useEffect復元 | 対応済み |
| REQ-007〜010 | docker-config-validator | 対応済み |
| REQ-011〜012 | DockerAdapter.buildDockerArgs | 対応済み |
| REQ-101〜104 | EnvironmentForm + VolumeMountList | 対応済み |
| REQ-105〜106 | EnvironmentForm useEffect復元 | 対応済み |
| REQ-107〜111 | docker-config-validator | 対応済み |
| REQ-112〜114 | DangerousPathWarning | 対応済み |
| REQ-115〜117 | DockerAdapter.buildDockerArgs | 対応済み |
| REQ-118〜119 | buildDockerArgs引数順序 + validator | 対応済み |
| REQ-201〜204 | 既存のDB保存・セッション作成フロー | 対応済み |
| REQ-205〜210 | ApplyChangesButton + API /apply | 対応済み |
| REQ-211〜212 | GET /api/environments/:id/sessions | 対応済み |
| NFR-001〜005 | docker-config-validator + 既存spawn() | 対応済み |
| NFR-101〜105 | PortMappingList + VolumeMountList | 対応済み |
