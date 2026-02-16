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

#### TASK-EE-019: 環境管理画面へのナビゲーション導線追加

**状態**: `DONE`
**完了サマリー**: ヘッダーに設定メニュー（歯車アイコン）を追加。ドロップダウンから「実行環境」をクリックで/settings/environmentsに遷移可能。
**優先度**: P1
**見積もり**: 20分
**依存**: TASK-EE-013
**関連要件**: REQ-EE008

**受入基準**:
- [x] ヘッダーに設定メニュー（歯車アイコン）を追加
- [x] 設定メニューから「実行環境」へのリンクがある
- [x] 環境管理画面（/settings/environments）にアクセスできる

**実装指示**:
1. `src/components/layout/Header.tsx`を更新（または新規作成）
2. 設定アイコンとドロップダウンメニューを追加
3. 「実行環境」リンクを追加

**ファイル**:
- 変更: ヘッダーコンポーネント

---

#### TASK-EE-018: ドキュメント更新

**状態**: `DONE`
**完了サマリー**: CLAUDE.md、docs/API.md、docs/ENV_VARS.mdを更新。環境タイプ、API仕様、認証ディレクトリ、dockerMode非推奨を明記。
**優先度**: P2
**見積もり**: 30分
**依存**: 全タスク完了後

**受入基準**:
- [x] CLAUDE.mdに実行環境機能の説明を追加
- [x] docs/API.mdに環境APIを追加
- [x] docs/ENV_VARS.mdに関連環境変数を追加
- [x] docker_modeの非推奨を明記

**ファイル**:
- 変更: `CLAUDE.md`
- 変更: `docs/API.md`
- 変更: `docs/ENV_VARS.md`

---

### Phase 7: Dockerイメージ設定機能

#### TASK-EE-020: Dockerイメージ一覧取得API

**状態**: `DONE`
**完了サマリー**: GET /api/docker/images を実装。docker imagesコマンドでローカルイメージ一覧を取得。5テストパス。
**優先度**: P1
**見積もり**: 25分
**依存**: なし
**関連要件**: REQ-EE024

**受入基準**:
- [ ] GET /api/docker/images でローカルDockerイメージ一覧を取得できる
- [ ] レスポンスにrepository, tag, id, size, createdが含まれる
- [ ] Dockerデーモンに接続できない場合は503エラー
- [ ] ユニットテストが通過する

**実装指示**:
```typescript
// src/app/api/docker/images/route.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';

const execAsync = promisify(exec);

export async function GET() {
  try {
    // docker imagesをJSON形式で取得
    const { stdout } = await execAsync(
      'docker images --format "{{json .}}"',
      { timeout: 10000 }
    );

    const images = stdout
      .trim()
      .split('\n')
      .filter(line => line)
      .map(line => {
        const img = JSON.parse(line);
        return {
          repository: img.Repository,
          tag: img.Tag,
          id: img.ID,
          size: img.Size,
          created: img.CreatedAt,
        };
      })
      // <none>タグを除外
      .filter(img => img.repository !== '<none>' && img.tag !== '<none>');

    return NextResponse.json({ images });
  } catch (error) {
    return NextResponse.json(
      { error: 'Docker daemon not available' },
      { status: 503 }
    );
  }
}
```

**TDD手順**:
1. テストファイル作成: `src/app/api/docker/images/__tests__/route.test.ts`
2. テストケースを先に書く:
   - it('should return list of docker images')
   - it('should exclude images with <none> tag')
   - it('should return 503 when docker daemon is unavailable')
3. 実装
4. テストが通過することを確認

**ファイル**:
- 新規: `src/app/api/docker/images/route.ts`
- 新規: `src/app/api/docker/images/__tests__/route.test.ts`

---

#### TASK-EE-021: Dockerfileビルド用API

**状態**: `DONE`
**完了サマリー**: POST /api/docker/image-build を実装。Dockerfileからイメージをビルド。6テストパス。
**優先度**: P1
**見積もり**: 35分
**依存**: なし
**関連要件**: REQ-EE027

**受入基準**:
- [ ] POST /api/docker/build でDockerfileからイメージをビルドできる
- [ ] dockerfilePath, imageName, imageTagをリクエストで受け付ける
- [ ] ビルドログをレスポンスに含める
- [ ] Dockerfileが存在しない場合は400エラー
- [ ] ビルドエラー時は400エラーとエラーログを返す
- [ ] ユニットテストが通過する

