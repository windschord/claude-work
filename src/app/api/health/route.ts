import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
  const timestamp = new Date().toISOString();

  logger.debug('Health check requested', { timestamp });

  return NextResponse.json(
    {
      status: 'ok',
      timestamp,
    },
    { status: 200 }
  );
}
