# タスク管理書: 実行環境（Execution Environments）機能

## 概要

実行環境機能の実装タスクを管理する。各タスクはTDD方式で進め、テストを先に書いてから実装する。

## タスク一覧

### Phase 1: データモデルとサービス層

#### TASK-EE-001: Prismaスキーマに ExecutionEnvironment モデルを追加

**状態**: `DONE`
**完了サマリー**: ExecutionEnvironmentモデルとSessionへのenvironment_idフィールドを追加。prisma db push完了。
**優先度**: P0
**見積もり**: 20分
**関連要件**: REQ-EE001, REQ-EE004, REQ-EE020

**受入基準**:
- [ ] ExecutionEnvironmentモデルがスキーマに定義されている
- [ ] Sessionモデルにenvironment_idフィールドが追加されている
- [ ] ExecutionEnvironmentとSessionのリレーションが定義されている
- [ ] `npx prisma db push`が成功する
- [ ] `npx prisma generate`が成功する

**実装指示**:
1. `prisma/schema.prisma`を編集
2. ExecutionEnvironmentモデルを追加:
   - id: String @id @default(uuid())
   - name: String
   - type: String（'HOST' | 'DOCKER' | 'SSH'）
   - description: String?
   - config: String（JSON形式）
   - auth_dir_path: String?
   - is_default: Boolean @default(false)
   - created_at: DateTime @default(now())
   - updated_at: DateTime @updatedAt
   - sessions: Session[] リレーション
3. Sessionモデルを変更:
   - environment_id: String? を追加
   - environment: ExecutionEnvironment? リレーションを追加（onDelete: SetNull）
4. `npx prisma db push`を実行
5. `npx prisma generate`を実行

**TDD手順**:
1. このタスクはスキーマ変更のみのため、テストは次タスクで実施

---

#### TASK-EE-002: EnvironmentService の基本実装

**状態**: `DONE`
**完了サマリー**: EnvironmentServiceクラスを実装。CRUD操作、getDefault、ensureDefaultExistsを含む。26テストパス。
**優先度**: P0
**見積もり**: 40分
**依存**: TASK-EE-001
**関連要件**: REQ-EE008, REQ-EE009, REQ-EE010, REQ-EE011, REQ-EE012

**受入基準**:
- [ ] EnvironmentServiceクラスが実装されている
- [ ] CRUD操作（create, findById, findAll, update, delete）が動作する
- [ ] getDefault()でデフォルト環境を取得できる
- [ ] ensureDefaultExists()でデフォルトHOST環境が作成される
- [ ] HOST環境は削除できない（エラーをスロー）
- [ ] 使用中セッションがある環境の削除は警告を返す
- [ ] ユニットテストが通過する

**TDD手順**:
1. テストファイル作成: `src/services/__tests__/environment-service.test.ts`
2. 以下のテストケースを先に書く:
   - describe('create')
     - it('should create HOST environment')
     - it('should create DOCKER environment with auth_dir_path')
     - it('should reject invalid environment type')
   - describe('findById')
     - it('should return environment by id')
     - it('should return null for non-existent id')
   - describe('findAll')
     - it('should return all environments')
   - describe('update')
     - it('should update environment name and description')
     - it('should not allow changing type')
   - describe('delete')
     - it('should delete environment')
     - it('should throw error when deleting default environment')
     - it('should warn when sessions are using the environment')
   - describe('getDefault')
     - it('should return default HOST environment')
   - describe('ensureDefaultExists')
     - it('should create default HOST environment if not exists')
     - it('should not duplicate if already exists')
3. テスト実行で失敗を確認
4. `src/services/environment-service.ts`を実装
5. テストが通過することを確認

**ファイル**:
- 新規: `src/services/environment-service.ts`
- 新規: `src/services/__tests__/environment-service.test.ts`

---

#### TASK-EE-003: 認証ディレクトリ管理機能の実装

