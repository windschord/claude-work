import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnvironmentForm } from '../EnvironmentForm';
import { CreateEnvironmentInput, UpdateEnvironmentInput, Environment } from '@/hooks/useEnvironments';

// fetchのモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createDefaultProps(overrides: Partial<Parameters<typeof EnvironmentForm>[0]> = {}) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn<(input: CreateEnvironmentInput | UpdateEnvironmentInput) => Promise<Environment | void>>().mockResolvedValue(undefined),
    mode: 'create' as const,
    ...overrides,
  };
}

describe('EnvironmentForm - HOST環境無効化時の動作', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url === '/api/docker/images') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ images: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('hostEnvironmentDisabled=trueの場合、タイプ選択でHOSTオプションが選択肢に含まれない', () => {
    const props = createDefaultProps({
      hostEnvironmentDisabled: true,
    });

    render(<EnvironmentForm {...props} />);

    // タイプのListboxボタンをクリックしてオプション一覧を開く
    const typeButton = screen.getByRole('button', { name: /Docker/ });
    fireEvent.click(typeButton);

    // Listboxのオプション一覧を取得
    const options = screen.getAllByRole('option');
    const optionTexts = options.map(opt => opt.textContent);

    // DOCKERとSSHのみが選択肢に含まれる
    expect(optionTexts.some(t => t?.includes('Docker'))).toBe(true);
    expect(optionTexts.some(t => t?.includes('SSH'))).toBe(true);
    // HOSTは選択肢に含まれない
    expect(optionTexts.some(t => t?.includes('ホスト'))).toBe(false);
  });

  it('hostEnvironmentDisabled=falseの場合、全タイプが選択肢に含まれる', () => {
    const props = createDefaultProps({
      hostEnvironmentDisabled: false,
    });

    render(<EnvironmentForm {...props} />);

    // タイプのListboxボタンをクリック
    const typeButton = screen.getByRole('button', { name: /ホスト/ });
    fireEvent.click(typeButton);

    // Listboxのオプション一覧を取得
    const options = screen.getAllByRole('option');
    const optionTexts = options.map(opt => opt.textContent);

    // 全タイプが選択肢に含まれる
    expect(optionTexts.some(t => t?.includes('ホスト'))).toBe(true);
    expect(optionTexts.some(t => t?.includes('Docker'))).toBe(true);
    expect(optionTexts.some(t => t?.includes('SSH'))).toBe(true);
  });

  it('hostEnvironmentDisabled=trueの場合、デフォルトタイプがDOCKERになる', () => {
    const props = createDefaultProps({
      hostEnvironmentDisabled: true,
    });

    render(<EnvironmentForm {...props} />);

    // Listboxのボタンに「Docker」と表示されている（HOSTではなく）
    const typeButton = screen.getByRole('button', { name: /Docker/ });
    expect(typeButton).toBeInTheDocument();
  });
});
