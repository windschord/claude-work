import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DELETE } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

describe('DELETE /api/prompts/[id]', () => {
  beforeEach(async () => {
    await prisma.prompt.deleteMany();
  });

  afterEach(async () => {
    await prisma.prompt.deleteMany();
  });

  it('プロンプトを削除する（200）', async () => {
    const prompt = await prisma.prompt.create({
      data: {
        content: 'Test prompt',
        used_count: 5,
        last_used_at: new Date(),
      },
    });

    const request = new NextRequest(`http://localhost:3000/api/prompts/${prompt.id}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: prompt.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Deleted successfully');

    const deletedPrompt = await prisma.prompt.findUnique({
      where: { id: prompt.id },
    });
    expect(deletedPrompt).toBeNull();
  });

  it('存在しないプロンプトを削除しようとすると404エラー', async () => {
    const request = new NextRequest('http://localhost:3000/api/prompts/non-existent-id', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent-id' }) });
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it('削除後、他のプロンプトは残っている', async () => {
    const prompt1 = await prisma.prompt.create({
      data: {
        content: 'Prompt 1',
        used_count: 1,
        last_used_at: new Date(),
      },
    });

    const prompt2 = await prisma.prompt.create({
      data: {
        content: 'Prompt 2',
        used_count: 2,
        last_used_at: new Date(),
      },
    });

    const request = new NextRequest(`http://localhost:3000/api/prompts/${prompt1.id}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: prompt1.id }) });
    expect(response.status).toBe(200);

    const remainingPrompt = await prisma.prompt.findUnique({
      where: { id: prompt2.id },
    });
    expect(remainingPrompt).toBeTruthy();
    expect(remainingPrompt?.content).toBe('Prompt 2');
  });
});
