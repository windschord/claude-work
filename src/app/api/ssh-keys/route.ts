import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { EncryptionService } from '@/services/encryption-service';
import { logger } from '@/lib/logger';
import { eq } from 'drizzle-orm';

const encryptionService = new EncryptionService();

// SSH鍵名のバリデーション
function isValidKeyName(name: string): boolean {
  // 1-100文字、英数字、ハイフン、アンダースコアのみ
  return /^[a-zA-Z0-9_-]{1,100}$/.test(name);
}

// SSH公開鍵のバリデーション
function isValidPublicKey(key: string): boolean {
  // ssh-rsa, ssh-ed25519, ecdsa-sha2-nistp256 などで始まることを確認
  return /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/]+=*(\s+.+)?$/.test(key);
}

// SSH秘密鍵のバリデーション
function isValidPrivateKey(key: string): boolean {
  // -----BEGIN で始まり -----END で終わることを確認
  return key.includes('-----BEGIN') && key.includes('-----END');
}

/**
 * GET /api/ssh-keys - すべてのSSH鍵を取得（公開鍵のみ）
 */
export async function GET(_request: NextRequest) {
  try {
    const keys = db
      .select({
        id: schema.sshKeys.id,
        name: schema.sshKeys.name,
        public_key: schema.sshKeys.public_key,
        has_passphrase: schema.sshKeys.has_passphrase,
        created_at: schema.sshKeys.created_at,
        updated_at: schema.sshKeys.updated_at,
      })
      .from(schema.sshKeys)
      .all();

    return NextResponse.json({ keys }, { status: 200 });
  } catch (error) {
    logger.error('Failed to fetch SSH keys', { error });
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ssh-keys - 新しいSSH鍵を登録
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '不正なJSONです',
          },
        },
        { status: 400 }
      );
    }

    const { name, private_key, public_key, passphrase } = body;

    // 必須フィールドのバリデーション
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'SSH鍵名は必須です',
            details: { field: 'name', value: name },
          },
        },
        { status: 400 }
      );
    }

    if (!isValidKeyName(name)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'SSH鍵名は英数字、ハイフン、アンダースコアのみ使用可能です（1-100文字）',
            details: { field: 'name', value: name },
          },
        },
        { status: 400 }
      );
    }

    if (!private_key || typeof private_key !== 'string') {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'SSH秘密鍵は必須です',
            details: { field: 'private_key' },
          },
        },
        { status: 400 }
      );
    }

    if (!isValidPrivateKey(private_key)) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'SSH秘密鍵の形式が正しくありません',
            details: { field: 'private_key' },
          },
        },
        { status: 400 }
      );
    }

    // 公開鍵のバリデーション（オプショナル）
    if (public_key !== undefined && public_key !== null) {
      if (typeof public_key !== 'string' || !isValidPublicKey(public_key)) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'SSH公開鍵の形式が正しくありません',
              details: { field: 'public_key' },
            },
          },
          { status: 400 }
        );
      }
    }

    // 名前の重複チェック
    const existingKey = db
      .select()
      .from(schema.sshKeys)
      .where(eq(schema.sshKeys.name, name))
      .get();

    if (existingKey) {
      return NextResponse.json(
        {
          error: {
            code: 'DUPLICATE_SSH_KEY_NAME',
            message: 'この名前のSSH鍵は既に登録されています',
            details: { field: 'name', value: name },
          },
        },
        { status: 409 }
      );
    }

    // 公開鍵が提供されていない場合、秘密鍵から生成
    // （実際には、クライアント側で生成されることを期待）
    const finalPublicKey = public_key || `Generated from private key for ${name}`;

    // 秘密鍵を暗号化
    // EncryptionServiceはiv:authTag:encryptedの形式で返す
    const encryptedData = await encryptionService.encrypt(private_key);
    const [iv, authTag] = encryptedData.split(':');

    // データベースに保存
    // private_key_encryptedには完全な暗号化データ（iv:authTag:encrypted）を保存
    // encryption_ivには参照用にiv:authTagを保存
    const newKey = db
      .insert(schema.sshKeys)
      .values({
        name,
        public_key: finalPublicKey,
        private_key_encrypted: encryptedData,
        encryption_iv: `${iv}:${authTag}`,
        has_passphrase: !!passphrase,
      })
      .returning({
        id: schema.sshKeys.id,
        name: schema.sshKeys.name,
        public_key: schema.sshKeys.public_key,
        has_passphrase: schema.sshKeys.has_passphrase,
        created_at: schema.sshKeys.created_at,
        updated_at: schema.sshKeys.updated_at,
      })
      .get();

    logger.info('SSH key registered', { keyId: newKey.id, keyName: newKey.name });

    return NextResponse.json({ key: newKey }, { status: 201 });
  } catch (error) {
    logger.error('Failed to register SSH key', { error });
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'サーバー内部エラーが発生しました',
        },
      },
      { status: 500 }
    );
  }
}
