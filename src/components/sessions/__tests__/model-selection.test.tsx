import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CreateSessionForm } from '../CreateSessionForm';
import { useAppStore } from '@/store';

// Zustandストアのモック
vi.mock('@/store', () => ({
  useAppStore: vi.fn(),
}));

describe('CreateSessionForm - Model Selection', () => {
  const mockCreateSession = vi.fn();
  const mockProjects = [
    {
      id: 'project-1',
      name: 'Test Project',
      path: '/path/to/project',
      default_model: 'sonnet',
      run_scripts: [],
      session_count: 0,
      created_at: '2024-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSession.mockResolvedValue(undefined);
    (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => selector({
      createSession: mockCreateSession,
      projects: mockProjects,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  describe('モデル選択UIの表示', () => {
    it('モデル選択のドロップダウンが表示される', () => {
      render(<CreateSessionForm projectId="project-1" />);

      const modelSelect = screen.getByLabelText(/モデル/);
      expect(modelSelect).toBeInTheDocument();
    });

    it('モデル選択に4つのオプションが表示される', () => {
      render(<CreateSessionForm projectId="project-1" />);

      const modelSelect = screen.getByLabelText(/モデル/) as HTMLSelectElement;
      const options = Array.from(modelSelect.options).map((option) => option.value);

      expect(options).toContain('auto');
      expect(options).toContain('opus');
      expect(options).toContain('sonnet');
      expect(options).toContain('haiku');
      expect(options).toHaveLength(4);
    });

    it('各モデルオプションに適切なラベルが表示される', () => {
      render(<CreateSessionForm projectId="project-1" />);

      expect(screen.getByRole('option', { name: /Auto/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Opus/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Sonnet/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Haiku/ })).toBeInTheDocument();
    });
  });

  describe('デフォルトモデルの適用', () => {
    it('プロジェクトのデフォルトモデルが選択される', () => {
      render(<CreateSessionForm projectId="project-1" />);

      const modelSelect = screen.getByLabelText(/モデル/) as HTMLSelectElement;
      expect(modelSelect.value).toBe('sonnet');
    });

    it('デフォルトモデルが未設定の場合はAutoが選択される', () => {
      const projectsWithoutDefault = [
        {
          ...mockProjects[0],
          default_model: '',
        },
      ];

      (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => selector({
        createSession: mockCreateSession,
        projects: projectsWithoutDefault,
      }));

      render(<CreateSessionForm projectId="project-1" />);

      const modelSelect = screen.getByLabelText(/モデル/) as HTMLSelectElement;
      expect(modelSelect.value).toBe('auto');
    });

    it('デフォルトモデルがautoの場合はAutoが選択される', () => {
      const projectsWithAutoDefault = [
        {
          ...mockProjects[0],
          default_model: 'auto',
        },
      ];

      (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => selector({
        createSession: mockCreateSession,
        projects: projectsWithAutoDefault,
      }));

      render(<CreateSessionForm projectId="project-1" />);

      const modelSelect = screen.getByLabelText(/モデル/) as HTMLSelectElement;
      expect(modelSelect.value).toBe('auto');
    });
  });

  describe('モデル選択の変更', () => {
    it('モデル選択を変更できる', () => {
      render(<CreateSessionForm projectId="project-1" />);

      const modelSelect = screen.getByLabelText(/モデル/) as HTMLSelectElement;

      fireEvent.change(modelSelect, { target: { value: 'opus' } });
      expect(modelSelect.value).toBe('opus');

      fireEvent.change(modelSelect, { target: { value: 'haiku' } });
      expect(modelSelect.value).toBe('haiku');
    });

    it('モデル選択をautoに変更できる', () => {
      render(<CreateSessionForm projectId="project-1" />);

      const modelSelect = screen.getByLabelText(/モデル/) as HTMLSelectElement;

      // 初期値はsonnet
      expect(modelSelect.value).toBe('sonnet');

      // autoに変更
      fireEvent.change(modelSelect, { target: { value: 'auto' } });
      expect(modelSelect.value).toBe('auto');
    });
  });

  describe('モデル指定でのセッション作成', () => {
    it('デフォルトモデルでセッションが作成される', async () => {
      render(<CreateSessionForm projectId="project-1" />);

      const nameInput = screen.getByPlaceholderText(/セッション名/);
      const promptInput = screen.getByPlaceholderText(/プロンプト/);
      const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

      fireEvent.change(nameInput, { target: { value: 'Test Session' } });
      fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockCreateSession).toHaveBeenCalledWith('project-1', {
          name: 'Test Session',
          prompt: 'Test prompt',
          model: 'sonnet',
        });
      });
    });

    it('選択したモデルでセッションが作成される - Opus', async () => {
      render(<CreateSessionForm projectId="project-1" />);

      const nameInput = screen.getByPlaceholderText(/セッション名/);
      const promptInput = screen.getByPlaceholderText(/プロンプト/);
      const modelSelect = screen.getByLabelText(/モデル/);
      const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

      fireEvent.change(nameInput, { target: { value: 'Test Session' } });
      fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
      fireEvent.change(modelSelect, { target: { value: 'opus' } });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockCreateSession).toHaveBeenCalledWith('project-1', {
          name: 'Test Session',
          prompt: 'Test prompt',
          model: 'opus',
        });
      });
    });

    it('選択したモデルでセッションが作成される - Haiku', async () => {
      render(<CreateSessionForm projectId="project-1" />);

      const nameInput = screen.getByPlaceholderText(/セッション名/);
      const promptInput = screen.getByPlaceholderText(/プロンプト/);
      const modelSelect = screen.getByLabelText(/モデル/);
      const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

      fireEvent.change(nameInput, { target: { value: 'Test Session' } });
      fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
      fireEvent.change(modelSelect, { target: { value: 'haiku' } });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockCreateSession).toHaveBeenCalledWith('project-1', {
          name: 'Test Session',
          prompt: 'Test prompt',
          model: 'haiku',
        });
      });
    });

    it('Autoモデルでセッションが作成される', async () => {
      render(<CreateSessionForm projectId="project-1" />);

      const nameInput = screen.getByPlaceholderText(/セッション名/);
      const promptInput = screen.getByPlaceholderText(/プロンプト/);
      const modelSelect = screen.getByLabelText(/モデル/);
      const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

      fireEvent.change(nameInput, { target: { value: 'Test Session' } });
      fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
      fireEvent.change(modelSelect, { target: { value: 'auto' } });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockCreateSession).toHaveBeenCalledWith('project-1', {
          name: 'Test Session',
          prompt: 'Test prompt',
          model: 'auto',
        });
      });
    });
  });

  describe('フォームの状態管理', () => {
    it('セッション作成後、モデル選択がデフォルトに戻る', async () => {
      render(<CreateSessionForm projectId="project-1" />);

      const nameInput = screen.getByPlaceholderText(/セッション名/);
      const promptInput = screen.getByPlaceholderText(/プロンプト/);
      const modelSelect = screen.getByLabelText(/モデル/) as HTMLSelectElement;
      const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

      // モデルを変更
      fireEvent.change(modelSelect, { target: { value: 'opus' } });
      expect(modelSelect.value).toBe('opus');

      // セッションを作成
      fireEvent.change(nameInput, { target: { value: 'Test Session' } });
      fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
      fireEvent.click(createButton);

      // 作成後はデフォルトモデルに戻る
      await waitFor(() => {
        expect(modelSelect.value).toBe('sonnet');
      });
    });

    it('ローディング中はモデル選択が無効化される', async () => {
      let _resolveCreateSession: () => void;
      const createSessionPromise = new Promise<void>((resolve) => {
        _resolveCreateSession = resolve;
      });
      mockCreateSession.mockReturnValue(createSessionPromise);

      render(<CreateSessionForm projectId="project-1" />);

      const nameInput = screen.getByPlaceholderText(/セッション名/);
      const promptInput = screen.getByPlaceholderText(/プロンプト/);
      const modelSelect = screen.getByLabelText(/モデル/);
      const createButton = screen.getByRole('button', { name: /作成|セッション作成/ });

      fireEvent.change(nameInput, { target: { value: 'Test Session' } });
      fireEvent.change(promptInput, { target: { value: 'Test prompt' } });

      // クリック前はモデル選択は有効
      expect(modelSelect).not.toBeDisabled();

      fireEvent.click(createButton);

      // クリック後はモデル選択が無効化される
      await waitFor(() => {
        expect(modelSelect).toBeDisabled();
      });
    });
  });

  describe('プロジェクトが見つからない場合', () => {
    it('プロジェクトが見つからない場合はAutoがデフォルトになる', () => {
      (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => selector({
        createSession: mockCreateSession,
        projects: [],
      }));

      render(<CreateSessionForm projectId="non-existent-project" />);

      const modelSelect = screen.getByLabelText(/モデル/) as HTMLSelectElement;
      expect(modelSelect.value).toBe('auto');
    });
  });
});
