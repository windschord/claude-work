import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// DATABASE_URL が未設定の場合（CI環境など）はフォールバック値を使用
// __dirname を使用して prisma.config.ts からの相対パスを正確に解決
const fallbackDbPath = path.join(__dirname, 'prisma', 'data', 'fallback.db');
const databaseUrl = process.env.DATABASE_URL || `file:${fallbackDbPath}`;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});
