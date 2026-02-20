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
// tarballパス（afterAllでのクリーンアップ用）
let tarballPath: string | null = null;
// CI最適化: 事前ビルド済みパッケージを使用する場合はクリーンアップをスキップ
let skipCleanup = false;

// プロジェクトルート
const projectRoot = path.resolve(__dirname, '..');

// タイムアウトを長めに設定（ビルドに時間がかかるため）
test.setTimeout(300000);

// このテストスイートは直列実行（並列実行するとnpm packが競合する）
test.describe.serial('npx CLI installation test', () => {
  test.beforeAll(async () => {
    // CI最適化: 事前ビルド済みパッケージディレクトリが指定されている場合はそれを使用
    const prebuiltDir = process.env.CLI_PACKAGE_DIR;
    if (prebuiltDir && fs.existsSync(prebuiltDir)) {
      if (!fs.statSync(prebuiltDir).isDirectory()) {
        throw new Error(`CLI_PACKAGE_DIR is not a directory: ${prebuiltDir}`);
      }
      const requiredArtifacts = [
        path.join(prebuiltDir, 'dist', 'src', 'bin', 'cli.js'),
        path.join(prebuiltDir, '.next'),
        path.join(prebuiltDir, 'package.json'),
      ];
      const missingArtifacts = requiredArtifacts.filter((p) => !fs.existsSync(p));
      if (missingArtifacts.length > 0) {
        throw new Error(
          `Pre-built CLI package at ${prebuiltDir} is incomplete. Missing: ${missingArtifacts.join(', ')}`
        );
      }
      console.log(`Using pre-built CLI package: ${prebuiltDir}`);
      tempDir = prebuiltDir;
      skipCleanup = true;
      return;
    }

    // 一時ディレクトリを作成
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-work-e2e-'));
    console.log(`Created temp directory: ${tempDir}`);

    // npm pack で tarball を作成（--ignore-scripts でprepareをスキップ）
    // npm pack は通常 prepare スクリプトを実行するため、--ignore-scripts で防止
    console.log('Creating tarball with npm pack...');
    const packOutput = execSync('npm pack --ignore-scripts', {
      cwd: projectRoot,
      encoding: 'utf-8',
      shell: '/bin/bash',
    });
    // 出力の最終行からtarball名を取得（余分な出力がある場合に対応）
    const lines = packOutput.trim().split('\n');
    const tarballName = lines[lines.length - 1].trim();
    tarballPath = path.join(projectRoot, tarballName);

    console.log(`Created tarball: ${tarballPath}`);

    // tarball を一時ディレクトリに展開
    // npx github:... の実際の動作を模擬（cloneしてnpm installを実行）
    console.log('Extracting tarball...');
    execSync(`tar -xzf "${tarballPath}" -C "${tempDir}"`, {
      encoding: 'utf-8',
    });

    // tarball を削除（クリーンアップ）
    try {
      fs.unlinkSync(tarballPath);
      console.log('Cleaned up tarball');
      tarballPath = null; // クリーンアップ済みを示す
    } catch (error) {
      console.warn('Failed to clean up tarball:', error);
      // afterAllで再試行
    }

    // 展開されたディレクトリ（package/）に移動
    const packageDir = path.join(tempDir, 'package');

    // npm install を実行（prepare スクリプトが発火する）
    // npx github:... と同じ動作をシミュレート
    console.log('Running npm install (this will trigger prepare script)...');
    try {
      execSync('npm install', {
        cwd: packageDir,
        encoding: 'utf-8',
        stdio: 'inherit',
        timeout: 240000, // 4分タイムアウト（ビルドに時間がかかる）
      });
    } catch (error) {
      console.error('Installation failed:', error);
      throw error;
    }

    // tempDirを展開されたパッケージディレクトリに更新
    tempDir = packageDir;

    console.log('Installation completed successfully');
  });

  test.afterAll(async () => {
    // CI最適化: 事前ビルド済みパッケージはCIキャッシュが管理するためクリーンアップしない
    if (skipCleanup) {
      console.log('Skipping cleanup of pre-built CLI package directory');
      return;
    }

    // tarball を削除（beforeAllで失敗した場合の保険）
    if (tarballPath) {
      try {
        if (fs.existsSync(tarballPath)) {
          fs.unlinkSync(tarballPath);
          console.log('Cleaned up tarball in afterAll');
        }
      } catch (error) {
        console.warn('Failed to clean up tarball:', error);
      }
    }

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
    // prepare スクリプトでビルドされたファイルが存在することを確認
    const distPath = path.join(tempDir, 'dist');
    expect(fs.existsSync(distPath)).toBe(true);
    expect(fs.existsSync(path.join(distPath, 'src', 'bin', 'cli.js'))).toBe(true);

    // Next.js ビルド成果物が存在することを確認
    const nextPath = path.join(tempDir, '.next');
    expect(fs.existsSync(nextPath)).toBe(true);

    // CLI バイナリがpackage.jsonで正しく指定されていることを確認
    const packageJsonPath = path.join(tempDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    expect(packageJson.bin['claude-work']).toContain('dist/src/bin/cli.js');
  });

  test('claude-work help shows usage', async () => {
    // help コマンドを実行（展開されたパッケージ内のCLIを直接実行）
    const output = execSync('node dist/src/bin/cli.js help', {
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
    const output = execSync('node dist/src/bin/cli.js --help', {
      cwd: tempDir,
      encoding: 'utf-8',
    });

    expect(output).toContain('ClaudeWork');
    expect(output).toContain('使い方');
  });

  test('claude-work -h shows usage', async () => {
    // -h オプションでもヘルプが表示される
    const output = execSync('node dist/src/bin/cli.js -h', {
      cwd: tempDir,
      encoding: 'utf-8',
    });

    expect(output).toContain('ClaudeWork');
    expect(output).toContain('使い方');
  });

  test('claude-work status shows pm2 status', async () => {
    // status コマンドを実行（pm2 がインストールされていることを確認）
    const output = execSync('node dist/src/bin/cli.js status', {
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
      execSync('node dist/src/bin/cli.js unknown-command', {
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
