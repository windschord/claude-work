'use client';

import { useEffect } from 'react';
import { Listbox } from '@headlessui/react';
import { ChevronDown, Check, Server, Container, ExternalLink } from 'lucide-react';
import { useEnvironments, Environment } from '@/hooks/useEnvironments';
import type { WizardData } from './types';

interface StepEnvironmentProps {
  environmentId: string | null;
  onChange: (data: Partial<WizardData>) => void;
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'DOCKER':
      return <Container className="w-4 h-4 text-blue-500" />;
    case 'HOST':
      return <Server className="w-4 h-4 text-green-500" />;
    default:
      return <Server className="w-4 h-4 text-purple-500" />;
  }
}

function getTypeBadge(type: string) {
  const colors: Record<string, string> = {
    DOCKER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    HOST: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    SSH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[type] || colors.SSH}`}>
      {type}
    </span>
  );
}

export function StepEnvironment({ environmentId, onChange }: StepEnvironmentProps) {
  const { environments, isLoading } = useEnvironments();

  const selected = environments.find((e) => e.id === environmentId) || null;

  // デフォルト環境を自動選択
  useEffect(() => {
    if (!environmentId && environments.length > 0) {
      const defaultEnv = environments.find((e) => e.is_default);
      if (defaultEnv) {
        onChange({ environmentId: defaultEnv.id });
      }
    }
  }, [environments, environmentId, onChange]);

  const handleChange = (env: Environment | null) => {
    onChange({ environmentId: env?.id || null });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (environments.length === 0) {
    return (
      <div className="text-center py-8">
        <Container className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          利用可能な環境がありません
        </p>
        <a
          href="/settings/environments"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          環境設定で作成
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
        実行環境を選択
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        プロジェクトを実行する環境を選択してください
      </p>

      <Listbox value={selected} onChange={handleChange}>
        <div className="relative">
          <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white dark:bg-gray-700 py-3 pl-4 pr-10 text-left border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {selected ? (
              <div className="flex items-center gap-2">
                {getTypeIcon(selected.type)}
                <span className="block truncate text-gray-900 dark:text-gray-100">
                  {selected.name}
                </span>
                {getTypeBadge(selected.type)}
                {selected.is_default && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">(default)</span>
                )}
              </div>
            ) : (
              <span className="block truncate text-gray-500">環境を選択...</span>
            )}
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </span>
          </Listbox.Button>

          <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-700 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            {environments.map((env) => (
              <Listbox.Option
                key={env.id}
                value={env}
                className={({ active }) =>
                  `relative cursor-pointer select-none py-3 pl-10 pr-4 ${
                    active ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`
                }
              >
                {({ selected: isSelected }) => (
                  <>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(env.type)}
                      <span
                        className={`block truncate ${
                          isSelected ? 'font-medium' : 'font-normal'
                        } text-gray-900 dark:text-gray-100`}
                      >
                        {env.name}
                      </span>
                      {getTypeBadge(env.type)}
                      {env.is_default && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">(default)</span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </div>
      </Listbox>

      {selected && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            {getTypeIcon(selected.type)}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {selected.name}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {selected.type === 'DOCKER'
              ? 'Docker コンテナ内で隔離実行されます'
              : selected.type === 'HOST'
                ? 'ローカルマシンで直接実行されます'
                : 'SSH経由でリモート実行されます'}
          </p>
        </div>
      )}

      <div className="mt-3">
        <a
          href="/settings/environments"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          新しい環境を作成
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
