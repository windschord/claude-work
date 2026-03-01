'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FolderGit2, Globe } from 'lucide-react';
import { extractProjectName } from './types';
import type { WizardData } from './types';

interface StepRepositoryProps {
  wizardData: WizardData;
  onChange: (data: Partial<WizardData>) => void;
  hostEnvironmentDisabled: boolean;
}

export function StepRepository({ wizardData, onChange, hostEnvironmentDisabled }: StepRepositoryProps) {
  const { repoType, localPath, remoteUrl, cloneLocation, projectName, targetDir } = wizardData;
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
        リポジトリ設定
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        追加するリポジトリの情報を入力してください
      </p>

      {/* ローカル / リモート切り替え */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => onChange({ repoType: 'local' })}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors ${
            repoType === 'local'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          ローカル
        </button>
        <button
          type="button"
          onClick={() => onChange({ repoType: 'remote' })}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors ${
            repoType === 'remote'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
        >
          <Globe className="w-4 h-4" />
          リモート
        </button>
      </div>

      {/* ローカルパス入力 */}
      {repoType === 'local' && (
        <div className="mb-4">
          <label
            htmlFor="local-path"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Gitリポジトリのパス
          </label>
          <input
            id="local-path"
            type="text"
            value={localPath}
            onChange={(e) => {
              const newPath = e.target.value;
              const autoName = extractProjectName(newPath);
              onChange({ localPath: newPath, projectName: autoName });
            }}
            placeholder="/path/to/git/repo"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
      )}

      {/* リモートURL入力 */}
      {repoType === 'remote' && (
        <>
          <div className="mb-4">
            <label
              htmlFor="remote-url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              リポジトリURL
            </label>
            <input
              id="remote-url"
              type="text"
              value={remoteUrl}
              onChange={(e) => {
                const newUrl = e.target.value;
                const autoName = extractProjectName(newUrl);
                onChange({ remoteUrl: newUrl, projectName: autoName });
              }}
              placeholder="git@github.com:user/repo.git"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              SSH (git@...) または HTTPS (https://...) URLを入力
            </p>
          </div>

          {/* 保存場所選択 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              保存場所
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="cloneLocation"
                  value="docker"
                  checked={cloneLocation === 'docker'}
                  onChange={() => onChange({ cloneLocation: 'docker' })}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Docker環境
                  <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">(推奨)</span>
                </span>
              </label>
              {!hostEnvironmentDisabled && (
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="cloneLocation"
                    value="host"
                    checked={cloneLocation === 'host'}
                    onChange={() => onChange({ cloneLocation: 'host' })}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    ホスト環境
                  </span>
                </label>
              )}
            </div>
          </div>
        </>
      )}

      {/* プロジェクト名 */}
      <div className="mb-4">
        <label
          htmlFor="project-name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          プロジェクト名
        </label>
        <input
          id="project-name"
          type="text"
          value={projectName}
          onChange={(e) => onChange({ projectName: e.target.value })}
          placeholder="my-project"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          パスまたはURLから自動推測されます
        </p>
      </div>

      {/* 詳細設定 */}
      {repoType === 'remote' && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 mr-1" />
            ) : (
              <ChevronDown className="w-4 h-4 mr-1" />
            )}
            詳細設定
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <label
                htmlFor="target-dir"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Clone先ディレクトリ（任意）
              </label>
              <input
                id="target-dir"
                type="text"
                value={targetDir}
                onChange={(e) => onChange({ targetDir: e.target.value })}
                placeholder="空の場合は data/repos/ 配下にclone"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