**状態**: `DONE`
**完了サマリー**: createAuthDirectory、deleteAuthDirectoryメソッドを実装。data/environments/<env-id>/形式。
**優先度**: P0
**見積もり**: 30分
**依存**: TASK-EE-002
**関連要件**: REQ-EE004, REQ-EE007, NFR-EE004

**受入基準**:
- [ ] Docker環境作成時に認証ディレクトリが作成される
- [ ] ディレクトリパスは`data/environments/<env-id>/`形式
- [ ] ディレクトリパーミッションは700
- [ ] サブディレクトリ（claude/, config/claude/）が作成される
- [ ] 環境削除時に認証ディレクトリも削除される
- [ ] ユニットテストが通過する

**TDD手順**:
1. `src/services/__tests__/environment-service.test.ts`にテスト追加:
   - describe('createAuthDirectory')
     - it('should create auth directory with correct structure')
     - it('should set directory permissions to 700')
   - describe('deleteAuthDirectory')
     - it('should delete auth directory')
     - it('should handle non-existent directory gracefully')
2. テスト実行で失敗を確認
3. EnvironmentServiceにメソッドを追加実装
4. テストが通過することを確認

**ファイル**:
- 変更: `src/services/environment-service.ts`
- 変更: `src/services/__tests__/environment-service.test.ts`

---

### Phase 2: アダプター層

#### TASK-EE-004: EnvironmentAdapter インターフェース定義

**状態**: `DONE`
**完了サマリー**: EnvironmentAdapterインターフェース、CreateSessionOptions、PTYExitInfoを定義。isEnvironmentAdapter型ガードも追加。
**優先度**: P0
**見積もり**: 15分
**依存**: なし
**関連要件**: REQ-EE020, REQ-EE021

**受入基準**:
- [ ] EnvironmentAdapterインターフェースが定義されている
- [ ] createSession, write, resize, destroySession, restartSession, hasSession, getWorkingDirメソッドが定義されている
- [ ] EventEmitterを継承している
- [ ] CreateSessionOptionsインターフェースが定義されている

**実装指示**:
1. `src/services/environment-adapter.ts`を作成
2. インターフェースを定義（設計書参照）

**TDD手順**:
1. このタスクはインターフェース定義のみのため、テストは次タスク以降で実施

**ファイル**:
- 新規: `src/services/environment-adapter.ts`

---

#### TASK-EE-005: HostAdapter の実装

**状態**: `DONE`
**完了サマリー**: HostAdapterクラスを実装。ClaudePTYManagerをラップし、dockerMode:falseを固定。17テストパス。
**優先度**: P0
**見積もり**: 30分
**依存**: TASK-EE-004
**関連要件**: REQ-EE003, REQ-EE019

**受入基準**:
- [ ] HostAdapterクラスがEnvironmentAdapterインターフェースを実装している
- [ ] 内部でClaudePTYManagerを使用している
- [ ] ClaudePTYManagerには常に`dockerMode: false`を渡す
- [ ] イベント（data, exit, error, claudeSessionId）が正しく転送される
- [ ] ユニットテストが通過する

**実装指示**:
```typescript
// 重要: dockerModeは常にfalseで固定
// ClaudePTYManager内部のdockerAdapter処理は使用しない
createSession(..., options) {
  this.ptyManager.createSession(..., {
    resumeSessionId: options?.resumeSessionId,
    dockerMode: false,  // 固定値
  });
}
```

**TDD手順**:
1. テストファイル作成: `src/services/adapters/__tests__/host-adapter.test.ts`
2. 以下のテストケースを先に書く:
   - describe('createSession')
     - it('should create session using ClaudePTYManager')
     - it('should always pass dockerMode: false to ClaudePTYManager')
   - describe('write')
     - it('should forward write to ClaudePTYManager')
   - describe('event forwarding')
     - it('should emit data event when PTY outputs')
     - it('should emit exit event when PTY exits')
