import { describe, it, expect, vi } from 'vitest';

// next/navigationをモック
const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  useSearchParams: () => ({ get: vi.fn() }),
}));

describe('EnvironmentsSettingsPage (廃止済み)', () => {
  it('/settings/environments は廃止されており /settings にリダイレクトする', async () => {
    // このページはリダイレクトのみを行うサーバーコンポーネントに変更済み
    // redirect() が呼ばれることを確認（Next.jsのredirectはthrowするため）
    const mod = await import('../page');
    const EnvironmentsSettingsPage = mod.default;
    expect(typeof EnvironmentsSettingsPage).toBe('function');
    try {
      EnvironmentsSettingsPage();
    } catch {
      // redirect()はthrowするため、エラーが発生することが期待される
    }
    expect(mockRedirect).toHaveBeenCalledWith('/settings');
  });
});