**実装指示**:
```typescript
// src/app/api/docker/image-build/route.ts
// 注意: コマンドインジェクション対策のため、spawnを使用して引数を配列で渡す
// また、imageName/imageTagは正規表現でバリデーションし、dockerfilePathは
// 許可されたベースディレクトリ配下のみ許可する
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { NextRequest, NextResponse } from 'next/server';

// 許可されたベースディレクトリ
const ALLOWED_BASE_DIRS = [path.resolve(process.cwd(), 'data', 'environments')];

// イメージ名/タグのバリデーション正規表現
const IMAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const IMAGE_TAG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export async function POST(request: NextRequest) {
  const { dockerfilePath, imageName, imageTag = 'latest' } = await request.json();

  // バリデーション（イメージ名/タグの形式チェック）
  if (!IMAGE_NAME_PATTERN.test(imageName) || !IMAGE_TAG_PATTERN.test(imageTag)) {
    return NextResponse.json({ error: 'Invalid image name or tag format' }, { status: 400 });
  }

  // パストラバーサル対策
  const resolvedPath = path.resolve(dockerfilePath);
  const isAllowed = ALLOWED_BASE_DIRS.some(base => resolvedPath.startsWith(base + path.sep));
  if (!isAllowed) {
    return NextResponse.json({ error: 'Dockerfile path is not allowed' }, { status: 400 });
  }

  const fullImageName = `${imageName}:${imageTag}`;
  const dockerfileDir = path.dirname(dockerfilePath);
  const dockerfileName = path.basename(dockerfilePath);

  // spawnで引数を配列で渡すことでコマンドインジェクションを防止
  const buildResult = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const args = ['build', '-t', fullImageName, '-f', dockerfileName, '.'];
    const child = spawn('docker', args, { cwd: dockerfileDir });
    let stdout = '', stderr = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('close', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`Build failed with code ${code}`)));
  });

  return NextResponse.json({ success: true, imageName: fullImageName, buildLog: buildResult.stdout + buildResult.stderr });
}
```

**TDD手順**:
1. テストファイル作成: `src/app/api/docker/build/__tests__/route.test.ts`
2. テストケースを先に書く:
   - it('should build image from Dockerfile')
   - it('should return 400 when Dockerfile not found')
   - it('should return 400 with build log on build failure')
3. 実装
4. テストが通過することを確認

**ファイル**:
- 新規: `src/app/api/docker/build/route.ts`
- 新規: `src/app/api/docker/build/__tests__/route.test.ts`

---

#### TASK-EE-022: EnvironmentFormにDockerイメージ設定UIを追加

**状態**: `DONE`
**優先度**: P1
**見積もり**: 45分
**依存**: TASK-EE-020, TASK-EE-021
**関連要件**: REQ-EE023, REQ-EE024, REQ-EE025, REQ-EE026, REQ-EE029

**受入基準**:
- [x] Docker環境選択時に「イメージソース」セクションが表示される
- [x] 「既存イメージを使用」「Dockerfileからビルド」のラジオボタンがある
- [x] 既存イメージ選択時:
  - [x] ドロップダウンにローカルイメージ一覧が表示される
  - [x] 「カスタムイメージを入力」オプションがある
  - [x] カスタム選択時はテキスト入力欄が表示される
- [x] Dockerfileビルド選択時:
  - [x] Dockerfileパス入力欄が表示される
- [x] 選択内容がconfig JSONに正しく保存される

**実装指示**:
```typescript
// EnvironmentForm.tsx に追加するstate
const [imageSource, setImageSource] = useState<'existing' | 'dockerfile'>('existing');
const [selectedImage, setSelectedImage] = useState('');
const [customImageName, setCustomImageName] = useState('');
const [dockerfilePath, setDockerfilePath] = useState('');
const [availableImages, setAvailableImages] = useState<DockerImage[]>([]);
const [isLoadingImages, setIsLoadingImages] = useState(false);

// Docker環境選択時にイメージ一覧を取得
useEffect(() => {
  if (type === 'DOCKER') {
    fetchDockerImages();
  }
}, [type]);

// フォーム送信時のconfig構築
const buildConfig = () => {
  if (type !== 'DOCKER') return {};

  if (imageSource === 'existing') {
    const [imageName, imageTag] = (selectedImage === 'custom' ? customImageName : selectedImage).split(':');
    return {
      imageSource: 'existing',
      imageName: imageName || 'claude-code-sandboxed',
      imageTag: imageTag || 'latest',
    };
  } else {
    return {
      imageSource: 'dockerfile',
      dockerfilePath,
      buildImageName: `claude-work-env-${Date.now()}`,
    };
  }
};
```

