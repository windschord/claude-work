import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NetworkTestDialog } from '../NetworkTestDialog';

// fetchをモック
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createDefaultProps(overrides: Partial<Parameters<typeof NetworkTestDialog>[0]> = {}) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    environmentId: 'env-123',
    ...overrides,
  };
}

describe('NetworkTestDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('8. ドメイン/IPアドレス入力フィールドが表示される', () => {
    const props = createDefaultProps();
    render(<NetworkTestDialog {...props} />);

    expect(screen.getByPlaceholderText(/example\.com/)).toBeInTheDocument();
  });

  it('9. ポート番号入力フィールドが表示される', () => {
    const props = createDefaultProps();
    render(<NetworkTestDialog {...props} />);

    expect(screen.getByPlaceholderText(/443/)).toBeInTheDocument();
  });

  it('10. テスト実行ボタンでAPIが呼ばれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { allowed: true } }),
    });

    const props = createDefaultProps();
    render(<NetworkTestDialog {...props} />);

    const targetInput = screen.getByPlaceholderText(/example\.com/);
    fireEvent.change(targetInput, { target: { value: 'api.anthropic.com' } });

    const portInput = screen.getByPlaceholderText(/443/);
    fireEvent.change(portInput, { target: { value: '443' } });

    fireEvent.click(screen.getByRole('button', { name: 'テスト実行' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/environments/env-123/network-filter/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: 'api.anthropic.com', port: 443 }),
        })
      );
    });
  });

  it('11. 許可結果が緑色で表示される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          allowed: true,
          matchedRule: { id: 'rule-1', target: 'api.anthropic.com', port: 443, description: 'Claude API' },
        },
      }),
    });

    const props = createDefaultProps();
    render(<NetworkTestDialog {...props} />);

    const targetInput = screen.getByPlaceholderText(/example\.com/);
    fireEvent.change(targetInput, { target: { value: 'api.anthropic.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'テスト実行' }));

    await waitFor(() => {
      expect(screen.getByText('Allowed')).toBeInTheDocument();
    });

    const resultElement = screen.getByText('Allowed').closest('[class*="green"]') ??
      screen.getByText('Allowed').parentElement;
    expect(resultElement?.className).toMatch(/green/);
  });

  it('12. ブロック結果が赤色で表示される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { allowed: false },
      }),
    });

    const props = createDefaultProps();
    render(<NetworkTestDialog {...props} />);

    const targetInput = screen.getByPlaceholderText(/example\.com/);
    fireEvent.change(targetInput, { target: { value: 'malicious.example.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'テスト実行' }));

    await waitFor(() => {
      expect(screen.getByText('Blocked')).toBeInTheDocument();
    });

    const resultElement = screen.getByText('Blocked').closest('[class*="red"]') ??
      screen.getByText('Blocked').parentElement;
    expect(resultElement?.className).toMatch(/red/);
  });

  it('13. マッチしたルール情報が表示される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          allowed: true,
          matchedRule: { id: 'rule-1', target: 'api.anthropic.com', port: 443, description: 'Claude API' },
        },
      }),
    });

    const props = createDefaultProps();
    render(<NetworkTestDialog {...props} />);

    const targetInput = screen.getByPlaceholderText(/example\.com/);
    fireEvent.change(targetInput, { target: { value: 'api.anthropic.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'テスト実行' }));

    await waitFor(() => {
      expect(screen.getByText('api.anthropic.com')).toBeInTheDocument();
      expect(screen.getByText('Claude API')).toBeInTheDocument();
    });
  });
});
