/**
 * ProjectSettingsModal - 環境名リンク機能のテスト
 * Issue#170: プロジェクト設定の環境名から環境設定画面へのリンク追加
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProjectSettingsModal } from '../ProjectSettingsModal';

// Next.js Link mock
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// store mock
vi.mock('@/store', () => ({
  useAppStore: () => ({
    fetchProjects: vi.fn(),
  }),
}));

// react-hot-toast mock
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// ClaudeOptionsForm mock
vi.mock('@/components/claude-options/ClaudeOptionsForm', () => ({
  ClaudeOptionsForm: () => <div data-testid="claude-options-form" />,
}));

const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  path: '/repos/test',
  run_scripts: [],
  session_count: 0,
  created_at: '2024-01-01T00:00:00Z',
};

describe('ProjectSettingsModal - 環境名リンク', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('環境IDがある場合、環境名が環境設定画面へのリンクになる', async () => {
    const environmentId = 'env-123';
    const environmentName = 'Test Docker';

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scripts: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          project: {
            clone_location: 'docker',
            environment_id: environmentId,
            environment: { id: environmentId, name: environmentName, type: 'DOCKER' },
            claude_code_options: null,
            custom_env_vars: null,
          },
        }),
      });

    render(
      <ProjectSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        project={mockProject}
      />
    );

    await waitFor(() => {
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', `/settings/environments?highlight=${environmentId}`);
    });

    await waitFor(() => {
      expect(screen.getByText(environmentName)).toBeInTheDocument();
    });
  });

  it('環境IDがない場合(自動選択)、リンクにならない', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ scripts: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          project: {
            clone_location: 'docker',
            environment_id: null,
            environment: null,
            claude_code_options: null,
            custom_env_vars: null,
          },
        }),
      });

    render(
      <ProjectSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        project={mockProject}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Docker (自動選択)')).toBeInTheDocument();
    });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
