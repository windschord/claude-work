import { describe, it, expect } from 'vitest';
import { validateChromeSidecarConfig } from '@/lib/chrome-sidecar-validator';

describe('Chrome Sidecar バリデーション', () => {
  describe('validateChromeSidecarConfig', () => {
    it('chromeSidecarキー省略時: バリデーション成功', () => {
      const config = { imageName: 'test', imageTag: 'v1' };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBeNull();
    });

    it('enabled: false の場合: image/tagバリデーションスキップ', () => {
      const config = {
        chromeSidecar: { enabled: false, image: '', tag: '' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBeNull();
    });

    it('正常な設定: バリデーション成功', () => {
      const config = {
        chromeSidecar: {
          enabled: true,
          image: 'chromium/headless-shell',
          tag: '131.0.6778.204',
        },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBeNull();
    });

    it('enabled が boolean でない場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: 'true', image: 'test', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).not.toBeNull();
      expect(error).toContain('chromeSidecar.enabled');
    });

    it('enabled が数値の場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: 1, image: 'test', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).not.toBeNull();
      expect(error).toContain('chromeSidecar.enabled');
    });

    it('image が空文字の場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: true, image: '', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).not.toBeNull();
      expect(error).toContain('chromeSidecar.image');
    });

    it('image に大文字を含む場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'Chromium/HeadlessShell', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).not.toBeNull();
      expect(error).toContain('chromeSidecar.image');
    });

    it('image に特殊文字を含む場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'test@image', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).not.toBeNull();
      expect(error).toContain('chromeSidecar.image');
    });

    it('image にコロン付きプライベートレジストリを含む場合: 正常', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'registry.example.com:5000/chromium/headless-shell', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBeNull();
    });

    it('tag が空文字の場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'chromium/headless-shell', tag: '' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).not.toBeNull();
      expect(error).toContain('tag');
    });

    it('tag が "latest" の場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'chromium/headless-shell', tag: 'latest' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).not.toBeNull();
      expect(error).toContain('latest');
    });
  });
});
