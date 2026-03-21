# タスク計画書: .envファイルインポート機能

## 概要

プロジェクト設定画面のカスタム環境変数エディタに、リポジトリ内の.envファイルからインポートする機能を追加する実装タスク計画。

- 要件定義書: `docs/sdd/requirements/dotenv-import.md`
- 技術設計書: `docs/sdd/design/dotenv-import.md`
- 対象ブランチ: `feat/dotenv-import`

## タスク一覧

| ID | タスク名 | ステータス | 依存 |
|---|---|---|---|
| TASK-001 | Dotenvパーサーサービスの実装 | TODO | なし |
| TASK-002 | EnvFileServiceの実装（ホスト環境） | TODO | TASK-001 |
| TASK-003 | EnvFileServiceの実装（Docker環境） | TODO | TASK-002 |
| TASK-004 | API: .envファイル一覧取得エンドポイント | TODO | TASK-002 |
| TASK-005 | API: .envファイルパースエンドポイント | TODO | TASK-001, TASK-002 |
| TASK-006 | フロントエンド: EnvVarImportSectionコンポーネント | TODO | TASK-004, TASK-005 |
| TASK-007 | フロントエンド: ClaudeOptionsFormへの統合 | TODO | TASK-006 |
| TASK-008 | 結合テスト・既存テストの修正 | TODO | TASK-007 |

## フェーズ構成

```
Phase A: バックエンド・サービス層 (TASK-001 ~ 003)
Phase B: API エンドポイント (TASK-004 ~ 005)
Phase C: フロントエンド (TASK-006 ~ 007)
Phase D: 結合テスト (TASK-008)
```

---

## Phase A: バックエンド・サービス層

### TASK-001: Dotenvパーサーサービスの実装

**ステータス**: TODO

**説明**

.envフォーマットのテキストをkey-valueオブジェクトに変換する純粋関数 `parseDotenv()` を実装する。
副作用がなくテスト容易性が高いため、最初に実装する。

