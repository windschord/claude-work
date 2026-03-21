import { describe, it, expect } from 'vitest';
import type { DockerEnvironmentConfig, ChromeSidecarConfig } from '../environment';
import type { CreateSessionOptions } from '../../services/environment-adapter';

describe('Chrome Sidecar 型定義', () => {
  describe('ChromeSidecarConfig型の検証', () => {
    it('enabled, image, tagフィールドを持つオブジェクトが型に適合すること', () => {
      const config: ChromeSidecarConfig = {
        enabled: true,
        image: 'chromium/headless-shell',
        tag: '131.0.6778.204',
      };
      expect(config.enabled).toBe(true);
      expect(config.image).toBe('chromium/headless-shell');
      expect(config.tag).toBe('131.0.6778.204');
    });
  });

  describe('DockerEnvironmentConfig後方互換性の検証', () => {
    it('chromeSidecarキーなしのconfigが有効であること', () => {
      const config: DockerEnvironmentConfig = {
        imageName: 'test-image',
        imageTag: 'latest',
      };
      expect(config.chromeSidecar).toBeUndefined();
    });

    it('chromeSidecarキーありのconfigが有効であること', () => {
      const config: DockerEnvironmentConfig = {
        imageName: 'test-image',
        imageTag: 'latest',
        chromeSidecar: {
          enabled: true,
          image: 'chromium/headless-shell',
          tag: '131.0.6778.204',
        },
      };
      expect(config.chromeSidecar).toBeDefined();
      expect(config.chromeSidecar!.enabled).toBe(true);
    });

    it('既存のimageName, imageTag等のフィールドが影響を受けないこと', () => {
      const config: DockerEnvironmentConfig = {
        imageSource: 'existing',
        imageName: 'my-image',
        imageTag: 'v1',
        skipPermissions: true,
        portMappings: [{ hostPort: 3000, containerPort: 3000 }],
        volumeMounts: [{ hostPath: '/tmp', containerPath: '/data' }],
      };
      expect(config.imageSource).toBe('existing');
      expect(config.imageName).toBe('my-image');
      expect(config.imageTag).toBe('v1');
      expect(config.skipPermissions).toBe(true);
      expect(config.portMappings).toHaveLength(1);
      expect(config.volumeMounts).toHaveLength(1);
    });
  });

  describe('CreateSessionOptions拡張の検証', () => {
    it('chromeSidecarフィールドなしのオプションが有効であること', () => {
      const options: CreateSessionOptions = {
        resumeSessionId: 'test-id',
      };
      expect(options.chromeSidecar).toBeUndefined();
    });

    it('chromeSidecarフィールドありのオプションが有効であること', () => {
      const options: CreateSessionOptions = {
        chromeSidecar: {
          enabled: true,
          image: 'chromium/headless-shell',
          tag: '131.0.6778.204',
        },
      };
      expect(options.chromeSidecar).toBeDefined();
      expect(options.chromeSidecar!.enabled).toBe(true);
    });
  });
});
