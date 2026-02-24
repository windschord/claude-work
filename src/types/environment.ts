/**
 * Docker環境設定の型定義
 */

/** ポートマッピング設定 */
export interface PortMapping {
  hostPort: number;                   // 1-65535
  containerPort: number;              // 1-65535
  protocol?: 'tcp' | 'udp';          // 省略時のデフォルト: 'tcp'
}

/** ボリュームマウント設定 */
export interface VolumeMount {
  hostPath: string;                   // 絶対パス
  containerPath: string;              // 絶対パス
  accessMode?: 'rw' | 'ro';          // 省略時のデフォルト: 'rw'
}

/** Docker環境の拡張config */
export interface DockerEnvironmentConfig {
  imageSource?: 'existing' | 'dockerfile';
  imageName?: string;
  imageTag?: string;
  dockerfilePath?: string;
  dockerfileUploaded?: boolean;
  skipPermissions?: boolean;
  portMappings?: PortMapping[];
  volumeMounts?: VolumeMount[];
}
