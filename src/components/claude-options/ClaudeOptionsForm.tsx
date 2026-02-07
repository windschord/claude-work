'use client';

import { useState } from 'react';
import { Disclosure } from '@headlessui/react';
import { ChevronDown, Plus, X } from 'lucide-react';

export interface ClaudeCodeOptions {
  model?: string;
  allowedTools?: string;
  permissionMode?: string;
  additionalFlags?: string;
}

export interface CustomEnvVars {
  [key: string]: string;
}

interface EnvVarEntry {
  id: string;
  key: string;
  value: string;
}

interface ClaudeOptionsFormProps {
  options: ClaudeCodeOptions;
  envVars: CustomEnvVars;
  onOptionsChange: (options: ClaudeCodeOptions) => void;
  onEnvVarsChange: (envVars: CustomEnvVars) => void;
  disabled?: boolean;
}

const PERMISSION_MODES = [
  { value: '', label: '指定なし' },
  { value: 'default', label: 'default' },
  { value: 'plan', label: 'plan' },
  { value: 'bypasstool', label: 'bypasstool' },
];

function envVarsToEntries(envVars: CustomEnvVars): EnvVarEntry[] {
  return Object.entries(envVars).map(([key, value]) => ({
    id: `env-${key}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    key,
    value,
  }));
}

function entriesToEnvVars(entries: EnvVarEntry[]): CustomEnvVars {
  const result: CustomEnvVars = {};
  for (const entry of entries) {
    if (entry.key.trim()) {
      result[entry.key.trim()] = entry.value;
    }
  }
  return result;
}

export function ClaudeOptionsForm({
  options,
  envVars,
  onOptionsChange,
  onEnvVarsChange,
  disabled = false,
}: ClaudeOptionsFormProps) {
  const [envEntries, setEnvEntries] = useState<EnvVarEntry[]>(() =>
    envVarsToEntries(envVars)
  );

  const handleOptionChange = (field: keyof ClaudeCodeOptions, value: string) => {
    onOptionsChange({ ...options, [field]: value });
  };

  const handleEnvEntryChange = (id: string, field: 'key' | 'value', val: string) => {
    const updated = envEntries.map((e) =>
      e.id === id ? { ...e, [field]: val } : e
    );
    setEnvEntries(updated);
    onEnvVarsChange(entriesToEnvVars(updated));
  };

  const handleAddEnvVar = () => {
    const newEntry: EnvVarEntry = {
      id: `env-new-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      key: '',
      value: '',
    };
    const updated = [...envEntries, newEntry];
    setEnvEntries(updated);
  };

  const handleRemoveEnvVar = (id: string) => {
    const updated = envEntries.filter((e) => e.id !== id);
    setEnvEntries(updated);
    onEnvVarsChange(entriesToEnvVars(updated));
  };

  const hasAnySettings = !!(
    options.model ||
    options.allowedTools ||
    options.permissionMode ||
    options.additionalFlags ||
    envEntries.length > 0
  );

  return (
    <Disclosure defaultOpen={hasAnySettings}>
      {({ open }) => (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
          <Disclosure.Button className="flex w-full justify-between items-center px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <span>Claude Code オプション（詳細設定）</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </Disclosure.Button>

          <Disclosure.Panel className="px-4 pb-4 space-y-4">
            {/* CLI Options */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  モデル
                </label>
                <input
                  type="text"
                  value={options.model || ''}
                  onChange={(e) => handleOptionChange('model', e.target.value)}
                  placeholder="例: claude-sonnet-4-5-20250929"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  disabled={disabled}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  許可ツール
                </label>
                <input
                  type="text"
                  value={options.allowedTools || ''}
                  onChange={(e) => handleOptionChange('allowedTools', e.target.value)}
                  placeholder="例: Bash,Read,Write"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  disabled={disabled}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  権限モード
                </label>
                <select
                  value={options.permissionMode || ''}
                  onChange={(e) => handleOptionChange('permissionMode', e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  disabled={disabled}
                >
                  {PERMISSION_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  追加フラグ
                </label>
                <input
                  type="text"
                  value={options.additionalFlags || ''}
                  onChange={(e) => handleOptionChange('additionalFlags', e.target.value)}
                  placeholder="例: --verbose --max-turns 10"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Custom Environment Variables */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  カスタム環境変数
                </label>
                <button
                  type="button"
                  onClick={handleAddEnvVar}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  disabled={disabled}
                >
                  <Plus className="w-3 h-3" />
                  追加
                </button>
              </div>

              {envEntries.length > 0 && (
                <div className="space-y-2">
                  {envEntries.map((entry) => (
                    <div key={entry.id} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={entry.key}
                        onChange={(e) =>
                          handleEnvEntryChange(entry.id, 'key', e.target.value)
                        }
                        placeholder="KEY"
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono placeholder-gray-400 dark:placeholder-gray-500"
                        disabled={disabled}
                      />
                      <input
                        type="text"
                        value={entry.value}
                        onChange={(e) =>
                          handleEnvEntryChange(entry.id, 'value', e.target.value)
                        }
                        placeholder="VALUE"
                        className="flex-[2] px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono placeholder-gray-400 dark:placeholder-gray-500"
                        disabled={disabled}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveEnvVar(entry.id)}
                        className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        disabled={disabled}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {envEntries.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  環境変数が設定されていません
                </p>
              )}
            </div>
          </Disclosure.Panel>
        </div>
      )}
    </Disclosure>
  );
}
