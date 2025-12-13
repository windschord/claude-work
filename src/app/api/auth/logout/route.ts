import { NextRequest, NextResponse } from 'next/server';
import { getSession, deleteSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;

    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete session from database
    await deleteSession(sessionId);

    // Clear session cookie
    const response = NextResponse.json({ message: 'Logout successful' });
    response.cookies.set('sessionId', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    logger.info('User logged out successfully', { sessionId });
    return response;
  } catch (error) {
    logger.error('Logout error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
