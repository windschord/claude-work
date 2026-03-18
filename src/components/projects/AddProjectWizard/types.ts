import type { ComponentType } from 'react';

export interface WizardStep {
  id: number;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export interface WizardData {
  // Step 1: 認証情報
  githubPatId: string | null;

  // Step 2: リポジトリ設定
  repoType: 'local' | 'remote';
  localPath: string;
  remoteUrl: string;
  cloneLocation: 'docker' | 'host';
  projectName: string;
  targetDir: string;

  // Step 3: セッション開始
  createdProjectId: string | null;
  sessionName: string;
}

export const initialWizardData: WizardData = {
  githubPatId: null,
  repoType: 'local',
  localPath: '',
  remoteUrl: '',
  cloneLocation: 'docker',
  projectName: '',
  targetDir: '',
  createdProjectId: null,
  sessionName: '',
};

/**
 * パスまたはURLからプロジェクト名を推測する
 */
export function extractProjectName(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim().replace(/[\\/]+$/, '');
  if (!trimmed) return '';

  // SSH URL: git@github.com:user/repo.git
  if (/^[^/]+@[^:]+:.+/.test(trimmed)) {
    const afterColon = trimmed.split(':').pop() || '';
    return afterColon.split(/[\\/]/).pop()?.replace(/\.git$/, '') || '';
  }

  // HTTPS URL or local path
  const name = trimmed.split(/[\\/]/).pop()?.replace(/\.git$/, '') || '';
  return name;
}
