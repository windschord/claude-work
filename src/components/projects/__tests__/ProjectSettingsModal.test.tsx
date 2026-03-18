/**
 * ProjectSettingsModal - 環境設定セクション統合テスト
 * Phase D (TASK-017): env-project-one-to-one リファクタリング後の動作確認
 * 環境選択はProjectEnvironmentSectionに委譲され、モーダル内に統合表示される
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

// ProjectEnvironmentSection mock（実際のfetch処理を持つ子コンポーネントをモック）
vi.mock('@/components/projects/ProjectEnvironmentSection', () => ({
  ProjectEnvironmentSection: ({ projectId }: { projectId: string }) => (
    <div data-testid="project-environment-section" data-project-id={projectId}>
      環境設定セクション
    </div>
  ),
}));

const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  path: '/repos/test',
  run_scripts: [],
  session_count: 0,
  created_at: '2024-01-01T00:00:00Z',
};

describe('ProjectSettingsModal - 環境設定セクション', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
            claude_code_options: null,
            custom_env_vars: null,
          },
        }),
      });
  });

  it('モーダルが開かれているとき、ProjectEnvironmentSectionが表示される', async () => {
    render(
      <ProjectSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        project={mockProject}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-environment-section')).toBeInTheDocument();
    });
  });

  it('ProjectEnvironmentSectionに正しいprojectIdが渡される', async () => {
    render(
      <ProjectSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        project={mockProject}
      />
    );

    await waitFor(() => {
      const section = screen.getByTestId('project-environment-section');
      expect(section).toHaveAttribute('data-project-id', mockProject.id);
    });
  });
});
