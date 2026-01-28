# 設計書: Git操作・差分・PR連携

## 概要

Git操作（コミット履歴、差分表示、rebase、merge）およびPR作成・リンク機能の設計を定義します。

---

## コンポーネント

### バックエンド

#### コンポーネント: Git Operations

**目的**: Git操作の実行

**責務**:
- worktreeの作成・削除
- diff取得
- rebase実行
- squash & merge実行
- コミット履歴取得
- コミットへのリセット

**実装場所**: `src/services/git-service.ts`（Node.js child_process使用）

---

## API設計

### Git操作

#### GET /api/sessions/{id}/diff
**目的**: mainブランチとの差分取得

**レスポンス（200）**:
```json
{
  "diff": {
    "files": [
      {
        "path": "src/auth.ts",
        "status": "modified",
        "additions": 45,
        "deletions": 12,
        "hunks": [
          {
            "old_start": 10,
            "old_lines": 5,
            "new_start": 10,
            "new_lines": 8,
            "content": "@@ -10,5 +10,8 @@\n-old line\n+new line"
          }
        ]
      }
    ],
    "totalAdditions": 45,
    "totalDeletions": 12
  }
}
```

#### GET /api/sessions/{id}/commits
**目的**: コミット履歴取得

**レスポンス（200）**:
```json
{
  "commits": [
    {
      "hash": "abc123",
      "short_hash": "abc123",
      "message": "Add authentication",
      "author": "Claude",
      "date": "2025-12-08T10:05:00Z",
      "files_changed": 3
    }
  ]
}
```

#### POST /api/sessions/{id}/rebase
**目的**: mainからのrebase

**レスポンス（200）**:
```json
{
  "success": true
}
```

**レスポンス（409）**:
```json
{
  "success": false,
  "conflicts": ["src/auth.ts"]
}
```

#### POST /api/sessions/{id}/reset
**目的**: 特定コミットへのリセット

**注意**: このエンドポイントは未実装です。

**リクエスト**:
```json
{
  "commit_hash": "abc123"
}
```

#### POST /api/sessions/{id}/merge
**目的**: mainへのsquash merge

**リクエスト**:
```json
{
  "commit_message": "feat: Add user authentication",
  "delete_worktree": true
}
```

**レスポンス（200）**:
```json
{
  "success": true
}
```

**レスポンス（409）**:
```json
{
  "success": false,
  "conflicts": ["src/auth.ts", "src/utils.ts"]
}
```

### PR操作

#### POST /api/sessions/{id}/pr
**目的**: PR作成

**リクエスト**:
```json
{
  "title": "feat: Add new feature",
  "body": "## Description\n..."
}
```

**レスポンス（201）**:
```json
{
  "pr": {
    "url": "https://github.com/owner/repo/pull/123",
    "number": 123,
    "status": "open"
  }
}
```

**レスポンス（503）** - gh CLI未インストール時:
```json
{
  "error": "GitHub CLI (gh) is not installed or not in PATH"
}
```

#### GET /api/sessions/{id}/pr
**目的**: PRステータス取得

**レスポンス（200）**:
```json
{
  "pr": {
    "url": "https://github.com/owner/repo/pull/123",
    "number": 123,
    "status": "merged",
    "title": "feat: Add new feature"
  }
}
```

---

## 実装詳細

### PR APIエンドポイント

**実装場所**: `src/app/api/sessions/[id]/pr/route.ts`

```typescript
import { spawn } from 'child_process';
import { execSync } from 'child_process';

// gh CLI の利用可能性を事前チェック
function checkGhAvailable(): boolean {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // gh CLI の事前チェック
  if (!checkGhAvailable()) {
    return NextResponse.json(
      { error: 'GitHub CLI (gh) is not installed or not in PATH' },
      { status: 503 }
    );
  }

  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: { project: true },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { title, body } = await request.json();

  try {
    // gh CLI でPR作成（spawn を使用してコマンドインジェクションを防止）
    const stdout = await new Promise<string>((resolve, reject) => {
      const args = [
        'pr', 'create',
        '--title', title,
        '--body', body,
        '--head', session.branch_name
      ];

      const proc = spawn('gh', args, {
        cwd: session.worktree_path,
        timeout: 30000,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { errorOutput += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`gh pr create failed: ${errorOutput}`));
        }
      });

      proc.on('error', reject);
    });

    // PRのURLを抽出
    const prUrlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
    const prNumberMatch = stdout.match(/pull\/(\d+)/);

    if (!prUrlMatch) {
      throw new Error('Failed to parse PR URL from gh output');
    }

    const prUrl = prUrlMatch[0];
    const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : null;

    // セッションにPR情報を保存
    await prisma.session.update({
      where: { id: params.id },
      data: {
        pr_url: prUrl,
        pr_number: prNumber,
        pr_status: 'open',
        pr_updated_at: new Date(),
      },
    });

    return NextResponse.json({
      pr: { url: prUrl, number: prNumber, status: 'open' },
    }, { status: 201 });
  } catch (error) {
    throw error;
  }
}
```

### PRSection コンポーネント

**実装場所**: `src/components/sessions/PRSection.tsx`

```typescript
interface PRSectionProps {
  sessionId: string;
  branchName: string;
}

export function PRSection({ sessionId, branchName }: PRSectionProps) {
  const [pr, setPR] = useState<PR | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [ghAvailable, setGhAvailable] = useState(true);

  // PR存在時: リンクとステータス表示
  // PR未作成時: 作成ボタン

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      {pr ? (
        <>
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 hover:underline"
          >
            <GitPullRequest className="w-4 h-4" />
            PR #{pr.number}
            <ExternalLink className="w-3 h-3" />
          </a>
          <PRStatusBadge status={pr.status} />
        </>
      ) : (
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          disabled={!ghAvailable}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          title={ghAvailable ? 'PRを作成' : 'gh CLIが利用できません'}
        >
          <GitPullRequest className="w-4 h-4" />
          PRを作成
        </button>
      )}
    </div>
  );
}

function PRStatusBadge({ status }: { status: string }) {
  const styles = {
    open: 'bg-green-100 text-green-800',
    merged: 'bg-purple-100 text-purple-800',
    closed: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${styles[status] || ''}`}>
      {status.toUpperCase()}
    </span>
  );
}
```

---

## データベーススキーマ（追加フィールド）

### テーブル: sessions（PR関連フィールド）

| カラム | 型 | 制約 | 説明 |
|--------|------|------|------|
| pr_url | TEXT | NULLABLE | GitHub PR URL |
| pr_number | INTEGER | NULLABLE | PR番号 |
| pr_status | TEXT | NULLABLE | open, merged, closed |
| pr_updated_at | DateTime | NULLABLE | PRステータス最終確認日時 |

---

## エラー処理

### Git操作

- rebase失敗時はコンフリクトファイルを通知
- merge失敗時はロールバック
- worktree作成失敗時は詳細なエラーメッセージを返却

### PR操作

- gh CLIが利用できない場合は503エラーを返却
- PR作成失敗時はエラーメッセージを表示
- PRステータス取得失敗時はキャッシュされた値を返却
