import { describe, it, expect } from 'vitest';
import {
  validatePortMappings,
  validateVolumeMounts,
  isDangerousPath,
  isSystemContainerPath,
} from '../docker-config-validator';
import type { PortMapping, VolumeMount } from '@/types/environment';

describe('docker-config-validator', () => {
  describe('validatePortMappings', () => {
    it('正常なポートマッピング配列で valid: true', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 3000, protocol: 'tcp' },
        { hostPort: 9090, containerPort: 9090, protocol: 'udp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('空配列で valid: true', () => {
      const result = validatePortMappings([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('ポート番号0でエラー', () => {
      const mappings: PortMapping[] = [
        { hostPort: 0, containerPort: 3000, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('1'))).toBe(true);
      expect(result.errors.some((e) => e.includes('65535'))).toBe(true);
    });

    it('ポート番号65536でエラー', () => {
      const mappings: PortMapping[] = [
        { hostPort: 65536, containerPort: 3000, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('ポート番号が整数でない場合エラー（例: 3.14）', () => {
      const mappings: PortMapping[] = [
        { hostPort: 3.14, containerPort: 3000, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('整数'))).toBe(true);
    });

    it('同一hostPort+protocol重複でエラー', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 3000, protocol: 'tcp' },
        { hostPort: 8080, containerPort: 4000, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
    });

    it('異なるプロトコルの同一ポートは許可', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 3000, protocol: 'tcp' },
        { hostPort: 8080, containerPort: 3000, protocol: 'udp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('hostPort/containerPortが空（NaN等）でエラー', () => {
      const mappings: PortMapping[] = [
        { hostPort: NaN, containerPort: NaN, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateVolumeMounts', () => {
    it('正常なボリュームマウント配列で valid: true', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/home/user/data', containerPath: '/data', accessMode: 'rw' },
        { hostPath: '/tmp/logs', containerPath: '/logs', accessMode: 'ro' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('空配列で valid: true', () => {
      const result = validateVolumeMounts([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('hostPathが絶対パスでないとエラー', () => {
      const mounts: VolumeMount[] = [
        { hostPath: 'relative/path', containerPath: '/data', accessMode: 'rw' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('絶対パス'))).toBe(true);
    });

    it('containerPathが絶対パスでないとエラー', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/home/user/data', containerPath: 'relative/path', accessMode: 'rw' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('絶対パス'))).toBe(true);
    });

    it('同一containerPath重複でエラー', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/home/user/data1', containerPath: '/data', accessMode: 'rw' },
        { hostPath: '/home/user/data2', containerPath: '/data', accessMode: 'ro' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
    });

    it('../ を含むパスでエラー', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/home/user/../etc/passwd', containerPath: '/data', accessMode: 'rw' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('..'))).toBe(true);
    });

    it('システムコンテナパス（/workspace等）でエラー', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/home/user/data', containerPath: '/workspace', accessMode: 'rw' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('システム'))).toBe(true);
    });
  });

  describe('isDangerousPath', () => {
    it('/etc で true', () => {
      expect(isDangerousPath('/etc')).toBe(true);
    });

    it('/proc で true', () => {
      expect(isDangerousPath('/proc')).toBe(true);
    });

    it('/home/user で false', () => {
      expect(isDangerousPath('/home/user')).toBe(false);
    });

    it('/etc/nginx（サブパス）で true', () => {
      expect(isDangerousPath('/etc/nginx')).toBe(true);
    });
  });

  describe('isSystemContainerPath', () => {
    it('/workspace で true', () => {
      expect(isSystemContainerPath('/workspace')).toBe(true);
    });

    it('/home/node/.claude で true', () => {
      expect(isSystemContainerPath('/home/node/.claude')).toBe(true);
    });

    it('/data で false', () => {
      expect(isSystemContainerPath('/data')).toBe(false);
    });

    it('/workspace/sub（サブパス）で true', () => {
      expect(isSystemContainerPath('/workspace/sub')).toBe(true);
    });
  });
});