**TDD手順**:
1. UIコンポーネントのためE2Eテストを優先
2. `e2e/environment-form.spec.ts`にテスト追加:
   - it('should show image source options when Docker type selected')
   - it('should show image dropdown when existing image selected')
   - it('should show custom input when custom image selected')
   - it('should show dockerfile path input when dockerfile selected')
3. 実装
4. テストが通過することを確認

**ファイル**:
- 変更: `src/components/environments/EnvironmentForm.tsx`
- 新規: `src/hooks/useDockerImages.ts`
- 変更: `e2e/environment-form.spec.ts`（または新規）

---

#### TASK-EE-023: Docker環境作成時のビルド処理統合

**状態**: `DONE`
**完了サマリー**: POST /api/environmentsでimageSource=dockerfile時に自動ビルド実行。17テストパス。
**優先度**: P1
**見積もり**: 30分
**依存**: TASK-EE-021, TASK-EE-022
**関連要件**: REQ-EE027

**受入基準**:
- [ ] imageSource='dockerfile'の環境作成時、自動的にビルドを実行
- [ ] ビルド中はローディング表示
- [ ] ビルド失敗時はエラーメッセージを表示
- [ ] ビルド成功後に環境が作成される
- [ ] ビルド後のイメージ名がconfigに保存される

**実装指示**:
```typescript
// POST /api/environments でのビルド統合
export async function POST(request: NextRequest) {
  const { name, type, description, config } = await request.json();

  // Docker環境でDockerfileビルドが指定されている場合
  if (type === 'DOCKER' && config.imageSource === 'dockerfile') {
    // ビルド用のイメージ名を生成
    const buildImageName = config.buildImageName || `claude-work-env-${Date.now()}`;

    // ビルドAPI呼び出し
    const buildResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/docker/build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dockerfilePath: config.dockerfilePath,
        imageName: buildImageName,
        imageTag: 'latest',
      }),
    });

    if (!buildResponse.ok) {
      const buildResult = await buildResponse.json();
      return NextResponse.json(
        { error: 'Docker build failed', details: buildResult.buildLog },
        { status: 400 }
      );
    }

    // ビルド成功 - configを更新
    config.imageName = buildImageName;
    config.imageTag = 'latest';
  }

  // 環境作成
  const environment = await environmentService.create({
    name,
    type,
    description,
    config,
  });

  return NextResponse.json(environment, { status: 201 });
}
```

**TDD手順**:
1. `src/app/api/environments/__tests__/route.test.ts`にテスト追加:
   - it('should build image when imageSource is dockerfile')
   - it('should return 400 when docker build fails')
   - it('should save built image name in config')
2. 実装
3. テストが通過することを確認

**ファイル**:
- 変更: `src/app/api/environments/route.ts`
- 変更: `src/app/api/environments/__tests__/route.test.ts`

---

#### TASK-EE-024: EnvironmentCardにイメージ情報表示を追加

**状態**: `DONE`
**完了サマリー**: EnvironmentCardにrenderImageInfo関数を追加。Dockerfile/既存イメージに応じた表示。11テストパス。
**優先度**: P2
**見積もり**: 20分
**依存**: TASK-EE-022
**関連要件**: REQ-EE028

**受入基準**:
- [ ] Docker環境カードに使用中のイメージ名が表示される
- [ ] imageSource='dockerfile'の場合はDockerfileパスが表示される
- [ ] imageSource='existing'の場合はイメージ名:タグが表示される

**実装指示**:
```typescript
// EnvironmentCard.tsx に追加
const renderImageInfo = () => {
  if (environment.type !== 'DOCKER') return null;

  const config = JSON.parse(environment.config || '{}');

  if (config.imageSource === 'dockerfile') {
    return (
      <div className="text-sm text-gray-500">
        <span className="font-medium">Dockerfile:</span> {config.dockerfilePath}
      </div>
    );
  }

  const imageName = config.imageName || 'claude-code-sandboxed';
  const imageTag = config.imageTag || 'latest';
  return (
    <div className="text-sm text-gray-500">
      <span className="font-medium">イメージ:</span> {imageName}:{imageTag}
    </div>
  );
};
```

**ファイル**:
- 変更: `src/components/environments/EnvironmentCard.tsx`

---

#### TASK-EE-025: checkStatusでのイメージ存在確認更新

**状態**: `DONE`
**完了サマリー**: checkDockerStatusをimageSourceに応じたイメージ確認に更新。適切なエラーメッセージを出し分け。31テストパス。
**優先度**: P1
**見積もり**: 20分
**依存**: TASK-EE-023
**関連要件**: REQ-EE017

