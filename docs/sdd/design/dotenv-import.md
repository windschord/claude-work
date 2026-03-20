# 技術設計書: .envファイルインポート機能

## 概要

プロジェクト設定画面のカスタム環境変数エディタに、リポジトリ内の.envファイルからインポートする機能を追加する。
バックエンドでファイル検索とパースを行い、フロントエンドでプレビューとマージのUIを提供する。

- 要件定義書: `docs/sdd/requirements/dotenv-import.md`
- タスク計画書: `docs/sdd/tasks/dotenv-import.md`
- 対象ブランチ: `feat/dotenv-import`（予定）

---

## 1. コンポーネント構成

### 1.1 全体構成図

```text
ClaudeOptionsForm
└── EnvVarImportSection (新規)
    ├── インポートボタン
    ├── ファイル選択ドロップダウン
    └── プレビュー・マージ確認UI

GET /api/projects/:id/env-files
POST /api/projects/:id/env-files/parse
    │
    ├── EnvFileService (新規)
    │   ├── listEnvFiles(projectPath, cloneLocation)
    │   │   ├── [host] glob でファイル検索
    │   │   └── [docker] docker exec + find でファイル検索
    │   ├── readEnvFile(projectPath, relativePath, cloneLocation)
    │   │   ├── [host] fs.readFile
    │   │   └── [docker] docker exec + cat
    │   └── validatePath(projectPath, relativePath)  // パストラバーサル防止
    │
    └── DotenvParser (新規)
        └── parse(content: string) → { variables, errors }
```

### 1.2 ファイル構成

| ファイル | 種別 | 説明 |
|--------|------|------|
| `src/services/dotenv-parser.ts` | 新規 | .envフォーマットのパーサー（純粋関数） |
| `src/services/env-file-service.ts` | 新規 | .envファイル検索・読み込みサービス |
| `src/app/api/projects/[project_id]/env-files/route.ts` | 新規 | ファイル一覧API |
| `src/app/api/projects/[project_id]/env-files/parse/route.ts` | 新規 | ファイルパースAPI |
| `src/components/claude-options/ClaudeOptionsForm.tsx` | 変更 | インポートUI追加 |
| `src/components/claude-options/EnvVarImportSection.tsx` | 新規 | インポートUIコンポーネント |

---

## 2. Dotenvパーサー設計

### 2.1 インターフェース

```typescript
// src/services/dotenv-parser.ts

export interface DotenvParseResult {
  variables: { [key: string]: string };
  errors: string[];
}

/**
 * .envフォーマットのテキストをパースする
 * 副作用のない純粋関数として実装
 */
export function parseDotenv(content: string): DotenvParseResult;
```

### 2.2 パースルール

1. 行ごとに処理（`\n` または `\r\n` で分割）
2. 空行をスキップ
3. `#` で始まる行（先頭空白後）をコメントとしてスキップ
4. `export ` プレフィックスを除去
5. 最初の `=` で key と value に分割
6. key の前後の空白をトリム
7. value の処理:
   - 前後の空白をトリム
   - ダブルクォート（`"..."`) で囲まれている場合はクォートを除去
   - シングルクォート（`'...'`）で囲まれている場合はクォートを除去
   - クォートなしの場合、行末コメント（` #...`）を除去
8. `=` を含まない非空行はエラーとして報告

### 2.3 パースアルゴリズム

```typescript
export function parseDotenv(content: string): DotenvParseResult {
  const variables: { [key: string]: string } = {};
  const errors: string[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].trim();

    // 空行・コメント行をスキップ
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    // export プレフィックスを除去
    let processedLine = line;
    if (processedLine.startsWith('export ')) {
      processedLine = processedLine.slice(7).trim();
    }

    // = で分割
    const eqIndex = processedLine.indexOf('=');
    if (eqIndex === -1) {
      errors.push(`Line ${lineNum}: '=' が見つかりません: ${line}`);
      continue;
    }

    const key = processedLine.slice(0, eqIndex).trim();
    let value = processedLine.slice(eqIndex + 1).trim();

    // キーのバリデーション
    if (key === '') {
      errors.push(`Line ${lineNum}: キーが空です: ${line}`);
      continue;
    }

    // クォート処理
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      // クォートなしの場合、インラインコメントを除去
      const commentIndex = value.indexOf(' #');
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    variables[key] = value;
  }

  return { variables, errors };
}
```

