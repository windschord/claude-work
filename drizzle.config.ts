import 'dotenv/config';
import type { Config } from 'drizzle-kit';

// DATABASE_URLから file: プレフィックスを除去
const dbUrl = process.env.DATABASE_URL?.replace(/^file:/, '') || './data/claudework.db';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbUrl,
  },
} satisfies Config;