**受入基準**:
- [ ] imageSource='dockerfile'の場合、ビルド済みイメージの存在をチェック
- [ ] imageSource='existing'の場合、指定イメージの存在をチェック
- [ ] イメージが存在しない場合は適切なエラーメッセージを返す

**実装指示**:
```typescript
// environment-service.ts checkDockerStatus更新
private async checkDockerStatus(environment: ExecutionEnvironment): Promise<EnvironmentStatus> {
  // ... 既存のDockerデーモンチェック ...

  // イメージの存在チェック
  const config = JSON.parse(environment.config || '{}');
  let imageName: string;
  let imageTag: string;

  if (config.imageSource === 'dockerfile') {
    imageName = config.buildImageName || config.imageName || 'claude-code-sandboxed';
    imageTag = 'latest';
  } else {
    imageName = config.imageName || 'claude-code-sandboxed';
    imageTag = config.imageTag || 'latest';
  }

  const fullImageName = `${imageName}:${imageTag}`;

  try {
    await execAsync(`docker image inspect ${fullImageName}`, { timeout: 5000 });
    imageExists = true;
  } catch {
    const errorMsg = config.imageSource === 'dockerfile'
      ? `ビルド済みイメージが見つかりません。環境を再作成してビルドしてください。`
      : `イメージ ${fullImageName} が見つかりません。docker pullまたはビルドしてください。`;

    return {
      available: false,
      authenticated: !!environment.auth_dir_path,
      error: errorMsg,
      details: { dockerDaemon: true, imageExists: false },
    };
  }

  // ... 残りの処理 ...
}
```

**ファイル**:
- 変更: `src/services/environment-service.ts`
- 変更: `src/services/__tests__/environment-service.test.ts`

---

### Phase 8: Dockerfileアップロード機能

#### TASK-EE-026: DockerfileアップロードAPI

**状態**: `DONE`
**完了サマリー**: POST/DELETE /api/environments/:id/dockerfile を実装。multipart/form-dataでファイルを受け付け、data/environments/<env-id>/Dockerfileに保存。8テストパス。
**優先度**: P1
**見積もり**: 35分
**依存**: TASK-EE-021
**関連要件**: REQ-EE026, REQ-EE030

**受入基準**:
- [ ] POST /api/environments/:id/dockerfile でDockerfileをアップロードできる
- [ ] multipart/form-dataでファイルを受け付ける
- [ ] ファイルは data/environments/<env-id>/Dockerfile に保存される
- [ ] 環境のconfig.dockerfileUploadedがtrueに更新される
- [ ] 環境タイプがDOCKERでない場合は400エラー
- [ ] ユニットテストが通過する

**実装指示**:
```typescript
// src/app/api/environments/[id]/dockerfile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { environmentService } from '@/services/environment-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // 環境の取得と検証
  const environment = await environmentService.findById(id);
  if (!environment) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
  }
  if (environment.type !== 'DOCKER') {
    return NextResponse.json(
      { error: 'Dockerfile upload is only supported for DOCKER environments' },
      { status: 400 }
    );
  }

  // multipart/form-dataからファイルを取得
  const formData = await request.formData();
  const file = formData.get('dockerfile') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No dockerfile provided' }, { status: 400 });
  }

  // 環境専用ディレクトリにDockerfileを保存
  const envDir = path.join(process.cwd(), 'data', 'environments', id);
  await fs.mkdir(envDir, { recursive: true });

  const dockerfilePath = path.join(envDir, 'Dockerfile');
  const fileContent = await file.text();
  await fs.writeFile(dockerfilePath, fileContent, 'utf-8');

  // 環境のconfigを更新
  const config = JSON.parse(environment.config || '{}');
  config.dockerfileUploaded = true;
  config.imageSource = 'dockerfile';

  await environmentService.update(id, { config });

  return NextResponse.json({
    success: true,
    path: `data/environments/${id}/Dockerfile`,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const environment = await environmentService.findById(id);
  if (!environment) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
  }
  if (environment.type !== 'DOCKER') {
    return NextResponse.json(
      { error: 'Dockerfile delete is only supported for DOCKER environments' },
      { status: 400 }
    );
  }

  // Dockerfileを削除
  const dockerfilePath = path.join(process.cwd(), 'data', 'environments', id, 'Dockerfile');
  try {
    await fs.unlink(dockerfilePath);
  } catch {
    // ファイルが存在しなくてもOK
  }

  // 環境のconfigを更新
  const config = JSON.parse(environment.config || '{}');
  config.dockerfileUploaded = false;
  config.imageSource = 'existing';

  await environmentService.update(id, { config });

  return NextResponse.json({ success: true });
}
```

