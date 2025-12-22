require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'claude-work-dev',
      script: 'ts-node',
      args: '-r tsconfig-paths/register --project tsconfig.server.json server.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
        // .envファイルの環境変数をそのまま使用（PM2で上書きしない）
        // server.ts内のdotenv.config()で.envファイルから読み込まれる
        // ここではデフォルト値も設定しない（.envファイルに完全に委譲）
      },
      watch: false,
      autorestart: true,
      max_memory_restart: '1G',
      error_file: './logs/pm2-dev-error.log',
      out_file: './logs/pm2-dev-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'claude-work-test',
      script: 'npm',
      args: 'test',
      cwd: __dirname,
      env: {
        NODE_ENV: 'test',
      },
      watch: false,
      autorestart: false,
      error_file: './logs/pm2-test-error.log',
      out_file: './logs/pm2-test-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'claude-work-test-watch',
      script: 'npm',
      args: 'run test:watch',
      cwd: __dirname,
      env: {
        NODE_ENV: 'test',
      },
      watch: false,
      autorestart: true,
      error_file: './logs/pm2-test-watch-error.log',
      out_file: './logs/pm2-test-watch-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
