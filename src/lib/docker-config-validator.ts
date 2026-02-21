/**
 * Docker環境設定のバリデーションモジュール
 *
 * フロントエンド・バックエンド両方で使用するため、
 * Node.js固有API（path.resolve()等）は使わず、文字列操作で実装する。
 */

import type { PortMapping, VolumeMount } from '@/types/environment';

/** 危険なホストパス一覧 */
export const DANGEROUS_HOST_PATHS = [
  '/',
  '/etc',
  '/proc',
  '/sys',
  '/dev',
  '/root',
  '/boot',
  '/sbin',
  '/bin',
  '/usr/sbin',
  '/var',
] as const;

/** システムコンテナパス一覧（Docker環境が内部で使用するパス） */
export const SYSTEM_CONTAINER_PATHS = [
  '/workspace',
  '/home/node/.claude',
  '/home/node/.config/claude',
  '/home/node/.ssh',
  '/home/node/.gitconfig',
] as const;

/** バリデーション結果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * ポート番号が有効かどうかを検証する
 */
function validatePort(port: number, label: string, index: number): string[] {
  const errors: string[] = [];

  if (typeof port !== 'number' || isNaN(port)) {
    errors.push(`マッピング${index + 1}: ${label}が有効な数値ではありません`);
    return errors;
  }

  if (!Number.isInteger(port)) {
    errors.push(`マッピング${index + 1}: ${label}は整数である必要があります`);
    return errors;
  }

  if (port < 1 || port > 65535) {
    errors.push(`マッピング${index + 1}: ${label}は1から65535の範囲である必要があります`);
  }

  return errors;
}

/**
 * ポートマッピング配列をバリデーションする
 */
export function validatePortMappings(mappings: PortMapping[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < mappings.length; i++) {
    const mapping = mappings[i];

    errors.push(...validatePort(mapping.hostPort, 'hostPort', i));
    errors.push(...validatePort(mapping.containerPort, 'containerPort', i));

    // protocol バリデーション
    const protocol = (mapping.protocol ?? 'tcp').toLowerCase();
    if (protocol !== 'tcp' && protocol !== 'udp') {
      errors.push(`マッピング${i + 1}: protocolは"tcp"または"udp"である必要があります`);
    }
  }

  // hostPort + protocol の重複チェック
  const seen = new Set<string>();
  for (let i = 0; i < mappings.length; i++) {
    const mapping = mappings[i];
    const normalizedProtocol = (mapping.protocol ?? 'tcp').toLowerCase();
    const key = `${mapping.hostPort}:${normalizedProtocol}`;

    if (seen.has(key)) {
      errors.push(
        `マッピング${i + 1}: hostPort ${mapping.hostPort}/${mapping.protocol} が重複しています`
      );
    }
    seen.add(key);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * ボリュームマウント配列をバリデーションする
 */
export function validateVolumeMounts(mounts: VolumeMount[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < mounts.length; i++) {
    const mount = mounts[i];

    // 絶対パスチェック
    if (!mount.hostPath.startsWith('/')) {
      errors.push(`マウント${i + 1}: hostPathは絶対パスである必要があります`);
    }

    if (!mount.containerPath.startsWith('/')) {
      errors.push(`マウント${i + 1}: containerPathは絶対パスである必要があります`);
    }

    // パストラバーサルチェック
    if (mount.hostPath.includes('..')) {
      errors.push(`マウント${i + 1}: hostPathに「..」を含めることはできません`);
    }

    if (mount.containerPath.includes('..')) {
      errors.push(`マウント${i + 1}: containerPathに「..」を含めることはできません`);
    }

    // コロン文字チェック（Docker -v デリミタとの衝突防止）
    if (mount.hostPath.includes(':')) {
      errors.push(`マウント${i + 1}: hostPathに「:」を含めることはできません`);
    }

    if (mount.containerPath.includes(':')) {
      errors.push(`マウント${i + 1}: containerPathに「:」を含めることはできません`);
    }

    // 危険なホストパスチェック
    if (isDangerousPath(mount.hostPath)) {
      warnings.push(
        `マウント${i + 1}: hostPath「${mount.hostPath}」は危険なシステムパスです`
      );
    }

    // システムコンテナパスチェック
    if (isSystemContainerPath(mount.containerPath)) {
      errors.push(
        `マウント${i + 1}: containerPath「${mount.containerPath}」はシステムが使用するパスのためマウントできません`
      );
    }
    // accessMode バリデーション
    const accessMode = mount.accessMode ?? 'rw';
    if (accessMode !== 'rw' && accessMode !== 'ro') {
      errors.push(`マウント${i + 1}: accessModeは"rw"または"ro"である必要があります`);
    }
  }

  // containerPath の重複チェック
  const seen = new Set<string>();
  for (let i = 0; i < mounts.length; i++) {
    const containerPath = mounts[i].containerPath;

    if (seen.has(containerPath)) {
      errors.push(
        `マウント${i + 1}: containerPath「${containerPath}」が重複しています`
      );
    }
    seen.add(containerPath);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 指定されたホストパスが危険なシステムパスかどうかを判定する
 * 完全一致またはサブパス（/etc/nginx等）の場合にtrueを返す
 */
export function isDangerousPath(hostPath: string): boolean {
  for (const dangerousPath of DANGEROUS_HOST_PATHS) {
    if (hostPath === dangerousPath || hostPath.startsWith(dangerousPath + '/')) {
      return true;
    }
  }
  return false;
}

/**
 * 指定されたコンテナパスがシステム予約パスかどうかを判定する
 * 完全一致またはサブパス（/workspace/sub等）の場合にtrueを返す
 */
export function isSystemContainerPath(containerPath: string): boolean {
  for (const systemPath of SYSTEM_CONTAINER_PATHS) {
    if (containerPath === systemPath || containerPath.startsWith(systemPath + '/')) {
      return true;
    }
  }
  return false;
}