**TDD手順**:
1. テストファイル作成: `src/app/api/environments/[id]/dockerfile/__tests__/route.test.ts`
2. テストケースを先に書く:
   - describe('POST')
     - it('should upload Dockerfile and save to environment directory')
     - it('should return 404 when environment not found')
     - it('should return 400 when environment is not DOCKER type')
     - it('should return 400 when no file provided')
   - describe('DELETE')
     - it('should delete Dockerfile and update config')
     - it('should handle non-existent file gracefully')
3. 実装
4. テストが通過することを確認

**ファイル**:
- 新規: `src/app/api/environments/[id]/dockerfile/route.ts`
- 新規: `src/app/api/environments/[id]/dockerfile/__tests__/route.test.ts`

---

#### TASK-EE-027: EnvironmentFormをファイルアップロード方式に変更

**状態**: `DONE`
**完了サマリー**: Dockerfileテキスト入力をドラッグ&ドロップ/ファイル選択のアップロードUIに変更。
**優先度**: P1
**見積もり**: 40分
**依存**: TASK-EE-026
**関連要件**: REQ-EE026, REQ-EE029

**受入基準**:
- [ ] Dockerfileビルド選択時にファイルアップロードUIが表示される
- [ ] ドラッグ&ドロップでファイルをアップロードできる
- [ ] ファイル選択ボタンでもアップロードできる
- [ ] アップロード済みの場合はファイル名と削除ボタンが表示される
- [ ] dockerfilePathテキスト入力は削除される
- [ ] 既存環境の編集時に既存Dockerfileがあれば表示される

**実装指示**:
```tsx
// EnvironmentForm.tsx の Dockerfile セクションを変更

// 状態追加
const [dockerfileFile, setDockerfileFile] = useState<File | null>(null);
const [isUploading, setIsUploading] = useState(false);
const [uploadedDockerfile, setUploadedDockerfile] = useState(false);

// ドラッグ&ドロップハンドラー
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) {
    setDockerfileFile(file);
  }
};

// ファイル選択ハンドラー
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    setDockerfileFile(file);
  }
};

// アップロード処理（環境作成後に呼び出し）
const uploadDockerfile = async (environmentId: string) => {
  if (!dockerfileFile) return;

  const formData = new FormData();
  formData.append('dockerfile', dockerfileFile);

  const response = await fetch(`/api/environments/${environmentId}/dockerfile`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Dockerfile upload failed');
  }
};

// UIコンポーネント
{imageSource === 'dockerfile' && (
  <div
    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
    onDrop={handleDrop}
    onDragOver={(e) => e.preventDefault()}
  >
    {dockerfileFile || uploadedDockerfile ? (
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700">
          {dockerfileFile?.name || 'Dockerfile'} ✓
        </span>
        <button
          type="button"
          onClick={() => {
            setDockerfileFile(null);
            setUploadedDockerfile(false);
          }}
          className="text-red-500 text-sm"
        >
          削除
        </button>
      </div>
    ) : (
      <>
        <input
          type="file"
          id="dockerfile-upload"
          className="hidden"
          onChange={handleFileChange}
          accept="*"
        />
        <label
          htmlFor="dockerfile-upload"
          className="cursor-pointer text-blue-600"
        >
          ファイルを選択
        </label>
        <p className="text-sm text-gray-500 mt-2">
          またはドラッグ&ドロップ
        </p>
      </>
    )}
  </div>
)}
```

**TDD手順**:
1. `e2e/environment-form.spec.ts`にテスト追加:
   - it('should show file upload area when dockerfile selected')
   - it('should accept file via drag and drop')
   - it('should accept file via file input')
   - it('should show uploaded file name and delete button')
2. 実装
3. テストが通過することを確認

**ファイル**:
- 変更: `src/components/environments/EnvironmentForm.tsx`

---

#### TASK-EE-028: 環境作成フローのDockerfileアップロード統合

**状態**: `DONE`
**完了サマリー**: 環境作成後にDockerfileをアップロードし、自動でイメージビルドを実行するフローを実装。
**優先度**: P1
**見積もり**: 30分
**依存**: TASK-EE-026, TASK-EE-027
**関連要件**: REQ-EE027

**受入基準**:
- [ ] 環境作成後にDockerfileがアップロードされる
- [ ] アップロード後に自動的にイメージがビルドされる
- [ ] ビルド中はローディング表示
- [ ] ビルド失敗時はエラーメッセージを表示し、環境は作成済み状態で残る
- [ ] 既存のdockerfilePath方式は削除

