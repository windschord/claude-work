import { describe, it, expect } from 'vitest';
import { middleware } from '../middleware';
import { NextRequest } from 'next/server';

describe('Middleware', () => {
  describe('/login redirect', () => {
    it('should redirect /login to /', () => {
      const request = new NextRequest('http://localhost:3000/login');

      const response = middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('http://localhost:3000/');
    });

    it('should pass through other paths', () => {
      const request = new NextRequest('http://localhost:3000/');

      const response = middleware(request);

      expect(response.status).toBe(200);
    });

    it('should pass through API paths', () => {
      const request = new NextRequest('http://localhost:3000/api/health');

      const response = middleware(request);

      expect(response.status).toBe(200);
    });
  });
});
