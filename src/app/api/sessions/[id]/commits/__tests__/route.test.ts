import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';
import { db, schema } from '@/lib/db';
import { NextRequest } from 'next/server';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import type { Project, Session } from '@/lib/db';

describe('GET /api/sessions/{id}/commits', () => {
  let testRepoPath: string;
  let project: Project;
  let session: Session;

  beforeEach(async () => {
    db.delete(schema.sessions).run();
    db.delete(schema.projects).run();

    testRepoPath = mkdtempSync(join(tmpdir(), 'commits-test-'));
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    execSync('echo "test" > README.md && git add . && git commit -m "initial"', {
      cwd: testRepoPath,
      shell: true,
    });
    execSync('git branch -M main', { cwd: testRepoPath });

    project = db
      .insert(schema.projects)
      .values({
        name: 'Test Project',
        path: testRepoPath,
      })
      .returning()
      .get();

    session = db
      .insert(schema.sessions)
      .values({
        project_id: project.id,
        name: 'Test Session',
        status: 'running',
        worktree_path: join(testRepoPath, '.worktrees', 'test-session'),
        branch_name: 'test-branch',
      })
      .returning()
      .get();

    // Create worktree and make some commits
    execSync(
      `git worktree add -b ${session.branch_name} ${session.worktree_path}`,
      { cwd: testRepoPath }
    );
    writeFileSync(join(session.worktree_path, 'file1.txt'), 'content1');
    execSync('git add file1.txt && git commit -m "Add authentication"', {
      cwd: session.worktree_path,
      shell: true,
    });
    writeFileSync(join(session.worktree_path, 'file2.txt'), 'content2');
    execSync('git add file2.txt && git commit -m "Fix bug in login"', {
      cwd: session.worktree_path,
      shell: true,
    });
  });

  afterEach(async () => {
    db.delete(schema.sessions).run();
    db.delete(schema.projects).run();
    if (testRepoPath) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  it('セッションが見つからない場合は404を返す', async () => {
    const request = new NextRequest('http://localhost:3000/api/sessions/non-existent/commits', {
      method: 'GET',
    });

    const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });
    expect(response.status).toBe(404);
  });

  it('コミット履歴を統一形式で返す', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/sessions/${session.id}/commits`,
      {
        method: 'GET',
      }
    );

    const response = await GET(request, { params: Promise.resolve({ id: session.id }) });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('commits');
    expect(Array.isArray(data.commits)).toBe(true);
    expect(data.commits.length).toBe(2);

    // 最新のコミットが最初に来る
    expect(data.commits[0].message).toBe('Fix bug in login');
    expect(data.commits[0]).toHaveProperty('hash');
    expect(data.commits[0]).toHaveProperty('short_hash');
    expect(data.commits[0]).toHaveProperty('author');
    expect(data.commits[0]).toHaveProperty('date');
    expect(data.commits[0]).toHaveProperty('files_changed');
    expect(data.commits[0].files_changed).toBe(1);

    expect(data.commits[1].message).toBe('Add authentication');
    expect(data.commits[1].files_changed).toBe(1);
  });
});