3. テスト実行で失敗を確認
4. `src/services/adapters/host-adapter.ts`を実装
5. テストが通過することを確認

**ファイル**:
- 新規: `src/services/adapters/host-adapter.ts`
- 新規: `src/services/adapters/__tests__/host-adapter.test.ts`

---

#### TASK-EE-006: DockerAdapter の実装（独立認証対応）

**状態**: `DONE`
**完了サマリー**: DockerAdapterクラスを実装。環境専用認証ディレクトリをマウント、container_id管理を追加。
**優先度**: P0
**見積もり**: 45分
**依存**: TASK-EE-004, TASK-EE-003
**関連要件**: REQ-EE005, REQ-EE006, REQ-EE013, REQ-EE014

**受入基準**:
- [ ] DockerAdapterクラスがEnvironmentAdapterインターフェースを実装している
- [ ] 環境専用の認証ディレクトリをマウントしている
- [ ] ホストの認証情報（~/.claude）は共有しない
- [ ] ワークスペースはbindマウントで共有
- [ ] Git認証情報（.ssh, .gitconfig）は読み取り専用でマウント
- [ ] createSession時にSession.container_idを更新する
- [ ] destroySession時にSession.container_idをnullに更新する
- [ ] ユニットテストが通過する

**実装指示**:
```typescript
// 既存DockerPTYAdapterとの違い:
// - ホスト~/.claudeをマウントしない
// - 環境専用ディレクトリ（data/environments/<id>/claude）をマウント
// - Session.container_idを更新

async createSession(sessionId, workingDir, ...) {
  const containerName = `claude-env-${this.config.environmentId}-${Date.now()}`;
  // ... コンテナ起動 ...

  // container_idを更新
  await prisma.session.update({
    where: { id: sessionId },
    data: { container_id: containerName },
  });
}

async destroySession(sessionId) {
  // ... コンテナ停止 ...

  // container_idをクリア
  await prisma.session.update({
    where: { id: sessionId },
    data: { container_id: null },
  });
}
```

**TDD手順**:
1. テストファイル作成: `src/services/adapters/__tests__/docker-adapter.test.ts`
2. 以下のテストケースを先に書く:
   - describe('buildDockerArgs')
     - it('should mount environment-specific auth directory')
     - it('should mount workspace as RW')
     - it('should mount git auth as RO')
     - it('should not mount host claude auth')
   - describe('createSession')
     - it('should spawn docker run with correct args')
     - it('should update Session.container_id')
   - describe('destroySession')
     - it('should kill docker container')
     - it('should clear Session.container_id')
3. テスト実行で失敗を確認
4. `src/services/adapters/docker-adapter.ts`を実装
5. テストが通過することを確認

**ファイル**:
- 新規: `src/services/adapters/docker-adapter.ts`
- 新規: `src/services/adapters/__tests__/docker-adapter.test.ts`

---

#### TASK-EE-007: AdapterFactory の実装

**状態**: `DONE`
**完了サマリー**: AdapterFactoryクラスを実装。HostAdapterシングルトン、DockerAdapter環境IDごとシングルトン。13テストパス。
**優先度**: P0
**見積もり**: 25分
**依存**: TASK-EE-005, TASK-EE-006
**関連要件**: REQ-EE002, REQ-EE020

**受入基準**:
- [ ] AdapterFactoryクラスが実装されている
- [ ] getAdapter()で環境タイプに応じたアダプターを返す
- [ ] HostAdapterはシングルトン
- [ ] DockerAdapterは環境IDごとにシングルトン
- [ ] 未知の環境タイプでエラーをスロー
- [ ] ユニットテストが通過する

**TDD手順**:
1. テストファイル作成: `src/services/__tests__/adapter-factory.test.ts`
2. 以下のテストケースを先に書く:
   - describe('getAdapter')
     - it('should return HostAdapter for HOST type')
     - it('should return DockerAdapter for DOCKER type')
     - it('should throw error for SSH type (not implemented)')
     - it('should return same HostAdapter instance (singleton)')
     - it('should return same DockerAdapter for same environment id')
   - describe('removeDockerAdapter')
     - it('should remove cached DockerAdapter')
