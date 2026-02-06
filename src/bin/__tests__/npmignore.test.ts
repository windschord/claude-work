import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const projectRoot = join(__dirname, '..', '..', '..');

describe('.npmignore', () => {
  it('should exist in project root', () => {
    const npmignorePath = join(projectRoot, '.npmignore');
    expect(existsSync(npmignorePath)).toBe(true);
  });

  it('should not exclude .next directory', () => {
    const npmignorePath = join(projectRoot, '.npmignore');
    const content = readFileSync(npmignorePath, 'utf-8');
    const lines = content.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

    // .next/ or /.next/ should NOT appear in .npmignore
    const excludesNext = lines.some(
      (line) => line === '.next' || line === '.next/' || line === '/.next/' || line === '/.next'
    );
    expect(excludesNext).toBe(false);
  });

  it('should not exclude dist directory', () => {
    const npmignorePath = join(projectRoot, '.npmignore');
    const content = readFileSync(npmignorePath, 'utf-8');
    const lines = content.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

    // dist or /dist should NOT appear in .npmignore
    const excludesDist = lines.some(
      (line) => line === 'dist' || line === 'dist/' || line === '/dist' || line === '/dist/'
    );
    expect(excludesDist).toBe(false);
  });

  it('should exclude development-only files', () => {
    const npmignorePath = join(projectRoot, '.npmignore');
    const content = readFileSync(npmignorePath, 'utf-8');

    // These patterns should be excluded to reduce package size
    expect(content).toContain('coverage');
    expect(content).toContain('test-results');
    expect(content).toContain('.env');
  });

  it('.gitignore should exclude .next (confirming the problem exists)', () => {
    const gitignorePath = join(projectRoot, '.gitignore');
    const content = readFileSync(gitignorePath, 'utf-8');

    // .gitignore DOES exclude .next - this is why .npmignore is needed
    expect(content).toContain('/.next/');
  });

  it('.gitignore should exclude dist (confirming the problem exists)', () => {
    const gitignorePath = join(projectRoot, '.gitignore');
    const content = readFileSync(gitignorePath, 'utf-8');

    // .gitignore DOES exclude dist - this is why .npmignore is needed
    expect(content).toContain('/dist');
  });
});
