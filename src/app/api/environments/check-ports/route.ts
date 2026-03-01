import { NextRequest, NextResponse } from 'next/server';
import { portChecker } from '@/services/port-checker';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ports, excludeEnvironmentId } = body;

    if (excludeEnvironmentId !== undefined && typeof excludeEnvironmentId !== 'string') {
      return NextResponse.json({ error: 'excludeEnvironmentId must be a string' }, { status: 400 });
    }

    if (!Array.isArray(ports) || ports.length === 0) {
      return NextResponse.json({ error: 'ports must be a non-empty array' }, { status: 400 });
    }
    if (ports.length > 20) {
      return NextResponse.json({ error: 'Maximum 20 ports can be checked at once' }, { status: 400 });
    }
    for (const port of ports) {
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return NextResponse.json({ error: `Invalid port number: ${port}` }, { status: 400 });
      }
    }

    const results = await portChecker.checkPorts({ ports, excludeEnvironmentId });
    return NextResponse.json({ results });
  } catch (error) {
    logger.error('Port check failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
