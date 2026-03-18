import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// iron-sessionのモック
vi.mock('iron-session', () => ({
  default: {},
}));

describe('session module', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('in development mode', () => {
    it('should use default password when SESSION_SECRET is not set', async () => {
      delete process.env.SESSION_SECRET;
      process.env.NODE_ENV = 'development';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mod = await import('../session');

      expect(mod.sessionOptions.password).toBe('complex_password_at_least_32_characters_long');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SESSION_SECRET is not set')
      );
      warnSpy.mockRestore();
    });

    it('should use SESSION_SECRET when provided', async () => {
      process.env.SESSION_SECRET = 'my_super_secret_password_that_is_long_enough';
      process.env.NODE_ENV = 'development';

      const mod = await import('../session');

      expect(mod.sessionOptions.password).toBe('my_super_secret_password_that_is_long_enough');
    });
  });

  describe('sessionOptions configuration', () => {
    it('should have correct cookie name', async () => {
      delete process.env.SESSION_SECRET;
      process.env.NODE_ENV = 'test';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mod = await import('../session');
      warnSpy.mockRestore();

      expect(mod.sessionOptions.cookieName).toBe('session');
    });

    it('should have httpOnly cookies', async () => {
      delete process.env.SESSION_SECRET;
      process.env.NODE_ENV = 'test';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mod = await import('../session');
      warnSpy.mockRestore();

      expect(mod.sessionOptions.cookieOptions?.httpOnly).toBe(true);
    });

    it('should have sameSite lax', async () => {
      delete process.env.SESSION_SECRET;
      process.env.NODE_ENV = 'test';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mod = await import('../session');
      warnSpy.mockRestore();

      expect(mod.sessionOptions.cookieOptions?.sameSite).toBe('lax');
    });

    it('should have maxAge of 24 hours', async () => {
      delete process.env.SESSION_SECRET;
      process.env.NODE_ENV = 'test';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mod = await import('../session');
      warnSpy.mockRestore();

      expect(mod.sessionOptions.cookieOptions?.maxAge).toBe(24 * 60 * 60);
    });

    it('should have path /', async () => {
      delete process.env.SESSION_SECRET;
      process.env.NODE_ENV = 'test';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mod = await import('../session');
      warnSpy.mockRestore();

      expect(mod.sessionOptions.cookieOptions?.path).toBe('/');
    });

    it('should set secure to false in non-production', async () => {
      delete process.env.SESSION_SECRET;
      process.env.NODE_ENV = 'test';

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mod = await import('../session');
      warnSpy.mockRestore();

      expect(mod.sessionOptions.cookieOptions?.secure).toBe(false);
    });

    it('should set secure to true in production', async () => {
      process.env.SESSION_SECRET = 'my_super_secret_password_that_is_long_enough';
      process.env.NODE_ENV = 'production';

      const mod = await import('../session');

      expect(mod.sessionOptions.cookieOptions?.secure).toBe(true);
    });
  });

  describe('production mode', () => {
    it('should throw error when SESSION_SECRET is not set in production', async () => {
      delete process.env.SESSION_SECRET;
      process.env.NODE_ENV = 'production';

      await expect(import('../session')).rejects.toThrow(
        'SESSION_SECRET environment variable must be set in production'
      );
    });
  });
});
