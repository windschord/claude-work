import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { SessionStatusIcon } from '../SessionStatusIcon';

describe('SessionStatusIcon', () => {
  afterEach(() => {
    cleanup();
  });

  it('initializingステータスでスピナーアイコンが表示される', () => {
    render(<SessionStatusIcon status="initializing" />);

    const icon = screen.getByTestId('status-icon-initializing');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('text-blue-500');
  });

  it('runningステータスで再生アイコンが表示される', () => {
    render(<SessionStatusIcon status="running" />);

    const icon = screen.getByTestId('status-icon-running');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('text-green-500');
  });

  it('waiting_inputステータスで一時停止アイコンが表示される', () => {
    render(<SessionStatusIcon status="waiting_input" />);

    const icon = screen.getByTestId('status-icon-waiting_input');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('text-yellow-500');
  });

  it('completedステータスでチェックアイコンが表示される', () => {
    render(<SessionStatusIcon status="completed" />);

    const icon = screen.getByTestId('status-icon-completed');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('text-gray-500');
  });

  it('errorステータスでエラーアイコンが表示される', () => {
    render(<SessionStatusIcon status="error" />);

    const icon = screen.getByTestId('status-icon-error');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('text-red-500');
  });

  it('アイコンのサイズが正しく設定される', () => {
    render(<SessionStatusIcon status="running" />);

    const icon = screen.getByTestId('status-icon-running');
    expect(icon).toHaveClass('w-5', 'h-5');
  });

  it('全てのステータスでアイコンが表示される', () => {
    const statuses: Array<'initializing' | 'running' | 'waiting_input' | 'completed' | 'error'> = [
      'initializing',
      'running',
      'waiting_input',
      'completed',
      'error',
    ];

    statuses.forEach((status) => {
      const { unmount } = render(<SessionStatusIcon status={status} />);
      const icon = screen.getByTestId(`status-icon-${status}`);
      expect(icon).toBeInTheDocument();
      unmount();
    });
  });

  it('ステータスに応じた適切な色が設定される', () => {
    const statusColorMap = [
      { status: 'initializing' as const, color: 'text-blue-500' },
      { status: 'running' as const, color: 'text-green-500' },
      { status: 'waiting_input' as const, color: 'text-yellow-500' },
      { status: 'completed' as const, color: 'text-gray-500' },
      { status: 'error' as const, color: 'text-red-500' },
    ];

    statusColorMap.forEach(({ status, color }) => {
      const { unmount } = render(<SessionStatusIcon status={status} />);
      const icon = screen.getByTestId(`status-icon-${status}`);
      expect(icon).toHaveClass(color);
      unmount();
    });
  });
});
