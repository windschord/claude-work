'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { NetworkFilterRule, NetworkFilterConfig } from '@/db/schema';
import type { CreateRuleInput, UpdateRuleInput, DefaultTemplate, TestResult } from '@/services/network-filter-service';

export type { CreateRuleInput, UpdateRuleInput };

export interface UseNetworkFilterReturn {
  // 状態
  rules: NetworkFilterRule[];
  filterConfig: NetworkFilterConfig | null;
  isLoading: boolean;
  error: string | null;

  // ルール操作
  createRule: (input: CreateRuleInput) => Promise<void>;
  updateRule: (ruleId: string, input: UpdateRuleInput) => Promise<void>;
  deleteRule: (ruleId: string) => Promise<void>;
  toggleRule: (ruleId: string, enabled: boolean) => Promise<void>;

  // フィルタリング設定
  toggleFilter: (enabled: boolean) => Promise<void>;

  // テンプレート
  getTemplates: () => Promise<DefaultTemplate[]>;
  applyTemplates: (rules: CreateRuleInput[]) => Promise<void>;

  // テスト
  testConnection: (target: string, port?: number) => Promise<TestResult>;

  // 再フェッチ
  refetch: () => Promise<void>;
}

/**
 * ネットワークフィルタリング管理フック
 *
 * 指定した環境のネットワークフィルタリングルールとフィルタ設定を管理する。
 * useEffect依存配列にはprimitiveな値（environmentId）のみを含める。
 *
 * @param environmentId - 管理対象の環境ID
 * @returns ルール・設定の状態と操作関数
 */
