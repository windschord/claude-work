import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDataDir } from './data-dir';

const KEY_FILE_NAME = 'encryption.key';

/**
 * ENCRYPTION_KEYを確保する
 * 1. 環境変数が設定済みならそのまま使用
 * 2. キーファイルが存在すれば読み込み
 * 3. どちらもなければ新規生成してファイルに保存
 */
export function ensureEncryptionKey(): void {
  if (process.env.ENCRYPTION_KEY) {
    return;
  }

  const keyFilePath = path.join(getDataDir(), KEY_FILE_NAME);

  if (fs.existsSync(keyFilePath)) {
    const key = fs.readFileSync(keyFilePath, 'utf-8');
    process.env.ENCRYPTION_KEY = key;
    return;
  }

  const key = randomBytes(32).toString('base64');
  fs.writeFileSync(keyFilePath, key, { mode: 0o600 });
  process.env.ENCRYPTION_KEY = key;
}
