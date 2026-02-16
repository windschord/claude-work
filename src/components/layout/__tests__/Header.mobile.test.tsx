import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Header } from '../Header';

// next/navigationのモック
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// storeのモック
vi.mock('@/store', () => ({
  useAppStore: () => ({
    logout: vi.fn(),
    isSidebarOpen: false,
    setIsSidebarOpen: vi.fn(),
  }),
}));

// ThemeToggleのモック
vi.mock('@/components/common/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

describe('Header - Mobile Optimization', () => {
  afterEach(() => {
    cleanup();
  });

  it('ハンバーガーメニューボタンのタップ領域が確保されている', () => {
    render(<Header />);
    const hamburgerButton = screen.getByLabelText('メニュー');
    expect(hamburgerButton).toHaveClass('p-2');
  });

  it('設定ボタンのタップ領域が確保されている', () => {
    render(<Header />);
    const environmentButton = screen.getByLabelText('設定');
    expect(environmentButton).toHaveClass('p-2');
  });

  it('ハンバーガーメニューボタンにホバー効果が設定されている', () => {
    render(<Header />);
    const hamburgerButton = screen.getByLabelText('メニュー');
    expect(hamburgerButton).toHaveClass('hover:bg-gray-100');
    expect(hamburgerButton).toHaveClass('dark:hover:bg-gray-800');
  });

  it('設定ボタンにホバー効果が設定されている', () => {
    render(<Header />);
    const environmentButton = screen.getByLabelText('設定');
    expect(environmentButton).toHaveClass('hover:bg-gray-100');
    expect(environmentButton).toHaveClass('dark:hover:bg-gray-800');
  });

  it('ボタンに角丸が設定されている', () => {
    render(<Header />);
    const hamburgerButton = screen.getByLabelText('メニュー');
    const environmentButton = screen.getByLabelText('設定');

    expect(hamburgerButton).toHaveClass('rounded-lg');
    expect(environmentButton).toHaveClass('rounded-lg');
  });

  it('トランジション効果が設定されている', () => {
    render(<Header />);
    const hamburgerButton = screen.getByLabelText('メニュー');
    const environmentButton = screen.getByLabelText('設定');

    expect(hamburgerButton).toHaveClass('transition-colors');
    expect(environmentButton).toHaveClass('transition-colors');
  });

  it('ヘッダーの高さが適切に設定されている', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('h-16');
  });

  it('ヘッダーのパディングがモバイルとデスクトップで異なる', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');
    expect(header).toHaveClass('px-4');
    expect(header).toHaveClass('md:px-6');
  });
});
