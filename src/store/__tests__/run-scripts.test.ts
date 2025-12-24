import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRunScriptStore } from '../run-scripts';
import type { RunScript } from '../run-scripts';

// global fetchのモック
global.fetch = vi.fn();

describe('useRunScriptStore', () => {
  beforeEach(() => {
    // 各テストの前にストアをリセット
    useRunScriptStore.setState({
      scripts: [],
      isLoading: false,
      error: null,
    });
    // fetchモックをクリア
    vi.clearAllMocks();
  });

  describe('fetchScripts', () => {
    const projectId = 'test-project-id';
    const mockScripts: RunScript[] = [
      {
        id: 'script-1',
        project_id: projectId,
        name: 'Test Script',
        description: 'Run tests',
        command: 'npm test',
        created_at: '2025-12-22T00:00:00Z',
        updated_at: '2025-12-22T00:00:00Z',
      },
      {
        id: 'script-2',
        project_id: projectId,
        name: 'Build Script',
        description: null,
        command: 'npm run build',
        created_at: '2025-12-22T01:00:00Z',
        updated_at: '2025-12-22T01:00:00Z',
      },
    ];

    it('APIが { scripts: [...] } 形式で返した時に正しくパースされる', async () => {
      // APIレスポンスをモック（{ scripts: [...] } 形式）
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ scripts: mockScripts }),
      } as Response);

      const { fetchScripts } = useRunScriptStore.getState();
      await fetchScripts(projectId);

      const { scripts, isLoading, error } = useRunScriptStore.getState();
      expect(scripts).toEqual(mockScripts);
      expect(scripts).toHaveLength(2);
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
    });

    it('APIが空のscripts配列を返した時に正しく処理される', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ scripts: [] }),
      } as Response);

      const { fetchScripts } = useRunScriptStore.getState();
      await fetchScripts(projectId);

      const { scripts, isLoading, error } = useRunScriptStore.getState();
      expect(scripts).toEqual([]);
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
    });

    it('APIがscriptsプロパティなしで返した時に空配列にフォールバックする', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);

      const { fetchScripts } = useRunScriptStore.getState();
      await fetchScripts(projectId);

      const { scripts, isLoading, error } = useRunScriptStore.getState();
      expect(scripts).toEqual([]);
      expect(isLoading).toBe(false);
      expect(error).toBeNull();
    });

    it('APIがエラーを返した時にエラーメッセージが設定される', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      } as Response);

      const { fetchScripts } = useRunScriptStore.getState();
      await fetchScripts(projectId);

      const { scripts, isLoading, error } = useRunScriptStore.getState();
      expect(scripts).toEqual([]);
      expect(isLoading).toBe(false);
      expect(error).toBe('スクリプトの取得に失敗しました');
    });

    it('APIが401エラーを返した時にエラーメッセージが設定される', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response);

      const { fetchScripts } = useRunScriptStore.getState();
      await fetchScripts(projectId);

      const { scripts, isLoading, error } = useRunScriptStore.getState();
      expect(scripts).toEqual([]);
      expect(isLoading).toBe(false);
      expect(error).toBe('スクリプトの取得に失敗しました');
    });

    it('fetch中にネットワークエラーが発生した時にエラーメッセージが設定される', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { fetchScripts } = useRunScriptStore.getState();
      await fetchScripts(projectId);

      const { scripts, isLoading, error } = useRunScriptStore.getState();
      expect(scripts).toEqual([]);
      expect(isLoading).toBe(false);
      expect(error).toBe('Network error');
    });

    it('fetchScripts実行中はisLoadingがtrueになる', async () => {
      // fetchをpendingのままにして、isLoadingを観察
      let resolveFetch: (value: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
      vi.mocked(global.fetch).mockReturnValueOnce(fetchPromise);

      const { fetchScripts } = useRunScriptStore.getState();
      const promise = fetchScripts(projectId);

      // fetch実行中
      expect(useRunScriptStore.getState().isLoading).toBe(true);

      // fetchを完了
      resolveFetch!({
        ok: true,
        status: 200,
        json: async () => ({ scripts: mockScripts }),
      } as Response);
      await promise;

      // fetch完了後
      expect(useRunScriptStore.getState().isLoading).toBe(false);
    });
  });
});
