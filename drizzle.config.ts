import 'dotenv/config';
import type { Config } from 'drizzle-kit';
import { fileURLToPath } from 'url';

// DATABASE_URLから file: プレフィックスを除去
// file:// (full URL format from pathToFileURL) or file: (simple prefix) both handled
const rawUrl = process.env.DATABASE_URL || 'file:./data/claudework.db';
const dbUrl = rawUrl.startsWith('file://')
  ? fileURLToPath(rawUrl)
  : rawUrl.replace(/^file:/, '');

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbUrl,
  },
} satisfies Config;
