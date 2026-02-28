/**
 * Docker Volume命名ユーティリティ
 *
 * Volume名の生成・バリデーションを提供する。
 * フロントエンド・バックエンド共用。
 */

/** Volume種別 */
export type VolumeType = 'repo' | 'config';

/** Volume種別ごとのプレフィックス */
const VOLUME_PREFIX: Record<VolumeType, string> = {
  repo: 'cw-repo',
  config: 'cw-config',
};

/** Docker Volume名の正規表現制約: 先頭は英数字、以降は英数字・アンダースコア・ドット・ハイフン */
const DOCKER_VOLUME_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

/**
 * 入力文字列からDocker Volume名に使用可能なスラッグを生成する
 *
 * 変換ルール:
 * 1. 小文字に変換
 * 2. スペース・特殊文字をハイフンに変換
 * 3. ASCII英数字・ハイフン・アンダースコア・ドット以外を除去
 * 4. 連続するハイフンを1つに統合
 * 5. 先頭・末尾のハイフンを除去
 * 6. 結果が空の場合、空文字列を返す
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Volume名を生成する（重複チェックなし）
 *
 * @param type - Volume種別 ('repo' | 'config')
 * @param name - 元の名前（プロジェクト名 or 環境名）
 * @param fallbackId - スラッグが空の場合に使用する短縮ID
 * @returns `cw-{type}-{slug}` 形式の文字列
 */
export function generateVolumeName(type: VolumeType, name: string, fallbackId?: string): string {
  const slug = generateSlug(name) || fallbackId || 'unknown';
  return `${VOLUME_PREFIX[type]}-${slug}`;
}

/**
 * 既存Volume名のリストを受け取り、重複しない一意なVolume名を生成する
 * 重複時は `-2`, `-3`, ... のサフィックスを追加
 */
export function generateUniqueVolumeName(
  type: VolumeType,
  name: string,
  existingNames: string[],
  fallbackId?: string,
): string {
  const baseName = generateVolumeName(type, name, fallbackId);
  const existingSet = new Set(existingNames);

  if (!existingSet.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  while (existingSet.has(`${baseName}-${suffix}`)) {
    suffix++;
  }

  return `${baseName}-${suffix}`;
}

/**
 * Docker Volume名のバリデーション
 * Docker Volume名の制約: 先頭は英数字、以降は英数字・アンダースコア・ドット・ハイフン
 */
export function validateVolumeName(name: string): boolean {
  if (!name) return false;
  return DOCKER_VOLUME_NAME_REGEX.test(name);
}
