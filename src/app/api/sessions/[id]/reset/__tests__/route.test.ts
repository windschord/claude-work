import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import type { Project, Session } from '@/lib/db';

describe('POST /api/sessions/[id]/reset', () => {
  let testRepoPath: string;
  let project: Project;
  let session: Session;
  let commitHashes: string[] = [];

  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();

    testRepoPath = mkdtempSync(join(tmpdir(), 'reset-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test User"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial commit"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    project = await prisma.project.create({
      data: {
        name: 'Test Project',
        path: testRepoPath,
      },
    });

    session = await prisma.session.create({
      data: {
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: join(testRepoPath, '.worktrees', 'test-session'),
        branch_name: 'test-branch',
      },
    });

    // Create worktree and make several commits
    execSync(
      `git worktree add -b ${session.branch_name} ${session.worktree_path}`,
      { cwd: testRepoPath }
    );

    // Commit 1
    writeFileSync(join(session.worktree_path, 'file1.txt'), 'content 1');
    execSync('git add . && git commit -m "Add file1"', {
      cwd: session.worktree_path,
      shell: true,
    });
    const commit1Hash = execSync('git rev-parse HEAD', {
      cwd: session.worktree_path,
      encoding: 'utf-8',
    }).trim();
    commitHashes.push(commit1Hash);

    // Commit 2
    writeFileSync(join(session.worktree_path, 'file2.txt'), 'content 2');
    execSync('git add . && git commit -m "Add file2"', {
      cwd: session.worktree_path,
      shell: true,
    });
    const commit2Hash = execSync('git rev-parse HEAD', {
      cwd: session.worktree_path,
      encoding: 'utf-8',
    }).trim();
    commitHashes.push(commit2Hash);

    // Commit 3
    writeFileSync(join(session.worktree_path, 'file3.txt'), 'content 3');
    execSync('git add . && git commit -m "Add file3"', {
      cwd: session.worktree_path,
      shell: true,
    });
    const commit3Hash = execSync('git rev-parse HEAD', {
      cwd: session.worktree_path,
      encoding: 'utf-8',
    }).trim();
    commitHashes.push(commit3Hash);
  });

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.project.deleteMany();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
    commitHashes = [];
  });

  it('should reset to specified commit successfully', async () => {
    const targetCommit = commitHashes[0]; // Reset to first commit

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/reset`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ commit_hash: targetCommit }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(data.success).toBe(true);

    // Verify that HEAD is now at the target commit
    const currentHash = execSync('git rev-parse HEAD', {
      cwd: session.worktree_path,
      encoding: 'utf-8',
    }).trim();
    expect(currentHash).toBe(targetCommit);
  });

  it('should remove files added after the target commit', async () => {
    const targetCommit = commitHashes[0]; // Reset to first commit

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/reset`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ commit_hash: targetCommit }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    // file1.txt should exist (added in commit 1)
    const file1Path = join(session.worktree_path, 'file1.txt');
    const file1Exists = existsSync(file1Path);
    expect(file1Exists).toBe(true);

    // file2.txt and file3.txt should not exist (added in commits 2 and 3)
    const file2Path = join(session.worktree_path, 'file2.txt');
    const file3Path = join(session.worktree_path, 'file3.txt');
    const file2Exists = existsSync(file2Path);
    const file3Exists = existsSync(file3Path);
    expect(file2Exists).toBe(false);
    expect(file3Exists).toBe(false);
  });

  it('should reset to middle commit correctly', async () => {
    const targetCommit = commitHashes[1]; // Reset to second commit

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/reset`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ commit_hash: targetCommit }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    // file1.txt and file2.txt should exist
    const file1Path = join(session.worktree_path, 'file1.txt');
    const file2Path = join(session.worktree_path, 'file2.txt');
    const file1Exists = existsSync(file1Path);
    const file2Exists = existsSync(file2Path);
    expect(file1Exists).toBe(true);
    expect(file2Exists).toBe(true);

    // file3.txt should not exist
    const file3Path = join(session.worktree_path, 'file3.txt');
    const file3Exists = existsSync(file3Path);
    expect(file3Exists).toBe(false);
  });

  it('should preserve file contents when resetting', async () => {
    const targetCommit = commitHashes[0]; // Reset to first commit

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/reset`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ commit_hash: targetCommit }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    // Verify file content is preserved
    const file1Path = join(session.worktree_path, 'file1.txt');
    const file1Content = readFileSync(file1Path, 'utf-8');
    expect(file1Content).toBe('content 1');
  });

  it('should return 400 for invalid commit hash', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/reset`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ commit_hash: 'invalid-hash' }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(400);
  });

  it('should return 400 for non-existent commit hash', async () => {
    const fakeHash = 'a'.repeat(40); // Valid format but doesn't exist

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/reset`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ commit_hash: fakeHash }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(400);
  });

  it('should return 400 if commit_hash is missing', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/reset`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(400);
  });

  it('should return 404 for non-existent session', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/reset', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ commit_hash: commitHashes[0] }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'non-existent' }) });
    expect(response.status).toBe(404);
  });

  it('should accept both full and short commit hashes', async () => {
    const fullHash = commitHashes[0];
    const shortHash = fullHash.substring(0, 7);

    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/reset`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ commit_hash: shortHash }),
      }
    );

    const response = await POST(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
