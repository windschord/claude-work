import { PrismaClient } from '@prisma/client';

// Set default DATABASE_URL for tests if not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./data/test.db';
}

// Prisma Clientのシングルトンインスタンス
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const options: any = {
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  };

  return new PrismaClient(options);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
