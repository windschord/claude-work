import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

describe('GET /api/prompts', () => {
  beforeEach(async () => {
    await prisma.prompt.deleteMany();
  });

  afterEach(async () => {
    await prisma.prompt.deleteMany();
  });

  it('空の履歴を返す', async () => {
    const request = new NextRequest('http://localhost:3000/api/prompts');

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('prompts');
    expect(data.prompts).toEqual([]);
  });

  it('プロンプト履歴を取得する', async () => {
    await prisma.prompt.createMany({
      data: [
        {
          content: 'Implement user authentication',
          used_count: 5,
          last_used_at: new Date('2025-12-10T10:00:00Z'),
        },
        {
          content: 'Add unit tests',
          used_count: 3,
          last_used_at: new Date('2025-12-11T10:00:00Z'),
        },
      ],
    });

    const request = new NextRequest('http://localhost:3000/api/prompts');

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.prompts).toHaveLength(2);
    expect(data.prompts[0].content).toBeDefined();
    expect(data.prompts[0].used_count).toBeDefined();
    expect(data.prompts[0].last_used_at).toBeDefined();
  });

  it('プロンプト履歴がused_count降順でソートされる', async () => {
    await prisma.prompt.createMany({
      data: [
        {
          content: 'Low usage prompt',
          used_count: 1,
          last_used_at: new Date('2025-12-10T10:00:00Z'),
        },
        {
          content: 'High usage prompt',
          used_count: 10,
          last_used_at: new Date('2025-12-11T10:00:00Z'),
        },
        {
          content: 'Medium usage prompt',
          used_count: 5,
          last_used_at: new Date('2025-12-12T10:00:00Z'),
        },
      ],
    });

    const request = new NextRequest('http://localhost:3000/api/prompts');

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.prompts[0].content).toBe('High usage prompt');
    expect(data.prompts[1].content).toBe('Medium usage prompt');
    expect(data.prompts[2].content).toBe('Low usage prompt');
  });

  it('最大50件までのプロンプトを返す', async () => {
    const prompts = Array.from({ length: 60 }, (_, i) => ({
      content: `Prompt ${i + 1}`,
      used_count: 60 - i,
      last_used_at: new Date(`2025-12-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
    }));

    await prisma.prompt.createMany({ data: prompts });

    const request = new NextRequest('http://localhost:3000/api/prompts');

    const response = await GET(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.prompts).toHaveLength(50);
  });
});

describe('POST /api/prompts', () => {
  beforeEach(async () => {
    await prisma.prompt.deleteMany();
  });

  afterEach(async () => {
    await prisma.prompt.deleteMany();
  });

  it('新しいプロンプトを作成する（201）', async () => {
    const request = new NextRequest('http://localhost:3000/api/prompts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        content: 'Implement user authentication',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.content).toBe('Implement user authentication');
    expect(data.used_count).toBe(1);

    const savedPrompt = await prisma.prompt.findUnique({
      where: { id: data.id },
    });
    expect(savedPrompt).toBeTruthy();
    expect(savedPrompt?.content).toBe('Implement user authentication');
    expect(savedPrompt?.used_count).toBe(1);
  });

  it('既存のプロンプトのused_countをインクリメントする（200）', async () => {
    const existingPrompt = await prisma.prompt.create({
      data: {
        content: 'Implement user authentication',
        used_count: 5,
        last_used_at: new Date('2025-12-10T10:00:00Z'),
      },
    });

    const request = new NextRequest('http://localhost:3000/api/prompts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        content: 'Implement user authentication',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.id).toBe(existingPrompt.id);
    expect(data.content).toBe('Implement user authentication');
    expect(data.used_count).toBe(6);

    const updatedPrompt = await prisma.prompt.findUnique({
      where: { id: existingPrompt.id },
    });
    expect(updatedPrompt?.used_count).toBe(6);
    expect(updatedPrompt?.last_used_at.getTime()).toBeGreaterThan(
      existingPrompt.last_used_at.getTime()
    );
  });

  it('contentが空の場合は400エラー', async () => {
    const request = new NextRequest('http://localhost:3000/api/prompts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        content: '',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('contentが指定されていない場合は400エラー', async () => {
    const request = new NextRequest('http://localhost:3000/api/prompts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('last_used_atが更新される', async () => {
    const pastDate = new Date('2025-12-01T10:00:00Z');
    const existingPrompt = await prisma.prompt.create({
      data: {
        content: 'Test prompt',
        used_count: 1,
        last_used_at: pastDate,
      },
    });

    const beforeUpdate = new Date();

    const request = new NextRequest('http://localhost:3000/api/prompts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        content: 'Test prompt',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const updatedPrompt = await prisma.prompt.findUnique({
      where: { id: existingPrompt.id },
    });

    expect(updatedPrompt?.last_used_at.getTime()).toBeGreaterThanOrEqual(
      beforeUpdate.getTime()
    );
    expect(updatedPrompt?.last_used_at.getTime()).toBeGreaterThan(pastDate.getTime());
  });
});
