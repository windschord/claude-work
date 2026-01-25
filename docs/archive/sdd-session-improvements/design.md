# 設計: セッション管理機能の改善

## アーキテクチャ概要

```text
┌─────────────────────────────────────────────────────────────┐
│                      Frontend                                │
├─────────────────────────────────────────────────────────────┤
│  SessionCard.tsx          CreateSessionForm.tsx              │
│  ├─ 削除ボタン追加         ├─ 名前入力を任意に変更           │
│  └─ DeleteSessionDialog    ├─ セッション数選択を削除         │
│     (新規)                 └─ 自動命名ロジック呼び出し       │
├─────────────────────────────────────────────────────────────┤
│                      Utility                                 │
├─────────────────────────────────────────────────────────────┤
│  src/lib/session-name-generator.ts (新規)                   │
│  ├─ 形容詞リスト (50語程度)                                 │
│  ├─ 動物名リスト (50語程度)                                 │
│  └─ generateSessionName(): string                           │
├─────────────────────────────────────────────────────────────┤
│                      Backend API                             │
├─────────────────────────────────────────────────────────────┤
│  POST /api/projects/[project_id]/sessions                   │
│  ├─ name を任意パラメータに変更                             │
│  └─ name未指定時は自動生成                                  │
│                                                              │
│  DELETE /api/projects/[project_id]/sessions/bulk            │
│  └─ 削除（使用されないため）                                │
└─────────────────────────────────────────────────────────────┘
```

## コンポーネント設計

### 1. DeleteSessionDialog（新規）

**ファイル**: `src/components/sessions/DeleteSessionDialog.tsx`

**目的**: セッション削除の確認ダイアログを表示

**Props**:
```typescript
interface DeleteSessionDialogProps {
  isOpen: boolean;
  sessionName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}
```

**UI構成**:
- ダイアログタイトル: 「セッションを削除」
- 警告メッセージ: 「セッション「{sessionName}」を削除しますか？この操作は取り消せません。」
- キャンセルボタン: グレー、左側
- 削除ボタン: 赤色、右側、isDeleting時はローディング表示

### 2. SessionCard（変更）

**ファイル**: `src/components/sessions/SessionCard.tsx`

**変更内容**:
- 削除ボタン（ゴミ箱アイコン）を追加
- DeleteSessionDialogの状態管理を追加
- 削除処理のハンドラを追加

### 3. CreateSessionForm（変更）

**ファイル**: `src/components/sessions/CreateSessionForm.tsx`

**変更内容**:
- セッション名入力を任意に変更（placeholder更新）
- セッション数選択UI（NumericInput）を削除
- 複数セッション作成関連のロジックを削除
- 名前未入力時の自動生成ロジックを追加

### 4. session-name-generator（新規）

**ファイル**: `src/lib/session-name-generator.ts`

**目的**: 可読性のあるセッション名を自動生成

**インターフェース**:
```typescript
/**
 * 形容詞-動物名形式のセッション名を生成する
 * @returns 生成されたセッション名（例: "gentle-panda"）
 */
export function generateSessionName(): string;

/**
 * 既存のセッション名と重複しない名前を生成する
 * @param existingNames 既存のセッション名の配列
 * @param maxAttempts 最大試行回数（デフォルト: 10）
 * @returns 一意のセッション名
 */
export function generateUniqueSessionName(
  existingNames: string[],
  maxAttempts?: number
): string;
```

**単語リスト（各50語程度）**:

形容詞例:
```
swift, gentle, brave, calm, clever, eager, fierce, happy,
jolly, keen, lively, merry, noble, proud, quick, quiet,
rapid, steady, strong, wise, agile, bold, bright, cool,
daring, epic, fancy, grand, humble, ideal, jovial, kind,
lucky, mighty, neat, optimal, prime, royal, serene, super,
tender, ultra, vivid, warm, witty, young, zealous, active, cosmic, digital
```

動物名例:
```
panda, falcon, tiger, dolphin, eagle, fox, hawk, jaguar,
koala, lion, monkey, otter, penguin, rabbit, shark, turtle,
whale, wolf, zebra, bear, cheetah, deer, elephant, flamingo,
giraffe, heron, iguana, jellyfish, kangaroo, lemur, moose,
narwhal, owl, parrot, quail, raven, seal, toucan, urchin,
viper, walrus, xerus, yak, badger, cougar, dove, ferret, goose, hummingbird
```

## API設計

### POST /api/projects/[project_id]/sessions

**変更内容**: `name`パラメータを任意に変更

**リクエスト（変更後）**:
```typescript
interface CreateSessionRequest {
  name?: string;      // 任意（未指定時は自動生成）
  prompt: string;     // 必須
  model?: string;     // 任意（デフォルト: プロジェクト設定）
}
```

**処理フロー（変更後）**:
1. name未指定の場合、generateSessionName()で自動生成
2. 既存セッション名との重複チェック
3. 重複時はgenerateUniqueSessionName()で再生成
4. 以降は既存の処理

### DELETE /api/projects/[project_id]/sessions/bulk

**変更内容**: エンドポイント自体を削除（ファイル削除）

## 技術的決定事項

### 決定1: セッション名生成をフロントエンドで行う

**検討した選択肢**:
- A) フロントエンドで生成（CreateSessionForm内）
- B) バックエンドAPIで生成

**決定**: A) フロントエンドで生成

**根拠**:
- ユーザーに生成された名前を即座にプレビュー表示できる
- 名前が気に入らなければ送信前に編集できる
- バックエンドAPIの変更を最小限に抑えられる

### 決定2: 単語リストはハードコードする

**検討した選択肢**:
- A) JSONファイルから読み込む
- B) TypeScriptにハードコード

**決定**: B) TypeScriptにハードコード

**根拠**:
- 単語リストは頻繁に変更されない
- ファイル読み込みのオーバーヘッドを避けられる
- 型安全性が確保できる

### 決定3: 削除確認ダイアログは専用コンポーネントとして実装

**検討した選択肢**:
- A) 既存のDialogコンポーネントを直接使用
- B) 専用のDeleteSessionDialogコンポーネントを作成

**決定**: B) 専用コンポーネント

**根拠**:
- 削除に特化したUIロジックをカプセル化できる
- 再利用性が高い（他の箇所でセッション削除が必要になった場合）
- テストが書きやすい

## ファイル構成

```text
src/
├── components/
│   └── sessions/
│       ├── SessionCard.tsx           # 変更（削除ボタン追加）
│       ├── CreateSessionForm.tsx     # 変更（簡略化）
│       └── DeleteSessionDialog.tsx   # 新規
├── lib/
│   └── session-name-generator.ts     # 新規
└── app/
    └── api/
        └── projects/
            └── [project_id]/
                └── sessions/
                    ├── route.ts      # 変更（name任意化）
                    └── bulk/
                        └── route.ts  # 削除
```
