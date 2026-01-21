'use client';

import { useState, useEffect, useCallback } from 'react';
import { EnvironmentStatus } from '@/services/environment-service';

/**
 * 環境タイプ
 */
export type EnvironmentType = 'HOST' | 'DOCKER' | 'SSH';

/**
 * 環境情報
 */
export interface Environment {
  id: string;
  name: string;
  type: EnvironmentType;
  description?: string | null;
  config: string;
  auth_dir_path?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  status?: EnvironmentStatus;
}

/**
 * 環境作成入力
 */
export interface CreateEnvironmentInput {
  name: string;
  type: EnvironmentType;
  description?: string;
  config?: object;
}

/**
 * 環境更新入力
 */
export interface UpdateEnvironmentInput {
  name?: string;
  description?: string;
  config?: object;
}

/**
 * useEnvironments フックの戻り値
 */
export interface UseEnvironmentsReturn {
  environments: Environment[];
  isLoading: boolean;
  error: string | null;
  fetchEnvironments: () => Promise<void>;
  createEnvironment: (input: CreateEnvironmentInput) => Promise<Environment>;
  updateEnvironment: (id: string, input: UpdateEnvironmentInput) => Promise<Environment>;
  deleteEnvironment: (id: string) => Promise<void>;
  refreshEnvironment: (id: string) => Promise<Environment | null>;
}

/**
 * 環境管理フック
 *
 * 機能:
 * - 環境一覧の取得
 * - 環境の作成
 * - 環境の更新
 * - 環境の削除
 * - ステータスを含めた環境の取得
 *
 * @returns 環境操作関数と状態
 */
export function useEnvironments(): UseEnvironmentsReturn {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 環境一覧を取得する
   */
  const fetchEnvironments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/environments?includeStatus=true');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '環境の取得に失敗しました');
      }

      setEnvironments(data.environments);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '環境の取得に失敗しました';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 環境を作成する
   */
  const createEnvironment = useCallback(async (input: CreateEnvironmentInput): Promise<Environment> => {
    const response = await fetch('/api/environments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '環境の作成に失敗しました');
    }

    // 環境一覧を再取得
    await fetchEnvironments();

    return data.environment;
  }, [fetchEnvironments]);

  /**
   * 環境を更新する
   */
  const updateEnvironment = useCallback(async (id: string, input: UpdateEnvironmentInput): Promise<Environment> => {
    const response = await fetch(`/api/environments/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '環境の更新に失敗しました');
    }

    // 環境一覧を再取得
    await fetchEnvironments();

    return data.environment;
  }, [fetchEnvironments]);

  /**
   * 環境を削除する
   */
  const deleteEnvironment = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`/api/environments/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '環境の削除に失敗しました');
    }

    // 環境一覧を再取得
    await fetchEnvironments();
  }, [fetchEnvironments]);

  /**
   * 特定の環境を再取得する（ステータス含む）
   */
  const refreshEnvironment = useCallback(async (id: string): Promise<Environment | null> => {
    const response = await fetch(`/api/environments/${id}?includeStatus=true`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // 環境一覧内の該当環境を更新
    setEnvironments((prev) =>
      prev.map((env) => (env.id === id ? data.environment : env))
    );

    return data.environment;
  }, []);

  // 初回マウント時に環境一覧を取得
  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  return {
    environments,
    isLoading,
    error,
    fetchEnvironments,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    refreshEnvironment,
  };
}
