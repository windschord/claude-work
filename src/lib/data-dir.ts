import path from 'path';
import fs from 'fs';

export function getDataDir(): string {
  const dataDir = process.env.DATA_DIR;
  if (dataDir) {
    return path.resolve(dataDir);
  }
  return path.resolve(process.cwd(), 'data');
}

export function getReposDir(): string {
  return path.join(getDataDir(), 'repos');
}

export function getEnvironmentsDir(): string {
  return path.join(getDataDir(), 'environments');
}

export function ensureDataDirs(): void {
  const dirs = [getDataDir(), getReposDir(), getEnvironmentsDir()];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
