import path from 'path';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFilePromise = promisify(execFile);

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.worktrees',
]);

/**
 * Docker内でコマンドを実行するヘルパー
 * テスト時にモック可能にするためstaticメソッドとして公開
 */
async function runDockerCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFilePromise('docker', args, { encoding: 'utf8' });
}

export class EnvFileService {
  // テスト時にモック可能にするためのフック
  static _runDockerCommand = runDockerCommand;

  /**
   * パストラバーサル防止のバリデーション
   * 絶対パスや親ディレクトリへの参照を拒否する
   * @returns resolved された安全なパス
   */
  static validatePath(projectPath: string, relativePath: string): string {
    if (path.isAbsolute(relativePath)) {
      throw new Error(`絶対パスは許可されていません: ${relativePath}`);
    }

    const resolvedPath = path.resolve(projectPath, relativePath);
    const normalizedProjectPath = path.resolve(projectPath);

    if (!resolvedPath.startsWith(normalizedProjectPath + path.sep) && resolvedPath !== normalizedProjectPath) {
      throw new Error(`パストラバーサルが検出されました: ${relativePath}`);
    }

    return resolvedPath;
  }

  /**
   * プロジェクト内の.envファイルを検索する
   */
  static async listEnvFiles(
    projectPath: string,
    cloneLocation: string | null,
    dockerVolumeId?: string | null,
  ): Promise<string[]> {
    if (cloneLocation === 'docker') {
      if (!dockerVolumeId) {
        throw new Error('Docker環境ですがdockerVolumeIdが設定されていません');
      }
      return EnvFileService.listEnvFilesDocker(dockerVolumeId);
    }

    return EnvFileService.listEnvFilesHost(projectPath);
  }

  /**
   * .envファイルの内容を読み込む
   */
  static async readEnvFile(
    projectPath: string,
    relativePath: string,
    cloneLocation: string | null,
    dockerVolumeId?: string | null,
  ): Promise<string> {
    EnvFileService.validatePath(projectPath, relativePath);

    if (cloneLocation === 'docker') {
      if (!dockerVolumeId) {
        throw new Error('Docker環境ですがdockerVolumeIdが設定されていません');
      }
      return EnvFileService.readEnvFileDocker(dockerVolumeId, relativePath);
    }

    return EnvFileService.readEnvFileHost(projectPath, relativePath);
  }

  /**
   * ディレクトリを再帰的に探索して.env*ファイルを見つける
   */
  private static async findEnvFiles(dirPath: string, basePath: string): Promise<string[]> {
    const results: string[] = [];

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) {
          continue;
        }
        const subResults = await EnvFileService.findEnvFiles(
          path.join(dirPath, entry.name),
          basePath,
        );
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.startsWith('.env')) {
        const relativePath = path.relative(basePath, path.join(dirPath, entry.name));
        results.push(relativePath);
      }
    }

    return results;
  }

  private static async listEnvFilesHost(projectPath: string): Promise<string[]> {
    const files = await EnvFileService.findEnvFiles(projectPath, projectPath);
    return files.sort();
  }

  private static async listEnvFilesDocker(dockerVolumeId: string): Promise<string[]> {
    const excludeArgs = Array.from(EXCLUDE_DIRS).flatMap(dir => ['-not', '-path', `*/${dir}/*`]);

    const { stdout } = await EnvFileService._runDockerCommand([
      'run', '--rm',
      '-v', `${dockerVolumeId}:/workspace`,
      'alpine:latest',
      'find', '/workspace',
      '-name', '.env*',
      ...excludeArgs,
      '-type', 'f',
    ]);

    return stdout
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => line.replace(/^\/workspace\//, ''))
      .sort();
  }

  // Note: relativePath is validated by validatePath() before any filesystem access
  private static async readEnvFileHost(projectPath: string, relativePath: string): Promise<string> {
    const safePath = EnvFileService.validatePath(projectPath, relativePath);

    // シンボリックリンク経由のパストラバーサル対策
    const realPath = await fs.realpath(safePath);
    const realProjectPath = await fs.realpath(projectPath);
    if (!realPath.startsWith(realProjectPath + path.sep)) {
      throw new Error('シンボリックリンクによるパストラバーサルが検出されました');
    }

    const stat = await fs.stat(safePath);
    if (stat.size > MAX_FILE_SIZE) {
      throw new Error(`ファイルサイズが1MBを超えています: ${relativePath} (${stat.size} bytes)`);
    }

    return fs.readFile(safePath, 'utf-8');
  }

  private static async readEnvFileDocker(dockerVolumeId: string, relativePath: string): Promise<string> {
    const { stdout } = await EnvFileService._runDockerCommand([
      'run', '--rm',
      '-v', `${dockerVolumeId}:/workspace`,
      'alpine:latest',
      'cat', `/workspace/${relativePath}`,
    ]);

    const size = Buffer.byteLength(stdout, 'utf8');
    if (size > MAX_FILE_SIZE) {
      throw new Error(`ファイルサイズが1MBを超えています: ${relativePath} (${size} bytes)`);
    }

    return stdout;
  }
}
