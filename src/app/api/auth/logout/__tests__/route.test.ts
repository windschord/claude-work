import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

describe('POST /api/auth/logout', () => {
  let authSession: any;

  beforeEach(async () => {
    await prisma.authSession.deleteMany();

    authSession = await prisma.authSession.create({
      data: {
        id: randomUUID(),
        token_hash: 'test-hash',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  });

  afterEach(async () => {
    await prisma.authSession.deleteMany();
  });

  it('should return 200 and delete session with valid session cookie', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: `sessionId=${authSession.id}`,
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Logout successful');

    // Check if session cookie is cleared
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain('sessionId=;');
    expect(setCookieHeader).toContain('Max-Age=0');

    // Verify session was deleted from database
    const session = await prisma.authSession.findUnique({
      where: { id: authSession.id },
    });
    expect(session).toBeNull();
  });

  it('should return 401 when session cookie is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe('Unauthorized');

    // Verify session still exists
    const session = await prisma.authSession.findUnique({
      where: { id: authSession.id },
    });
    expect(session).not.toBeNull();
  });

  it('should return 401 when session is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: 'sessionId=invalid-session-id',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });
});
