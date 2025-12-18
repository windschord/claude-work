import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import type { AuthSession, Project } from '@prisma/client';
import { setupTestEnvironment, cleanupTestEnvironment } from './test-helpers';

describe('GET /api/projects/[project_id]/scripts', () => {
  let testRepoPath: string;
  let authSession: AuthSession;
  let project: Project;

  beforeEach(async () => {
    const env = await setupTestEnvironment();
    testRepoPath = env.testRepoPath;
    authSession = env.authSession;
    project = env.project;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(testRepoPath);
  });

  it('should return 200 and list of run scripts', async () => {
    await prisma.runScript.createMany({
      data: [
        {
          project_id: project.id,
          name: 'Test',
          description: 'Run unit tests',
          command: 'npm test',
        },
        {
          project_id: project.id,
          name: 'Build',
          description: 'Build the project',
          command: 'npm run build',
        },
      ],
    });

    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.scripts).toHaveLength(2);
    expect(data.scripts[0].name).toBe('Test');
    expect(data.scripts[0].command).toBe('npm test');
    expect(data.scripts[1].name).toBe('Build');
  });

  it('should return empty array when no scripts exist', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        headers: {
          cookie: `sessionId=${authSession.id}`,
        },
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.scripts).toEqual([]);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`
    );

    const response = await GET(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(401);
  });
});

describe('POST /api/projects/[project_id]/scripts', () => {
  let testRepoPath: string;
  let authSession: AuthSession;
  let project: Project;

  beforeEach(async () => {
    const env = await setupTestEnvironment();
    testRepoPath = env.testRepoPath;
    authSession = env.authSession;
    project = env.project;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(testRepoPath);
  });

  it('should create run script successfully', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Test',
          description: 'Run unit tests',
          command: 'npm test',
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.script.name).toBe('Test');
    expect(data.script.description).toBe('Run unit tests');
    expect(data.script.command).toBe('npm test');
    expect(data.script.project_id).toBe(project.id);

    const script = await prisma.runScript.findFirst({
      where: { project_id: project.id },
    });
    expect(script).toBeTruthy();
    expect(script?.name).toBe('Test');
  });

  it('should create run script without description', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Build',
          command: 'npm run build',
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.script.name).toBe('Build');
    expect(data.script.description).toBeNull();
    expect(data.script.command).toBe('npm run build');
  });

  it('should return 400 if name is missing', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          command: 'npm test',
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(400);
  });

  it('should return 400 if command is missing', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `sessionId=${authSession.id}`,
        },
        body: JSON.stringify({
          name: 'Test',
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(400);
  });

  it('should return 401 if not authenticated', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/projects/${project.id}/scripts`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test',
          command: 'npm test',
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ project_id: project.id }),
    });
    expect(response.status).toBe(401);
  });
});
