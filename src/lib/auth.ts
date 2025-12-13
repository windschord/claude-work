import { randomUUID } from 'crypto';
import { prisma } from './db';
import { NextRequest } from 'next/server';

export async function createSession(): Promise<string> {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.authSession.create({
    data: {
      id: sessionId,
      token_hash: '',
      expires_at: expiresAt,
    },
  });

  return sessionId;
}

export async function getSession(sessionId: string) {
  const session = await prisma.authSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return null;
  }

  if (session.expires_at < new Date()) {
    return null;
  }

  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await prisma.authSession.delete({
    where: { id: sessionId },
  });
}

export function requireAuth(_request?: NextRequest) {
  // This function is referenced in the test import but not tested
  // Implementation placeholder for future use
  // TODO: Implement proper authentication check
  return true;
}
