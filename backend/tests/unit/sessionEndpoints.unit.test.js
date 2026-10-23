import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSessions = [
  {
    id: 'session-1',
    deviceFingerprint: { deviceType: 'desktop', browser: 'Chrome', os: 'Windows' },
    ipAddress: '103.21.244.1',
    geoCountry: 'IN',
    geoCity: 'Mumbai',
    isCurrent: true,
  },
  {
    id: 'session-2',
    deviceFingerprint: { deviceType: 'mobile', browser: 'Safari', os: 'iOS' },
    ipAddress: '81.2.69.142',
    geoCountry: 'GB',
    geoCity: 'London',
    isCurrent: false,
  },
];

const mockSessionManager = {
  getUserSessions: vi.fn(async (userId, currentSessionId) => mockSessions),
  revokeSession: vi.fn(async (sessionId, userId) => {
    if (sessionId === 'session-2') return { id: 'session-2', isRevoked: true };
    return null;
  }),
  revokeOtherSessions: vi.fn(async (userId, currentSessionId) => 2),
};

const sessionManagerPath = require.resolve('../../middleware/sessionManager');
require.cache[sessionManagerPath] = {
  id: sessionManagerPath,
  filename: sessionManagerPath,
  loaded: true,
  exports: mockSessionManager,
};

delete require.cache[require.resolve('../../controllers/authController')];
const {
  getActiveSessions,
  revokeSession,
  revokeOtherSessions,
} = require('../../controllers/authController');

describe('Auth Controller - Multi-Device Session Endpoints (#2326)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveSessions (GET /api/auth/sessions)', () => {
    it('returns 200 with all user sessions and current session ID', async () => {
      const req = {
        user: { id: 'user-xyz' },
        sessionId: 'session-1',
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await getActiveSessions(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          count: 2,
          currentSessionId: 'session-1',
          sessions: expect.arrayContaining([
            expect.objectContaining({ id: 'session-1', isCurrent: true }),
            expect.objectContaining({ id: 'session-2', isCurrent: false }),
          ]),
        })
      );
    });
  });

  describe('revokeSession (DELETE /api/auth/sessions/:sessionId)', () => {
    it('revokes an existing session successfully', async () => {
      const req = {
        user: { id: 'user-xyz' },
        params: { sessionId: 'session-2' },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await revokeSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Session revoked successfully',
          sessionId: 'session-2',
        })
      );
    });

    it('returns 404 when session not found or does not belong to user', async () => {
      const req = {
        user: { id: 'user-xyz' },
        params: { sessionId: 'unknown-sess' },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await revokeSession(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/not found/i),
        })
      );
    });

    it('delegates to revokeOtherSessions if sessionId is "others"', async () => {
      const req = {
        user: { id: 'user-xyz' },
        sessionId: 'session-1',
        params: { sessionId: 'others' },
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await revokeSession(req, res, next);

      expect(mockSessionManager.revokeOtherSessions).toHaveBeenCalledWith('user-xyz', 'session-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          revokedCount: 2,
        })
      );
    });
  });

  describe('revokeOtherSessions (DELETE /api/auth/sessions/others)', () => {
    it('revokes all other sessions except current and returns count', async () => {
      const req = {
        user: { id: 'user-xyz' },
        sessionId: 'session-1',
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await revokeOtherSessions(req, res, next);

      expect(mockSessionManager.revokeOtherSessions).toHaveBeenCalledWith('user-xyz', 'session-1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'All other sessions revoked successfully',
          revokedCount: 2,
        })
      );
    });
  });
});
