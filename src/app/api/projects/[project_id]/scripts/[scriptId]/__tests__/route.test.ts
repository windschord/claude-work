import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PUT, DELETE } from '../route';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import type { Project, RunScript } from '@/lib/db';
import { setupTestEnvironment, cleanupTestEnvironment } from '../../__tests__/test-helpers';

// 共通テストセットアップ
let testRepoPath: string;
let project: Project;
let script: RunScript;

beforeEach(async () => {
  const env = await setupTestEnvironment();
  testRepoPath = env.testRepoPath;
  project = env.project;

  script = db.insert(schema.runScripts).values({
    project_id: project.id,
    name: 'Test',
    description: 'Run unit tests',
    command: 'npm test',
  }).returning().get();
});

afterEach(async () => {
  await cleanupTestEnvironment(testRepoPath);
});

describe('PUT /api/projects/[project_id]/scripts/[scriptId]', () => {

  it('should update run script successfully', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts/${script.id}`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Updated',
          description: 'Run all tests',
          command: 'npm run test:all',
        }),
      }
    );

    const response = await PUT(request, {
      params: Promise.resolve({ project_id: project.id, scriptId: script.id }),
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.script.name).toBe('Test Updated');
    expect(data.script.description).toBe('Run all tests');
    expect(data.script.command).toBe('npm run test:all');

    const updatedScript = db.select().from(schema.runScripts).where(eq(schema.runScripts.id, script.id)).get();
    expect(updatedScript?.name).toBe('Test Updated');
  });

  it('should update only specified fields', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts/${script.id}`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Updated',
        }),
      }
    );

    const response = await PUT(request, {
      params: Promise.resolve({ project_id: project.id, scriptId: script.id }),
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.script.name).toBe('Test Updated');
    expect(data.script.description).toBe('Run unit tests');
    expect(data.script.command).toBe('npm test');
  });

  it('should return 404 if script not found', async () => {
    const fakeId = randomUUID();
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts/${fakeId}`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Updated',
        }),
      }
    );

    const response = await PUT(request, {
      params: Promise.resolve({ project_id: project.id, scriptId: fakeId }),
    });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/projects/[project_id]/scripts/[scriptId]', () => {

  it('should delete run script successfully', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts/${script.id}`,
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ project_id: project.id, scriptId: script.id }),
    });
    expect(response.status).toBe(204);

    const deletedScript = db.select().from(schema.runScripts).where(eq(schema.runScripts.id, script.id)).get();
    expect(deletedScript).toBeUndefined();
  });

  it('should return 404 if script not found', async () => {
    const fakeId = randomUUID();
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts/${fakeId}`,
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ project_id: project.id, scriptId: fakeId }),
    });
    expect(response.status).toBe(404);
  });
});