---

## 3. EnvFileService設計

### 3.1 インターフェース

```typescript
// src/services/env-file-service.ts

export class EnvFileService {
  /**
   * プロジェクト内の.envファイル一覧を取得
   * @returns プロジェクトルートからの相対パスリスト
   */
  static async listEnvFiles(
    projectPath: string,
    cloneLocation: string | null
  ): Promise<string[]>;

  /**
   * .envファイルの内容を読み込む
   * @param relativePath プロジェクトルートからの相対パス
   * @returns ファイル内容のテキスト
   * @throws パストラバーサル検出時、ファイル未検出時
   */
  static async readEnvFile(
    projectPath: string,
    relativePath: string,
    cloneLocation: string | null
  ): Promise<string>;

  /**
   * パストラバーサル検証
   * @throws パストラバーサル検出時にエラーをスロー
   */
  static validatePath(projectPath: string, relativePath: string): void;
}
```

### 3.2 ホスト環境でのファイル検索

```typescript
import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';

static async listEnvFilesHost(projectPath: string): Promise<string[]> {
  const pattern = '**/.env*';
  const ignore = [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
  ];

  const files = await glob(pattern, {
    cwd: projectPath,
    ignore,
    dot: true,        // .env で始まるファイルを検出
    nodir: true,       // ディレクトリを除外
  });

  return files.sort();
}
```

### 3.3 Docker環境でのファイル検索

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

static async listEnvFilesDocker(
  projectPath: string,
  volumeName: string
): Promise<string[]> {
  // Docker volume 内で find を実行
  // プロジェクトの docker_volume_name を使用してコンテナ内パスを特定
  const { stdout } = await execFileAsync('docker', [
    'run', '--rm',
    '-v', `${volumeName}:/workspace`,
    'alpine:latest',
    'find', '/workspace',
    '-name', '.env*',
    '-not', '-path', '*/node_modules/*',
    '-not', '-path', '*/.git/*',
    '-not', '-path', '*/dist/*',
    '-not', '-path', '*/build/*',
    '-not', '-path', '*/.next/*',
    '-type', 'f',
  ]);

  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(p => p.replace('/workspace/', ''))
    .sort();
}
```

### 3.4 パストラバーサル防止

```typescript
static validatePath(projectPath: string, relativePath: string): void {
  // 絶対パスを拒否
  if (path.isAbsolute(relativePath)) {
    throw new Error('絶対パスは許可されていません');
  }

  // 正規化して解決
  const resolvedPath = path.resolve(projectPath, relativePath);
  const normalizedProjectPath = path.resolve(projectPath);

  // プロジェクトディレクトリ外への参照を検出
  if (!resolvedPath.startsWith(normalizedProjectPath + path.sep) &&
      resolvedPath !== normalizedProjectPath) {
    throw new Error('パストラバーサルが検出されました');
  }
}
```

### 3.5 ファイル読み込み

```typescript
static async readEnvFileHost(
  projectPath: string,
  relativePath: string
): Promise<string> {
  this.validatePath(projectPath, relativePath);

  const fullPath = path.join(projectPath, relativePath);

  // ファイルサイズチェック（1MB制限）
  const stat = await fs.stat(fullPath);
  if (stat.size > 1024 * 1024) {
    throw new Error('ファイルサイズが1MBを超えています');
  }

  return fs.readFile(fullPath, 'utf-8');
}

static async readEnvFileDocker(
  volumeName: string,
  relativePath: string,
  projectPath: string
): Promise<string> {
  // Docker内でもパスバリデーションは行う（relativePath に .. が含まれないことを確認）
  this.validatePath(projectPath, relativePath);

  const { stdout } = await execFileAsync('docker', [
    'run', '--rm',
    '-v', `${volumeName}:/workspace`,
    'alpine:latest',
    'cat', `/workspace/${relativePath}`,
  ]);

  // サイズチェック
  if (Buffer.byteLength(stdout, 'utf-8') > 1024 * 1024) {
    throw new Error('ファイルサイズが1MBを超えています');
  }

  return stdout;
}
```

---

## 4. API設計

### 4.1 GET /api/projects/:id/env-files

.envファイル一覧を取得する。

```text
レスポンス (200):
{
  "files": [
    ".env",
    ".env.local",
    ".env.production",
    "config/.env.test"
  ]
}