**実装指示**:
```typescript
// EnvironmentForm.tsx のsubmit処理を変更

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);

  try {
    // 1. 環境を作成
    const config = buildConfig();
    const response = await fetch('/api/environments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, description, config }),
    });

    if (!response.ok) {
      throw new Error('Failed to create environment');
    }

    const environment = await response.json();

    // 2. Dockerfileがある場合はアップロード
    if (type === 'DOCKER' && imageSource === 'dockerfile' && dockerfileFile) {
      setIsUploading(true);
      await uploadDockerfile(environment.id);

      // 3. イメージをビルド
      const buildResponse = await fetch('/api/docker/image-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dockerfilePath: `data/environments/${environment.id}/Dockerfile`,
          imageName: `claude-work-env-${environment.id}`,
          imageTag: 'latest',
        }),
      });

      if (!buildResponse.ok) {
        const result = await buildResponse.json();
        // 環境は作成済みだがビルド失敗
        toast.error(`イメージのビルドに失敗しました: ${result.error}`);
      }
    }

    onSuccess();
  } catch (error) {
    toast.error('環境の作成に失敗しました');
  } finally {
    setIsSubmitting(false);
    setIsUploading(false);
  }
};
```

**ファイル**:
- 変更: `src/components/environments/EnvironmentForm.tsx`
- 変更: `src/app/api/environments/route.ts`（dockerfilePath関連のビルド処理を削除）

---

#### TASK-EE-029: EnvironmentCardのDockerfile表示更新

**状態**: `DONE`
**完了サマリー**: imageSource='dockerfile'の場合、dockerfileUploadedに応じて「アップロード済み」または「未アップロード」と表示するように更新。
**優先度**: P2
**見積もり**: 15分
**依存**: TASK-EE-026
**関連要件**: REQ-EE028

**受入基準**:
- [ ] imageSource='dockerfile'でdockerfileUploaded=trueの場合「Dockerfileアップロード済み」と表示
- [ ] imageSource='dockerfile'でdockerfileUploaded=falseの場合「Dockerfile未アップロード」と表示
- [ ] 既存のdockerfilePathの表示ロジックを削除

**実装指示**:
```typescript
// EnvironmentCard.tsx renderImageInfo更新
const renderImageInfo = () => {
  if (environment.type !== 'DOCKER') return null;

  const config = JSON.parse(environment.config || '{}');

  if (config.imageSource === 'dockerfile') {
    return (
      <div className="text-sm text-gray-500">
        <span className="font-medium">Dockerfile:</span>{' '}
        {config.dockerfileUploaded ? (
          <span className="text-green-600">アップロード済み</span>
        ) : (
          <span className="text-yellow-600">未アップロード</span>
        )}
      </div>
    );
  }

  const imageName = config.imageName || 'claude-code-sandboxed';
  const imageTag = config.imageTag || 'latest';
  return (
    <div className="text-sm text-gray-500">
      <span className="font-medium">イメージ:</span> {imageName}:{imageTag}
    </div>
  );
};
```

**ファイル**:
- 変更: `src/components/environments/EnvironmentCard.tsx`

---

#### TASK-EE-030: 環境削除時のDockerfile削除

**状態**: `DONE`
**完了サマリー**: 環境削除時にDockerfileも一緒に削除するロジックをEnvironmentService.delete()に追加。
**優先度**: P1
**見積もり**: 15分
**依存**: TASK-EE-026
**関連要件**: REQ-EE031

**受入基準**:
- [ ] 環境削除時にDockerfileも一緒に削除される
- [ ] EnvironmentService.delete()にDockerfile削除ロジックを追加
- [ ] Dockerfileが存在しなくても削除処理は成功する

**実装指示**:
```typescript
// environment-service.ts delete()メソッドを更新
async delete(id: string): Promise<void> {
  const environment = await this.findById(id);
  if (!environment) {
    throw new Error('Environment not found');
  }

  if (environment.is_default) {
    throw new Error('Cannot delete default environment');
  }

  // 認証ディレクトリの削除（既存処理）
  if (environment.auth_dir_path) {
    await this.deleteAuthDirectory(id);
  }

  // Dockerfileの削除（新規追加）
  if (environment.type === 'DOCKER') {
    const dockerfilePath = path.join(process.cwd(), 'data', 'environments', id, 'Dockerfile');
    try {
      await fs.unlink(dockerfilePath);
    } catch {
      // ファイルが存在しなくてもOK
    }
  }

  await prisma.executionEnvironment.delete({
    where: { id },
  });
}
```

