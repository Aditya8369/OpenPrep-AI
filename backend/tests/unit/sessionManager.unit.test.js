import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSessions = [];

const mockUserSession = {
  create: vi.fn(async (data) => {
    const session = {
      id: data.id || 'sess-uuid-' + Math.random().toString(36).substring(7),
      ...data,
      toJSON() {
        return { ...this };
      },
      save: vi.fn(async function () {
        return this;
      }),
    };
    mockSessions.push(session);
    return session;
  }),
  findOne: vi.fn(async ({ where }) => {
    if (where.id) {
      const found = mockSessions.find((s) => s.id === where.id);
      return found || null;
    }
    if (where.userId) {
      const found = mockSessions.find(
        (s) => s.userId === where.userId && (where.isRevoked === undefined || s.isRevoked === where.isRevoked)
      );
      return found || null;
    }
    return null;
  }),
  findByPk: vi.fn(async (id) => {
    const found = mockSessions.find((s) => s.id === id);
    return found || null;
  }),
  findAll: vi.fn(async ({ where }) => {
    return mockSessions.filter((s) => {
      if (where.userId && s.userId !== where.userId) return false;
      if (where.isRevoked !== undefined && s.isRevoked !== where.isRevoked) return false;
      return true;
    });
  }),
  update: vi.fn(async (values, { where }) => {
    let count = 0;
    mockSessions.forEach((s) => {
      if (where.userId && s.userId !== where.userId) return;
      if (where.id && s.id === where.id[Symbol.for('ne')]) return;
      Object.assign(s, values);
      count++;
    });
    return [count];
  }),
  _reset() {
    mockSessions.length = 0;
  },
  _sessions: mockSessions,
};

const mockSecurityAuditLog = {
  create: vi.fn(async (data) => data),
};

const userSessionPath = require.resolve('../../models/UserSession');
require.cache[userSessionPath] = {
  id: userSessionPath,
  filename: userSessionPath,
  loaded: true,
  exports: mockUserSession,
};

const auditLogPath = require.resolve('../../models/SecurityAuditLog');
require.cache[auditLogPath] = {
  id: auditLogPath,
  filename: auditLogPath,
  loaded: true,
  exports: mockSecurityAuditLog,
};

const emailServicePath = require.resolve('../../services/emailService');
require.cache[emailServicePath] = {
  id: emailServicePath,
  filename: emailServicePath,
  loaded: true,
  exports: vi.fn(async () => true),
};

delete require.cache[require.resolve('../../middleware/sessionManager')];
const {
  getClientIp,
  createSession,
  touchSession,
  revokeSession,
  revokeOtherSessions,
  getUserSessions,
  validateSession,
} = require('../../middleware/sessionManager');