**依存タスク**: なし

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/services/dotenv-parser.ts` | 新規 |
| `src/services/__tests__/dotenv-parser.test.ts` | 新規 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/services/__tests__/dotenv-parser.test.ts (新規)
import { describe, it, expect } from 'vitest';
import { parseDotenv } from '../dotenv-parser';

describe('parseDotenv', () => {
  describe('基本的なパース', () => {
    it('KEY=VALUE 形式をパースする', () => {
      const result = parseDotenv('DATABASE_URL=postgresql://localhost:5432/mydb');
      expect(result.variables).toEqual({ DATABASE_URL: 'postgresql://localhost:5432/mydb' });
      expect(result.errors).toHaveLength(0);
    });

    it('複数行をパースする', () => {
      const content = 'KEY1=value1\nKEY2=value2\nKEY3=value3';
      const result = parseDotenv(content);
      expect(result.variables).toEqual({
        KEY1: 'value1',
        KEY2: 'value2',
        KEY3: 'value3',
      });
    });

    it('値に = を含む行は最初の = で分割する', () => {
      const result = parseDotenv('CONNECTION=host=localhost;port=5432');
      expect(result.variables).toEqual({ CONNECTION: 'host=localhost;port=5432' });
    });
  });

  describe('クォート処理', () => {
    it('ダブルクォートの値のクォートを除去する', () => {
      const result = parseDotenv('KEY="hello world"');
      expect(result.variables).toEqual({ KEY: 'hello world' });
    });

    it('シングルクォートの値のクォートを除去する', () => {
      const result = parseDotenv("KEY='hello world'");
      expect(result.variables).toEqual({ KEY: 'hello world' });
    });

    it('クォート内の # はコメントとして扱わない', () => {
      const result = parseDotenv('KEY="value # with hash"');
      expect(result.variables).toEqual({ KEY: 'value # with hash' });
    });
  });

  describe('コメントと空行', () => {
    it('# で始まる行をスキップする', () => {
      const content = '# comment\nKEY=value';
      const result = parseDotenv(content);
      expect(result.variables).toEqual({ KEY: 'value' });
    });

    it('空行をスキップする', () => {
      const content = 'KEY1=value1\n\n\nKEY2=value2';
      const result = parseDotenv(content);
      expect(result.variables).toEqual({ KEY1: 'value1', KEY2: 'value2' });
    });

    it('インラインコメントを除去する（クォートなし）', () => {
      const result = parseDotenv('KEY=value # this is a comment');
      expect(result.variables).toEqual({ KEY: 'value' });
    });
  });

  describe('export プレフィックス', () => {
    it('export KEY=VALUE 形式をパースする', () => {
      const result = parseDotenv('export API_KEY=sk-12345');
      expect(result.variables).toEqual({ API_KEY: 'sk-12345' });
    });
  });

  describe('空白の処理', () => {
    it('キーの前後の空白をトリムする', () => {
      const result = parseDotenv('  KEY  =value');
      expect(result.variables).toEqual({ KEY: 'value' });
    });

    it('値の前後の空白をトリムする', () => {
      const result = parseDotenv('KEY=  value  ');
      expect(result.variables).toEqual({ KEY: 'value' });
    });

    it('先頭空白のあるコメント行をスキップする', () => {
      const result = parseDotenv('  # comment\nKEY=value');
      expect(result.variables).toEqual({ KEY: 'value' });
    });
  });

  describe('エラーハンドリング', () => {
    it('= のない非空行をエラーとして報告する', () => {
      const result = parseDotenv('INVALID_LINE\nKEY=value');
      expect(result.variables).toEqual({ KEY: 'value' });
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Line 1');
    });

    it('空キーをエラーとして報告する', () => {
      const result = parseDotenv('=value');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('キーが空');
    });
  });

  describe('Windows改行コード', () => {
    it('\\r\\n で区切られた行をパースする', () => {
      const content = 'KEY1=value1\r\nKEY2=value2';
      const result = parseDotenv(content);
      expect(result.variables).toEqual({ KEY1: 'value1', KEY2: 'value2' });
    });
  });

  describe('複合テスト', () => {
    it('一般的な.envファイルを正しくパースする', () => {
      const content = [
        '# Database settings',
        'DATABASE_URL=postgresql://localhost:5432/mydb',
        '',
        '# API Keys',
        'export API_KEY="sk-12345"',
        "SECRET='my-secret-value'",
        '',
        'DEBUG=true # enable debug mode',
        'EMPTY_VALUE=',
      ].join('\n');

      const result = parseDotenv(content);
      expect(result.variables).toEqual({
        DATABASE_URL: 'postgresql://localhost:5432/mydb',
        API_KEY: 'sk-12345',
        SECRET: 'my-secret-value',
        DEBUG: 'true',
        EMPTY_VALUE: '',
      });
      expect(result.errors).toHaveLength(0);
    });
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/services/__tests__/dotenv-parser.test.ts
```

3. 実装内容

`src/services/dotenv-parser.ts` を新規作成:
- `DotenvParseResult` インターフェースをエクスポート
- `parseDotenv(content: string): DotenvParseResult` 関数をエクスポート
- 技術設計書セクション2.3のアルゴリズムに従って実装

4. テスト再実行と確認

```bash
npx vitest run src/services/__tests__/dotenv-parser.test.ts
```

**受入基準**

- 全テストケースがパスする
- `parseDotenv` が純粋関数として実装されている（副作用なし）
- TypeScript 型エラーがない

**コミットメッセージ案**

```
feat: .envパーサーサービスを追加

dotenvフォーマットのテキストをkey-valueオブジェクトに変換する
parseDotenv()関数を実装。KEY=VALUE、クォート、export、
コメント、インラインコメントに対応。

関連: docs/sdd/tasks/dotenv-import.md TASK-001
```

---

### TASK-002: EnvFileServiceの実装（ホスト環境）

**ステータス**: TODO

**説明**

ホストファイルシステム上のプロジェクトディレクトリ内で.envファイルを検索・読み込むサービスを実装する。
パストラバーサル防止のバリデーションも含む。

