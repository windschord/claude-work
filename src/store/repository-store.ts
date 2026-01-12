import { create } from 'zustand';
import { Repository } from '@prisma/client';

/**
 * セッション数を含むリポジトリ
 */
export interface RepositoryWithSessionCount extends Repository {
  sessionCount: number;
}

/**
 * リポジトリ登録データ
 */
interface AddRepositoryData {
  name: string;
  type: 'local' | 'remote';
  path?: string;
  url?: string;
}

/**
 * リポジトリストアの状態とアクション
 */
interface RepositoryState {
  // 状態
  repositories: RepositoryWithSessionCount[];
  selectedRepository: RepositoryWithSessionCount | null;
  branches: string[];
  defaultBranch: string;
  loading: boolean;
  error: string | null;

  // アクション
  fetchRepositories: () => Promise<void>;
  addRepository: (data: AddRepositoryData) => Promise<RepositoryWithSessionCount>;
  deleteRepository: (id: string) => Promise<void>;
  selectRepository: (repository: RepositoryWithSessionCount | null) => void;
  fetchBranches: (repositoryId: string) => Promise<void>;
  clearError: () => void;
}

export const useRepositoryStore = create<RepositoryState>((set, get) => ({
  // 初期状態
  repositories: [],
  selectedRepository: null,
  branches: [],
  defaultBranch: '',
  loading: false,
  error: null,

  /**
   * リポジトリ一覧を取得
   */
  fetchRepositories: async () => {
    set({ loading: true, error: null });

    try {
      const response = await fetch('/api/repositories');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch repositories');
      }

      const data = await response.json();
      set({ repositories: data.repositories, loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
    }
  },

  /**
   * リポジトリを追加
   */
  addRepository: async (data: AddRepositoryData) => {
    set({ loading: true, error: null });

    try {
      const response = await fetch('/api/repositories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add repository');
      }

      const repository = await response.json();

      // 一覧を再取得（セッション数を含む形式で取得するため）
      await get().fetchRepositories();

      // 作成されたリポジトリをsessionCount付きで探す
      const updatedRepositories = get().repositories;
      const createdRepository = updatedRepositories.find((r) => r.id === repository.id);

      set({ loading: false });

      return createdRepository || { ...repository, sessionCount: 0 };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  /**
   * リポジトリを削除
   */
  deleteRepository: async (id: string) => {
    set({ loading: true, error: null });

    try {
      const response = await fetch(`/api/repositories/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete repository');
      }

      // 選択中のリポジトリが削除された場合はクリア
      const { selectedRepository } = get();
      if (selectedRepository?.id === id) {
        set({ selectedRepository: null, branches: [], defaultBranch: '' });
      }

      // 一覧を再取得
      await get().fetchRepositories();

      set({ loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  /**
   * リポジトリを選択
   */
  selectRepository: (repository: RepositoryWithSessionCount | null) => {
    set({ selectedRepository: repository });

    // 選択時にブランチ一覧を取得
    if (repository) {
      get().fetchBranches(repository.id);
    } else {
      set({ branches: [], defaultBranch: '' });
    }
  },

  /**
   * ブランチ一覧を取得
   */
  fetchBranches: async (repositoryId: string) => {
    set({ error: null });

    try {
      const response = await fetch(`/api/repositories/${repositoryId}/branches`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch branches');
      }

      const data = await response.json();
      set({ branches: data.branches, defaultBranch: data.defaultBranch });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage, branches: [], defaultBranch: '' });
    }
  },

  /**
   * エラーをクリア
   */
  clearError: () => {
    set({ error: null });
  },
}));
