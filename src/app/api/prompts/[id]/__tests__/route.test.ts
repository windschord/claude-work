import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DELETE } from '../route';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

describe('DELETE /api/prompts/[id]', () => {
  beforeEach(() => {
    db.delete(schema.prompts).run();
  });

  afterEach(() => {
    db.delete(schema.prompts).run();
  });

  it('プロンプトを削除する（200）', async () => {
    const prompt = db.insert(schema.prompts).values({
      content: 'Test prompt',
      used_count: 5,
      last_used_at: new Date(),
    }).returning().get();

    const request = new NextRequest(`http://localhost:3000/api/prompts/${prompt.id}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: prompt.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.message).toBe('Deleted successfully');

    const deletedPrompt = db.select().from(schema.prompts)
      .where(eq(schema.prompts.id, prompt.id))
      .get();
    expect(deletedPrompt).toBeUndefined();
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
    const prompt1 = db.insert(schema.prompts).values({
      content: 'Prompt 1',
      used_count: 1,
      last_used_at: new Date(),
    }).returning().get();

    const prompt2 = db.insert(schema.prompts).values({
      content: 'Prompt 2',
      used_count: 2,
      last_used_at: new Date(),
    }).returning().get();

    const request = new NextRequest(`http://localhost:3000/api/prompts/${prompt1.id}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: prompt1.id }) });
    expect(response.status).toBe(200);

    const remainingPrompt = db.select().from(schema.prompts)
      .where(eq(schema.prompts.id, prompt2.id))
      .get();
    expect(remainingPrompt).toBeTruthy();
    expect(remainingPrompt?.content).toBe('Prompt 2');
  });
});
