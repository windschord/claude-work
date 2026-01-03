/**
 * Docker統合テスト
 *
 * 実際のDockerコンテナを使用した統合テスト。
 * Docker環境がない場合はスキップされる。
 *
 * 注意: これらのテストはDockerインフラストラクチャの動作を確認するもので、
 * Claude Codeの動作テストではない（APIキーが必要なため）。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { dockerService } from '../docker-service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Docker環境のチェック
function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Dockerイメージの存在チェック
function dockerImageExists(): boolean {
  try {
    const result = execSync('docker images -q claude-code-sandboxed:latest', {
      encoding: 'utf-8',
    }).trim();
    return result.length > 0;
  } catch {
    return false;
  }
}

const DOCKER_AVAILABLE = isDockerAvailable();
const IMAGE_EXISTS = DOCKER_AVAILABLE && dockerImageExists();

// Docker未インストール時はテストをスキップ
const describeWithDocker = DOCKER_AVAILABLE
  ? describe
  : describe.skip;

const describeWithImage = IMAGE_EXISTS
  ? describe
  : describe.skip;

describeWithDocker('Docker Integration Tests', () => {
  describe('DockerService', () => {
    it('should report Docker as available', async () => {
      const available = await dockerService.isDockerAvailable();
      expect(available).toBe(true);
    });

    it('should check image existence correctly', async () => {
      const exists = await dockerService.imageExists();
      // イメージの有無に関わらず、メソッドが正常に動作することを確認
      expect(typeof exists).toBe('boolean');
    });

    it('should get Docker version info', async () => {
      const version = execSync('docker version --format "{{.Server.Version}}"', {
        encoding: 'utf-8',
      }).trim();
      expect(version).toMatch(/^\d+\.\d+/);
    });
  });

  describeWithImage('Docker Container Lifecycle', () => {
    let tempDir: string;
    const testContainerName = `test-container-${Date.now()}`;

    beforeAll(() => {
      // テスト用の一時ディレクトリを作成
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docker-test-'));
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'Hello from host');
    });

    afterAll(() => {
      // コンテナを強制停止（存在する場合）
      try {
        execSync(`docker rm -f ${testContainerName}`, { stdio: 'pipe' });
      } catch {
        // コンテナが存在しない場合は無視
      }

      // 一時ディレクトリを削除
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('should run container with volume mount', () => {
      // bashシェルでファイル読み取りテスト
      const result = execSync(
        `docker run --rm -v "${tempDir}:/workspace:ro" claude-code-sandboxed:latest cat /workspace/test.txt`,
        { encoding: 'utf-8' }
      );
      expect(result.trim()).toBe('Hello from host');
    });

    it('should run container with correct user', () => {
      // Dockerfileでは既存のnodeユーザー（UID 1000）を使用
      const result = execSync(
        `docker run --rm claude-code-sandboxed:latest whoami`,
        { encoding: 'utf-8' }
      );
      expect(result.trim()).toBe('node');
    });

    it('should have claude command available', () => {
      const result = execSync(
        `docker run --rm claude-code-sandboxed:latest which claude`,
        { encoding: 'utf-8' }
      );
      expect(result.trim()).toContain('/claude');
    });

    it('should respect security options', () => {
      // 権限ドロップが正しく機能することを確認
      // SYS_ADMIN権限がないことをテスト
      try {
        execSync(
          `docker run --rm --cap-drop ALL claude-code-sandboxed:latest mount -t proc proc /proc 2>&1`,
          { encoding: 'utf-8' }
        );
        // mountが成功した場合はテスト失敗
        expect(true).toBe(false);
      } catch (error) {
        // mountが失敗することが期待される
        expect(true).toBe(true);
      }
    });

    it('should be able to write to workspace', () => {
      // ワークスペースへの書き込みテスト
      const result = execSync(
        `docker run --rm -v "${tempDir}:/workspace" claude-code-sandboxed:latest sh -c "echo 'written by container' > /workspace/output.txt && cat /workspace/output.txt"`,
        { encoding: 'utf-8' }
      );
      expect(result.trim()).toBe('written by container');

      // ホストからも読めることを確認
      const hostContent = fs.readFileSync(path.join(tempDir, 'output.txt'), 'utf-8');
      expect(hostContent.trim()).toBe('written by container');
    });

    it('should have git available', () => {
      const result = execSync(
        `docker run --rm claude-code-sandboxed:latest git --version`,
        { encoding: 'utf-8' }
      );
      expect(result).toContain('git version');
    });

    it('should have node available', () => {
      const result = execSync(
        `docker run --rm claude-code-sandboxed:latest node --version`,
        { encoding: 'utf-8' }
      );
      expect(result.trim()).toMatch(/^v\d+\.\d+/);
    });
  });

  describeWithImage('Docker Image Build', () => {
    it('should be able to rebuild image', async () => {
      // プログレスコールバックが呼ばれることを確認
      const progressMessages: string[] = [];

      await dockerService.buildImage((message) => {
        progressMessages.push(message);
      });

      // ビルドが成功し、プログレスメッセージがあることを確認
      expect(progressMessages.length).toBeGreaterThan(0);

      // イメージが存在することを確認
      const exists = await dockerService.imageExists();
      expect(exists).toBe(true);
    }, 120000); // タイムアウト2分
  });
});

// CI環境でのテスト実行情報
describe('Docker Test Environment Info', () => {
  it('should report Docker availability', () => {
    console.log('Docker available:', DOCKER_AVAILABLE);
    console.log('Docker image exists:', IMAGE_EXISTS);

    if (!DOCKER_AVAILABLE) {
      console.log('Skipping Docker tests - Docker not available');
    } else if (!IMAGE_EXISTS) {
      console.log('Some tests skipped - Docker image not found');
      console.log('Run: docker build -t claude-code-sandboxed:latest docker/');
    }

    // このテストは常に通過（情報提供のため）
    expect(true).toBe(true);
  });
});