describe('Session Manager Middleware & Operations', () => {
  beforeEach(() => {
    mockUserSession._reset();
    vi.clearAllMocks();
  });

  describe('getClientIp', () => {
    it('extracts first IP from X-Forwarded-For header', () => {
      const req = {
        headers: { 'x-forwarded-for': '103.21.244.1, 10.0.0.1' },
      };
      expect(getClientIp(req)).toBe('103.21.244.1');
    });

    it('falls back to remoteAddress or 127.0.0.1', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '::ffff:192.168.1.5' },
      };
      expect(getClientIp(req)).toBe('192.168.1.5');
    });
  });

  describe('createSession', () => {
    it('creates a session with parsed device fingerprint and location', async () => {
      const req = {
        headers: {
          'x-forwarded-for': '103.21.244.1',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0',
        },
      };

      const { session, impossibleTravelAlert } = await createSession(req, 'user-123', 'refresh-token-xyz');
      expect(session).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.geoCity).toBe('Mumbai');
      expect(session.geoCountry).toBe('IN');
      expect(session.deviceFingerprint.deviceType).toBe('desktop');
      expect(session.deviceFingerprint.browser).toBe('Chrome');
      expect(session.deviceFingerprint.os).toBe('Windows');
      expect(session.refreshTokenHash).toBeDefined();
      expect(impossibleTravelAlert).toBeNull();
    });

    it('detects impossible travel anomaly when logging in from London shortly after Mumbai', async () => {
      // First session in Mumbai 5 minutes ago
      const req1 = {
        headers: {
          'x-forwarded-for': '103.21.244.1',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0',
        },
      };
      const { session: sess1 } = await createSession(req1, 'user-123');
      sess1.lastActiveAt = new Date(Date.now() - 5 * 60 * 1000); // 5 mins ago

      // Second session from London right now
      const req2 = {
        headers: {
          'x-forwarded-for': '81.2.69.142',
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
        },
      };
      const { session: sess2, impossibleTravelAlert } = await createSession(req2, 'user-123', null, {
        userEmail: 'student@example.com',
      });

      expect(sess2).toBeDefined();
      expect(impossibleTravelAlert).not.toBeNull();
      expect(impossibleTravelAlert.isImpossible).toBe(true);
      expect(impossibleTravelAlert.severity).toBe('CRITICAL');
      expect(mockSecurityAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          eventType: 'SUSPICIOUS_IMPOSSIBLE_TRAVEL',
          severity: 'CRITICAL',
        })
      );
    });
  });

  describe('revokeSession & revokeOtherSessions', () => {
    it('revokes a specific session', async () => {
      const session = await mockUserSession.create({
        id: 'sess-to-revoke',
        userId: 'user-123',
        isRevoked: false,
      });

      const revoked = await revokeSession('sess-to-revoke', 'user-123');
      expect(revoked).not.toBeNull();
      expect(revoked.isRevoked).toBe(true);
    });

    it('returns null if session not found', async () => {
      const revoked = await revokeSession('non-existent', 'user-123');
      expect(revoked).toBeNull();
    });

    it('revokes all other sessions except current session', async () => {
      const s1 = await mockUserSession.create({ id: 's1', userId: 'user-123', isRevoked: false });
      const s2 = await mockUserSession.create({ id: 's2', userId: 'user-123', isRevoked: false });
      const s3 = await mockUserSession.create({ id: 's3', userId: 'user-123', isRevoked: false });

      await revokeOtherSessions('user-123', 's2');
      expect(s1.isRevoked).toBe(true);
      expect(s2.isRevoked).toBe(false);
      expect(s3.isRevoked).toBe(true);
    });
  });

  describe('getUserSessions', () => {
    it('flags the current session correctly', async () => {
      await mockUserSession.create({ id: 'sess-current', userId: 'user-abc', isRevoked: false });
      await mockUserSession.create({ id: 'sess-other', userId: 'user-abc', isRevoked: false });

      const list = await getUserSessions('user-abc', 'sess-current');
      expect(list.length).toBe(2);
      const current = list.find((s) => s.id === 'sess-current');
      const other = list.find((s) => s.id === 'sess-other');
      expect(current.isCurrent).toBe(true);
      expect(other.isCurrent).toBe(false);
    });
  });

  describe('validateSession middleware', () => {
    it('allows valid active session to proceed and attaches session', async () => {
      await mockUserSession.create({
        id: 'valid-sess',
        userId: 'user-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 100000),
      });

      const req = { sessionId: 'valid-sess', headers: {} };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const next = vi.fn();

      await validateSession(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.currentSession.id).toBe('valid-sess');
    });

    it('blocks revoked session with 401 Unauthorized', async () => {
      await mockUserSession.create({
        id: 'revoked-sess',
        userId: 'user-1',
        isRevoked: true,
      });

      const req = { sessionId: 'revoked-sess', headers: {} };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await validateSession(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringMatching(/revoked|terminated/i) })
      );
    });

    it('blocks expired session with 401 Unauthorized', async () => {
      await mockUserSession.create({
        id: 'expired-sess',
        userId: 'user-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 100000),
      });

      const req = { sessionId: 'expired-sess', headers: {} };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await validateSession(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringMatching(/expired/i) })
      );
    });
  });
});
