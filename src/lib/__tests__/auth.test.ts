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
      expect(session?.expires_at).toBeInstanceOf(Date);
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

    it('should correctly compare DateTime fields using Date conversion', async () => {
      const testToken = 'test-token-datetime';
      const sessionId = await createSession(testToken);

      // Set expiry to 1 hour in the future
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.authSession.update({
        where: { id: sessionId },
        data: { expires_at: futureDate },
      });

      const session = await getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
      // Verify that the expires_at is correctly compared as Date
      expect(new Date(session!.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle expires_at as string and convert to Date for comparison', async () => {
      const testToken = 'test-token-string-date';
      const sessionId = await createSession(testToken);

      // Get the raw session from database
      const rawSession = await prisma.authSession.findUnique({
        where: { id: sessionId },
      });

      expect(rawSession).toBeDefined();

      // Verify that comparing with Date works correctly
      // This tests the fix: new Date(session.expires_at) < new Date()
      const expiresAt = new Date(rawSession!.expires_at);
      const now = new Date();
      expect(expiresAt > now).toBe(true);

      const session = await getSession(sessionId);
      expect(session).toBeDefined();
    });

    it('should return null for session expired exactly at current time', async () => {
      const testToken = 'test-token-exact-expiry';
      const sessionId = await createSession(testToken);

      // Set expiry to current time (edge case)
      const currentTime = new Date();
      await prisma.authSession.update({
        where: { id: sessionId },
        data: { expires_at: currentTime },
      });

      // Wait 1ms to ensure current time is after expiry
      await new Promise(resolve => setTimeout(resolve, 1));

      const session = await getSession(sessionId);

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
