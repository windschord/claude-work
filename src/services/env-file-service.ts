import path from 'path';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFilePromise = promisify(execFile);

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const ENV_FILE_PATTERN = /^\.env(\.[\w.-]+)?$/;

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
  return execFilePromise('docker', args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: 30000 });
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

    // listEnvFiles()と同じ許可ポリシーを適用
    const fileName = path.basename(relativePath);
    if (!ENV_FILE_PATTERN.test(fileName)) {
      throw new Error('.envファイルのみ読み込みが許可されています');
    }
    const parts = relativePath.split(/[/\\]/);
    if (parts.some(part => EXCLUDE_DIRS.has(part))) {
      throw new Error('除外ディレクトリ内のファイルは読み込みが許可されていません');
    }

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
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return results;
      }
      throw error;
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
      } else if (entry.isFile() && !entry.isSymbolicLink() && entry.name.startsWith('.env') && ENV_FILE_PATTERN.test(entry.name)) {
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
    const pruneArgs = Array.from(EXCLUDE_DIRS).flatMap((dir, i) => [
      ...(i > 0 ? ['-o'] : []),
      '-path', `*/${dir}`,
    ]);

    const { stdout } = await EnvFileService._runDockerCommand([
      'run', '--rm',
      '-v', `${dockerVolumeId}:/workspace`,
      'alpine:latest',
      'find', '/workspace',
      '(', ...pruneArgs, ')',
      '-prune', '-o',
      '-name', '.env*', '-type', 'f', '-print',
    ]);

    const envFilePattern = /^\.env(\.[\w.-]+)?$/;
    return stdout
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => line.replace(/^\/workspace\//, ''))
      .filter(filePath => envFilePattern.test(path.basename(filePath)))
      .sort();
  }

  /**
   * 許可リスト方式でホスト側の.envファイルを読み込む
   * findEnvFiles()がディレクトリ走査で構築した安全なパスのみを使用し、
   * ユーザー入力(relativePath)をファイルシステムAPIに直接渡さない
   */
  private static async readEnvFileHost(projectPath: string, relativePath: string): Promise<string> {
    // findEnvFilesがfs.readdirで構築したパスリストから完全一致で取得
    // これによりユーザー入力はファイルシステムAPIに渡らない
    const allowedFiles = await EnvFileService.listEnvFilesHost(projectPath);
    const safeRelativePath = allowedFiles.find(f => f === relativePath);
    if (safeRelativePath === undefined) {
      const err = new Error(`許可されたファイル一覧にありません: ${relativePath}`);
      (err as NodeJS.ErrnoException).code = 'ENOENT';
      throw err;
    }

    // safeRelativePathはfindEnvFiles()がfs.readdir + path.relativeで構築した値
    // projectPathはDB由来のサーバー制御値
    const resolvedProjectPath = path.resolve(projectPath);
    const targetPath = path.join(resolvedProjectPath, safeRelativePath);

    const stat = await fs.stat(targetPath);
    if (stat.size > MAX_FILE_SIZE) {
      throw new Error(`ファイルサイズが1MBを超えています: ${relativePath} (${stat.size} bytes)`);
    }

    return fs.readFile(targetPath, 'utf-8');
  }

  private static async readEnvFileDocker(dockerVolumeId: string, relativePath: string): Promise<string> {
    // TOCTOU対策: サイズ確認と読み込みを1回のコンテナ実行で行う
    const filePath = `/workspace/${relativePath}`;
    const maxSize = MAX_FILE_SIZE;
    const { stdout } = await EnvFileService._runDockerCommand([
      'run', '--rm',
      '-v', `${dockerVolumeId}:/workspace`,
      'alpine:latest',
      'sh', '-c',
      'if ! size=$(stat -c %s "$1" 2>/dev/null); then echo "___NOT_FOUND___"; elif [ "$size" -le $2 ]; then cat "$1"; else echo "___SIZE_EXCEEDED___"; fi',
      '--', filePath, String(maxSize),
    ]);

    const output = stdout.trim();
    if (output === '___NOT_FOUND___') {
      const err = new Error(`ファイルが存在しません: ${relativePath}`);
      (err as NodeJS.ErrnoException).code = 'ENOENT';
      throw err;
    }
    if (output === '___SIZE_EXCEEDED___') {
      throw new Error(`ファイルサイズが1MBを超えています: ${relativePath}`);
    }

    return stdout;
  }
}
