import winston from 'winston';

/**
 * ログレベルの設定
 *
 * 環境変数LOG_LEVELが設定されていればそれを使用し、
 * 未設定の場合は本番環境では'info'、それ以外では'debug'を使用します。
 */
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

/**
 * Winstonロガーインスタンス
 *
 * タイムスタンプ、エラースタック、JSON形式のログを出力します。
 * コンソールにはカラー付きで人間が読みやすい形式で出力されます。
 */
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'claude-work' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let metaString = '';
          if (Object.keys(meta).length > 0) {
            metaString = '\n' + JSON.stringify(meta, null, 2);
          }
          return `${timestamp} [${level}]: ${message}${metaString}`;
        })
      ),
    }),
  ],
});

export { logger };
