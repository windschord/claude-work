import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from './index';

// global fetchのモック
global.fetch = vi.fn();

describe('addProject', () => {
  beforeEach(() => {
    // 各テストの前にストアをリセット
    useAppStore.setState({
      projects: [],
      selectedProjectId: null,
    });
    // fetchモックをクリア
    vi.clearAllMocks();
  });

  describe('エラーハンドリング', () => {
    it('Gitリポジトリでない場合、適切なエラーメッセージがスローされる', async () => {
      // 400エラー（Gitリポジトリでない）をモック
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Gitリポジトリではありません' }),
      } as Response);

      const { addProject } = useAppStore.getState();

      // エラーがスローされることを確認
      await expect(addProject('/test/path')).rejects.toThrow(
        'Gitリポジトリではありません'
      );
    });

    it('403エラーの場合、適切なエラーメッセージがスローされる', async () => {
      // 403エラーをモック
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: '指定されたパスは許可されていません' }),
      } as Response);

      const { addProject } = useAppStore.getState();

      // エラーがスローされることを確認
      await expect(addProject('/test/path')).rejects.toThrow(
        '指定されたパスは許可されていません'
      );
    });

    it('エラー後もstateのprojects配列にundefinedが含まれない', async () => {
      // 初期状態として既存のプロジェクトを設定
      const existingProject = {
        id: 'existing-id',
        name: 'Existing Project',
        path: '/existing/path',
        run_scripts: [],
        session_count: 0,
        created_at: new Date().toISOString(),
      };
      useAppStore.setState({ projects: [existingProject] });

      // 403エラーをモック
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: '指定されたパスは許可されていません' }),
      } as Response);

      const { addProject } = useAppStore.getState();

      try {
        await addProject('/test/path');
      } catch {
        // エラーは無視
      }

      // projects配列にundefinedが含まれていないことを確認
      const { projects } = useAppStore.getState();
      expect(projects.every((project) => project !== undefined)).toBe(true);
      expect(projects).toHaveLength(1);
      expect(projects[0]).toEqual(existingProject);
    });

    it('エラー後もstateのprojects配列が破壊されない', async () => {
      // 初期状態として既存のプロジェクトを設定
      const existingProjects = [
        {
          id: 'project-1',
          name: 'Project 1',
          path: '/path/1',
          run_scripts: [],
          session_count: 0,
          created_at: new Date().toISOString(),
        },
        {
          id: 'project-2',
          name: 'Project 2',
          path: '/path/2',
          run_scripts: [],
          session_count: 0,
          created_at: new Date().toISOString(),
        },
      ];
      useAppStore.setState({ projects: existingProjects });

      // 500エラーをモック
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'プロジェクトの追加に失敗しました' }),
      } as Response);

      const { addProject } = useAppStore.getState();

      try {
        await addProject('/test/path');
      } catch {
        // エラーは無視
      }

      // projects配列が変更されていないことを確認
      const { projects } = useAppStore.getState();
      expect(projects).toEqual(existingProjects);
    });

    it('データ検証: レスポンスにprojectが含まれていない場合、エラーがスローされる', async () => {
      // 成功レスポンスだがprojectが含まれていない
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);

      const { addProject } = useAppStore.getState();

      await expect(addProject('/test/path')).rejects.toThrow(
        'プロジェクトの追加に失敗しました'
      );
    });

    it('データ検証: project.idが含まれていない場合、エラーがスローされる', async () => {
      // 成功レスポンスだがproject.idが含まれていない
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          project: {
            name: 'Test Project',
            path: '/test/path',
          },
        }),
      } as Response);

      const { addProject } = useAppStore.getState();

      await expect(addProject('/test/path')).rejects.toThrow(
        'プロジェクトの追加に失敗しました'
      );
    });
  });

  describe('正常系', () => {
    it('正常にプロジェクトが追加される', async () => {
      const newProject = {
        id: 'new-project-id',
        name: 'New Project',
        path: '/test/path',
        run_scripts: [],
        session_count: 0,
        created_at: new Date().toISOString(),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ project: newProject }),
      } as Response);

      const { addProject } = useAppStore.getState();
      await addProject('/test/path');

      const { projects } = useAppStore.getState();
      expect(projects).toHaveLength(1);
      expect(projects[0]).toEqual(newProject);
    });
  });
});
