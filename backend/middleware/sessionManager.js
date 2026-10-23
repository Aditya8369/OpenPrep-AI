const crypto = require('crypto');
const { Op } = require('sequelize');
const UserSession = require('../models/UserSession');
const SecurityAuditLog = require('../models/SecurityAuditLog');
const sendEmail = require('../services/emailService');
const {
  resolveIpLocation,
  detectImpossibleTravel,
  parseDeviceFingerprint,
  normalizeIp,
} = require('../utils/geoIp');

/**
 * Extracts client IP from request
 */
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return normalizeIp(forwarded.split(',')[0].trim());
  }
  return normalizeIp(req.socket?.remoteAddress || req.ip || '127.0.0.1');
};

/**
 * Creates a new session record for a user upon login/refresh
 * Performs impossible travel detection against previous active logins
 */
const createSession = async (req, userId, rawRefreshToken = null, options = {}) => {
  try {
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const geo = resolveIpLocation(ipAddress);
    const deviceFingerprint = parseDeviceFingerprint(userAgent);

    let refreshTokenHash = null;
    if (rawRefreshToken) {
      refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    }

    // Check last active non-revoked session to detect impossible travel
    let impossibleTravelAlert = null;
    try {
      const lastSession = await UserSession.findOne({
        where: {
          userId,
          isRevoked: false,
        },
        order: [['lastActiveAt', 'DESC']],
      });

      if (lastSession) {
        const travelResult = detectImpossibleTravel(
          lastSession,
          {
            latitude: geo.latitude,
            longitude: geo.longitude,
            timestamp: new Date(),
            geoCity: geo.city,
            geoCountry: geo.country,
          },
          { maxSpeedKmh: options.maxSpeedKmh || 850 }
        );

        if (travelResult.isImpossible) {
          impossibleTravelAlert = travelResult;

          // Record in SecurityAuditLog
          try {
            await SecurityAuditLog.create({
              userId,
              eventType: 'SUSPICIOUS_IMPOSSIBLE_TRAVEL',
              severity: travelResult.severity || 'CRITICAL',
              ipAddress,
              userAgent,
              metadata: {
                previousSessionId: lastSession.id,
                previousLocation: travelResult.prevLocation,
                currentLocation: travelResult.currentLocation,
                velocityKmh: travelResult.velocityKmh,
                distanceKm: travelResult.distanceKm,
                timeDiffMinutes: travelResult.timeDiffMinutes,
              },
            });
          } catch (auditErr) {
            console.error('[SessionManager] Failed to record security audit log:', auditErr.message);
          }

          // Trigger email alert asynchronously if user email is present
          if (options.userEmail) {
            try {
              sendEmail({
                email: options.userEmail,
                subject: 'Security Alert: Suspicious Login Detected (Impossible Travel)',
                message: `We detected a concurrent login to your OpenPrep AI account from ${travelResult.currentLocation} shortly after activity in ${travelResult.prevLocation}. If this was not you, please log out of other devices and reset your password immediately.`,
              }).catch(() => {});
            } catch {
              // Ignore email send errors in test/dev
            }
          }
        }
      }
    } catch (checkErr) {
      console.error('[SessionManager] Impossible travel check error:', checkErr.message);
    }

    // Default expiration: 7 days
    const expiresAt = options.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await UserSession.create({
      userId,
      refreshTokenHash,
      deviceFingerprint,
      ipAddress,
      geoCountry: geo.country,
      geoCity: geo.city,
      latitude: geo.latitude,
      longitude: geo.longitude,
      isRevoked: false,
      lastActiveAt: new Date(),
      expiresAt,
    });

    return {
      session,
      impossibleTravelAlert,
    };
  } catch (err) {
    console.error('[SessionManager] createSession error:', err);
    throw err;
  }
};

/**
 * Updates last active timestamp for a session
 */
const touchSession = async (sessionId) => {
  if (!sessionId) return;
  try {
    await UserSession.update(
      { lastActiveAt: new Date() },
      { where: { id: sessionId, isRevoked: false } }
    );
  } catch {
    // Non-blocking
  }
};

/**
 * Revokes a single session by ID
 */
const revokeSession = async (sessionId, userId = null) => {
  const where = { id: sessionId };
  if (userId) {
    where.userId = userId;
  }
  const session = await UserSession.findOne({ where });
  if (!session) {
    return null;
  }
  session.isRevoked = true;
  await session.save();
  return session;
};

/**
 * Revokes all active sessions for a user except the current one
 */
const revokeOtherSessions = async (userId, currentSessionId = null) => {
  const where = {
    userId,
    isRevoked: false,
  };
  if (currentSessionId) {
    where.id = { [Op.ne]: currentSessionId };
  }
  const [affectedCount] = await UserSession.update(
    { isRevoked: true },
    { where }
  );
  return affectedCount;
};

/**
 * Fetches all active & recent sessions for a user, marking the current session
 */
const getUserSessions = async (userId, currentSessionId = null) => {
  const sessions = await UserSession.findAll({
    where: {
      userId,
      isRevoked: false,
      [Op.or]: [
        { expiresAt: { [Op.gt]: new Date() } },
        { expiresAt: null },
      ],
    },
    order: [['lastActiveAt', 'DESC']],
    attributes: [
      'id',
      'deviceFingerprint',
      'ipAddress',
      'geoCountry',
      'geoCity',
      'latitude',
      'longitude',
      'isRevoked',
      'lastActiveAt',
      'expiresAt',
      'createdAt',
    ],
  });

  return sessions.map((sess) => {
    const json = sess.toJSON();
    return {
      ...json,
      isCurrent: currentSessionId ? json.id === currentSessionId : false,
    };
  });
};

/**
 * Express middleware to validate session status from JWT claim or header
 */
const validateSession = async (req, res, next) => {
  const sessionId = req.sessionId || req.headers['x-session-id'] || req.cookies?.sessionId;
  if (!sessionId) {
    return next();
  }

  try {
    const session = await UserSession.findByPk(sessionId);
    if (!session || session.isRevoked) {
      return res.status(401).json({
        success: false,
        error: 'Session has been revoked or terminated',
      });
    }

    if (session.expiresAt && session.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'Session has expired',
      });
    }

    req.currentSession = session;
    req.sessionId = session.id;

    // Async update last active (non-blocking)
    touchSession(session.id).catch(() => {});
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Session validation failed',
    });
  }
};

module.exports = {
  getClientIp,
  createSession,
  touchSession,
  revokeSession,
  revokeOtherSessions,
  getUserSessions,
  validateSession,
};
