import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { middleware } from '../middleware';
import { NextRequest } from 'next/server';

describe('Middleware', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('CORS', () => {
    it('should allow all origins in development mode by default', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOWED_ORIGINS;

      const request = new NextRequest('http://localhost:3000/api/health', {
        headers: {
          origin: 'http://localhost:3001',
        },
      });

      const response = middleware(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should restrict origins in production mode', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOWED_ORIGINS;

      const request = new NextRequest('http://localhost:3000/api/health', {
        headers: {
          origin: 'http://example.com',
        },
      });

      const response = middleware(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
    });

    it('should allow specified origins from environment variable', () => {
      process.env.ALLOWED_ORIGINS = 'http://example.com,http://test.com';

      const request = new NextRequest('http://localhost:3000/api/health', {
        headers: {
          origin: 'http://example.com',
        },
      });

      const response = middleware(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com');
    });

    it('should not allow unspecified origins', () => {
      process.env.ALLOWED_ORIGINS = 'http://example.com';

      const request = new NextRequest('http://localhost:3000/api/health', {
        headers: {
          origin: 'http://malicious.com',
        },
      });

      const response = middleware(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('http://malicious.com');
    });

    it('should set CORS headers', () => {
      const request = new NextRequest('http://localhost:3000/api/health');
      const response = middleware(request);

      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });
  });

  describe('OPTIONS requests', () => {
    it('should handle OPTIONS requests with 204', () => {
      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'OPTIONS',
      });

      const response = middleware(request);

      expect(response.status).toBe(204);
    });

    it('should include CORS headers in OPTIONS response', () => {
      const request = new NextRequest('http://localhost:3000/api/health', {
        method: 'OPTIONS',
      });

      const response = middleware(request);

      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
    });
  });
});
