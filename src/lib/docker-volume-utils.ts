/**
 * Docker名前付きVolumeのユーティリティ関数
 *
 * EnvironmentServiceとDockerAdapterの両方から使用される共通ロジックを提供する。
 */

/**
 * 環境IDからClaude設定用Volume名を生成する
 * @param environmentId - 環境ID
 * @returns claudeVolume と configClaudeVolume の名前
 */
export function getConfigVolumeNames(environmentId: string): {
  claudeVolume: string;
  configClaudeVolume: string;
} {
  return {
    claudeVolume: `claude-config-claude-${environmentId}`,
    configClaudeVolume: `claude-config-configclaude-${environmentId}`,
  };
}
