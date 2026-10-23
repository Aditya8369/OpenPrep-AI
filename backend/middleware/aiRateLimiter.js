/**
 * Token Bucket Rate Limiter & Tiered Daily Quota Guard Middleware
 * Implements RFC 6585 rate limiting headers, burst capacity control,
 * and midnight reset countdown.
 */

// In-memory token bucket store for high-speed tracking and Redis-fallback
const inMemoryBuckets = new Map();
const inMemoryDailyUsage = new Map();

const TIER_CONFIGS = {
  free: {
    hourlyLimit: 20,
    burstCapacity: 5,
    refillRatePerSec: 20 / 3600, // ~1 token every 180s
    dailyQuota: 50,
  },
  pro: {
    hourlyLimit: 120,
    burstCapacity: 15,
    refillRatePerSec: 120 / 3600, // ~1 token every 30s
    dailyQuota: 500,
  },
};

/**
 * Calculates remaining seconds until the next local midnight reset.
 * @returns {number}
 */
function getSecondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

/**
 * Formats current date as YYYY-MM-DD for daily quota isolation.
 */
function getTodayDateKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Creates token bucket rate limiter middleware for AI endpoints.
 * 
 * @param {object} [customOptions]
 * @returns {import('express').RequestHandler}
 */
function aiRateLimiter(customOptions = {}) {
  return (req, res, next) => {
    // Determine user identity & tier
    const user = req.user || {};
    const userId = user.id || user.userId || req.ip || 'anonymous_user';
    const tier = (user.isPro || user.tier === 'pro' || req.headers['x-user-tier'] === 'pro') ? 'pro' : 'free';
    const config = TIER_CONFIGS[tier] || TIER_CONFIGS.free;

    const nowSec = Date.now() / 1000;
    const bucketKey = `${userId}:${tier}`;

    // 1. Daily Quota Check
    const today = getTodayDateKey();
    const dailyKey = `${userId}:${today}`;
    const dailyCount = inMemoryDailyUsage.get(dailyKey) || 0;
    const secondsUntilReset = getSecondsUntilMidnight();

    if (dailyCount >= config.dailyQuota) {
      res.setHeader('Retry-After', String(secondsUntilReset));
      res.setHeader('X-Daily-Quota-Remaining', '0');
      return res.status(429).json({
        success: false,
        error: `Daily AI prompt quota (${config.dailyQuota} requests) exhausted. Quota resets at midnight.`,
        code: 'ERR_DAILY_AI_QUOTA_EXCEEDED',
        tier,
        dailyLimit: config.dailyQuota,
        dailyRemaining: 0,
        resetCountdownSeconds: secondsUntilReset,
      });
    }

    // 2. Token Bucket Burst & Rate Limiting
    let bucket = inMemoryBuckets.get(bucketKey);
    if (!bucket) {
      bucket = {
        tokens: config.burstCapacity,
        lastRefill: nowSec,
      };
    } else {
      // Calculate token refill since last request
      const deltaSec = Math.max(0, nowSec - bucket.lastRefill);
      const refilledTokens = deltaSec * config.refillRatePerSec;
      bucket.tokens = Math.min(config.burstCapacity, bucket.tokens + refilledTokens);
      bucket.lastRefill = nowSec;
    }

    // Set standard RFC 6585 rate limiting headers
    const remainingTokens = Math.max(0, Math.floor(bucket.tokens));
    const secondsForOneToken = Math.ceil((1 - Math.min(1, bucket.tokens)) / config.refillRatePerSec);
    const resetTimestamp = Math.floor(nowSec + Math.max(0, secondsForOneToken));

    res.setHeader('X-RateLimit-Limit', String(config.hourlyLimit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remainingTokens - 1)));
    res.setHeader('X-RateLimit-Reset', String(resetTimestamp));
    res.setHeader('X-Daily-Quota-Remaining', String(Math.max(0, config.dailyQuota - dailyCount - 1)));

    // Check if tokens are available (costs 1 token per request)
    if (bucket.tokens < 1.0) {
      const retryAfter = Math.max(1, Math.ceil((1.0 - bucket.tokens) / config.refillRatePerSec));
      res.setHeader('Retry-After', String(retryAfter));
      inMemoryBuckets.set(bucketKey, bucket);

      return res.status(429).json({
        success: false,
        error: `Hourly AI rate limit exceeded for ${tier} tier. Please wait before retrying.`,
        code: 'ERR_AI_RATE_LIMIT_EXCEEDED',
        tier,
        limit: config.hourlyLimit,
        remaining: 0,
        retryAfter,
      });
    }

    // Deduct 1 token and increment daily count
    bucket.tokens -= 1.0;
    inMemoryBuckets.set(bucketKey, bucket);
    inMemoryDailyUsage.set(dailyKey, dailyCount + 1);

    next();
  };
}

module.exports = {
  aiRateLimiter,
  TIER_CONFIGS,
  inMemoryBuckets,
  inMemoryDailyUsage,
  getSecondsUntilMidnight,
};
