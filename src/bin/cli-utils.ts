/**
 * CLI ユーティリティ関数
 *
 * テスト可能にするため、cli.ts から抽出した関数群
 */

import fs from 'fs';
import path from 'path';

/**
 * Next.jsビルドが存在し、完全かどうかを確認
 * BUILD_ID、static、serverディレクトリの存在を検証
 *
 * @param projectRoot - プロジェクトルートディレクトリ
 * @returns ビルドが完全な場合はtrue、それ以外はfalse
 */
export function checkNextBuild(projectRoot: string): boolean {
  const nextDir = path.join(projectRoot, '.next');
  const buildIdPath = path.join(nextDir, 'BUILD_ID');
  const staticDir = path.join(nextDir, 'static');
  const serverDir = path.join(nextDir, 'server');

  // 必須ファイル・ディレクトリが全て存在するか確認
  if (!fs.existsSync(nextDir)) {
    return false;
  }

  if (!fs.existsSync(buildIdPath)) {
    console.log('Build incomplete: BUILD_ID not found');
    return false;
  }

  if (!fs.existsSync(staticDir)) {
    console.log('Build incomplete: static directory not found');
    return false;
  }

  if (!fs.existsSync(serverDir)) {
    console.log('Build incomplete: server directory not found');
    return false;
  }

  return true;
}

/**
 * drizzle-ormがインストールされているか確認
 *
 * projectRoot/node_modules/drizzle-orm を最初に確認し、
 * 見つからない場合は上位ディレクトリの node_modules も探索する。
 * npx実行時はパッケージがフラットにインストールされるため、
 * drizzle-orm が親の node_modules に配置されるケースに対応。
 *
 * @param projectRoot - プロジェクトルートディレクトリ
 * @returns drizzle-ormが存在する場合はtrue
 */
export function checkDrizzle(projectRoot: string): boolean {
  let current = path.resolve(projectRoot);
  const root = path.parse(current).root;

  while (current !== root) {
    const drizzlePath = path.join(current, 'node_modules', 'drizzle-orm');
    if (fs.existsSync(drizzlePath)) {
      return true;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return false;
}

/**
 * node_modules/.bin ディレクトリを探索する
 *
 * projectRoot から上位ディレクトリを辿り、node_modules/.bin を探す。
 * npx実行時はバイナリが親の node_modules/.bin に配置されるケースに対応。
 * 見つからない場合は projectRoot/node_modules/.bin をフォールバックとして返す。
 *
 * @param projectRoot - プロジェクトルートディレクトリ
 * @returns node_modules/.bin ディレクトリのパス
 */
export function findBinDir(projectRoot: string): string {
  const fallback = path.join(projectRoot, 'node_modules', '.bin');
  let current = path.resolve(projectRoot);
  const root = path.parse(current).root;

  while (current !== root) {
    const binDir = path.join(current, 'node_modules', '.bin');
    if (fs.existsSync(binDir)) {
      return binDir;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return fallback;
}

/**
 * データベースファイルが存在するか確認
 *
 * @param projectRoot - プロジェクトルートディレクトリ
 * @returns データベースが存在する場合はtrue
 */
export function checkDatabase(projectRoot: string): boolean {
  const dbPath = path.join(projectRoot, 'data', 'claudework.db');
  return fs.existsSync(dbPath);
}