3. テスト実行で失敗を確認
4. `src/services/adapter-factory.ts`を実装
5. テストが通過することを確認

**ファイル**:
- 新規: `src/services/adapter-factory.ts`
- 新規: `src/services/__tests__/adapter-factory.test.ts`

---

### Phase 3: API層

#### TASK-EE-008: 環境管理API（GET /api/environments）

**状態**: `DONE`
**完了サマリー**: GET /api/environmentsを実装。?includeStatus=trueでステータス付き取得対応。
**優先度**: P1
**見積もり**: 30分
**依存**: TASK-EE-002
**関連要件**: REQ-EE008, REQ-EE016, REQ-EE017, REQ-EE018

**受入基準**:
- [ ] GET /api/environments で環境一覧を取得できる
- [ ] `?includeStatus=true`でステータス付き、未指定でステータスなし
- [ ] ステータス付きの場合、各環境のステータス（available, authenticated）が含まれる
- [ ] Docker環境の詳細（dockerDaemon, imageExists）が含まれる
- [ ] ユニットテストが通過する

**実装指示**:
```typescript
// パフォーマンス対策: ステータスはオプショナル
// GET /api/environments → 高速（ステータスなし）
// GET /api/environments?includeStatus=true → ステータス付き

export async function GET(request: NextRequest) {
  const includeStatus = request.nextUrl.searchParams.get('includeStatus') === 'true';

  const environments = await environmentService.findAll();

  if (includeStatus) {
    // 各環境のステータスを並列取得
    const envWithStatus = await Promise.all(
      environments.map(async (env) => ({
        ...env,
        status: await environmentService.checkStatus(env.id),
      }))
    );
    return NextResponse.json({ environments: envWithStatus });
  }

  return NextResponse.json({ environments });
}
```

**TDD手順**:
1. テストファイル作成: `src/app/api/environments/__tests__/route.test.ts`
2. テストケースを先に書く
3. `src/app/api/environments/route.ts`を実装
4. テストが通過することを確認

**ファイル**:
- 新規: `src/app/api/environments/route.ts`
- 新規: `src/app/api/environments/__tests__/route.test.ts`

---

#### TASK-EE-009: 環境管理API（POST /api/environments）

**状態**: `DONE`
**完了サマリー**: POST /api/environmentsを実装。Docker環境作成時に認証ディレクトリ自動作成。
**優先度**: P1
**見積もり**: 30分
**依存**: TASK-EE-003
**関連要件**: REQ-EE009

**受入基準**:
- [ ] POST /api/environments で環境を作成できる
- [ ] Docker環境作成時に認証ディレクトリが作成される
- [ ] バリデーションエラー時は400を返す
- [ ] ユニットテストが通過する

**TDD手順**:
1. `src/app/api/environments/__tests__/route.test.ts`にテスト追加
2. POSTハンドラーを実装
3. テストが通過することを確認

**ファイル**:
- 変更: `src/app/api/environments/route.ts`
- 変更: `src/app/api/environments/__tests__/route.test.ts`

---

#### TASK-EE-010: 環境管理API（PUT, DELETE /api/environments/:id）

**状態**: `DONE`
**完了サマリー**: PUT/DELETE /api/environments/:idを実装。デフォルト環境削除禁止、使用中警告対応。
**優先度**: P1
**見積もり**: 35分
**依存**: TASK-EE-009
**関連要件**: REQ-EE010, REQ-EE011, REQ-EE012

**受入基準**:
- [ ] PUT /api/environments/:id で環境を更新できる
- [ ] DELETE /api/environments/:id で環境を削除できる
- [ ] デフォルト環境の削除は400エラー
- [ ] 使用中セッションがある場合は409（警告）を返す
- [ ] ユニットテストが通過する

