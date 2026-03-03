import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NetworkTemplateDialog } from '../NetworkTemplateDialog';

// fetchをモック
const mockFetch = vi.fn();

const mockTemplates = [
  {
    category: 'Anthropic API',
    rules: [
      { target: 'api.anthropic.com', port: 443, description: 'Claude API' },
    ],
  },
  {
    category: 'npm',
    rules: [
      { target: '*.npmjs.org', port: 443, description: 'npm registry' },
      { target: '*.npmjs.com', port: 443, description: 'npm registry' },
    ],
  },
];

function createDefaultProps(overrides: Partial<Parameters<typeof NetworkTemplateDialog>[0]> = {}) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    environmentId: 'env-123',
    onApplied: vi.fn(),
    ...overrides,
  };
}

describe('NetworkTemplateDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ templates: mockTemplates }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1. テンプレート一覧がカテゴリ別に表示される', async () => {
    const props = createDefaultProps();
    render(<NetworkTemplateDialog {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Anthropic API')).toBeInTheDocument();
      expect(screen.getByText('npm')).toBeInTheDocument();
    });

    expect(screen.getByText('api.anthropic.com')).toBeInTheDocument();
    expect(screen.getByText('*.npmjs.org')).toBeInTheDocument();
    expect(screen.getByText('*.npmjs.com')).toBeInTheDocument();
  });

  it('2. 各ルールにチェックボックスが表示される', async () => {
    const props = createDefaultProps();
    render(<NetworkTemplateDialog {...props} />);

    await waitFor(() => {
      expect(screen.getByText('api.anthropic.com')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    // 3ルール分のチェックボックス
    expect(checkboxes.length).toBe(3);
  });

  it('3. 「全選択」ボタンで全ルールが選択される', async () => {
    const props = createDefaultProps();
    render(<NetworkTemplateDialog {...props} />);

    await waitFor(() => {
      expect(screen.getByText('全選択')).toBeInTheDocument();
    });

    // まず全解除して全チェックをオフにする
    fireEvent.click(screen.getByText('全解除'));

    // 全選択をクリック
    fireEvent.click(screen.getByText('全選択'));

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => {
      expect(cb).toBeChecked();
    });
  });

  it('4. 「全解除」ボタンで全ルールが解除される', async () => {
    const props = createDefaultProps();
    render(<NetworkTemplateDialog {...props} />);

    await waitFor(() => {
      expect(screen.getByText('全解除')).toBeInTheDocument();
    });

    // 全解除をクリック
    fireEvent.click(screen.getByText('全解除'));

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => {
      expect(cb).not.toBeChecked();
    });
  });

  it('5. 「適用」ボタンで選択されたルールがAPI経由で追加される', async () => {
    const onApplied = vi.fn();
    const props = createDefaultProps({ onApplied });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: mockTemplates }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ created: 3, skipped: 0, rules: [] }),
      });

    render(<NetworkTemplateDialog {...props} />);

    await waitFor(() => {
      expect(screen.getByText('全選択')).toBeInTheDocument();
    });

    // 全選択して適用
    fireEvent.click(screen.getByText('全選択'));
    fireEvent.click(screen.getByRole('button', { name: '適用' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/environments/env-123/network-rules/templates/apply',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        })
      );

      // POSTボディのJSON構造を検証
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const bodyJson = JSON.parse(lastCall[1].body as string) as unknown;
      expect(bodyJson).toMatchObject({
        rules: expect.arrayContaining([
          expect.objectContaining({ target: 'api.anthropic.com', port: 443 }),
          expect.objectContaining({ target: '*.npmjs.org', port: 443 }),
          expect.objectContaining({ target: '*.npmjs.com', port: 443 }),
        ]),
      });
    });

    await waitFor(() => {
      expect(onApplied).toHaveBeenCalled();
    });
  });

  it('6. 重複ルールがある場合にスキップ数が表示される', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ templates: mockTemplates }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ created: 1, skipped: 2, rules: [] }),
      });

    const props = createDefaultProps();
    render(<NetworkTemplateDialog {...props} />);

    await waitFor(() => {
      expect(screen.getByText('全選択')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('全選択'));
    fireEvent.click(screen.getByRole('button', { name: '適用' }));

    await waitFor(() => {
      expect(screen.getByText(/1件追加/)).toBeInTheDocument();
      expect(screen.getByText(/2件スキップ/)).toBeInTheDocument();
    });
  });

  it('7. 「キャンセル」ボタンでダイアログが閉じる', async () => {
    const onClose = vi.fn();
    const props = createDefaultProps({ onClose });
    render(<NetworkTemplateDialog {...props} />);

    await waitFor(() => {
      expect(screen.getByText('キャンセル')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('キャンセル'));
    expect(onClose).toHaveBeenCalled();
  });
});
