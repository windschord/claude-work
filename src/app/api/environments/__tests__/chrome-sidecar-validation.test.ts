import { describe, it, expect } from 'vitest';
import { validateChromeSidecarConfig } from '@/lib/chrome-sidecar-validator';

describe('Chrome Sidecar バリデーション', () => {
  describe('validateChromeSidecarConfig', () => {
    // === chromeSidecarキー不在・null・undefined ===

    it('chromeSidecarキー省略時: nullを返すこと', () => {
      const config = { imageName: 'test', imageTag: 'v1' };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBeNull();
    });

    it('chromeSidecar が null の場合: nullを返すこと', () => {
      const config = { chromeSidecar: null };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBeNull();
    });

    it('chromeSidecar が undefined の場合: nullを返すこと', () => {
      const config = { chromeSidecar: undefined };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBeNull();
    });

    // === chromeSidecarがオブジェクトでない場合 ===

    it('chromeSidecar が文字列の場合: エラーメッセージを返すこと', () => {
      const config = { chromeSidecar: 'invalid' };
      const error = validateChromeSidecarConfig(config as Record<string, unknown>);
      expect(error).toBe('chromeSidecar must be an object');
    });

    it('chromeSidecar が数値の場合: エラーメッセージを返すこと', () => {
      const config = { chromeSidecar: 42 };
      const error = validateChromeSidecarConfig(config as Record<string, unknown>);
      expect(error).toBe('chromeSidecar must be an object');
    });

    it('chromeSidecar が配列の場合: エラーメッセージを返さないこと (typeof array === object)', () => {
      // 配列はtypeof === 'object'なのでオブジェクトチェックは通過するが、enabledが未定義になる
      const config = { chromeSidecar: [] };
      const error = validateChromeSidecarConfig(config as Record<string, unknown>);
      expect(error).toBe('chromeSidecar.enabled is required and must be a boolean');
    });

    it('chromeSidecar が true (boolean) の場合: エラーメッセージを返すこと', () => {
      const config = { chromeSidecar: true };
      const error = validateChromeSidecarConfig(config as Record<string, unknown>);
      expect(error).toBe('chromeSidecar must be an object');
    });

    // === enabled フィールドのバリデーション ===

    it('enabled が boolean でない場合 (文字列): 正確なエラーメッセージ', () => {
      const config = {
        chromeSidecar: { enabled: 'true', image: 'test', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.enabled is required and must be a boolean');
    });

    it('enabled が数値の場合: 正確なエラーメッセージ', () => {
      const config = {
        chromeSidecar: { enabled: 1, image: 'test', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.enabled is required and must be a boolean');
    });

    it('enabled が未定義の場合: 正確なエラーメッセージ', () => {
      const config = {
        chromeSidecar: { image: 'test', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.enabled is required and must be a boolean');
    });

    it('enabled が null の場合: 正確なエラーメッセージ', () => {
      const config = {
        chromeSidecar: { enabled: null, image: 'test', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.enabled is required and must be a boolean');
    });

    // === enabled: false の場合 ===

    it('enabled: false の場合: image/tagバリデーションスキップ (nullを返す)', () => {
      const config = {
        chromeSidecar: { enabled: false, image: '', tag: '' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBeNull();
    });

    it('enabled: false の場合: image/tagがなくてもnullを返す', () => {
      const config = {
        chromeSidecar: { enabled: false },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBeNull();
    });

    // === enabled: true + image バリデーション ===

    it('正常な設定: nullを返すこと', () => {
      const config = {
        chromeSidecar: {
          enabled: true,
          image: 'ghcr.io/windschord/claude-work-sandbox',
          tag: 'chrome-devtools',
        },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBeNull();
    });

    it('image が空文字の場合: 正確なエラーメッセージ', () => {
      const config = {
        chromeSidecar: { enabled: true, image: '', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.image must be a valid Docker image name (lowercase alphanumeric, dots, slashes, colons, hyphens)');
    });

    it('image が未定義の場合: 正確なエラーメッセージ', () => {
      const config = {
        chromeSidecar: { enabled: true, tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.image must be a valid Docker image name (lowercase alphanumeric, dots, slashes, colons, hyphens)');
    });

    it('image が数値の場合: 正確なエラーメッセージ', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 123, tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.image must be a valid Docker image name (lowercase alphanumeric, dots, slashes, colons, hyphens)');
    });

    it('image に大文字を含む場合: 正確なエラーメッセージ', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'Chromium/HeadlessShell', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.image must be a valid Docker image name (lowercase alphanumeric, dots, slashes, colons, hyphens)');
    });

    it('image に @ を含む場合: 正確なエラーメッセージ', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'test@image', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.image must be a valid Docker image name (lowercase alphanumeric, dots, slashes, colons, hyphens)');
    });

    it('image にスペースを含む場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'test image', tag: 'v1' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.image must be a valid Docker image name (lowercase alphanumeric, dots, slashes, colons, hyphens)');
    });

    // 正常なimage値のバリエーション
    it('image: ドットを含むレジストリ名は正常', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'registry.example.com/ghcr.io/windschord/claude-work-sandbox', tag: 'v1' },
      };
      expect(validateChromeSidecarConfig(config)).toBeNull();
    });

    it('image: コロン付きプライベートレジストリは正常', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'registry.example.com:5000/ghcr.io/windschord/claude-work-sandbox', tag: 'v1' },
      };
      expect(validateChromeSidecarConfig(config)).toBeNull();
    });

    it('image: ハイフンを含む名前は正常', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'headless-shell', tag: 'v1' },
      };
      expect(validateChromeSidecarConfig(config)).toBeNull();
    });

    it('image: アンダースコアを含む名前は正常', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'headless_shell', tag: 'v1' },
      };
      expect(validateChromeSidecarConfig(config)).toBeNull();
    });

    // === enabled: true + tag バリデーション ===

    it('tag が空文字の場合: 正確なエラーメッセージ', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'ghcr.io/windschord/claude-work-sandbox', tag: '' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.tag is required');
    });

    it('tag が空白のみの場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'ghcr.io/windschord/claude-work-sandbox', tag: '   ' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.tag is required');
    });

    it('tag が未定義の場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'ghcr.io/windschord/claude-work-sandbox' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.tag is required');
    });

    it('tag が数値の場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'ghcr.io/windschord/claude-work-sandbox', tag: 123 },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.tag is required');
    });

    it('tag が "latest" の場合: 正確なエラーメッセージ', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'ghcr.io/windschord/claude-work-sandbox', tag: 'latest' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.tag must be a specific version (latest is not allowed for reproducibility)');
    });

    it('tag が "LATEST" (大文字) の場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'ghcr.io/windschord/claude-work-sandbox', tag: 'LATEST' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.tag must be a specific version (latest is not allowed for reproducibility)');
    });

    it('tag が " latest " (前後空白) の場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'ghcr.io/windschord/claude-work-sandbox', tag: ' latest ' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.tag must be a specific version (latest is not allowed for reproducibility)');
    });

    it('tag が "Latest" (混合ケース) の場合: エラー', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'ghcr.io/windschord/claude-work-sandbox', tag: 'Latest' },
      };
      const error = validateChromeSidecarConfig(config);
      expect(error).toBe('chromeSidecar.tag must be a specific version (latest is not allowed for reproducibility)');
    });

    // 正常なtag値
    it('tag が具体的なバージョン文字列の場合: 正常', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'ghcr.io/windschord/claude-work-sandbox', tag: 'chrome-devtools' },
      };
      expect(validateChromeSidecarConfig(config)).toBeNull();
    });

    it('tag が "stable" の場合: 正常', () => {
      const config = {
        chromeSidecar: { enabled: true, image: 'ghcr.io/windschord/claude-work-sandbox', tag: 'stable' },
      };
      expect(validateChromeSidecarConfig(config)).toBeNull();
    });
  });
});
