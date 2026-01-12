# ローカルGitリポジトリブラウザ - 設計書

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│                      フロントエンド                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           CreateSessionModal (拡張)                   │   │
│  │  ┌───────────────┬───────────────────────────────┐   │   │
│  │  │ SourceTypeTabs│  RemoteUrlForm / LocalRepoForm │   │   │
│  │  └───────────────┴───────────────────────────────┘   │   │
│  │                         │                             │   │
│  │              ┌──────────┴──────────┐                 │   │
│  │              │  DirectoryBrowser   │                 │   │
│  │              │  (ツリービュー)     │                 │   │
│  │              └─────────────────────┘                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      バックエンド                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FilesystemService                       │   │
│  │  - listDirectory(path): DirectoryEntry[]             │   │
│  │  - isGitRepository(path): boolean                    │   │
│  │  - getGitBranches(path): string[]                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ContainerManager (拡張)                  │   │
│  │  - createSessionWithLocalMount(localPath, ...)       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Docker                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Container                               │   │
│  │  /workspace ← bind mount ← /home/user/repos/myapp   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## コンポーネント設計

### 1. フロントエンドコンポーネント

#### 1.1 SourceTypeTabs

**役割**: リモートURL/ローカルリポジトリの切り替えUI

**Props**:
```typescript
interface SourceTypeTabsProps {
  value: 'remote' | 'local';
  onChange: (value: 'remote' | 'local') => void;
  disabled?: boolean;
}
```

**実装方針**:
- Headless UIのTabGroupを使用
- コンパクトなタブUIでモーダル内に収める

#### 1.2 DirectoryBrowser

**役割**: ディレクトリ一覧の表示とナビゲーション

**Props**:
```typescript
interface DirectoryBrowserProps {
  onSelect: (path: string) => void;
  onCancel: () => void;
}
```

**State**:
```typescript
interface DirectoryBrowserState {
  currentPath: string;
  entries: DirectoryEntry[];
  loading: boolean;
  error: string | null;
  selectedPath: string | null;
}
```

**実装方針**:
- ツリービュー形式で表示
- Gitリポジトリにはアイコン表示
- パンくずリストで現在位置を表示
- ダブルクリックでディレクトリ移動、シングルクリックで選択

#### 1.3 LocalRepoForm

**役割**: ローカルリポジトリ選択時のフォーム

**Props**:
```typescript
interface LocalRepoFormProps {
  onSubmit: (data: LocalSessionRequest) => Promise<void>;
  isSubmitting: boolean;
}
```

**実装方針**:
- セッション名入力
- リポジトリパス表示（Browse ボタンでDirectoryBrowserを開く）
- ブランチ選択（Gitリポジトリから自動取得）

---

### 2. API設計

#### 2.1 GET /api/filesystem/browse

**目的**: ディレクトリ内容の一覧取得

**リクエスト**:
```
GET /api/filesystem/browse?path=/home/user/projects
```

**パラメータ**:
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| path | string | No | 参照するディレクトリパス。省略時はホームディレクトリ |

**レスポンス**:
```typescript
interface BrowseResponse {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
}

interface DirectoryEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
  isGitRepository: boolean;
  isHidden: boolean;
}
```

**エラーレスポンス**:
| ステータス | 説明 |
|-----------|------|
| 400 | 不正なパス |
| 403 | アクセス禁止（ホームディレクトリ外） |
| 404 | ディレクトリが存在しない |

#### 2.2 GET /api/filesystem/branches

**目的**: Gitリポジトリのブランチ一覧取得

**リクエスト**:
```
GET /api/filesystem/branches?path=/home/user/projects/myapp
```

**レスポンス**:
```typescript
interface BranchesResponse {
  branches: string[];
  currentBranch: string;
}
```

---

### 3. サービス設計

#### 3.1 FilesystemService

**ファイル**: `src/services/filesystem-service.ts`

