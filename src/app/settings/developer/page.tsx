'use client';

import { useEffect, useState, useCallback } from 'react';
import { Tab } from '@headlessui/react';
import { BackButton } from '@/components/settings/BackButton';
import { DeveloperSettingsForm } from '@/components/developer-settings/DeveloperSettingsForm';
import { SshKeyManager } from '@/components/developer-settings/SshKeyManager';
import { useDeveloperSettingsStore } from '@/store/developer-settings';
import { useAppStore, Project } from '@/store';

export default function DeveloperSettingsPage() {
  const {
    globalSettings,
    projectSettings,
    loading,
    error,
    successMessage,
    fetchGlobalSettings,
    updateGlobalSettings,
    fetchProjectSettings,
    updateProjectSettings,
    deleteProjectSettings,
    clearError,
    clearSuccessMessage,
  } = useDeveloperSettingsStore();

  const { projects, fetchProjects } = useAppStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    fetchGlobalSettings();
    fetchProjects();
  }, [fetchGlobalSettings, fetchProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectSettings(selectedProjectId);
    }
  }, [selectedProjectId, fetchProjectSettings]);

  // 成功メッセージの自動消去（3秒）
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        clearSuccessMessage();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, clearSuccessMessage]);

  const handleGlobalSave = useCallback(async (data: { git_username?: string; git_email?: string }) => {
    await updateGlobalSettings(data);
  }, [updateGlobalSettings]);

  const handleProjectSave = useCallback(async (data: { git_username?: string; git_email?: string }) => {
    if (!selectedProjectId) return;
    await updateProjectSettings(selectedProjectId, data);
  }, [selectedProjectId, updateProjectSettings]);

  const handleProjectDelete = useCallback(async () => {
    if (!selectedProjectId) return;
    await deleteProjectSettings(selectedProjectId);
  }, [selectedProjectId, deleteProjectSettings]);

  const currentProjectSettings = selectedProjectId
    ? projectSettings[selectedProjectId]
    : null;

  const tabClassName = ({ selected }: { selected: boolean }) =>
    `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors
    ${
      selected
        ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow'
        : 'text-gray-600 dark:text-gray-400 hover:bg-white/[0.12] hover:text-gray-800 dark:hover:text-gray-200'
    }`;

  return (
    <div>
      <div className="p-6 pb-0">
        <BackButton />
      </div>

      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            開発ツール設定
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Git設定やSSH鍵を管理します。
          </p>
        </div>

        {/* 成功メッセージ */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
          </div>
        )}

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex justify-between items-start">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              type="button"
              onClick={clearError}
              className="text-red-400 hover:text-red-600 dark:hover:text-red-300 ml-3 flex-shrink-0"
            >
              x
            </button>
          </div>
        )}

        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-6">
            <Tab className={tabClassName}>
              グローバル設定
            </Tab>
            <Tab className={tabClassName}>
              プロジェクト別設定
            </Tab>
          </Tab.List>

          <Tab.Panels>
            {/* グローバル設定タブ */}
            <Tab.Panel className="space-y-6">
              <DeveloperSettingsForm
                gitUsername={globalSettings?.git_username ?? null}
                gitEmail={globalSettings?.git_email ?? null}
                loading={loading}
                onSave={handleGlobalSave}
              />
              <SshKeyManager />
            </Tab.Panel>

            {/* プロジェクト別設定タブ */}
            <Tab.Panel className="space-y-6">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <label
                  htmlFor="project-select"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  プロジェクトを選択
                </label>
                <select
                  id="project-select"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- プロジェクトを選択 --</option>
                  {projects.map((project: Project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProjectId && (
                <DeveloperSettingsForm
                  gitUsername={currentProjectSettings?.git_username ?? null}
                  gitEmail={currentProjectSettings?.git_email ?? null}
                  loading={loading}
                  effectiveSettings={currentProjectSettings?.effective_settings}
                  onSave={handleProjectSave}
                  onDelete={handleProjectDelete}
                  showDeleteButton={currentProjectSettings?.id != null}
                />
              )}

              <SshKeyManager />
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </div>
    </div>
  );
}
