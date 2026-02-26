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

    // DOCKERは表示される
    expect(screen.getByText('Docker')).toBeInTheDocument();
    // HOSTは表示されない
    expect(screen.queryByText('ホスト')).not.toBeInTheDocument();
    // SSHは表示される（未実装だが選択肢としては存在する）
    expect(screen.getByText('SSH')).toBeInTheDocument();
  });

  it('hostEnvironmentDisabled=falseの場合、全タイプが選択肢に含まれる', () => {
    const props = createDefaultProps({
      hostEnvironmentDisabled: false,
    });

    render(<EnvironmentForm {...props} />);

    // タイプのListboxボタンをクリック
    const typeButton = screen.getByRole('button', { name: /ホスト/ });
    fireEvent.click(typeButton);

    // 全タイプが表示される
    expect(screen.getByText('ホスト')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.getByText('SSH')).toBeInTheDocument();
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