**TDD手順**:
1. `src/services/__tests__/environment-service.test.ts`にテスト追加:
   - it('should delete Dockerfile when deleting DOCKER environment')
   - it('should handle non-existent Dockerfile gracefully')
2. 実装
3. テストが通過することを確認

**ファイル**:
- 変更: `src/services/environment-service.ts`
- 変更: `src/services/__tests__/environment-service.test.ts`

---

### Phase 9: サイドメニューセッション作成改善

#### TASK-EE-031: CreateSessionModalコンポーネント作成

**状態**: `DONE`
**完了サマリー**: CreateSessionModalコンポーネントを実装。環境選択のラジオボタン、デフォルト環境初期選択、セッション作成API呼び出しを含む。20テストパス。
**優先度**: P1
**見積もり**: 40分
**依存**: なし
**関連要件**: REQ-EE032, REQ-EE033, REQ-EE034, REQ-EE035

**受入基準**:
- [ ] CreateSessionModalコンポーネントが実装されている
- [ ] モーダルに利用可能な実行環境一覧がラジオボタンで表示される
- [ ] デフォルト環境が初期選択されている
- [ ] 「作成」「キャンセル」ボタンがある
- [ ] 作成ボタンをクリックすると選択した環境でセッションが作成される
- [ ] ユニットテストが通過する

**実装指示**:
```typescript
// src/components/sessions/CreateSessionModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { useEnvironments, Environment } from '@/hooks/useEnvironments';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: (sessionId: string) => void;
}

export function CreateSessionModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
}: CreateSessionModalProps) {
  const { environments, isLoading } = useEnvironments();
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // デフォルト環境を初期選択
  useEffect(() => {
    if (environments.length > 0 && !selectedEnvironmentId) {
      const defaultEnv = environments.find(e => e.is_default);
      setSelectedEnvironmentId(defaultEnv?.id || environments[0].id);
    }
  }, [environments, selectedEnvironmentId]);

  const handleCreate = async () => {
    if (!selectedEnvironmentId) return;

    setIsCreating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Session ${Date.now()}`,
          environment_id: selectedEnvironmentId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create session');

      const session = await response.json();
      onSuccess(session.id);
      onClose();
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* モーダル実装 */}
    </Dialog>
  );
}
```

**TDD手順**:
1. テストファイル作成: `src/components/sessions/__tests__/CreateSessionModal.test.tsx`
2. テストケースを先に書く:
   - it('should display environment list as radio buttons')
   - it('should select default environment initially')
   - it('should create session with selected environment')
   - it('should close modal after successful creation')
3. 実装
4. テストが通過することを確認

**ファイル**:
- 新規: `src/components/sessions/CreateSessionModal.tsx`
- 新規: `src/components/sessions/__tests__/CreateSessionModal.test.tsx`

---

#### TASK-EE-032: Sidebarでモーダル使用に変更

**状態**: `DONE`
**完了サマリー**: Sidebarの新規セッション追加時にCreateSessionModalを使用するよう変更。直接API呼び出しを削除。
**優先度**: P1
**見積もり**: 30分
**依存**: TASK-EE-031
**関連要件**: REQ-EE032, REQ-EE035

**受入基準**:
- [ ] 「新規セッション」クリック時にCreateSessionModalが表示される
- [ ] 直接API呼び出しではなくモーダル経由でセッションを作成する
- [ ] モーダル成功後にセッション詳細ページに遷移する
- [ ] 既存のcreateSession直接呼び出しロジックを削除

**実装指示**:
```typescript
// Sidebar.tsx の変更

// 状態追加
const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
const [selectedProjectIdForSession, setSelectedProjectIdForSession] = useState<string | null>(null);

// 新規セッションボタンのハンドラーを変更
const handleNewSessionClick = (projectId: string) => {
  setSelectedProjectIdForSession(projectId);
  setIsCreateSessionModalOpen(true);
};

// モーダル成功時のハンドラー
const handleSessionCreated = (sessionId: string) => {
  router.push(`/sessions/${sessionId}`);
};

