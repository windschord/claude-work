/**
 * GitHub CLI (gh) ラッパーサービス
 * PR作成やステータス取得を行う
 */

import { execSync } from 'child_process';

export interface PRInfo {
  url: string;
  number: number | null;
  status: string;
}

export interface PRStatus {
  state: string;
  merged: boolean;
}

/**
 * gh CLIが利用可能かチェック
 */
export function isGhAvailable(): boolean {
  try {
    execSync('gh --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * PRを作成する
 * @param options - PR作成オプション
 * @returns 作成されたPRのURL
 * @throws gh CLIが利用不可の場合やPR作成に失敗した場合
 */
export function createPR(options: {
  title: string;
  body?: string;
  branchName: string;
  cwd: string;
}): string {
  const { title, body, branchName, cwd } = options;

  const escapedTitle = title.replace(/"/g, '\\"');
  const escapedBody = body?.replace(/"/g, '\\"') || '';

  let command = `gh pr create --title "${escapedTitle}" --head "${branchName}"`;
  if (body) {
    command += ` --body "${escapedBody}"`;
  }

  try {
    const result = execSync(command, {
      cwd,
      encoding: 'utf-8',
    });
    return result.trim();
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      const ghError = new Error('GitHub CLI (gh) is not installed');
      (ghError as NodeJS.ErrnoException).code = 'GH_NOT_INSTALLED';
      throw ghError;
    }
    throw error;
  }
}

/**
 * PRのステータスを取得する
 * @param prNumber - PR番号
 * @param cwd - 作業ディレクトリ
 * @returns PRステータス
 */
export function getPRStatus(prNumber: number, cwd: string): PRStatus {
  const command = `gh pr view ${prNumber} --json state,merged`;
  const result = execSync(command, {
    cwd,
    encoding: 'utf-8',
  });
  return JSON.parse(result);
}

/**
 * PR URLからPR番号を抽出する
 */
export function extractPRNumber(prUrl: string): number | null {
  const match = prUrl.match(/\/pull\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