エラー:
  404: プロジェクトが見つからない
  500: ファイル検索に失敗
```

**実装フロー:**

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  const { project_id } = await params;

  // 1. プロジェクト取得
  const project = await getProject(project_id);
  if (!project) {
    return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 });
  }

  // 2. clone_location に応じてファイル検索
  const files = await EnvFileService.listEnvFiles(
    project.path,
    project.clone_location
  );

  return NextResponse.json({ files });
}
```

### 4.2 POST /api/projects/:id/env-files/parse

.envファイルをパースして結果を返す。

```text
リクエスト:
{
  "path": ".env.local"
}

レスポンス (200):
{
  "variables": {
    "DATABASE_URL": "postgresql://localhost:5432/mydb",
    "API_KEY": "sk-xxxxx",
    "NODE_ENV": "development"
  },
  "errors": [
    "Line 5: '=' が見つかりません: INVALID_LINE"
  ]
}

エラー:
  400: path が未指定
  400: パストラバーサルが検出されました
  404: プロジェクトが見つかりません
  404: ファイルが見つかりません
  413: ファイルサイズが1MBを超えています
```

**実装フロー:**

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ project_id: string }> }
) {
  const { project_id } = await params;
  const body = await request.json();
  const { path: filePath } = body;

  // 1. バリデーション
  if (!filePath || typeof filePath !== 'string') {
    return NextResponse.json({ error: 'path は必須です' }, { status: 400 });
  }

  // 2. プロジェクト取得
  const project = await getProject(project_id);
  if (!project) {
    return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 });
  }

  // 3. パストラバーサルチェック
  try {
    EnvFileService.validatePath(project.path, filePath);
  } catch {
    return NextResponse.json({ error: 'パストラバーサルが検出されました' }, { status: 400 });
  }

  // 4. ファイル読み込み
  let content: string;
  try {
    content = await EnvFileService.readEnvFile(
      project.path,
      filePath,
      project.clone_location
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes('1MB')) {
      return NextResponse.json({ error: err.message }, { status: 413 });
    }
    return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 404 });
  }

  // 5. パース
  const result = parseDotenv(content);

  // 6. ログにはパスのみ記録（値は含めない）
  logger.info('Parsed env file', {
    projectId: project_id,
    path: filePath,
    variableCount: Object.keys(result.variables).length,
    errorCount: result.errors.length,
  });

  return NextResponse.json(result);
}
```

---

## 5. フロントエンド設計

### 5.1 コンポーネント構成

```text
ClaudeOptionsForm (既存・変更)
├── ... (既存のオプションUI)
├── カスタム環境変数セクション (既存)
│   ├── key-value エントリリスト (既存)
│   ├── 「追加」ボタン (既存)
│   └── EnvVarImportSection (新規)
│       ├── 「.envからインポート」ボタン
│       ├── ファイル選択ドロップダウン (表示/非表示)
│       ├── パース結果プレビュー (表示/非表示)
│       │   ├── 変数リスト (key=value)
│       │   ├── 重複キー警告
│       │   └── パースエラー表示
│       └── 「インポート」/「キャンセル」ボタン
```

### 5.2 EnvVarImportSection コンポーネント

```typescript
// src/components/claude-options/EnvVarImportSection.tsx

interface EnvVarImportSectionProps {
  projectId: string;
  existingVars: CustomEnvVars;
  onImport: (vars: CustomEnvVars) => void;
  disabled?: boolean;
}

export function EnvVarImportSection({
  projectId,
  existingVars,
  onImport,
  disabled,
}: EnvVarImportSectionProps) {
  // 状態管理
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<DotenvParseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ...
}
```

### 5.3 状態遷移

```text
[初期状態]
  ↓ 「.envからインポート」クリック
[ファイル一覧取得中] (ローディング表示)
  ↓ 取得完了
[ファイル選択待ち] (ドロップダウン表示)
  ↓ ファイル選択
[パース中] (ローディング表示)
  ↓ パース完了
[プレビュー表示] (変数一覧 + 重複警告 + エラー表示)
  ↓ 「インポート」クリック
