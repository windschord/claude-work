import { describe, it, expect } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

describe('GET /api/health', () => {
  it('should return 200 status', async () => {
    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it('should return JSON response', async () => {
    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);

    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });

  it('should return status and timestamp', async () => {
    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('timestamp');
    expect(typeof data.timestamp).toBe('string');
  });

  it('should return valid ISO timestamp', async () => {
    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);

    const data = await response.json();
    const timestamp = new Date(data.timestamp);
    expect(timestamp.toString()).not.toBe('Invalid Date');
  });
});
