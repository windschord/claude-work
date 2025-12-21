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
        // .envファイルから読み込んだ環境変数を優先、未設定の場合のみデフォルト値を使用
        CLAUDE_WORK_TOKEN: process.env.CLAUDE_WORK_TOKEN || 'verification-test-token-2025',
        SESSION_SECRET: process.env.SESSION_SECRET || 'verification-session-secret-key-for-comprehensive-testing-2025',
        DATABASE_URL: process.env.DATABASE_URL || 'file:./prisma/data/claudework.db',
        ...(process.env.CLAUDE_CODE_PATH && { CLAUDE_CODE_PATH: process.env.CLAUDE_CODE_PATH }),
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
