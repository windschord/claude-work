import path from 'path';
import fs from 'fs';

/**
 * DATA_DIR環境変数またはデフォルト値からデータディレクトリのパスを取得する
 * @returns 絶対パスに解決されたデータディレクトリパス
 */
export function getDataDir(): string {
  const dataDir = process.env.DATA_DIR?.trim();
  if (dataDir) {
    return path.resolve(dataDir);
  }
  return path.resolve(process.cwd(), 'data');
}

/**
 * リポジトリclone先ディレクトリのパスを取得する
 * @returns ${DATA_DIR}/repos のパス
 */
export function getReposDir(): string {
  return path.join(getDataDir(), 'repos');
}

/**
 * Docker環境の認証情報ディレクトリのパスを取得する
 * @returns ${DATA_DIR}/environments のパス
 */
export function getEnvironmentsDir(): string {
  return path.join(getDataDir(), 'environments');
}

/**
 * データディレクトリ（data, repos, environments）を作成する
 * 既に存在する場合は何もしない
 */
export function ensureDataDirs(): void {
  const dirs = [getDataDir(), getReposDir(), getEnvironmentsDir()];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
