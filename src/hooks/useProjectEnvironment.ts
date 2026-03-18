'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { NetworkFilterRule, NetworkFilterConfig } from '@/db/schema';
import type { CreateRuleInput, UpdateRuleInput, DefaultTemplate, TestResult } from '@/services/network-filter-service';

export type { CreateRuleInput, UpdateRuleInput };

/**
 * 環境タイプ
 */
export type EnvironmentType = 'HOST' | 'DOCKER' | 'SSH';

/**
 * プロジェクト環境情報
 */
export interface ProjectEnvironment {
  id: string;
  name: string;
  type: EnvironmentType;
  description?: string | null;
  config: string;
  auth_dir_path?: string | null;
  project_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * 環境更新入力
 */
export interface UpdateEnvironmentInput {
  name?: string;
  description?: string;
  type?: EnvironmentType;
  config?: object;
}

/**
 * useProjectEnvironment フックの戻り値
 */
export interface UseProjectEnvironmentReturn {
  // 環境状態
  environment: ProjectEnvironment | null;
  isLoading: boolean;
  error: string | null;
  warning: string | null;

  // 環境操作
  fetchEnvironment: () => Promise<void>;
  updateEnvironment: (input: UpdateEnvironmentInput) => Promise<ProjectEnvironment>;
  applyChanges: () => Promise<void>;

  // ネットワークフィルター
  networkFilter: NetworkFilterConfig | null;
  networkFilterLoading: boolean;
  networkFilterError: string | null;
  fetchNetworkFilter: () => Promise<void>;
  updateNetworkFilter: (enabled: boolean) => Promise<void>;