**TDD手順**:
1. テストファイル作成: `src/app/api/environments/[id]/__tests__/route.test.ts`
2. テストケースを先に書く
3. `src/app/api/environments/[id]/route.ts`を実装
4. テストが通過することを確認

**ファイル**:
- 新規: `src/app/api/environments/[id]/route.ts`
- 新規: `src/app/api/environments/[id]/__tests__/route.test.ts`

---

#### TASK-EE-011: セッション作成APIの environment_id 対応

**状態**: `DONE`
**完了サマリー**: POST /api/projects/:id/sessionsにenvironment_id対応追加。dockerMode非推奨警告対応。
**優先度**: P0
**見積もり**: 30分
**依存**: TASK-EE-007
**関連要件**: REQ-EE001, REQ-EE002, REQ-EE003

**受入基準**:
- [ ] POST /api/projects/:id/sessionsでenvironment_idを受け付ける
- [ ] environment_idが指定されない場合はデフォルト環境を使用
- [ ] 存在しないenvironment_idは400エラー
- [ ] 既存のdocker_modeパラメータも引き続き動作（互換性）
- [ ] docker_mode使用時は非推奨警告をログ出力
- [ ] ユニットテストが通過する

**実装指示**:
```typescript
// パラメータ優先順位:
// 1. environment_id が指定されていればそれを使用
// 2. dockerMode=true かつ environment_id未指定 → レガシー動作（警告ログ出力）
// 3. 両方未指定 → デフォルトHOST環境

const { name, prompt, environment_id, dockerMode = false } = body;

let effectiveEnvironmentId: string | null = null;
let effectiveDockerMode = false;

if (environment_id) {
  // 新方式: environment_idを検証
  const env = await environmentService.findById(environment_id);
  if (!env) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 400 });
  }
  effectiveEnvironmentId = environment_id;
} else if (dockerMode) {
  // レガシー方式: 警告を出力しつつ従来動作を維持
  logger.warn('dockerMode parameter is deprecated, use environment_id instead', {
    projectId: project_id,
  });
  effectiveDockerMode = true;
  // environment_idはnull、docker_mode=trueで保存
}

// セッション作成
const newSession = await prisma.session.create({
  data: {
    ...
    environment_id: effectiveEnvironmentId,
    docker_mode: effectiveDockerMode,
  },
});
```

**TDD手順**:
1. 既存テストファイルを更新: `src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts`
2. environment_id関連のテストケースを追加:
   - it('should accept environment_id parameter')
   - it('should return 400 for non-existent environment_id')
   - it('should use default environment when no environment_id specified')
   - it('should support legacy dockerMode parameter with warning')
3. 実装を更新
4. テストが通過することを確認

**ファイル**:
- 変更: `src/app/api/projects/[project_id]/sessions/route.ts`
- 変更: `src/app/api/projects/[project_id]/sessions/__tests__/route.test.ts`

---

### Phase 4: WebSocket統合

#### TASK-EE-012: ClaudeWebSocketHandler の環境対応

**状態**: `DONE`
**完了サマリー**: claude-ws.tsに環境選択ロジック実装。AdapterFactory経由でアダプター選択、レガシーdockerMode対応。10テストパス。
**優先度**: P0
**見積もり**: 40分
**依存**: TASK-EE-007, TASK-EE-011
**関連要件**: REQ-EE002, REQ-EE005

**受入基準**:
- [ ] セッションのenvironment_idに基づいてアダプターを選択
- [ ] environment_idがnullでdocker_mode=falseの場合はデフォルト環境を使用
- [ ] environment_idがnullでdocker_mode=trueの場合はレガシー動作（既存claudePtyManager使用）
- [ ] Docker環境では環境専用認証ディレクトリを使用
- [ ] ユニットテストが通過する