**依存タスク**: TASK-001

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/services/env-file-service.ts` | 新規 |
| `src/services/__tests__/env-file-service.test.ts` | 新規 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/services/__tests__/env-file-service.test.ts (新規)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnvFileService } from '../env-file-service';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('EnvFileService', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'env-file-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('validatePath', () => {
    it('正当な相対パスを許可する', () => {
      expect(() => EnvFileService.validatePath('/project', '.env')).not.toThrow();
      expect(() => EnvFileService.validatePath('/project', '.env.local')).not.toThrow();
      expect(() => EnvFileService.validatePath('/project', 'config/.env')).not.toThrow();
    });

    it('../ を含むパスを拒否する', () => {
      expect(() => EnvFileService.validatePath('/project', '../.env')).toThrow();
      expect(() => EnvFileService.validatePath('/project', 'sub/../../.env')).toThrow();
    });

    it('絶対パスを拒否する', () => {
      expect(() => EnvFileService.validatePath('/project', '/etc/passwd')).toThrow();
    });
  });

  describe('listEnvFiles (host)', () => {
    it('.env* ファイルを検出する', async () => {
      await fs.writeFile(path.join(tmpDir, '.env'), 'KEY=value');
      await fs.writeFile(path.join(tmpDir, '.env.local'), 'KEY=value');
      await fs.writeFile(path.join(tmpDir, '.env.production'), 'KEY=value');

      const files = await EnvFileService.listEnvFiles(tmpDir, 'host');
      expect(files).toContain('.env');
      expect(files).toContain('.env.local');
      expect(files).toContain('.env.production');
    });

    it('node_modules 内のファイルを除外する', async () => {
      await fs.mkdir(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.env'), 'KEY=value');
      await fs.writeFile(path.join(tmpDir, 'node_modules', 'pkg', '.env'), 'KEY=value');

      const files = await EnvFileService.listEnvFiles(tmpDir, 'host');
      expect(files).toContain('.env');
      expect(files).not.toContain('node_modules/pkg/.env');
    });

    it('ファイルが見つからない場合は空配列を返す', async () => {
      const files = await EnvFileService.listEnvFiles(tmpDir, 'host');
      expect(files).toEqual([]);
    });

    it('サブディレクトリの.envファイルも検出する', async () => {
      await fs.mkdir(path.join(tmpDir, 'config'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'config', '.env.test'), 'KEY=value');

      const files = await EnvFileService.listEnvFiles(tmpDir, 'host');
      expect(files).toContain('config/.env.test');
    });
  });

  describe('readEnvFile (host)', () => {
    it('ファイル内容を読み込む', async () => {
      await fs.writeFile(path.join(tmpDir, '.env'), 'KEY=value');
      const content = await EnvFileService.readEnvFile(tmpDir, '.env', 'host');
      expect(content).toBe('KEY=value');
    });

    it('パストラバーサルを拒否する', async () => {
      await expect(
        EnvFileService.readEnvFile(tmpDir, '../.env', 'host')
      ).rejects.toThrow();
    });

    it('存在しないファイルでエラーをスローする', async () => {
      await expect(
        EnvFileService.readEnvFile(tmpDir, '.env.nonexistent', 'host')
      ).rejects.toThrow();
    });
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/services/__tests__/env-file-service.test.ts
```

3. 実装内容

`src/services/env-file-service.ts` を新規作成:
- `EnvFileService` クラスをエクスポート
- `validatePath()`: パストラバーサル検証（技術設計書 3.4）
- `listEnvFiles()`: clone_location に応じた分岐、ホスト環境はglob使用（技術設計書 3.2）
- `readEnvFile()`: clone_location に応じた分岐、ホスト環境はfs.readFile使用（技術設計書 3.5）

4. テスト再実行と確認

```bash
npx vitest run src/services/__tests__/env-file-service.test.ts
```

**受入基準**

- パストラバーサル防止が正しく動作する
- ホスト環境でのファイル検索・読み込みが正しく動作する
- 除外ディレクトリが適切にスキップされる
- 全テストケースがパスする

**コミットメッセージ案**

```
feat: EnvFileService（ホスト環境）を追加

.envファイルの検索・読み込みサービスを実装。
パストラバーサル防止、除外ディレクトリのスキップ、
ファイルサイズ制限（1MB）に対応。

関連: docs/sdd/tasks/dotenv-import.md TASK-002
```

---

### TASK-003: EnvFileServiceの実装（Docker環境）

**ステータス**: TODO

