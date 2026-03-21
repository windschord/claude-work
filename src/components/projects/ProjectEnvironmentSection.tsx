'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { PortMappingList } from '@/components/environments/PortMappingList';
import { VolumeMountList } from '@/components/environments/VolumeMountList';
import { DangerousPathWarning } from '@/components/environments/DangerousPathWarning';
import { NetworkFilterSection } from '@/components/environments/NetworkFilterSection';
import { ApplyChangesButton } from '@/components/environments/ApplyChangesButton';
import { ChromeSidecarSection } from '@/components/environments/ChromeSidecarSection';
import type { PortMapping, VolumeMount } from '@/types/environment';

interface ProjectEnvironmentSectionProps {
  projectId: string;
}

// SSH は未実装のため除外
type EnvironmentType = 'HOST' | 'DOCKER';

type OverrideValue = boolean | 'inherit';

interface ClaudeDefaultsOverride {
  dangerouslySkipPermissions?: OverrideValue;
  worktree?: OverrideValue;
}

interface AppClaudeDefaults {
  dangerouslySkipPermissions: boolean;
  worktree: boolean;
}

interface ChromeSidecarUIConfig {
  enabled: boolean;
  image: string;
  tag: string;
}

interface EnvironmentConfig {
  imageName?: string;
  imageTag?: string;
  skipPermissions?: boolean;
  portMappings?: PortMapping[];
  volumeMounts?: VolumeMount[];
  claude_defaults_override?: ClaudeDefaultsOverride;
  chromeSidecar?: ChromeSidecarUIConfig;
}

const ENVIRONMENT_TYPES: { value: EnvironmentType; label: string; description: string }[] = [
  { value: 'HOST', label: 'ホスト', description: 'ローカルホスト環境で実行' },
  { value: 'DOCKER', label: 'Docker', description: 'Dockerコンテナ内で実行' },
];

const DEFAULT_DOCKER_IMAGE = process.env.NEXT_PUBLIC_DEFAULT_DOCKER_IMAGE || 'ghcr.io/windschord/claude-work-sandbox:latest';

/**
 * プロジェクト設定の実行環境セクションコンポーネント
 *
 * プロジェクト設定モーダルに組み込まれ、プロジェクト専用の実行環境を設定する。
 * 環境タイプ選択、Docker設定、ネットワークフィルター設定を提供する。
 *
 * @param props.projectId - 設定対象のプロジェクトID
 */
