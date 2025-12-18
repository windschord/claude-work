import { describe, it, expect, beforeEach } from 'vitest';
import { createSession, getSession, deleteSession } from '../auth';
import { prisma } from '../db';

describe('Auth', () => {
  beforeEach(async () => {
    await prisma.authSession.deleteMany();
  });

  describe('createSession', () => {
    it('should create session with UUID in id field', async () => {
      const testToken = 'test-token-123';
      const sessionId = await createSession(testToken);

      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      const session = await prisma.authSession.findUnique({
        where: { id: sessionId },
      });

      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
    });

    it('should set expires_at to 24 hours from now', async () => {
      const testToken = 'test-token-456';
      const sessionId = await createSession(testToken);
      const session = await prisma.authSession.findUnique({
        where: { id: sessionId },
      });

      const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const actualExpiry = session!.expires_at;

      // Allow 1 second tolerance
      expect(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });
  });

  describe('getSession', () => {
    it('should return session if valid and not expired', async () => {
      const testToken = 'test-token-789';
      const sessionId = await createSession(testToken);

      const session = await getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
    });

    it('should return null if expired', async () => {
      const testToken = 'test-token-expired';
      const sessionId = await createSession(testToken);

      // Manually set expiry to past
      await prisma.authSession.update({
        where: { id: sessionId },
        data: { expires_at: new Date(Date.now() - 1000) },
      });

      const session = await getSession(sessionId);

      expect(session).toBeNull();
    });

    it('should return null if not found', async () => {
      const session = await getSession('non-existent-id');

      expect(session).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete session from database', async () => {
      const testToken = 'test-token-delete';
      const sessionId = await createSession(testToken);

      await deleteSession(sessionId);

      const session = await prisma.authSession.findUnique({
        where: { id: sessionId },
      });

      expect(session).toBeNull();
    });
  });
});
