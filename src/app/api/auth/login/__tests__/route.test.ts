import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await prisma.authSession.deleteMany();
    process.env.CLAUDE_WORK_TOKEN = 'test-secret-token';
  });

  afterEach(async () => {
    await prisma.authSession.deleteMany();
    delete process.env.CLAUDE_WORK_TOKEN;
  });

  it('should return 200 and set session cookie with correct token', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token: 'test-secret-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('message');
    expect(data.message).toBe('Login successful');

    // Check if session cookie is set
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toBeTruthy();
    expect(setCookieHeader).toContain('sessionId=');
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('Path=/');

    // Verify session was created in database
    const sessions = await prisma.authSession.findMany();
    expect(sessions).toHaveLength(1);
  });

  it('should return 401 with incorrect token', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token: 'wrong-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toContain('Invalid authentication token');

    // Verify no session was created
    const sessions = await prisma.authSession.findMany();
    expect(sessions).toHaveLength(0);
  });

  it('should return 400 when token is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('Token is required');
  });

  it('should return 500 when CLAUDE_WORK_TOKEN is not configured', async () => {
    delete process.env.CLAUDE_WORK_TOKEN;

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token: 'any-token' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toContain('Server configuration error');
  });
});

describe('POST /api/auth/login - エラーメッセージ', () => {
  beforeEach(async () => {
    await prisma.authSession.deleteMany();
  });

  afterEach(async () => {
    await prisma.authSession.deleteMany();
  });

  it('トークンが設定されていない場合、詳細なエラーメッセージを返す', async () => {
    // CLAUDE_WORK_TOKENを一時的に削除
    const originalToken = process.env.CLAUDE_WORK_TOKEN;
    delete process.env.CLAUDE_WORK_TOKEN;

    const response = await POST(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'any-token' }),
      })
    );

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Server configuration error');

    // 環境変数を復元
    process.env.CLAUDE_WORK_TOKEN = originalToken;
  });

  it('入力トークンが空の場合、適切なエラーメッセージを返す', async () => {
    const response = await POST(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '' }),
      })
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Token is required');
  });

  it('入力トークンが不正な場合、適切なエラーメッセージを返す', async () => {
    // 正しいトークンを設定
    process.env.CLAUDE_WORK_TOKEN = 'correct-token';

    const response = await POST(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'wrong-token' }),
      })
    );

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('Invalid authentication token');
  });
});
