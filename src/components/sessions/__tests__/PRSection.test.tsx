import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PRSection } from '../PRSection';

describe('PRSection', () => {
  const defaultProps = {
    sessionId: 'session-123',
    branchName: 'claude-work/feature-branch',
  };

  it('PR未作成時に作成ボタンが表示される', () => {
    render(<PRSection {...defaultProps} />);

    expect(screen.getByRole('button', { name: /PR\u3092\u4f5c\u6210/i })).toBeInTheDocument();
  });

  it('PR作成済み時にPRリンクが表示される', () => {
    render(
      <PRSection
        {...defaultProps}
        prUrl="https://github.com/owner/repo/pull/123"
        prNumber={123}
        prStatus="open"
      />
    );

    const link = screen.getByRole('link', { name: /#123/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/pull/123');
  });

  it('openステータスのバッジが正しく表示される', () => {
    render(
      <PRSection
        {...defaultProps}
        prUrl="https://github.com/owner/repo/pull/123"
        prNumber={123}
        prStatus="open"
      />
    );

    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('mergedステータスのバッジが正しく表示される', () => {
    render(
      <PRSection
        {...defaultProps}
        prUrl="https://github.com/owner/repo/pull/123"
        prNumber={123}
        prStatus="merged"
      />
    );

    expect(screen.getByText('Merged')).toBeInTheDocument();
  });

  it('closedステータスのバッジが正しく表示される', () => {
    render(
      <PRSection
        {...defaultProps}
        prUrl="https://github.com/owner/repo/pull/123"
        prNumber={123}
        prStatus="closed"
      />
    );

    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('ブランチ名が表示される', () => {
    render(<PRSection {...defaultProps} />);

    expect(screen.getByText('claude-work/feature-branch')).toBeInTheDocument();
  });
});
