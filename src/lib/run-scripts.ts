/**
 * Run Scripts ユーティリティ
 *
 * run_scriptsフィールドのシリアライズ/デシリアライズを提供します。
 * DBでは文字列として保存され、アプリケーション層では配列として扱われます。
 */

export type RunScript = {
  name: string;
  command: string;
};

/**
 * DB格納用の文字列からRunScript配列にパース
 *
 * @param value - JSON文字列またはnull/undefined
 * @returns RunScript配列
 */
export function parseRunScripts(value: string | null | undefined): RunScript[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

/**
 * RunScript配列をDB格納用の文字列にシリアライズ
 *
 * @param scripts - RunScript配列
 * @returns JSON文字列
 */
export function serializeRunScripts(scripts: RunScript[] | null | undefined): string {
  if (!scripts || !Array.isArray(scripts)) {
    return JSON.stringify([]);
  }
  return JSON.stringify(scripts);
}
