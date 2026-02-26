import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDataDir } from './data-dir';

const KEY_FILE_NAME = 'encryption.key';

/**
 * Base64エンコードされた暗号化キーを検証する
 * @param raw 検証対象の文字列
 * @param source キーのソース（エラーメッセージ用）
 * @returns trimされたキー文字列
 * @throws 不正なキーの場合
 */
function validateKey(raw: string, source: 'env' | 'file'): string {
  const key = raw.trim();
  if (!key) {
    throw new Error(`Invalid ENCRYPTION_KEY from ${source}: key is empty`);
  }
  const decoded = Buffer.from(key, 'base64');
  if (decoded.length !== 32) {
    throw new Error(
      `Invalid ENCRYPTION_KEY from ${source}: expected 32 bytes, got ${decoded.length} bytes. ` +
      `Please generate a valid key with: openssl rand -base64 32`
    );
  }
  return key;
}

/**
 * ENCRYPTION_KEYを確保する
 * 1. 環境変数が設定済みならそのまま使用
 * 2. キーファイルが存在すれば読み込み
 * 3. どちらもなければ新規生成してファイルに保存
 *
 * @returns キーのソース ('env' | 'file' | 'generated')
 */
export function ensureEncryptionKey(): 'env' | 'file' | 'generated' {
  if (process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = validateKey(process.env.ENCRYPTION_KEY, 'env');
    return 'env';
  }

  const keyFilePath = path.join(getDataDir(), KEY_FILE_NAME);

  try {
    const key = validateKey(fs.readFileSync(keyFilePath, 'utf-8'), 'file');
    process.env.ENCRYPTION_KEY = key;
    return 'file';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const key = randomBytes(32).toString('base64');
  try {
    fs.writeFileSync(keyFilePath, key, { mode: 0o600, flag: 'wx' });
    process.env.ENCRYPTION_KEY = key;
    return 'generated';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const existingKey = validateKey(fs.readFileSync(keyFilePath, 'utf-8'), 'file');
    process.env.ENCRYPTION_KEY = existingKey;
    return 'file';
  }
}