**実装指示**:
```typescript
// アダプター選択フロー（優先順位順）
async function selectAdapter(session: Session) {
  // 1. environment_idが指定されている場合 → 新方式
  if (session.environment_id) {
    const env = await environmentService.findById(session.environment_id);
    if (env) {
      return { type: 'new', adapter: AdapterFactory.getAdapter(env) };
    }
    // 環境が削除されていた場合はデフォルトにフォールバック
    logger.warn('Environment not found, falling back to default', {
      sessionId: session.id,
      environmentId: session.environment_id,
    });
  }

  // 2. docker_mode=true かつ environment_id未設定 → レガシー方式
  if (session.docker_mode && !session.environment_id) {
    return { type: 'legacy-docker', manager: claudePtyManager };
  }

  // 3. デフォルトHOST環境
  const defaultEnv = await environmentService.getDefault();
  return { type: 'new', adapter: AdapterFactory.getAdapter(defaultEnv) };
}

// 使用例
const selected = await selectAdapter(session);
if (selected.type === 'legacy-docker') {
  selected.manager.createSession(sessionId, worktreePath, prompt, { dockerMode: true });
} else {
  selected.adapter.createSession(sessionId, worktreePath, prompt, { resumeSessionId });
}
```

**TDD手順**:
1. 既存テストファイルを更新または新規作成
2. 環境選択ロジックのテストケースを追加:
   - it('should use AdapterFactory when environment_id is set')
   - it('should use legacy claudePtyManager when docker_mode=true and no environment_id')
   - it('should use default environment when neither is set')
   - it('should fallback to default when environment is deleted')
3. `src/lib/websocket/claude-ws.ts`を更新
4. テストが通過することを確認

**ファイル**:
- 変更: `src/lib/websocket/claude-ws.ts`
- 変更または新規: `src/lib/websocket/__tests__/claude-ws.test.ts`

---

### Phase 5: UI実装

#### TASK-EE-013: 環境管理画面の実装

**状態**: `DONE`
**完了サマリー**: /settings/environmentsページを実装。EnvironmentList、EnvironmentCard、EnvironmentForm、DeleteEnvironmentDialogコンポーネントとuseEnvironmentsフックを作成。
**優先度**: P1
**見積もり**: 60分
**依存**: TASK-EE-008, TASK-EE-009, TASK-EE-010
**関連要件**: REQ-EE008, REQ-EE016, REQ-EE017, REQ-EE018

**受入基準**:
- [x] /settings/environments ページが存在する
- [x] 環境一覧が表示される
- [x] 各環境のステータスが表示される
- [x] 環境追加ダイアログが動作する
- [x] 環境編集・削除が動作する
- [x] デフォルト環境は削除ボタンが無効

**実装指示**:
1. `src/app/settings/environments/page.tsx`を作成
2. `src/components/environments/EnvironmentList.tsx`を作成
3. `src/components/environments/EnvironmentForm.tsx`を作成
4. `src/components/environments/EnvironmentCard.tsx`を作成
5. API呼び出し用フック`src/hooks/useEnvironments.ts`を作成

**ファイル**:
- 新規: `src/app/settings/environments/page.tsx`
- 新規: `src/components/environments/EnvironmentList.tsx`
- 新規: `src/components/environments/EnvironmentForm.tsx`
- 新規: `src/components/environments/EnvironmentCard.tsx`
- 新規: `src/hooks/useEnvironments.ts`

---

#### TASK-EE-014: セッション作成フォームの環境選択対応

**状態**: `DONE`
**完了サマリー**: CreateSessionFormに環境選択ドロップダウンを追加。useEnvironmentsフックで環境一覧取得、デフォルト環境初期選択、environment_id選択時はdockerModeチェックボックスを非表示。CreateSessionData型にenvironment_idを追加。
**優先度**: P1
**見積もり**: 30分
**依存**: TASK-EE-011, TASK-EE-013
**関連要件**: REQ-EE001

**受入基準**:
- [x] セッション作成フォームに環境選択ドロップダウンがある
- [x] デフォルト環境が初期選択されている
- [x] 選択した環境IDがAPIに送信される
- [x] 既存のdocker_modeトグルは非表示または非推奨表示

