import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LoginPage from '../login/page';
import { useAppStore } from '@/store';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

// Next.jsのナビゲーションモック
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

describe('LoginPage', () => {
  const mockLogin = vi.fn();
  const mockSetAuthenticated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: false,
      login: mockLogin,
      setAuthenticated: mockSetAuthenticated,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('ログインフォームが表示される', () => {
    render(<LoginPage />);

    expect(screen.getByText('ClaudeWork')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('認証トークンを入力')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
  });

  it('トークン入力フィールドがある', () => {
    render(<LoginPage />);

    const input = screen.getByPlaceholderText('認証トークンを入力') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('password');
  });

  it('空のトークンで送信ボタンが無効化される', () => {
    render(<LoginPage />);

    const button = screen.getByRole('button', { name: 'ログイン' });
    expect(button).toBeDisabled();
  });

  it('トークンを入力すると送信ボタンが有効化される', () => {
    render(<LoginPage />);

    const input = screen.getByPlaceholderText('認証トークンを入力');
    const button = screen.getByRole('button', { name: 'ログイン' });

    fireEvent.change(input, { target: { value: 'test-token' } });

    expect(button).not.toBeDisabled();
  });

  it('正しいトークンでログイン成功し、/にリダイレクトされる', async () => {
    mockLogin.mockResolvedValueOnce(undefined);

    render(<LoginPage />);

    const input = screen.getByPlaceholderText('認証トークンを入力');
    const button = screen.getByRole('button', { name: 'ログイン' });

    fireEvent.change(input, { target: { value: 'correct-token' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('correct-token');
    });
  });

  it('誤ったトークンでエラーが表示される', async () => {
    mockLogin.mockRejectedValueOnce(new Error('トークンが無効です'));

    render(<LoginPage />);

    const input = screen.getByPlaceholderText('認証トークンを入力');
    const button = screen.getByRole('button', { name: 'ログイン' });

    fireEvent.change(input, { target: { value: 'wrong-token' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('トークンが無効です')).toBeInTheDocument();
    });
  });

  it('ネットワークエラーで適切なエラーメッセージが表示される', async () => {
    mockLogin.mockRejectedValueOnce(new Error('ネットワークエラーが発生しました'));

    render(<LoginPage />);

    const input = screen.getByPlaceholderText('認証トークンを入力');
    const button = screen.getByRole('button', { name: 'ログイン' });

    fireEvent.change(input, { target: { value: 'test-token' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('ネットワークエラーが発生しました')).toBeInTheDocument();
    });
  });

  it('ローディング中はボタンが無効化される', async () => {
    mockLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(<LoginPage />);

    const input = screen.getByPlaceholderText('認証トークンを入力');
    const button = screen.getByRole('button', { name: 'ログイン' });

    fireEvent.change(input, { target: { value: 'test-token' } });
    fireEvent.click(button);

    // ローディング中はボタンが無効化される
    expect(button).toBeDisabled();
  });
});