[マージ完了] → 初期状態に戻る
  or
  ↓ 「キャンセル」クリック
[初期状態に戻る]
```

### 5.4 マージロジック

```typescript
function mergeImportedVars(
  existingVars: CustomEnvVars,
  importedVars: CustomEnvVars
): { merged: CustomEnvVars; overwritten: string[] } {
  const overwritten: string[] = [];

  for (const key of Object.keys(importedVars)) {
    if (key in existingVars && existingVars[key] !== importedVars[key]) {
      overwritten.push(key);
    }
  }

  const merged = { ...existingVars, ...importedVars };
  return { merged, overwritten };
}
```

### 5.5 ClaudeOptionsForm への統合

`ClaudeOptionsForm` に `projectId` props を追加し、`EnvVarImportSection` を環境変数セクション内に配置する。

```typescript
interface ClaudeOptionsFormProps {
  options: ClaudeCodeOptions;
  envVars: CustomEnvVars;
  onOptionsChange: (options: ClaudeCodeOptions) => void;
  onEnvVarsChange: (envVars: CustomEnvVars) => void;
  disabled?: boolean;
  disabledBySkipPermissions?: boolean;
  projectId?: string;  // 追加: インポート機能に使用
}
```

`projectId` が渡された場合のみ `EnvVarImportSection` を表示する。
これにより、セッション作成時など `projectId` が不明なコンテキストでは表示されない。

---

## 6. データフロー

### 6.1 .envファイル一覧取得フロー

```text
ユーザー → 「.envからインポート」クリック
  → EnvVarImportSection
    → fetch GET /api/projects/:id/env-files
      → API Route
        → db.select(projects).where(id)
        → EnvFileService.listEnvFiles(path, clone_location)
          → [host] glob('**/.env*', { cwd: projectPath })
          → [docker] docker run find /workspace -name '.env*'
        ← string[]
      ← { files: string[] }
    ← ドロップダウンにファイル一覧を表示
```

### 6.2 .envファイルパース・インポートフロー

```text
ユーザー → ファイル選択
  → EnvVarImportSection
    → fetch POST /api/projects/:id/env-files/parse { path: ".env.local" }
      → API Route
        → EnvFileService.validatePath(projectPath, ".env.local")
        → EnvFileService.readEnvFile(projectPath, ".env.local", clone_location)
          → [host] fs.readFile
          → [docker] docker run cat /workspace/.env.local
        → parseDotenv(content)
        ← { variables: {...}, errors: [...] }
      ← { variables: {...}, errors: [...] }
    ← プレビュー表示（変数一覧 + 重複警告 + エラー）

ユーザー → 「インポート」クリック
  → mergeImportedVars(existingVars, importedVars)
  → onEnvVarsChange(merged)   // ClaudeOptionsForm の状態に反映
  → ユーザーが「保存」で PATCH /api/projects/:id に送信
```

---

## 7. セキュリティ設計

### 7.1 パストラバーサル防止の多層防御

```text
Layer 1: API Route
  - relativePath が空文字や undefined でないことを確認

Layer 2: EnvFileService.validatePath()
  - path.isAbsolute() で絶対パスを拒否
  - path.resolve() で正規化し、projectPath 配下であることを確認

Layer 3: Docker環境
  - Docker volume のマウントポイントにより、コンテナ外へのアクセスは不可
```

### 7.2 ログの機密情報排除

```typescript
// OK: パスと件数のみ記録
logger.info('Parsed env file', {
  projectId,
  path: filePath,
  variableCount: Object.keys(result.variables).length,
});