**実装指示**:
1. `src/components/sessions/CreateSessionForm.tsx`を更新
2. 環境一覧を取得するAPIを呼び出す
3. ドロップダウンUIを追加
4. 送信データにenvironment_idを含める

**ファイル**:
- 変更: `src/components/sessions/CreateSessionForm.tsx`

---

#### TASK-EE-015: セッション一覧・詳細での環境表示

**状態**: `DONE`
**完了サマリー**: Session型にenvironment_name/environment_typeを追加。APIでinclude joinを実装。EnvironmentBadgeコンポーネントを作成（タイプ別色分け・アイコン対応）。SessionCard、セッション詳細ページに適用。
**優先度**: P2
**見積もり**: 25分
**依存**: TASK-EE-014
**関連要件**: REQ-EE001

**受入基準**:
- [x] セッション一覧で環境名が表示される
- [x] セッション詳細で環境情報が表示される
- [x] 環境タイプに応じたアイコン/バッジが表示される

**実装指示**:
1. `src/components/sessions/SessionCard.tsx`を更新
2. 環境名とタイプバッジを表示
3. セッション詳細ページも同様に更新

**ファイル**:
- 変更: `src/components/sessions/SessionCard.tsx`
- 変更: `src/app/sessions/[id]/page.tsx`

---

### Phase 6: マイグレーションと仕上げ

#### TASK-EE-016: デフォルト環境の初期化スクリプト

**状態**: `DONE`
**完了サマリー**: server.tsでサーバー起動時にenvironmentService.ensureDefaultExists()を呼び出し。
**優先度**: P0
**見積もり**: 20分
**依存**: TASK-EE-002
**関連要件**: REQ-EE003, REQ-EE012

**受入基準**:
- [ ] サーバー起動時にデフォルトHOST環境が存在することを確認
- [ ] 存在しない場合は自動作成
- [ ] 既存環境がある場合は何もしない

**実装指示**:
1. `server.ts`またはサーバー初期化処理で`environmentService.ensureDefaultExists()`を呼び出す
2. 起動ログにデフォルト環境の状態を出力

**ファイル**:
- 変更: `server.ts`

---

#### TASK-EE-017: 既存docker_modeセッションのマイグレーション

**状態**: `DONE`
**完了サマリー**: prisma/seed-environments.tsを作成。デフォルトHOST環境とレガシーDocker環境をupsertで作成、既存docker_modeセッションのenvironment_idを更新。冪等性確保。
**優先度**: P1
**見積もり**: 30分
**依存**: TASK-EE-016
**関連要件**: C-EE006

**受入基準**:
- [ ] docker_mode=trueの既存セッション用にDocker環境が作成される
- [ ] 該当セッションのenvironment_idが設定される
- [ ] マイグレーションログが出力される
- [ ] 冪等性がある（複数回実行しても問題ない）

**実装指示**:
```typescript
// prisma/seed-environments.ts
// 冪等性を保証するためupsertを使用

async function migrateToEnvironments() {
  // 1. デフォルトHOST環境を作成（upsert）
  const hostEnv = await prisma.executionEnvironment.upsert({
    where: { id: 'host-default' },
    create: {
      id: 'host-default',
      name: 'Local Host',
      type: 'HOST',
      description: 'ローカル環境で直接実行',
      config: '{}',
      is_default: true,
    },
    update: {}, // 既存ならそのまま
  });
  console.log('Default HOST environment ensured:', hostEnv.id);

  // 2. docker_mode=trueのセッションがあればDocker環境を作成
  const dockerSessions = await prisma.session.findMany({
    where: {
      docker_mode: true,
      environment_id: null, // まだマイグレーションされていないもの
    },
  });

  if (dockerSessions.length > 0) {
    const dockerEnv = await prisma.executionEnvironment.upsert({
      where: { id: 'docker-legacy' },
      create: {
        id: 'docker-legacy',
        name: 'Docker (Legacy)',
        type: 'DOCKER',
        description: '既存のDockerセッション用環境（ホスト認証共有）',
        config: JSON.stringify({
          imageName: 'claude-code-sandboxed',
          imageTag: 'latest',
        }),
        // 注: レガシー環境はauth_dir_pathなし（ホスト認証共有のため）
      },
      update: {},
    });
    console.log('Legacy Docker environment ensured:', dockerEnv.id);

    // 3. 該当セッションを更新
    const updateResult = await prisma.session.updateMany({
      where: {
        docker_mode: true,
        environment_id: null,
      },
      data: { environment_id: dockerEnv.id },
    });
    console.log('Migrated sessions:', updateResult.count);
  } else {
    console.log('No sessions to migrate');
  }
}
```