// JSXにモーダルを追加
{selectedProjectIdForSession && (
  <CreateSessionModal
    isOpen={isCreateSessionModalOpen}
    onClose={() => setIsCreateSessionModalOpen(false)}
    projectId={selectedProjectIdForSession}
    onSuccess={handleSessionCreated}
  />
)}
```

**TDD手順**:
1. E2Eテストを追加: `e2e/sidebar-session-creation.spec.ts`
2. テストケースを先に書く:
   - it('should open modal when clicking new session button')
   - it('should navigate to session page after creation')
3. 実装
4. テストが通過することを確認

**ファイル**:
- 変更: `src/components/Sidebar.tsx`
- 新規: `e2e/sidebar-session-creation.spec.ts`

---

#### TASK-EE-033: ProjectTreeItemからページ遷移を削除

**状態**: `DONE`
**完了サマリー**: ProjectTreeItemは既にページ遷移を行っていなかった（展開/折りたたみのみ）。確認済み。
**優先度**: P1
**見積もり**: 20分
**依存**: TASK-EE-032
**関連要件**: REQ-EE037

**受入基準**:
- [ ] プロジェクト名クリック時はツリーの展開/折りたたみのみ
- [ ] プロジェクト詳細ページ（/projects/[id]）へのリンクを削除
- [ ] セッション一覧の表示/非表示が正しく動作する

**実装指示**:
```typescript
// ProjectTreeItem.tsx の変更

// プロジェクト名クリックのハンドラーを変更
const handleProjectClick = () => {
  // ページ遷移ではなく展開/折りたたみのみ
  setIsExpanded(!isExpanded);
};

// Link コンポーネントを削除し、ボタンに変更
<button
  type="button"
  onClick={handleProjectClick}
  className="flex items-center gap-2 flex-1"
>
  <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
  <span className="truncate">{project.name}</span>
</button>
```

**TDD手順**:
1. E2Eテストを更新: `e2e/sidebar.spec.ts`
2. テストケースを更新:
   - it('should toggle project expansion on click')
   - it('should not navigate to project page on click')
3. 実装
4. テストが通過することを確認

**ファイル**:
- 変更: `src/components/ProjectTreeItem.tsx` または該当コンポーネント

---

#### TASK-EE-034: プロジェクト詳細ページの削除

**状態**: `DONE`
**完了サマリー**: /projects/[id]/page.tsxを削除。ProjectCardの「開く」ボタンを「新規セッション」ボタンに変更してモーダルを使用。DeleteSessionButtonのリダイレクト先を/projectsに変更。
**優先度**: P1
**見積もり**: 15分
**依存**: TASK-EE-033
**関連要件**: REQ-EE036

**受入基準**:
- [ ] /projects/[id]/page.tsx が削除されている
- [ ] 関連するインポートやリンクがすべて削除されている
- [ ] /projects/[id] にアクセスすると404になる
- [ ] ビルドエラーがない

**実装指示**:
1. `src/app/projects/[id]/page.tsx` を削除
2. プロジェクト詳細ページへのリンクを検索して削除
3. 関連コンポーネント（CreateSessionForm等）で不要になったものを削除

**TDD手順**:
1. ビルドを実行して成功を確認
2. E2Eテストでプロジェクト詳細ページへのナビゲーションがないことを確認

**ファイル**:
- 削除: `src/app/projects/[id]/page.tsx`
- 変更: 関連するリンクを持つコンポーネント

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

TASK-EE-021 (ビルドAPI)
     │
     └──→ TASK-EE-026 (DockerfileアップロードAPI)
               │
               ├──→ TASK-EE-027 (EnvironmentFormファイルアップロード)
               │         │
               │         └──→ TASK-EE-028 (作成フロー統合)
               │
               ├──→ TASK-EE-029 (EnvironmentCard表示更新)
               │
               └──→ TASK-EE-030 (削除時Dockerfile削除)

TASK-EE-031 (CreateSessionModalコンポーネント)
     │
     └──→ TASK-EE-032 (Sidebarモーダル統合)
               │
               └──→ TASK-EE-033 (ProjectTreeItem変更)
                         │
                         └──→ TASK-EE-034 (プロジェクト詳細ページ削除)
```

## 進捗サマリー

| Phase | タスク数 | 完了 | 進捗率 |
|-------|---------|------|--------|
| Phase 1: データモデルとサービス層 | 3 | 3 | 100% |
| Phase 2: アダプター層 | 4 | 4 | 100% |
| Phase 3: API層 | 4 | 4 | 100% |
| Phase 4: WebSocket統合 | 1 | 1 | 100% |
| Phase 5: UI実装 | 4 | 4 | 100% |
| Phase 6: マイグレーションと仕上げ | 3 | 3 | 100% |
| Phase 7: Dockerイメージ設定機能 | 6 | 6 | 100% |
| Phase 8: Dockerfileアップロード機能 | 5 | 5 | 100% |
| Phase 9: サイドメニューセッション作成改善 | 4 | 4 | 100% |
| **合計** | **34** | **34** | **100%** |
