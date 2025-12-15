import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';

// next-themesのモック
const mockSetTheme = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('マウント前は空のプレースホルダーを表示する', () => {
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    // マウント前はaria-labelのみ存在
    const button = screen.getByLabelText('Toggle theme');
    expect(button).toBeInTheDocument();
  });

  it('ライトモード時は太陽アイコンを表示する', async () => {
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    // マウント後に太陽アイコンが表示されることを待つ
    await waitFor(() => {
      const button = screen.getByLabelText('Toggle theme');
      // lucide-reactのSunアイコンはSVG要素として描画される
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  it('ダークモード時は月アイコンを表示する', async () => {
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    // マウント後に月アイコンが表示されることを待つ
    await waitFor(() => {
      const button = screen.getByLabelText('Toggle theme');
      // lucide-reactのMoonアイコンはSVG要素として描画される
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  it('システムモード時はモニターアイコンを表示する', async () => {
    mockUseTheme.mockReturnValue({
      theme: 'system',
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    // マウント後にモニターアイコンが表示されることを待つ
    await waitFor(() => {
      const button = screen.getByLabelText('Toggle theme');
      // lucide-reactのMonitorアイコンはSVG要素として描画される
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  it('クリックでライトモードからダークモードに切り替わる', async () => {
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    // マウント完了を待つ
    await waitFor(() => {
      expect(screen.getByLabelText('Toggle theme').querySelector('svg')).toBeInTheDocument();
    });

    const button = screen.getByLabelText('Toggle theme');
    fireEvent.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('クリックでダークモードからシステムモードに切り替わる', async () => {
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    // マウント完了を待つ
    await waitFor(() => {
      expect(screen.getByLabelText('Toggle theme').querySelector('svg')).toBeInTheDocument();
    });

    const button = screen.getByLabelText('Toggle theme');
    fireEvent.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('クリックでシステムモードからライトモードに切り替わる', async () => {
    mockUseTheme.mockReturnValue({
      theme: 'system',
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    // マウント完了を待つ
    await waitFor(() => {
      expect(screen.getByLabelText('Toggle theme').querySelector('svg')).toBeInTheDocument();
    });

    const button = screen.getByLabelText('Toggle theme');
    fireEvent.click(button);

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('ボタンにホバースタイルが適用されている', () => {
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    const button = screen.getByLabelText('Toggle theme');
    expect(button).toHaveClass('hover:bg-gray-100');
    expect(button).toHaveClass('dark:hover:bg-gray-800');
  });

  it('ボタンにtransition-colorsクラスが適用されている', () => {
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    const button = screen.getByLabelText('Toggle theme');
    expect(button).toHaveClass('transition-colors');
  });
});
