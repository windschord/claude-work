import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackButton } from '../BackButton';

// Next.js routerのモック
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('BackButton', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('戻るボタンが正しくレンダリングされる', () => {
    render(<BackButton />);
    expect(screen.getByText('設定に戻る')).toBeInTheDocument();
  });

  it('ArrowLeftアイコンが表示される', () => {
    const { container } = render(<BackButton />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('クリック時に/settingsに遷移する', () => {
    render(<BackButton />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('onBeforeNavigateがtrueを返す場合、遷移する', () => {
    const onBeforeNavigate = vi.fn(() => true);
    render(<BackButton onBeforeNavigate={onBeforeNavigate} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(onBeforeNavigate).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('onBeforeNavigateがfalseを返す場合、遷移しない', () => {
    const onBeforeNavigate = vi.fn(() => false);
    render(<BackButton onBeforeNavigate={onBeforeNavigate} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(onBeforeNavigate).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('適切なスタイルが適用されている', () => {
    render(<BackButton />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('inline-flex');
    expect(button).toHaveClass('items-center');
    expect(button).toHaveClass('gap-2');
    expect(button).toHaveClass('transition-colors');
  });
});