1. `prisma/seed-environments.ts`を作成
2. マイグレーションロジックを実装
3. `package.json`にマイグレーションスクリプトを追加:
   ```json
   "scripts": {
     "db:migrate-environments": "npx ts-node prisma/seed-environments.ts"
   }
   ```

**ファイル**:
- 新規: `prisma/seed-environments.ts`
- 変更: `package.json`

---

#### TASK-EE-018: ドキュメント更新

**状態**: 未着手
**優先度**: P2
**見積もり**: 30分
**依存**: 全タスク完了後

**受入基準**:
- [ ] CLAUDE.mdに実行環境機能の説明を追加
- [ ] docs/API.mdに環境APIを追加
- [ ] docs/ENV_VARS.mdに関連環境変数を追加
- [ ] docker_modeの非推奨を明記

**ファイル**:
- 変更: `CLAUDE.md`
- 変更: `docs/API.md`
- 変更: `docs/ENV_VARS.md`

---

## タスク依存関係

```text
TASK-EE-001 (スキーマ)
     │
     ├──→ TASK-EE-002 (EnvironmentService)
     │         │
     │         ├──→ TASK-EE-003 (認証ディレクトリ)
     │         │         │
     │         │         └──→ TASK-EE-006 (DockerAdapter)
     │         │
     │         ├──→ TASK-EE-008 (GET /api/environments)
     │         │         │
     │         │         └──→ TASK-EE-009 (POST)
     │         │                   │
     │         │                   └──→ TASK-EE-010 (PUT, DELETE)
     │         │
     │         └──→ TASK-EE-016 (デフォルト環境初期化)
     │                   │
     │                   └──→ TASK-EE-017 (マイグレーション)
     │
     └──→ TASK-EE-004 (インターフェース)
               │
               ├──→ TASK-EE-005 (HostAdapter)
               │         │
               │         └──→ TASK-EE-007 (AdapterFactory)
               │                   │
               │                   ├──→ TASK-EE-011 (セッションAPI更新)
               │                   │         │
               │                   │         └──→ TASK-EE-012 (WebSocket統合)
               │                   │
               │                   └──→ TASK-EE-013 (環境管理UI)
               │                             │
               │                             └──→ TASK-EE-014 (セッション作成UI)
               │                                       │
               │                                       └──→ TASK-EE-015 (セッション表示UI)
               │
               └──→ TASK-EE-006 (DockerAdapter)

TASK-EE-018 (ドキュメント) は全タスク完了後
```

## 進捗サマリー

| Phase | タスク数 | 完了 | 進捗率 |
|-------|---------|------|--------|
| Phase 1: データモデルとサービス層 | 3 | 3 | 100% |
| Phase 2: アダプター層 | 4 | 4 | 100% |
| Phase 3: API層 | 4 | 4 | 100% |
| Phase 4: WebSocket統合 | 1 | 1 | 100% |
| Phase 5: UI実装 | 3 | 3 | 100% |
| Phase 6: マイグレーションと仕上げ | 3 | 2 | 67% |
| **合計** | **18** | **17** | **94%** |
