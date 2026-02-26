import * as fs from 'fs';

let _isRunningInDocker: boolean | null = null;
let _isHostAllowed: boolean | null = null;

export function initializeEnvironmentDetection(): void {
  const dockerenvExists = fs.existsSync('/.dockerenv');
  const envFlag = process.env.RUNNING_IN_DOCKER === 'true';
  _isRunningInDocker = dockerenvExists || envFlag;

  if (_isRunningInDocker) {
    _isHostAllowed = process.env.ALLOW_HOST_ENVIRONMENT === 'true';
  } else {
    _isHostAllowed = true;
  }
}

export function isRunningInDocker(): boolean {
  if (_isRunningInDocker === null) {
    initializeEnvironmentDetection();
  }
  return _isRunningInDocker!;
}

export function isHostEnvironmentAllowed(): boolean {
  if (_isHostAllowed === null) {
    initializeEnvironmentDetection();
  }
  return _isHostAllowed!;
}

// テスト用: キャッシュをリセット（テスト環境でのみ有効）
export function _resetForTesting(): void {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }
  _isRunningInDocker = null;
  _isHostAllowed = null;
}
