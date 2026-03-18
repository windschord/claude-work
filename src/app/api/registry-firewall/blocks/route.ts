import { NextRequest, NextResponse } from 'next/server';
import { getRegistryFirewallClient } from '@/services/registry-firewall-client';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limitStr = searchParams.get('limit');
    const parsed = parseInt(limitStr ?? '', 10);
    const limit = limitStr && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 100) : 10;

    const client = getRegistryFirewallClient();
    const blocks = await client.getBlocks(limit);

    // getBlocks()がエラー時は空配列を返す(例外をスローしない)ため、
    // registry-firewall停止時は blocks.total === 0 かつ blocks.blocks === [] となる
    return NextResponse.json(blocks);
  } catch (error) {
    logger.error('Failed to get registry firewall blocks', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
