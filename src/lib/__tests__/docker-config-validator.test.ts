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

    it('protocolがtcp/udp以外ならエラー', () => {
      const mappings = [
        { hostPort: 8080, containerPort: 3000, protocol: 'http' as PortMapping['protocol'] },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('protocol'))).toBe(true);
    });

    it('protocolが未指定の場合はtcpとして扱いエラーにならない', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 3000 },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(true);
    });

    it('配列要素がnullの場合エラー', () => {
      const mappings = [null] as unknown as PortMapping[];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('無効'))).toBe(true);
    });

    it('エラーメッセージにマッピング番号が正しく含まれる（1-based index）', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 3000, protocol: 'tcp' },
        { hostPort: NaN, containerPort: 3000, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(false);
      // 2番目のマッピングなので「マッピング2」と表示される
      expect(result.errors.some((e) => e.includes('マッピング2'))).toBe(true);
      expect(result.errors.every((e) => !e.includes('マッピング0'))).toBe(true);
    });

    it('NaNポートのエラーメッセージに「有効な数値」が含まれる', () => {
      const mappings: PortMapping[] = [
        { hostPort: NaN, containerPort: 3000, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.errors.some((e) => e.includes('有効な数値'))).toBe(true);
    });

    it('ポート番号1は受け入れる（境界値）', () => {
      const mappings: PortMapping[] = [
        { hostPort: 1, containerPort: 1, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(true);
    });

    it('ポート番号65535は受け入れる（境界値）', () => {
      const mappings: PortMapping[] = [
        { hostPort: 65535, containerPort: 65535, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(true);
    });

    it('protocolが未指定の場合、重複チェックではtcpとして扱う', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 3000 },
        { hostPort: 8080, containerPort: 4000 },
      ];
      const result = validatePortMappings(mappings);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
    });

    it('整数のエラーメッセージに「整数」が含まれる', () => {
      const mappings: PortMapping[] = [
        { hostPort: 3.14, containerPort: 3000, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.errors[0]).toContain('整数');
      // マッピング番号が正しい
      expect(result.errors[0]).toContain('マッピング1');
    });

    it('protocolのエラーメッセージにマッピング番号が含まれる', () => {
      const mappings = [
        { hostPort: 8080, containerPort: 3000, protocol: 'http' as PortMapping['protocol'] },
      ];
      const result = validatePortMappings(mappings);
      expect(result.errors.some((e) => e.includes('マッピング1') && e.includes('protocol'))).toBe(true);
    });

    it('重複エラーメッセージにマッピング番号が含まれる', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 3000, protocol: 'tcp' },
        { hostPort: 8080, containerPort: 4000, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.errors.some((e) => e.includes('マッピング2') && e.includes('重複'))).toBe(true);
    });

    it('warningsは空配列で返される', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: 3000, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.warnings).toEqual([]);
    });

    it('containerPortのエラーメッセージにcontainerPortラベルが含まれる', () => {
      const mappings: PortMapping[] = [
        { hostPort: 8080, containerPort: NaN, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.errors.some((e) => e.includes('containerPort'))).toBe(true);
    });

    it('ポート範囲エラーのメッセージにマッピング番号が含まれる', () => {
      const mappings: PortMapping[] = [
        { hostPort: 0, containerPort: 3000, protocol: 'tcp' },
      ];
      const result = validatePortMappings(mappings);
      expect(result.errors[0]).toContain('マッピング1');
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

    it('hostPathにコロンを含むとエラー', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/home/user/data:extra', containerPath: '/data', accessMode: 'rw' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(':'))).toBe(true);
    });

    it('containerPathにコロンを含むとエラー', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/home/user/data', containerPath: '/data:extra', accessMode: 'rw' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(':'))).toBe(true);
    });

    it('accessModeがrw/ro以外ならエラー', () => {
      const mounts = [
        { hostPath: '/home/user/data', containerPath: '/data', accessMode: 'rx' as VolumeMount['accessMode'] },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('accessMode'))).toBe(true);
    });

    it('accessModeが未指定の場合はrwとして扱いエラーにならない', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/home/user/data', containerPath: '/data' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(true);
    });

    it('配列要素がnullの場合エラー', () => {
      const mounts = [null] as unknown as VolumeMount[];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('無効'))).toBe(true);
    });

    it('エラーメッセージにマウント番号が正しく含まれる（1-based index）', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/valid/path', containerPath: '/data', accessMode: 'rw' },
        { hostPath: 'relative', containerPath: '/data2', accessMode: 'rw' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.errors.some((e) => e.includes('マウント2'))).toBe(true);
      expect(result.errors.every((e) => !e.includes('マウント0'))).toBe(true);
    });

    it('null要素のエラーメッセージにマウント番号が含まれる', () => {
      const mounts = [null] as unknown as VolumeMount[];
      const result = validateVolumeMounts(mounts);
      expect(result.errors[0]).toContain('マウント1');
    });

    it('warningsは正常時に空配列で返される', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/home/user/safe', containerPath: '/data', accessMode: 'rw' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.warnings).toEqual([]);
    });

    it('危険なパスの場合warningsが設定される', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/etc/nginx', containerPath: '/data', accessMode: 'rw' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('/etc/nginx');
    });

    it('hostPathとcontainerPathが文字列でない場合エラー', () => {
      const mounts = [
        { hostPath: 123, containerPath: true, accessMode: 'rw' },
      ] as unknown as VolumeMount[];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('文字列'))).toBe(true);
    });

    it('sourceTypeがbind/volume以外の場合エラー', () => {
      const mounts = [
        { hostPath: '/data', containerPath: '/data', accessMode: 'rw', sourceType: 'tmpfs' as VolumeMount['sourceType'] },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('sourceType'))).toBe(true);
    });

    it('containerPathに..を含むとエラー', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/home/user/data', containerPath: '/data/../etc', accessMode: 'rw' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('containerPath') && e.includes('..'))).toBe(true);
    });

    it('重複containerPathのエラーメッセージにマウント番号が含まれる', () => {
      const mounts: VolumeMount[] = [
        { hostPath: '/data1', containerPath: '/shared', accessMode: 'rw' },
        { hostPath: '/data2', containerPath: '/shared', accessMode: 'ro' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.errors.some((e) => e.includes('マウント2') && e.includes('重複'))).toBe(true);
    });

    describe('sourceType=volume', () => {
      it('有効なVolume名で valid: true', () => {
        const mounts: VolumeMount[] = [
          { hostPath: 'cw-repo-my-project', containerPath: '/data', accessMode: 'rw', sourceType: 'volume' },
        ];
        const result = validateVolumeMounts(mounts);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('無効なVolume名（スペース含む）でエラー', () => {
        const mounts: VolumeMount[] = [
          { hostPath: 'invalid name', containerPath: '/data', accessMode: 'rw', sourceType: 'volume' },
        ];
        const result = validateVolumeMounts(mounts);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('Volume名'))).toBe(true);
      });

      it('無効なVolume名（先頭がハイフン）でエラー', () => {
        const mounts: VolumeMount[] = [
          { hostPath: '-invalid', containerPath: '/data', accessMode: 'rw', sourceType: 'volume' },
        ];
        const result = validateVolumeMounts(mounts);
        expect(result.valid).toBe(false);
      });

      it('空のVolume名でエラー', () => {
        const mounts: VolumeMount[] = [
          { hostPath: '', containerPath: '/data', accessMode: 'rw', sourceType: 'volume' },
        ];
        const result = validateVolumeMounts(mounts);
        expect(result.valid).toBe(false);
      });

      it('ホストパス固有バリデーション（絶対パス）をスキップ', () => {
        const mounts: VolumeMount[] = [
          { hostPath: 'cw-repo-test', containerPath: '/data', accessMode: 'rw', sourceType: 'volume' },
        ];
        const result = validateVolumeMounts(mounts);
        expect(result.valid).toBe(true);
        expect(result.errors.some((e) => e.includes('絶対パス'))).toBe(false);
      });

      it('containerPathのバリデーションは維持', () => {
        const mounts: VolumeMount[] = [
          { hostPath: 'cw-repo-test', containerPath: 'relative', accessMode: 'rw', sourceType: 'volume' },
        ];
        const result = validateVolumeMounts(mounts);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('containerPath'))).toBe(true);
      });
    });

    it('sourceType未指定(bind)は既存の動作を維持', () => {
      const mounts: VolumeMount[] = [
        { hostPath: 'not-absolute', containerPath: '/data', accessMode: 'rw' },
      ];
      const result = validateVolumeMounts(mounts);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('絶対パス'))).toBe(true);
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
