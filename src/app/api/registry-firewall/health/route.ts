import { NextResponse } from 'next/server';
import { getRegistryFirewallClient } from '@/services/registry-firewall-client';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const client = getRegistryFirewallClient();
    const health = await client.getHealth();
    return NextResponse.json(health);
  } catch (error) {
    logger.error('Failed to get registry firewall health', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
