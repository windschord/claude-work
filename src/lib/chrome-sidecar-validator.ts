/**
 * Chrome Sidecar設定のバリデーション
 *
 * Environment APIのconfig JSONに含まれるchromeSidecar設定を検証する。
 */

/**
 * chromeSidecar config のバリデーション
 *
 * @param config - config オブジェクト全体
 * @returns エラーメッセージ（正常時はnull）
 */
export function validateChromeSidecarConfig(
  config: Record<string, unknown>
): string | null {
  if (!config.chromeSidecar) return null; // 省略OK

  const sidecar = config.chromeSidecar as Record<string, unknown>;

  if (typeof sidecar.enabled !== 'boolean') {
    return 'chromeSidecar.enabled is required and must be a boolean';
  }

  if (!sidecar.enabled) return null; // disabled時はimage/tagのバリデーション不要

  if (typeof sidecar.image !== 'string' || !/^[-a-z0-9._/:]+$/.test(sidecar.image)) {
    return 'chromeSidecar.image must be a valid Docker image name (lowercase alphanumeric, dots, slashes, colons, hyphens)';
  }

  if (typeof sidecar.tag !== 'string' || sidecar.tag.trim() === '') {
    return 'chromeSidecar.tag is required';
  }

  if (sidecar.tag === 'latest') {
    return 'chromeSidecar.tag must be a specific version (latest is not allowed for reproducibility)';
  }

  return null;
}
