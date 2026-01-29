/**
 * npx CLI インストール・実行テスト
 *
 * このテストは npm pack で作成した tarball から claude-work をインストールし、
 * CLI コマンドが正しく動作することを検証します。
 *
 * npx github:windschord/claude-work 形式での実行を模擬しています。
 *
 * 注意:
 * - このテストは直列実行が必要（test.describe.serial）
 * - pnpmではなくnpmを使用（ユーザーがnpxで実行することを想定）
 */

import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// テスト用の一時ディレクトリ
let tempDir: string;

// プロジェクトルート
const projectRoot = path.resolve(__dirname, '..');

// タイムアウトを長めに設定（ビルドに時間がかかるため）
test.setTimeout(300000);

// このテストスイートは直列実行（並列実行するとnpm packが競合する）
test.describe.serial('npx CLI installation test', () => {
  test.beforeAll(async () => {
    // 一時ディレクトリを作成
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-work-e2e-'));
    console.log(`Created temp directory: ${tempDir}`);

    // npm pack で tarball を作成（--ignore-scripts でprepareをスキップ）
    // npm pack 自体は prepare を実行しないが、念のため指定
    console.log('Creating tarball with npm pack...');
    const packOutput = execSync('npm pack --ignore-scripts', {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    const tarballName = packOutput.trim();
    const tarballPath = path.join(projectRoot, tarballName);

    console.log(`Created tarball: ${tarballPath}`);

    // 一時ディレクトリに package.json を作成（npm install に必要）
    const packageJson = {
      name: 'claude-work-e2e-test',
      version: '1.0.0',
      private: true,
    };
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // tarball をインストール（prepare スクリプトが実行される）
    console.log('Installing tarball (this will trigger prepare script)...');
    try {
      execSync(`npm install "${tarballPath}"`, {
        cwd: tempDir,
        encoding: 'utf-8',
        stdio: 'inherit',
        timeout: 240000, // 4分タイムアウト（ビルドに時間がかかる）
      });
    } catch (error) {
      // インストールエラーの詳細を出力
      console.error('Installation failed:', error);
      throw error;
    }

    // tarball を削除（クリーンアップ）
    try {
      fs.unlinkSync(tarballPath);
      console.log('Cleaned up tarball');
    } catch (error) {
      console.warn('Failed to clean up tarball:', error);
      // 非クリティカルなエラーのため、テストは続行する
    }

    console.log('Installation completed successfully');
  });

  test.afterAll(async () => {
    // 一時ディレクトリを削除（beforeAllでエラーが発生した場合もtempDirが設定されている場合のみ）
    if (tempDir) {
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
          console.log(`Cleaned up temp directory: ${tempDir}`);
        }
      } catch (error) {
        console.warn('Failed to clean up temp directory:', error);
      }
    }
  });

  test('claude-work CLI is installed and built', async () => {
    // CLI バイナリが存在することを確認
    const cliBinPath = path.join(tempDir, 'node_modules', '.bin', 'claude-work');
    expect(fs.existsSync(cliBinPath)).toBe(true);

    // prepare スクリプトでビルドされたファイルが存在することを確認
    const claudeWorkPath = path.join(tempDir, 'node_modules', 'claude-work');
    const distPath = path.join(claudeWorkPath, 'dist');
    expect(fs.existsSync(distPath)).toBe(true);
    expect(fs.existsSync(path.join(distPath, 'src', 'bin', 'cli.js'))).toBe(true);

    // Next.js ビルド成果物が存在することを確認
    const nextPath = path.join(claudeWorkPath, '.next');
    expect(fs.existsSync(nextPath)).toBe(true);
  });

  test('claude-work help shows usage', async () => {
    // help コマンドを実行
    const output = execSync('npx claude-work help', {
      cwd: tempDir,
      encoding: 'utf-8',
    });

    // 期待されるヘルプメッセージの内容を検証
    expect(output).toContain('ClaudeWork');
    expect(output).toContain('使い方');
    expect(output).toContain('start');
    expect(output).toContain('stop');
    expect(output).toContain('status');
    expect(output).toContain('logs');
    expect(output).toContain('help');
  });

  test('claude-work --help shows usage', async () => {
    // --help オプションでもヘルプが表示される
    const output = execSync('npx claude-work --help', {
      cwd: tempDir,
      encoding: 'utf-8',
    });

    expect(output).toContain('ClaudeWork');
    expect(output).toContain('使い方');
  });

  test('claude-work -h shows usage', async () => {
    // -h オプションでもヘルプが表示される
    const output = execSync('npx claude-work -h', {
      cwd: tempDir,
      encoding: 'utf-8',
    });

    expect(output).toContain('ClaudeWork');
    expect(output).toContain('使い方');
  });

  test('claude-work status shows pm2 status', async () => {
    // status コマンドを実行（pm2 がインストールされていることを確認）
    const output = execSync('npx claude-work status', {
      cwd: tempDir,
      encoding: 'utf-8',
    });

    // pm2 status の出力を確認（プロセスがなくても表示される）
    // "PM2" または "No processes found" のような出力を期待
    expect(output.length).toBeGreaterThan(0);
  });

  test('unknown command exits with error', async () => {
    // 不明なコマンドを実行
    let commandSucceeded = false;
    try {
      execSync('npx claude-work unknown-command', {
        cwd: tempDir,
        encoding: 'utf-8',
        timeout: 30000,
      });
      commandSucceeded = true;
    } catch (error: unknown) {
      // エラーで終了することを確認（エラーコード != 0）
      const execError = error as { status?: number };
      expect(execError.status).not.toBe(0);
    }
    // コマンドが成功した場合はテスト失敗
    expect(commandSucceeded).toBe(false);
  });
});