export function useNetworkFilter(environmentId: string): UseNetworkFilterReturn {
  const [rules, setRules] = useState<NetworkFilterRule[]>([]);
  const [filterConfig, setFilterConfig] = useState<NetworkFilterConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  // 最新のenvironmentIdを保持するRef（mutation完了時の逆流防止に使用）
  const environmentIdRef = useRef(environmentId);

  /**
   * ルール一覧を取得する
   */
  const fetchRules = useCallback(async (envId: string): Promise<NetworkFilterRule[]> => {
    const response = await fetch(`/api/environments/${envId}/network-rules`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ルール一覧の取得に失敗しました');
    }

    return data.rules as NetworkFilterRule[];
  }, []);

  /**
   * フィルタリング設定を取得する
   */
  const fetchConfig = useCallback(async (envId: string): Promise<NetworkFilterConfig | null> => {
    const response = await fetch(`/api/environments/${envId}/network-filter`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'フィルタリング設定の取得に失敗しました');
    }

    return data.config as NetworkFilterConfig;
  }, []);

  /**
   * ルール一覧とフィルタ設定を並列で取得して状態を更新する
   *
   * requestIdRefによる競合ガード: environmentId切替時に古いレスポンスで状態が上書きされないよう、
   * リクエストIDが最新でない場合は結果を破棄する。
   */
  const fetchAll = useCallback(async (envId: string): Promise<void> => {
    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const [fetchedRules, fetchedConfig] = await Promise.all([
        fetchRules(envId),
        fetchConfig(envId),
      ]);

      // stale response guard: このリクエストが最新でなければ状態を更新しない
      if (currentRequestId !== requestIdRef.current) return;

      setRules(fetchedRules);
      setFilterConfig(fetchedConfig);
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;
      const errorMessage = err instanceof Error ? err.message : 'データの取得に失敗しました';
      setError(errorMessage);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchRules, fetchConfig]);

  // NOTE: environmentIdはprimitiveなためuseEffect依存配列に安全に含められる
  useEffect(() => {
    // environmentIdRefを常に最新の値に同期する（mutation完了時の逆流防止に使用）
    environmentIdRef.current = environmentId;
    fetchAll(environmentId);
  }, [environmentId]); // eslint-disable-line react-hooks/exhaustive-deps
  // fetchAllをdepsに含めないのはCLAUDE.mdのガイドライン準拠（primitive値のみ）

  /**
   * ルールを作成し一覧を再フェッチする
   */
  const createRule = useCallback(async (input: CreateRuleInput): Promise<void> => {
    // キャプチャしたenvironmentIdを保持（非同期処理中の逆流防止）
    const capturedEnvId = environmentId;
    const response = await fetch(`/api/environments/${capturedEnvId}/network-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ルールの作成に失敗しました');
    }

    // 再フェッチで最新状態を取得（environmentIdが変わっていたらスキップ）
    if (capturedEnvId === environmentIdRef.current) {
      await fetchAll(capturedEnvId);
    }
  }, [environmentId, fetchAll]);

  /**
   * ルールを更新し一覧を再フェッチする
   */
  const updateRule = useCallback(async (ruleId: string, input: UpdateRuleInput): Promise<void> => {
    const capturedEnvId = environmentId;
    const response = await fetch(`/api/environments/${capturedEnvId}/network-rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ルールの更新に失敗しました');
    }

    if (capturedEnvId === environmentIdRef.current) {
      await fetchAll(capturedEnvId);
    }
  }, [environmentId, fetchAll]);

  /**
   * ルールを削除し一覧を再フェッチする
   */
  const deleteRule = useCallback(async (ruleId: string): Promise<void> => {
    const capturedEnvId = environmentId;
    const response = await fetch(`/api/environments/${capturedEnvId}/network-rules/${ruleId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'ルールの削除に失敗しました');
    }

    if (capturedEnvId === environmentIdRef.current) {
      await fetchAll(capturedEnvId);
    }
  }, [environmentId, fetchAll]);

  /**
   * ルールの有効/無効を切り替えし一覧を再フェッチする
   */
  const toggleRule = useCallback(async (ruleId: string, enabled: boolean): Promise<void> => {
    const capturedEnvId = environmentId;
    const response = await fetch(`/api/environments/${capturedEnvId}/network-rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ルールの更新に失敗しました');
    }

    if (capturedEnvId === environmentIdRef.current) {
      await fetchAll(capturedEnvId);
    }
  }, [environmentId, fetchAll]);

  /**
   * フィルタリングの有効/無効を切り替え設定を再フェッチする
   */
  const toggleFilter = useCallback(async (enabled: boolean): Promise<void> => {
    const capturedEnvId = environmentId;
    const response = await fetch(`/api/environments/${capturedEnvId}/network-filter`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'フィルタリング設定の更新に失敗しました');
    }

    if (capturedEnvId === environmentIdRef.current) {
      await fetchAll(capturedEnvId);
    }
  }, [environmentId, fetchAll]);

  /**
   * デフォルトテンプレートを取得する
   */
  const getTemplates = useCallback(async (): Promise<DefaultTemplate[]> => {
    const response = await fetch(`/api/environments/${environmentId}/network-rules/templates`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'テンプレートの取得に失敗しました');
    }

    return data.templates as DefaultTemplate[];
  }, [environmentId]);

  /**
   * テンプレートからルールを一括追加し一覧を再フェッチする
   */
  const applyTemplates = useCallback(async (ruleInputs: CreateRuleInput[]): Promise<void> => {
    const capturedEnvId = environmentId;
    const response = await fetch(`/api/environments/${capturedEnvId}/network-rules/templates/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: ruleInputs }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'テンプレートの適用に失敗しました');
    }

    if (capturedEnvId === environmentIdRef.current) {
      await fetchAll(capturedEnvId);
    }
  }, [environmentId, fetchAll]);

  /**
   * ルール一覧とフィルタ設定を再フェッチする
   */
  const refetch = useCallback(async (): Promise<void> => {
    await fetchAll(environmentIdRef.current);
  }, [fetchAll]);

  /**
   * 通信テストを実行する
   */
  const testConnection = useCallback(async (target: string, port?: number): Promise<TestResult> => {
    const response = await fetch(`/api/environments/${environmentId}/network-filter/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, port }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '通信テストに失敗しました');
    }

    return data.result as TestResult;
  }, [environmentId]);

  return {
    rules,
    filterConfig,
    isLoading,
    error,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    toggleFilter,
    getTemplates,
    applyTemplates,
    testConnection,
    refetch,
  };
}
