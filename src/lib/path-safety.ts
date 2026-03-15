import { resolve, normalize } from 'path';

/**
 * パスを正規化し、パストラバーサル攻撃を防止する
 *
 * - resolve() で絶対パスに変換
 * - normalize() で冗長なセパレータや . / .. を解決
 * - null bytes を除去
 *
 * @param inputPath - ユーザー入力のパス
 * @returns 正規化された絶対パス
 */
export function sanitizePath(inputPath: string): string {
  // null byte injection 防止
  const cleaned = inputPath.replace(/\0/g, '');
  return resolve(normalize(cleaned));
}

/**
 * 正規化されたパスが指定のベースディレクトリ配下にあることを確認する
 *
 * @param targetPath - 検証対象のパス（未正規化でも可）
 * @param baseDir - 許可されたベースディレクトリ
 * @returns ベースディレクトリ配下であれば true
 */
export function isWithinBase(targetPath: string, baseDir: string): boolean {
  const resolvedTarget = sanitizePath(targetPath);
  const resolvedBase = sanitizePath(baseDir);
  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(resolvedBase + '/');
}

/**
 * パスコンポーネント（ファイル名やディレクトリ名）がパストラバーサルを含まないことを確認する
 *
 * @param component - パスの一部分（ファイル名、リポジトリ名など）
 * @returns 安全であれば true
 */
export function isSafePathComponent(component: string): boolean {
  if (!component) return false;
  // null bytes, path separators, parent directory reference を拒否
  if (component.includes('\0')) return false;
  if (component.includes('/') || component.includes('\\')) return false;
  if (component === '..' || component === '.') return false;
  return true;
}
