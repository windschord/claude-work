import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * テスト用Gitリポジトリの管理
 */

export class TestGitRepo {
  public readonly path: string;

  constructor() {
    // 一時ディレクトリにテスト用リポジトリを作成
    this.path = mkdtempSync(join(tmpdir(), 'claudework-test-repo-'));
    this.initialize();
  }

  /**
   * Gitリポジトリを初期化する
   */
  private initialize() {
    execSync('git init', { cwd: this.path });
    execSync('git config user.email "test@example.com"', { cwd: this.path });
    execSync('git config user.name "Test User"', { cwd: this.path });

    // 初期ファイルを作成
    execSync('echo "# Test Repository" > README.md', { cwd: this.path });
    execSync('git add README.md', { cwd: this.path });
    execSync('git commit -m "Initial commit"', { cwd: this.path });

    // mainブランチを作成
    execSync('git branch -M main', { cwd: this.path });
  }

  /**
   * テストファイルを追加してコミットする
   */
  addAndCommit(filename: string, content: string, message: string) {
    execSync(`echo "${content}" > ${filename}`, { cwd: this.path });
    execSync(`git add ${filename}`, { cwd: this.path });
    execSync(`git commit -m "${message}"`, { cwd: this.path });
  }

  /**
   * リポジトリを削除する
   */
  cleanup() {
    try {
      rmSync(this.path, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup test repository:', error);
    }
  }
}