  // ネットワークルール
  networkRules: NetworkFilterRule[];
  networkRulesLoading: boolean;
  networkRulesError: string | null;
  createRule: (input: CreateRuleInput) => Promise<void>;
  updateRule: (ruleId: string, input: UpdateRuleInput) => Promise<void>;
  deleteRule: (ruleId: string) => Promise<void>;
  toggleRule: (ruleId: string, enabled: boolean) => Promise<void>;
  getTemplates: () => Promise<DefaultTemplate[]>;
  applyTemplates: (rules: CreateRuleInput[]) => Promise<void>;
  testConnection: (target: string, port?: number) => Promise<TestResult>;
  refetchNetworkRules: () => Promise<void>;
}

/**
 * プロジェクト環境管理フック
 *
 * プロジェクトの専用環境取得・更新・ネットワークフィルター操作を提供する。
 * 新API /api/projects/[projectId]/environment/* を使用する。
 *
 * @param projectId - 管理対象のプロジェクトID
 * @returns 環境操作関数と状態
 */
export function useProjectEnvironment(projectId: string): UseProjectEnvironmentReturn {
  const [environment, setEnvironment] = useState<ProjectEnvironment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [networkFilter, setNetworkFilter] = useState<NetworkFilterConfig | null>(null);
  const [networkFilterLoading, setNetworkFilterLoading] = useState(false);
  const [networkFilterError, setNetworkFilterError] = useState<string | null>(null);

  const [networkRules, setNetworkRules] = useState<NetworkFilterRule[]>([]);
  const [networkRulesLoading, setNetworkRulesLoading] = useState(false);
  const [networkRulesError, setNetworkRulesError] = useState<string | null>(null);

  const requestIdRef = useRef(0);
  const projectIdRef = useRef(projectId);

  /**
   * プロジェクトの環境を取得する
   */
  const fetchEnvironment = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/environment`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '環境の取得に失敗しました');
      }

      setEnvironment(data.environment);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '環境の取得に失敗しました';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  /**
   * プロジェクトの環境を更新する
   */
  const updateEnvironment = useCallback(async (input: UpdateEnvironmentInput): Promise<ProjectEnvironment> => {
    const response = await fetch(`/api/projects/${projectId}/environment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '環境の更新に失敗しました');
    }

    setEnvironment(data.environment);

    // アクティブセッション存在時の警告メッセージを保持
    if (data.warning) {
      setWarning(data.warning);
    } else {
      setWarning(null);
    }

    return data.environment as ProjectEnvironment;
  }, [projectId]);

  /**
   * 環境設定変更を実行中セッションに即時適用する
   */
  const applyChanges = useCallback(async (): Promise<void> => {
    const response = await fetch(`/api/projects/${projectId}/environment/apply`, {
      method: 'POST',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || '設定の適用に失敗しました');
    }
  }, [projectId]);

  /**
   * ネットワークフィルター設定を取得する
   */
  const fetchNetworkFilter = useCallback(async () => {
    setNetworkFilterLoading(true);
    setNetworkFilterError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/environment/network-filter`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'ネットワークフィルター設定の取得に失敗しました');
      }

      setNetworkFilter(data.config);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ネットワークフィルター設定の取得に失敗しました';
      setNetworkFilterError(errorMessage);
    } finally {
      setNetworkFilterLoading(false);
    }
  }, [projectId]);

  /**
   * ネットワークフィルターの有効/無効を切り替える
   */
  const updateNetworkFilter = useCallback(async (enabled: boolean): Promise<void> => {
    const response = await fetch(`/api/projects/${projectId}/environment/network-filter`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ネットワークフィルター設定の更新に失敗しました');
    }

    setNetworkFilter(data.config);
  }, [projectId]);

  /**
   * ネットワークルール一覧を取得する
   */
  const fetchNetworkRules = useCallback(async (projId: string): Promise<NetworkFilterRule[]> => {
    const response = await fetch(`/api/projects/${projId}/environment/network-rules`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ルール一覧の取得に失敗しました');
    }

    return data.rules as NetworkFilterRule[];
  }, []);

  /**
   * ネットワークルールと設定を並列で再取得する
   */
  const fetchAllNetworkData = useCallback(async (projId: string): Promise<void> => {
    const currentRequestId = ++requestIdRef.current;
    setNetworkRulesLoading(true);
    setNetworkRulesError(null);

    try {
      const [rules, filterResponse] = await Promise.all([
        fetchNetworkRules(projId),
        fetch(`/api/projects/${projId}/environment/network-filter`),
      ]);

      if (currentRequestId !== requestIdRef.current) return;

      const filterData = await filterResponse.json();
      if (filterResponse.ok) {
        setNetworkFilter(filterData.config);
      }

      setNetworkRules(rules);
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;
      const errorMessage = err instanceof Error ? err.message : 'ネットワークデータの取得に失敗しました';
      setNetworkRulesError(errorMessage);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setNetworkRulesLoading(false);
      }
    }
  }, [fetchNetworkRules]);

  /**
   * ルールを作成し一覧を再フェッチする
   */
  const createRule = useCallback(async (input: CreateRuleInput): Promise<void> => {
    const capturedProjId = projectId;
    const response = await fetch(`/api/projects/${capturedProjId}/environment/network-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ルールの作成に失敗しました');
    }

    if (capturedProjId === projectIdRef.current) {
      await fetchAllNetworkData(capturedProjId);
    }
  }, [projectId, fetchAllNetworkData]);

  /**
   * ルールを更新し一覧を再フェッチする
   */
  const updateRule = useCallback(async (ruleId: string, input: UpdateRuleInput): Promise<void> => {
    const capturedProjId = projectId;
    const response = await fetch(`/api/projects/${capturedProjId}/environment/network-rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ルールの更新に失敗しました');
    }

    if (capturedProjId === projectIdRef.current) {
      await fetchAllNetworkData(capturedProjId);
    }
  }, [projectId, fetchAllNetworkData]);

  /**
   * ルールを削除し一覧を再フェッチする
   */
  const deleteRule = useCallback(async (ruleId: string): Promise<void> => {
    const capturedProjId = projectId;
    const response = await fetch(`/api/projects/${capturedProjId}/environment/network-rules/${ruleId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'ルールの削除に失敗しました');
    }

    if (capturedProjId === projectIdRef.current) {
      await fetchAllNetworkData(capturedProjId);
    }
  }, [projectId, fetchAllNetworkData]);

  /**
   * ルールの有効/無効を切り替え一覧を再フェッチする
   */
  const toggleRule = useCallback(async (ruleId: string, enabled: boolean): Promise<void> => {
    const capturedProjId = projectId;
    const response = await fetch(`/api/projects/${capturedProjId}/environment/network-rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ルールの更新に失敗しました');
    }

    if (capturedProjId === projectIdRef.current) {
      await fetchAllNetworkData(capturedProjId);
    }
  }, [projectId, fetchAllNetworkData]);

  /**
   * デフォルトテンプレートを取得する
   */
  const getTemplates = useCallback(async (): Promise<DefaultTemplate[]> => {
    const response = await fetch(`/api/projects/${projectId}/environment/network-rules/templates`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'テンプレートの取得に失敗しました');
    }

    return data.templates as DefaultTemplate[];
  }, [projectId]);

  /**
   * テンプレートからルールを一括追加し一覧を再フェッチする
   */
  const applyTemplates = useCallback(async (ruleInputs: CreateRuleInput[]): Promise<void> => {
    const capturedProjId = projectId;
    const response = await fetch(`/api/projects/${capturedProjId}/environment/network-rules/templates/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: ruleInputs }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'テンプレートの適用に失敗しました');
    }

    if (capturedProjId === projectIdRef.current) {
      await fetchAllNetworkData(capturedProjId);
    }
  }, [projectId, fetchAllNetworkData]);

  /**
   * 通信テストを実行する
   */
  const testConnection = useCallback(async (target: string, port?: number): Promise<TestResult> => {
    const response = await fetch(`/api/projects/${projectId}/environment/network-filter/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, port }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '通信テストに失敗しました');
    }

    return data.result as TestResult;
  }, [projectId]);

  /**
   * ネットワークルール一覧とフィルタ設定を再フェッチする
   */
  const refetchNetworkRules = useCallback(async (): Promise<void> => {
    await fetchAllNetworkData(projectIdRef.current);
  }, [fetchAllNetworkData]);

  // 初回マウント時に環境とネットワークデータを取得
  // NOTE: projectIdはprimitiveなためuseEffect依存配列に安全に含められる
  useEffect(() => {
    projectIdRef.current = projectId;
    fetchEnvironment();
    fetchAllNetworkData(projectId);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  // fetchEnvironment/fetchAllNetworkDataをdepsに含めないのはCLAUDE.mdのガイドライン準拠（primitive値のみ）

  return {
    environment,
    isLoading,
    error,
    warning,
    fetchEnvironment,
    updateEnvironment,
    applyChanges,
    networkFilter,
    networkFilterLoading,
    networkFilterError,
    fetchNetworkFilter,
    updateNetworkFilter,
    networkRules,
    networkRulesLoading,
    networkRulesError,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    getTemplates,
    applyTemplates,
    testConnection,
    refetchNetworkRules,
  };
}
