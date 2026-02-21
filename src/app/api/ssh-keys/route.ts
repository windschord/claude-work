import { NextRequest, NextResponse } from 'next/server';
import {
  SshKeyService,
  DuplicateSshKeyNameError,
  InvalidSshKeyError,
  SshKeyEncryptionError,
} from '@/services/ssh-key-service';
import type { SshKeySummary } from '@/services/ssh-key-service';
import { logger } from '@/lib/logger';

const service = new SshKeyService();

function toApiResponse(key: SshKeySummary) {
  return {
    id: key.id,
    name: key.name,
    public_key: key.publicKey,
    has_passphrase: key.hasPassphrase,
    created_at: key.createdAt,
    updated_at: key.updatedAt,
  };
}

function validateRegisterInput(body: unknown): {
  valid: boolean;
  error?: { code: string; message: string };
  data?: { name: string; privateKey: string; publicKey: string; hasPassphrase: boolean };
} {
  if (body === null || typeof body !== 'object') {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'リクエストボディが不正です',
      },
    };
  }

  const { name, private_key, public_key, passphrase } = body as Record<string, unknown>;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'name は必須です',
      },
    };
  }

  if (!private_key || typeof private_key !== 'string' || private_key.trim().length === 0) {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'private_key は必須です',
      },
    };
  }

  if (public_key !== undefined && typeof public_key !== 'string') {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'public_key は文字列である必要があります',
      },
    };
  }

  if (passphrase !== undefined && typeof passphrase !== 'string') {
    return {
      valid: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'passphrase は文字列である必要があります',
      },
    };
  }

  return {
    valid: true,
    data: {
      name: (name as string).trim(),
      privateKey: private_key as string,
      publicKey: typeof public_key === 'string' ? public_key : '',
      hasPassphrase: !!passphrase,
    },
  };
}

/**
 * GET /api/ssh-keys - SSH鍵一覧を取得
 */
export async function GET(_request: NextRequest) {
  try {
    const keys = await service.getAllKeys();

    return NextResponse.json(
      { keys: keys.map(toApiResponse) },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Failed to get SSH keys', { error });
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
 * POST /api/ssh-keys - SSH鍵を登録
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

    const validation = validateRegisterInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const key = await service.registerKey(validation.data!);

    return NextResponse.json(
      { key: toApiResponse(key) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof DuplicateSshKeyNameError) {
      return NextResponse.json(
        {
          error: {
            code: 'DUPLICATE_NAME',
            message: '同名のSSH鍵が既に登録されています',
          },
        },
        { status: 409 }
      );
    }

    if (error instanceof InvalidSshKeyError) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_KEY_FORMAT',
            message: 'SSH秘密鍵の形式が不正です',
          },
        },
        { status: 400 }
      );
    }

    if (error instanceof SshKeyEncryptionError) {
      logger.error('SSH key encryption error', { error });
      return NextResponse.json(
        {
          error: {
            code: 'ENCRYPTION_ERROR',
            message: 'SSH鍵の暗号化に失敗しました',
          },
        },
        { status: 500 }
      );
    }

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
