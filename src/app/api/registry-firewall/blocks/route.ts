import { NextRequest, NextResponse } from 'next/server';
import { getRegistryFirewallClient } from '@/services/registry-firewall-client';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? Math.min(Math.max(parseInt(limitStr, 10), 1), 100) : 10;

    const client = getRegistryFirewallClient();
    const health = await client.getHealth();

    if (health.status === 'stopped') {
      return NextResponse.json({ error: 'Registry firewall is not available' }, { status: 503 });
    }

    const blocks = await client.getBlocks(limit);
    return NextResponse.json(blocks);
  } catch (error) {
    logger.error('Failed to get registry firewall blocks', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