// NG: 値を記録してはいけない
logger.info('Parsed env file', {
  variables: result.variables,  // 機密情報が含まれる可能性
});
```

---

## 8. エラーハンドリング

| エラーケース | HTTPステータス | エラーメッセージ |
|---|---|---|
| プロジェクト未検出 | 404 | プロジェクトが見つかりません |
| パストラバーサル検出 | 400 | パストラバーサルが検出されました |
| ファイル未検出 | 404 | ファイルが見つかりません |
| ファイルサイズ超過 | 413 | ファイルサイズが1MBを超えています |
| path パラメータ未指定 | 400 | path は必須です |
| Docker volume アクセスエラー | 500 | Docker環境のファイルにアクセスできません |
| .envファイルが1件も見つからない | 200 | `{ files: [] }` (空配列、エラーではない) |

---

## 9. テスト設計

### 9.1 DotenvParser のテスト

**テストファイル:** `src/services/__tests__/dotenv-parser.test.ts`

```typescript
describe('parseDotenv', () => {
  it('KEY=VALUE をパースする', () => { ... });
  it('ダブルクォートの値をパースする', () => { ... });
  it('シングルクォートの値をパースする', () => { ... });
  it('export プレフィックスを除去する', () => { ... });
  it('コメント行をスキップする', () => { ... });
  it('空行をスキップする', () => { ... });
  it('値に = を含む行をパースする', () => { ... });
  it('インラインコメントを除去する（クォートなし）', () => { ... });
  it('クォート内の # はコメントとして扱わない', () => { ... });
  it('= のない行をエラーとして報告する', () => { ... });
  it('空キーをエラーとして報告する', () => { ... });
  it('複合的な.envファイルを正しくパースする', () => { ... });
});
```

### 9.2 EnvFileService のテスト

**テストファイル:** `src/services/__tests__/env-file-service.test.ts`

```typescript
describe('EnvFileService', () => {
  describe('validatePath', () => {
    it('正当な相対パスを許可する', () => { ... });
    it('../ を含むパスを拒否する', () => { ... });
    it('絶対パスを拒否する', () => { ... });
  });

  describe('listEnvFiles (host)', () => {
    it('.env* ファイルを検出する', () => { ... });
    it('node_modules 内のファイルを除外する', () => { ... });
  });

  describe('readEnvFile (host)', () => {
    it('ファイル内容を読み込む', () => { ... });
    it('1MBを超えるファイルを拒否する', () => { ... });
    it('パストラバーサルを拒否する', () => { ... });
  });
});
```

### 9.3 API Route のテスト

**テストファイル:**
- `src/app/api/projects/[project_id]/env-files/__tests__/route.test.ts`
- `src/app/api/projects/[project_id]/env-files/parse/__tests__/route.test.ts`

### 9.4 フロントエンドコンポーネントのテスト

**テストファイル:** `src/components/claude-options/__tests__/EnvVarImportSection.test.tsx`

```typescript
describe('EnvVarImportSection', () => {
  it('インポートボタンが表示される', () => { ... });
  it('ボタンクリックでファイル一覧を取得する', () => { ... });
  it('ファイル選択でパース結果をプレビュー表示する', () => { ... });
  it('重複キーがある場合に警告を表示する', () => { ... });
  it('インポートで onImport コールバックが呼ばれる', () => { ... });
  it('disabled 時はボタンが無効化される', () => { ... });
  it('ファイルが見つからない場合にメッセージを表示する', () => { ... });
});
```

---

## 10. 影響ファイル一覧

### 10.1 新規ファイル

| ファイル | 内容 |
|---|---|
| `src/services/dotenv-parser.ts` | Dotenvパーサー（純粋関数） |
| `src/services/env-file-service.ts` | .envファイル検索・読み込みサービス |
| `src/services/__tests__/dotenv-parser.test.ts` | パーサーテスト |
| `src/services/__tests__/env-file-service.test.ts` | ファイルサービステスト |
| `src/app/api/projects/[project_id]/env-files/route.ts` | ファイル一覧API |
| `src/app/api/projects/[project_id]/env-files/parse/route.ts` | パースAPI |
| `src/app/api/projects/[project_id]/env-files/__tests__/route.test.ts` | API テスト |
| `src/app/api/projects/[project_id]/env-files/parse/__tests__/route.test.ts` | API テスト |
| `src/components/claude-options/EnvVarImportSection.tsx` | インポートUIコンポーネント |
| `src/components/claude-options/__tests__/EnvVarImportSection.test.tsx` | UIテスト |

### 10.2 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/components/claude-options/ClaudeOptionsForm.tsx` | `projectId` props追加、`EnvVarImportSection` の組み込み |
| `src/components/projects/ProjectSettingsModal.tsx` | `ClaudeOptionsForm` に `projectId` を渡す |
| `src/components/sessions/CreateSessionModal.tsx` | `ClaudeOptionsForm` に `projectId` を渡す（任意） |
