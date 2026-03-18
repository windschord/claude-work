# SshKeyService

## 概要

**目的**: SSH鍵の登録・削除・バリデーションを提供

**責務**:
- SSH鍵の新規登録（暗号化を含む）
- SSH鍵一覧の取得（公開鍵のみ）
- SSH鍵の削除
- SSH鍵フォーマットのバリデーション
- SSH鍵名の重複チェック

## インターフェース

### 主要メソッド

#### `registerKey(input: RegisterKeyInput): Promise<SshKey>`
SSH鍵を新規登録（秘密鍵をAES-256で暗号化して保存）

**パラメータ**:
- `name`: 鍵の識別名
- `private_key`: SSH秘密鍵（平文）
- `public_key`: SSH公開鍵（任意、省略時は秘密鍵から生成）
- `passphrase`: パスフレーズ（任意）

#### `getAllKeys(): Promise<SshKeyPublic[]>`
登録済みSSH鍵の一覧を取得（秘密鍵は含まない）

#### `getKeyById(id: string): Promise<SshKey | null>`
SSH鍵をIDで取得

#### `deleteKey(id: string): Promise<void>`
SSH鍵を削除

#### `validateKeyFormat(privateKey: string): boolean`
SSH鍵フォーマットのバリデーション

## 依存関係

- **EncryptionService**: SSH秘密鍵の暗号化・復号化
- **Prisma Client**: データベースアクセス
- **SshKey テーブル**: データ永続化

## 関連要件

- [US-003](../../requirements/dev-tool-settings/stories/US-003.md): SSH 鍵ペアの登録・管理
- [NFR-SEC-001](../../requirements/dev-tool-settings/nfr/security.md): SSH 秘密鍵の暗号化保存
