import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
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