```typescript
interface FilesystemService {
  /**
   * ディレクトリ内容を一覧取得
   * @param path 参照するパス
   * @returns ディレクトリエントリ一覧
   * @throws AccessDeniedError ホームディレクトリ外へのアクセス
   * @throws NotFoundError ディレクトリが存在しない
   */
  listDirectory(path: string): Promise<DirectoryEntry[]>;

  /**
   * パスがGitリポジトリかどうかを判定
   * @param path 判定するパス
   * @returns Gitリポジトリの場合true
   */
  isGitRepository(path: string): Promise<boolean>;

  /**
   * Gitリポジトリのブランチ一覧を取得
   * @param path リポジトリのパス
   * @returns ブランチ名の配列
   */
  getGitBranches(path: string): Promise<string[]>;

  /**
   * 現在のブランチ名を取得
   * @param path リポジトリのパス
   * @returns 現在のブランチ名
   */
  getCurrentBranch(path: string): Promise<string>;

  /**
   * パスがアクセス可能かどうかを検証
   * @param path 検証するパス
   * @returns アクセス可能な場合true
   */
  isPathAllowed(path: string): boolean;
}
```

**セキュリティ実装**:
```typescript
isPathAllowed(path: string): boolean {
  const homedir = os.homedir();
  const resolvedPath = path.resolve(path);
  return resolvedPath.startsWith(homedir);
}
```

#### 3.2 ContainerManager拡張

**追加メソッド**:
```typescript
interface ContainerManager {
  // 既存メソッド...

  /**
   * ローカルディレクトリをマウントしてセッションを作成
   * @param sessionId セッションID
   * @param localPath ローカルリポジトリのパス
   * @param branch ブランチ名
   */
  createContainerWithLocalMount(
    sessionId: string,
    localPath: string,
    branch: string
  ): Promise<void>;
}
```

**Dockerマウント設定**:
```typescript
const containerConfig = {
  HostConfig: {
    Binds: [`${localPath}:/workspace:rw`],
    // 既存の設定を継承
  },
};
```

---

### 4. データモデル変更

#### 4.1 Session テーブル拡張

```prisma
model Session {
  id          String   @id @default(uuid())
  name        String
  containerId String?  @map("container_id")
  volumeName  String?  @map("volume_name")  // ローカルマウント時はnull
  repoUrl     String?  @map("repo_url")     // ローカルマウント時はnull
  localPath   String?  @map("local_path")   // 追加: ローカルリポジトリのパス
  branch      String
  status      String   @default("creating")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("sessions")
}
```

#### 4.2 CreateSessionRequest 拡張

```typescript
interface CreateDockerSessionRequest {
  name: string;
  sourceType: 'remote' | 'local';
  // リモートの場合
  repoUrl?: string;
  // ローカルの場合
  localPath?: string;
  // 共通
  branch: string;
}
```

---

## セキュリティ考慮事項

### 1. パストラバーサル防止

```typescript
function validatePath(requestedPath: string): string {
  const homedir = os.homedir();
  const normalized = path.normalize(requestedPath);
  const resolved = path.resolve(normalized);

  if (!resolved.startsWith(homedir)) {
    throw new AccessDeniedError('Access denied: path outside home directory');
  }

  return resolved;
}
```

### 2. シンボリックリンク処理

```typescript
async function resolveSymlink(filePath: string): Promise<string> {
  const stats = await fs.lstat(filePath);
  if (stats.isSymbolicLink()) {
    const realPath = await fs.realpath(filePath);
    // 実際のパスも検証
    validatePath(realPath);
    return realPath;
  }
  return filePath;
}
```

### 3. 入力バリデーション

- パスに null バイトが含まれていないことを確認
- パスの長さ制限（4096文字）
- 許可された文字のみ（英数字、スラッシュ、ハイフン、アンダースコア、ドット）

---

## 技術的決定事項

| 決定事項 | 選択 | 理由 |
|---------|------|------|
| ファイルブラウザUI | サーバー側API + ツリービュー | ブラウザからファイルシステムに直接アクセスできないため |
| マウント方式 | ボリュームマウント（bind mount） | リアルタイム同期が必要、パフォーマンス最適 |
| ブランチ取得 | git コマンド実行 | simple-git ライブラリまたは child_process |
| 状態管理 | コンポーネントローカル state | 複雑な状態共有が不要 |

---

## テスト戦略

### ユニットテスト

1. **FilesystemService**
   - `listDirectory`: 正常系、権限エラー、存在しないパス
   - `isGitRepository`: Gitリポジトリ、非Gitディレクトリ
   - `isPathAllowed`: ホームディレクトリ内外のパス

2. **API Routes**
   - `/api/filesystem/browse`: パラメータバリデーション、エラーハンドリング
   - `/api/filesystem/branches`: Gitリポジトリ以外でのエラー

### E2Eテスト

1. ローカルリポジトリ選択フロー
2. セッション作成（ローカルマウント）
3. ディレクトリナビゲーション