export function ProjectEnvironmentSection({ projectId }: ProjectEnvironmentSectionProps) {
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const [environmentType, setEnvironmentType] = useState<EnvironmentType>('DOCKER');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  // Docker設定
  const [imageName, setImageName] = useState('');
  const [imageTag, setImageTag] = useState('latest');
  const [portMappings, setPortMappings] = useState<PortMapping[]>([]);
  const [volumeMounts, setVolumeMounts] = useState<VolumeMount[]>([]);
  const [dangerousPath, setDangerousPath] = useState<string | null>(null);

  // Chrome Sidecar設定
  const [chromeSidecarEnabled, setChromeSidecarEnabled] = useState(false);
  const [chromeSidecarImage, setChromeSidecarImage] = useState('chromium/headless-shell');
  const [chromeSidecarTag, setChromeSidecarTag] = useState('131.0.6778.204');

  // Claude Code設定オーバーライド
  const [overrideSkipPermissions, setOverrideSkipPermissions] = useState<OverrideValue>('inherit');
  const [overrideWorktree, setOverrideWorktree] = useState<OverrideValue>('inherit');
  const [appClaudeDefaults, setAppClaudeDefaults] = useState<AppClaudeDefaults>({
    dangerouslySkipPermissions: false,
    worktree: true,
  });

  // 変更検出用の初期値
  const initialTypeRef = useRef<EnvironmentType>('DOCKER');
  const initialConfigRef = useRef<EnvironmentConfig>({});

  /**
   * 環境設定を取得する
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

      const env = data.environment;
      setEnvironmentId(env.id);
      setEnvironmentType(env.type as EnvironmentType);
      initialTypeRef.current = env.type as EnvironmentType;

      if (env.type === 'DOCKER' && env.config) {
        try {
          const config: EnvironmentConfig = typeof env.config === 'string'
            ? JSON.parse(env.config)
            : env.config;

          const fullImage = config.imageName
            ? (config.imageTag ? `${config.imageName}:${config.imageTag}` : config.imageName)
            : DEFAULT_DOCKER_IMAGE;

          const lastColonIndex = fullImage.lastIndexOf(':');
          const lastSlashIndex = fullImage.lastIndexOf('/');
          const hasTag = lastColonIndex > lastSlashIndex;

          if (hasTag) {
            setImageName(fullImage.substring(0, lastColonIndex));
            setImageTag(fullImage.substring(lastColonIndex + 1));
          } else {
            setImageName(fullImage);
            setImageTag('latest');
          }

          setPortMappings(Array.isArray(config.portMappings) ? config.portMappings : []);
          setVolumeMounts(Array.isArray(config.volumeMounts) ? config.volumeMounts : []);

          // claude_defaults_override の復元
          // 旧skipPermissionsからの移行: claude_defaults_overrideが未設定の場合、
          // 旧skipPermissions=trueをclaude_defaults_override.dangerouslySkipPermissions=trueに移行
          const override = config.claude_defaults_override;
          if (override) {
            setOverrideSkipPermissions(override.dangerouslySkipPermissions ?? 'inherit');
            setOverrideWorktree(override.worktree ?? 'inherit');
          } else if (config.skipPermissions === true) {
            // 旧skipPermissionsの値をclaude_defaults_overrideに移行
            setOverrideSkipPermissions(true);
          }

          // Chrome Sidecar設定の復元
          if (config.chromeSidecar) {
            setChromeSidecarEnabled(config.chromeSidecar.enabled ?? false);
            if (config.chromeSidecar.image) setChromeSidecarImage(config.chromeSidecar.image);
            if (config.chromeSidecar.tag) setChromeSidecarTag(config.chromeSidecar.tag);
          } else {
            // chromeSidecar未設定時はデフォルト値にリセット
            setChromeSidecarEnabled(false);
            setChromeSidecarImage('chromium/headless-shell');
            setChromeSidecarTag('131.0.6778.204');
          }

          initialConfigRef.current = {
            imageName: config.imageName,
            imageTag: config.imageTag,
            portMappings: config.portMappings,
            volumeMounts: config.volumeMounts,
          };
        } catch {
          // configのパースに失敗した場合はデフォルト値を使用
          setImageName('ghcr.io/windschord/claude-work-sandbox');
          setImageTag('latest');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '環境の取得に失敗しました';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  /**
   * アプリ共通設定を取得する
   */
  const fetchAppConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/config');
      if (response.ok) {
        const data = await response.json();
        const claudeDefaults = data.config?.claude_defaults;
        if (claudeDefaults) {
          setAppClaudeDefaults({
            dangerouslySkipPermissions: claudeDefaults.dangerouslySkipPermissions ?? false,
            worktree: claudeDefaults.worktree ?? true,
          });
        }
      }
    } catch {
      // アプリ設定取得失敗時はデフォルト値を維持
    }
  }, []);

  useEffect(() => {
    fetchEnvironment();
    fetchAppConfig();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  // fetchEnvironment, fetchAppConfigをdepsに含めないのはCLAUDE.mdのガイドライン準拠（primitive値のみ）

  /**
   * 環境設定を保存する
   */
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    setWarning(null);

    try {
      // 常にclaude_defaults_overrideを保存してlegacy skipPermissionsを無効化する
      const config: EnvironmentConfig = environmentType === 'DOCKER'
        ? {
            imageName: imageName.trim() || 'ghcr.io/windschord/claude-work-sandbox',
            imageTag: imageTag.trim() || 'latest',
            // skipPermissionsはclaude_defaults_overrideに一本化（新規保存時は設定しない）
            portMappings: portMappings.length > 0 ? portMappings : undefined,
            volumeMounts: volumeMounts.length > 0 ? volumeMounts : undefined,
            // 常にclaude_defaults_overrideを保存（空でも保存することでlegacy skipPermissionsを無効化）
            claude_defaults_override: {
              dangerouslySkipPermissions: overrideSkipPermissions,
              worktree: overrideWorktree,
            },
            // Chrome Sidecar設定（トグルOFF時もenabled: falseを明示的に送信）
            // OFF時もimage/tagを保持することで、再度ONにした際に前回の値を復元できる
            chromeSidecar: {
              enabled: chromeSidecarEnabled,
              image: chromeSidecarImage.trim() || 'chromium/headless-shell',
              tag: chromeSidecarTag.trim() || '131.0.6778.204',
            },
          }
        : {};

      const response = await fetch(`/api/projects/${projectId}/environment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: environmentType,
          config,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '環境設定の保存に失敗しました');
      }

      // 保存成功
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (data.warning) {
        setWarning(data.warning);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '環境設定の保存に失敗しました';
      setSaveError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedTypeOption = useMemo(
    () => ENVIRONMENT_TYPES.find((t) => t.value === environmentType) || ENVIRONMENT_TYPES[1],
    [environmentType]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">環境設定を読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* アクティブセッション警告 */}
      {warning && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md">
          <p className="text-sm text-amber-700 dark:text-amber-300">{warning}</p>
        </div>
      )}

      {/* 環境タイプ選択 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          環境タイプ
        </label>
        <Listbox value={environmentType} onChange={setEnvironmentType} disabled={isSaving}>
          <div className="relative">
            <Listbox.Button className="relative w-full cursor-pointer rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 pl-3 pr-10 text-left focus:outline-none focus:ring-2 focus:ring-blue-500">
              <span className="block truncate text-gray-900 dark:text-gray-100">
                {selectedTypeOption.label}
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  - {selectedTypeOption.description}
                </span>
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </span>
            </Listbox.Button>
            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-700 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                {ENVIRONMENT_TYPES.map((typeOption) => (
                  <Listbox.Option
                    key={typeOption.value}
                    className={({ active }) =>
                      `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                        active
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                          : 'text-gray-900 dark:text-gray-100'
                      }`
                    }
                    value={typeOption.value}
                  >
                    {({ selected }) => (
                      <>
                        <div className="flex flex-col">
                          <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                            {typeOption.label}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {typeOption.description}
                          </span>
                        </div>
                        {selected && (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400">
                            <Check className="h-5 w-5" aria-hidden="true" />
                          </span>
                        )}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </Listbox>
      </div>

      {/* Docker設定（DOCKER選択時のみ表示） */}
      {environmentType === 'DOCKER' && (
        <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Docker設定
          </h4>

          {/* イメージ名 */}
          <div>
            <label
              htmlFor="env-image-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              イメージ名
            </label>
            <input
              id="env-image-name"
              type="text"
              value={imageName}
              onChange={(e) => setImageName(e.target.value)}
              placeholder="ghcr.io/windschord/claude-work-sandbox"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              disabled={isSaving}
            />
          </div>

          {/* イメージタグ */}
          <div>
            <label
              htmlFor="env-image-tag"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              タグ
            </label>
            <input
              id="env-image-tag"
              type="text"
              value={imageTag}
              onChange={(e) => setImageTag(e.target.value)}
              placeholder="latest"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              disabled={isSaving}
            />
          </div>

          {/* Claude Code設定オーバーライド */}
          <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Claude Code設定オーバーライド
            </h5>

            {/* パーミッション自動スキップ */}
            <div className="mb-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                パーミッション自動スキップ
              </p>
              <div className="space-y-1.5 ml-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="override-skip-permissions"
                    checked={overrideSkipPermissions === 'inherit'}
                    onChange={() => setOverrideSkipPermissions('inherit')}
                    disabled={isSaving}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    アプリ設定に従う
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                      [現在: {appClaudeDefaults.dangerouslySkipPermissions ? '有効' : '無効'}]
                    </span>
                  </span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="override-skip-permissions"
                    checked={overrideSkipPermissions === true}
                    onChange={() => setOverrideSkipPermissions(true)}
                    disabled={isSaving}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    有効
                  </span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="override-skip-permissions"
                    checked={overrideSkipPermissions === false}
                    onChange={() => setOverrideSkipPermissions(false)}
                    disabled={isSaving}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    無効
                  </span>
                </label>
              </div>
            </div>

            {/* Worktreeモード */}
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Worktreeモード
              </p>
              <div className="space-y-1.5 ml-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="override-worktree"
                    checked={overrideWorktree === 'inherit'}
                    onChange={() => setOverrideWorktree('inherit')}
                    disabled={isSaving}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    アプリ設定に従う
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                      [現在: {appClaudeDefaults.worktree ? '有効' : '無効'}]
                    </span>
                  </span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="override-worktree"
                    checked={overrideWorktree === true}
                    onChange={() => setOverrideWorktree(true)}
                    disabled={isSaving}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    有効
                  </span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="override-worktree"
                    checked={overrideWorktree === false}
                    onChange={() => setOverrideWorktree(false)}
                    disabled={isSaving}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    無効
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* ポートマッピング */}
          <div>
            <PortMappingList
              value={portMappings}
              onChange={setPortMappings}
              excludeEnvironmentId={environmentId ?? undefined}
            />
          </div>

          {/* ボリュームマウント */}
          <div>
            <VolumeMountList
              value={volumeMounts}
              onChange={setVolumeMounts}
              onDangerousPath={(path) => setDangerousPath(path)}
            />
          </div>

          {/* Chrome Sidecar */}
          <ChromeSidecarSection
            enabled={chromeSidecarEnabled}
            image={chromeSidecarImage}
            tag={chromeSidecarTag}
            onEnabledChange={setChromeSidecarEnabled}
            onImageChange={setChromeSidecarImage}
            onTagChange={setChromeSidecarTag}
            disabled={isSaving}
          />
        </div>
      )}

      {/* ネットワークフィルター（環境IDが存在し、Docker環境の場合） */}
      {environmentId && environmentType === 'DOCKER' && (
        <NetworkFilterSection
          environmentId={environmentId}
          environmentType={environmentType}
        />
      )}

      {/* 保存エラー */}
      {saveError && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
        </div>
      )}

      {/* 保存成功メッセージ */}
      {saveSuccess && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md">
          <p className="text-sm text-green-700 dark:text-green-300">環境設定を保存しました</p>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? '保存中...' : '設定を保存'}
        </button>

        {/* 即時適用ボタン（環境IDが存在する場合） */}
        {environmentId && (
          <ApplyChangesButton
            environmentId={environmentId}
            onApplied={() => {
              setWarning(null);
            }}
          />
        )}
      </div>

      {/* 危険パス警告ダイアログ */}
      <DangerousPathWarning
        isOpen={dangerousPath !== null}
        path={dangerousPath || ''}
        onConfirm={() => setDangerousPath(null)}
        onCancel={() => {
          if (dangerousPath) {
            setVolumeMounts((prev) =>
              prev.filter((m) => m.hostPath !== dangerousPath)
            );
          }
          setDangerousPath(null);
        }}
      />
    </div>
  );
}
