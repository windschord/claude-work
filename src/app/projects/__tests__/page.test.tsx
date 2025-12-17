import { describe, it, expect, vi } from 'vitest';
import ProjectsPage from '../page';

// Next.jsのナビゲーションモック
const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mockRedirect(path);
    throw new Error(`NEXT_REDIRECT: ${path}`); // Next.jsのredirectは例外をスローする
  },
}));

describe('ProjectsPage', () => {
  it('/projects にアクセスすると / にリダイレクトされる', () => {
    // redirectは例外をスローするので、エラーをキャッチする
    expect(() => {
      ProjectsPage();
    }).toThrow('NEXT_REDIRECT: /');

    expect(mockRedirect).toHaveBeenCalledWith('/');
  });
});
