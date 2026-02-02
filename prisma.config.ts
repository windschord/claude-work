import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// DATABASE_URL が未設定の場合（CI環境など）はフォールバック値を使用
const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/data/fallback.db';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});