**説明**

Docker volume内のプロジェクトに対する.envファイル検索・読み込みを実装する。
`docker run` コマンドを使用してコンテナ内のファイルにアクセスする。

**依存タスク**: TASK-002

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/services/env-file-service.ts` | 変更 |
| `src/services/__tests__/env-file-service.test.ts` | 変更 |

**TDD手順**

1. テストケース追加

```typescript
// src/services/__tests__/env-file-service.test.ts に追加
import { vi } from 'vitest';

describe('EnvFileService (docker)', () => {
  describe('listEnvFiles (docker)', () => {
    it('docker run + find でファイル一覧を取得する', async () => {
      // child_process.execFile をモック
      const mockExecFile = vi.fn().mockResolvedValue({
        stdout: '/workspace/.env\n/workspace/.env.local\n',
      });
      // モック注入後にテスト
      const files = await EnvFileService.listEnvFiles('/project', 'docker');
      expect(files).toContain('.env');
      expect(files).toContain('.env.local');
    });
  });

  describe('readEnvFile (docker)', () => {
    it('docker run + cat でファイル内容を取得する', async () => {
      const mockExecFile = vi.fn().mockResolvedValue({
        stdout: 'KEY=value\nKEY2=value2',
      });
      const content = await EnvFileService.readEnvFile('/project', '.env', 'docker');
      expect(content).toBe('KEY=value\nKEY2=value2');
    });

    it('パストラバーサルを拒否する', async () => {
      await expect(
        EnvFileService.readEnvFile('/project', '../.env', 'docker')
      ).rejects.toThrow();
    });
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/services/__tests__/env-file-service.test.ts
```

3. 実装内容

`src/services/env-file-service.ts` に Docker 環境用のメソッドを追加:
- `listEnvFilesDocker()`: `docker run` + `find` でファイル検索（技術設計書 3.3）
- `readEnvFileDocker()`: `docker run` + `cat` でファイル読み込み（技術設計書 3.5）
- プロジェクトの `docker_volume_name` を使用してvolumeをマウント

4. テスト再実行と確認

```bash
npx vitest run src/services/__tests__/env-file-service.test.ts
```

**受入基準**

- Docker環境でのファイル検索・読み込みが正しく動作する（モックテスト）
- Docker環境でもパストラバーサル防止が動作する
- 全テストケースがパスする

**コミットメッセージ案**

```
feat: EnvFileServiceにDocker環境サポートを追加

Docker volume内の.envファイル検索・読み込みを実装。
docker run + find/cat コマンドでコンテナ内ファイルにアクセス。

関連: docs/sdd/tasks/dotenv-import.md TASK-003
```

---

## Phase B: APIエンドポイント

### TASK-004: API: .envファイル一覧取得エンドポイント

**ステータス**: TODO

**説明**

`GET /api/projects/:id/env-files` エンドポイントを実装する。
プロジェクトのリポジトリ内にある.envファイルのパスリストを返す。

**依存タスク**: TASK-002

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/app/api/projects/[project_id]/env-files/route.ts` | 新規 |
| `src/app/api/projects/[project_id]/env-files/__tests__/route.test.ts` | 新規 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/app/api/projects/[project_id]/env-files/__tests__/route.test.ts (新規)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// db モック
vi.mock('@/lib/db', () => ({ ... }));
// EnvFileService モック
vi.mock('@/services/env-file-service', () => ({ ... }));

describe('GET /api/projects/:id/env-files', () => {
  it('プロジェクト内の.envファイル一覧を返す', async () => {
    // モック: プロジェクト存在、EnvFileService がファイルリストを返す
    const response = await GET(request, { params: Promise.resolve({ project_id: 'proj-1' }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.files).toEqual(['.env', '.env.local']);
  });

  it('プロジェクトが存在しない場合は404を返す', async () => {
    // モック: プロジェクト未検出
    const response = await GET(request, { params: Promise.resolve({ project_id: 'nonexistent' }) });
    expect(response.status).toBe(404);
  });

  it('ファイルが見つからない場合は空配列を返す', async () => {
    // モック: EnvFileService が空配列を返す
    const response = await GET(request, { params: Promise.resolve({ project_id: 'proj-1' }) });
    const data = await response.json();
    expect(data.files).toEqual([]);
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/app/api/projects/[project_id]/env-files/__tests__/route.test.ts
```

3. 実装内容

`src/app/api/projects/[project_id]/env-files/route.ts` を新規作成:
- プロジェクト取得（DB参照）
- `EnvFileService.listEnvFiles()` 呼び出し
- 結果を `{ files: string[] }` 形式で返却
- 技術設計書セクション4.1の実装フローに従う

4. テスト再実行と確認

```bash
npx vitest run src/app/api/projects/[project_id]/env-files/__tests__/route.test.ts
```

**受入基準**

- 200レスポンスでファイル一覧が返る
- 存在しないプロジェクトで404が返る
- ファイル未検出時に空配列が返る
- 全テストケースがパスする

**コミットメッセージ案**

```
feat: GET /api/projects/:id/env-files エンドポイントを追加

プロジェクトリポジトリ内の.envファイル一覧を返すAPIを実装。
ホスト/Docker環境に対応。

関連: docs/sdd/tasks/dotenv-import.md TASK-004
```

---

### TASK-005: API: .envファイルパースエンドポイント

**ステータス**: TODO

**説明**

`POST /api/projects/:id/env-files/parse` エンドポイントを実装する。
指定されたファイルを読み込み、パースして結果を返す。

**依存タスク**: TASK-001, TASK-002

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/app/api/projects/[project_id]/env-files/parse/route.ts` | 新規 |
| `src/app/api/projects/[project_id]/env-files/parse/__tests__/route.test.ts` | 新規 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/app/api/projects/[project_id]/env-files/parse/__tests__/route.test.ts (新規)
import { describe, it, expect, vi } from 'vitest';
import { POST } from '../route';

describe('POST /api/projects/:id/env-files/parse', () => {
  it('ファイルをパースして結果を返す', async () => {
    // モック: ファイル読み込み成功
    const response = await POST(request, { params: Promise.resolve({ project_id: 'proj-1' }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.variables).toBeDefined();
    expect(data.errors).toBeDefined();
  });

  it('path が未指定の場合は400を返す', async () => {
    // リクエストボディに path なし
    const response = await POST(request, { params: Promise.resolve({ project_id: 'proj-1' }) });
    expect(response.status).toBe(400);
  });

  it('パストラバーサルを検出した場合は400を返す', async () => {
    // path に '../' を含むリクエスト
    const response = await POST(request, { params: Promise.resolve({ project_id: 'proj-1' }) });
    expect(response.status).toBe(400);
  });

  it('ファイルが存在しない場合は404を返す', async () => {
    // モック: ファイル未検出
    const response = await POST(request, { params: Promise.resolve({ project_id: 'proj-1' }) });
    expect(response.status).toBe(404);
  });

  it('ファイルサイズ超過時は413を返す', async () => {
    // モック: 1MB超過エラー
    const response = await POST(request, { params: Promise.resolve({ project_id: 'proj-1' }) });
    expect(response.status).toBe(413);
  });

  it('.envファイルの値をログに記録しない', async () => {
    // logger.info の呼び出しを検証
    // variables の値が含まれないことを確認
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/app/api/projects/[project_id]/env-files/parse/__tests__/route.test.ts
```

3. 実装内容

`src/app/api/projects/[project_id]/env-files/parse/route.ts` を新規作成:
- リクエストボディの `path` バリデーション
- プロジェクト取得
- `EnvFileService.validatePath()` でパストラバーサルチェック
- `EnvFileService.readEnvFile()` でファイル読み込み
- `parseDotenv()` でパース
- ログには変数の件数のみ記録（値は記録しない）
- 技術設計書セクション4.2の実装フローに従う

4. テスト再実行と確認

```bash
npx vitest run src/app/api/projects/[project_id]/env-files/parse/__tests__/route.test.ts
```

**受入基準**

- パースAPIが正常に動作する
- パストラバーサルが適切に拒否される
- ファイルサイズ制限が動作する
- ログに機密情報が含まれない
- 全テストケースがパスする

**コミットメッセージ案**

```
feat: POST /api/projects/:id/env-files/parse エンドポイントを追加

.envファイルを読み込みパースするAPIを実装。
パストラバーサル防止、ファイルサイズ制限、
機密情報のログ非記録に対応。

関連: docs/sdd/tasks/dotenv-import.md TASK-005
```

---

## Phase C: フロントエンド

### TASK-006: フロントエンド: EnvVarImportSectionコンポーネント

**ステータス**: TODO

**説明**

.envファイルのインポートUI（ファイル選択、プレビュー、マージ確認）を実装する。
`ClaudeOptionsForm` に組み込むための独立コンポーネントとして作成する。

**依存タスク**: TASK-004, TASK-005

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/components/claude-options/EnvVarImportSection.tsx` | 新規 |
| `src/components/claude-options/__tests__/EnvVarImportSection.test.tsx` | 新規 |

**TDD手順**

1. テストファイルとテストケース

```typescript
// src/components/claude-options/__tests__/EnvVarImportSection.test.tsx (新規)
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EnvVarImportSection } from '../EnvVarImportSection';

// fetch モック
global.fetch = vi.fn();

describe('EnvVarImportSection', () => {
  const defaultProps = {
    projectId: 'proj-1',
    existingVars: {},
    onImport: vi.fn(),
    disabled: false,
  };

  it('「.envからインポート」ボタンが表示される', () => {
    render(<EnvVarImportSection {...defaultProps} />);
    expect(screen.getByText('.envからインポート')).toBeInTheDocument();
  });

  it('disabled 時はボタンが無効化される', () => {
    render(<EnvVarImportSection {...defaultProps} disabled={true} />);
    expect(screen.getByText('.envからインポート')).toBeDisabled();
  });

  it('ボタンクリックでファイル一覧APIを呼び出す', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: ['.env', '.env.local'] }),
    });

    render(<EnvVarImportSection {...defaultProps} />);
    fireEvent.click(screen.getByText('.envからインポート'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/proj-1/env-files')
      );
    });
  });

  it('ファイルが見つからない場合にメッセージを表示する', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: [] }),
    });

    render(<EnvVarImportSection {...defaultProps} />);
    fireEvent.click(screen.getByText('.envからインポート'));

    await waitFor(() => {
      expect(screen.getByText(/見つかりません/)).toBeInTheDocument();
    });
  });

  it('ファイル選択でパースAPIを呼び出す', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ files: ['.env'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ variables: { KEY: 'value' }, errors: [] }),
      });

    render(<EnvVarImportSection {...defaultProps} />);
    fireEvent.click(screen.getByText('.envからインポート'));

    await waitFor(() => {
      // ファイル選択UIが表示された後、ファイルを選択
    });
  });

  it('重複キーがある場合に警告を表示する', async () => {
    const props = {
      ...defaultProps,
      existingVars: { KEY: 'old-value' },
    };
    // パース結果に KEY が含まれる場合、上書き警告を表示
  });

  it('「インポート」クリックで onImport コールバックが呼ばれる', async () => {
    // インポートボタンクリック後に onImport が呼ばれることを検証
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/components/claude-options/__tests__/EnvVarImportSection.test.tsx
```

3. 実装内容

`src/components/claude-options/EnvVarImportSection.tsx` を新規作成:
- 技術設計書セクション5.2のインターフェースに従う
- 状態遷移: 初期 -> ファイル一覧取得中 -> ファイル選択 -> パース中 -> プレビュー -> マージ
- マージロジック: 技術設計書セクション5.4
- 重複キーの上書き確認UI

4. テスト再実行と確認

```bash
npx vitest run src/components/claude-options/__tests__/EnvVarImportSection.test.tsx
```

**受入基準**

- インポートボタンが表示される
- ファイル一覧取得・表示が動作する
- パース結果のプレビューが表示される
- 重複キーの警告が表示される
- マージが正しく動作する
- disabled状態が反映される

**コミットメッセージ案**

```
feat: EnvVarImportSectionコンポーネントを追加

.envファイルのインポートUI（ファイル選択、プレビュー、
マージ確認、重複キー警告）を実装。

関連: docs/sdd/tasks/dotenv-import.md TASK-006
```

---

### TASK-007: フロントエンド: ClaudeOptionsFormへの統合

**ステータス**: TODO

**説明**

`ClaudeOptionsForm` に `projectId` props を追加し、`EnvVarImportSection` を環境変数セクションに組み込む。
`ProjectSettingsModal` から `projectId` を渡す。

**依存タスク**: TASK-006

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| `src/components/claude-options/ClaudeOptionsForm.tsx` | 変更 |
| `src/components/projects/ProjectSettingsModal.tsx` | 変更 |
| `src/components/claude-options/__tests__/ClaudeOptionsForm.test.tsx` | 変更 |
| `src/components/projects/__tests__/ProjectSettingsModal.test.tsx` | 変更 |

**TDD手順**

1. テストケース追加

```typescript
// src/components/claude-options/__tests__/ClaudeOptionsForm.test.tsx に追加

describe('ClaudeOptionsForm - .envインポート', () => {
  it('projectId が渡された場合に EnvVarImportSection が表示される', () => {
    render(
      <ClaudeOptionsForm
        options={{}}
        envVars={{}}
        onOptionsChange={vi.fn()}
        onEnvVarsChange={vi.fn()}
        projectId="proj-1"
      />
    );
    expect(screen.getByText('.envからインポート')).toBeInTheDocument();
  });

  it('projectId が未指定の場合は EnvVarImportSection が表示されない', () => {
    render(
      <ClaudeOptionsForm
        options={{}}
        envVars={{}}
        onOptionsChange={vi.fn()}
        onEnvVarsChange={vi.fn()}
      />
    );
    expect(screen.queryByText('.envからインポート')).not.toBeInTheDocument();
  });
});
```

2. テスト実行コマンド

```bash
npx vitest run src/components/claude-options/__tests__/ClaudeOptionsForm.test.tsx
```

3. 実装内容

- `ClaudeOptionsFormProps` に `projectId?: string` を追加
- `projectId` が存在する場合のみ `EnvVarImportSection` を表示
- `onImport` コールバックで `onEnvVarsChange` を呼び出し、既存変数とマージ
- `ProjectSettingsModal` から `projectId` を渡す

4. テスト再実行と確認

```bash
npx vitest run src/components/claude-options/__tests__/ClaudeOptionsForm.test.tsx
npx vitest run src/components/projects/__tests__/ProjectSettingsModal.test.tsx
```

**受入基準**

- `projectId` 指定時にインポートUIが表示される
- `projectId` 未指定時にインポートUIが表示されない
- インポート結果が `onEnvVarsChange` に反映される
- 既存テストが壊れない

**コミットメッセージ案**

```
feat: ClaudeOptionsFormに.envインポート機能を統合

ClaudeOptionsFormにprojectId propsを追加し、
EnvVarImportSectionを環境変数セクションに組み込み。
ProjectSettingsModalからprojectIdを渡すよう変更。

関連: docs/sdd/tasks/dotenv-import.md TASK-007
```

---

## Phase D: 結合テスト

### TASK-008: 結合テスト・既存テストの修正

**ステータス**: TODO

**説明**

全体の結合テストを実施し、既存テストの修正が必要な場合は対応する。
E2Eテストの追加も検討する。

**依存タスク**: TASK-007

**対象ファイル**

| ファイル | 変更種別 |
|---|---|
| 既存テストファイル（必要に応じて） | 変更 |

**確認項目**

1. 全ユニットテストが通過する

```bash
npm test
```

2. ビルドが成功する

```bash
npm run build
```

3. lint が通過する

```bash
npm run lint
```

4. 手動テスト項目
   - プロジェクト設定画面でインポートボタンが表示される
   - .envファイル一覧が取得できる
   - ファイル選択でパース結果がプレビュー表示される
   - 重複キーの上書き確認が表示される
   - インポート後に保存できる
   - Docker環境のプロジェクトでもインポートが動作する

**受入基準**

- 全テストが通過する
- ビルドが成功する
- lint エラーがない
- 手動テストで主要フローが動作する

**コミットメッセージ案**

```
test: .envインポート機能の結合テストと既存テスト修正

全テストの通過確認、ビルド検証、lint修正を実施。

関連: docs/sdd/tasks/dotenv-import.md TASK-008
```
