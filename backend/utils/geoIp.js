/**
 * GeoIP Resolution & Impossible Travel Anomaly Detection Utility
 *
 * Implements client IP geo-location resolution, Haversine distance calculations,
 * and Impossible Travel Velocity checks to protect user accounts from concurrent
 * unauthorized logins across distant geographic regions.
 */

let geoip = null;
try {
  geoip = require('geoip-lite');
} catch (e) {
  // geoip-lite optional in environments without binary data
}

// Built-in lookup for well-known test and public ranges when geoip-lite is absent
const KNOWN_GEO_RANGES = [
  { prefix: '103.21.', country: 'IN', city: 'Mumbai', lat: 19.0760, lon: 72.8777, timezone: 'Asia/Kolkata' },
  { prefix: '115.112.', country: 'IN', city: 'Mumbai', lat: 19.0760, lon: 72.8777, timezone: 'Asia/Kolkata' },
  { prefix: '122.160.', country: 'IN', city: 'New Delhi', lat: 28.6139, lon: 77.2090, timezone: 'Asia/Kolkata' },
  { prefix: '106.51.', country: 'IN', city: 'Bengaluru', lat: 12.9716, lon: 77.5946, timezone: 'Asia/Kolkata' },
  { prefix: '81.2.69.', country: 'GB', city: 'London', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London' },
  { prefix: '151.101.', country: 'GB', city: 'London', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London' },
  { prefix: '8.8.8.', country: 'US', city: 'Mountain View', lat: 37.3860, lon: -122.0838, timezone: 'America/Los_Angeles' },
  { prefix: '1.1.1.', country: 'AU', city: 'Sydney', lat: -33.8688, lon: 151.2093, timezone: 'Australia/Sydney' },
  { prefix: '194.109.', country: 'NL', city: 'Amsterdam', lat: 52.3676, lon: 4.9041, timezone: 'Europe/Amsterdam' },
  { prefix: '210.140.', country: 'JP', city: 'Tokyo', lat: 35.6762, lon: 139.6503, timezone: 'Asia/Tokyo' },
  { prefix: '118.189.', country: 'SG', city: 'Singapore', lat: 1.3521, lon: 103.8198, timezone: 'Asia/Singapore' },
  { prefix: '195.154.', country: 'FR', city: 'Paris', lat: 48.8566, lon: 2.3522, timezone: 'Europe/Paris' },
  { prefix: '142.250.', country: 'US', city: 'New York', lat: 40.7128, lon: -74.0060, timezone: 'America/New_York' },
];

/**
 * Normalizes an IP string (stripping IPv6 mapped prefixes)
 */
const normalizeIp = (rawIp) => {
  if (!rawIp) return '127.0.0.1';
  let ip = rawIp.trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip;
};

/**
 * Checks if an IP is a local/private address
 */
const isPrivateIp = (ip) => {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  return false;
};

/**
 * Resolves client IP to approximate geographic location
 * @param {string} ip
 * @returns {{ country: string, city: string, latitude: number, longitude: number, timezone: string, isLocal: boolean }}
 */
const resolveIpLocation = (ip) => {
  const cleanIp = normalizeIp(ip);

  if (isPrivateIp(cleanIp)) {
    return {
      country: 'Local',
      city: 'Development',
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
      isLocal: true,
    };
  }

  // 1. Try geoip-lite if loaded
  if (geoip && typeof geoip.lookup === 'function') {
    try {
      const geo = geoip.lookup(cleanIp);
      if (geo && geo.ll) {
        return {
          country: geo.country || 'Unknown',
          city: geo.city || 'Unknown',
          latitude: geo.ll[0] || 0,
          longitude: geo.ll[1] || 0,
          timezone: geo.timezone || 'UTC',
          isLocal: false,
        };
      }
    } catch {
      // Fallback
    }
  }

  // 2. Check known range lookup table
  for (const range of KNOWN_GEO_RANGES) {
    if (cleanIp.startsWith(range.prefix)) {
      return {
        country: range.country,
        city: range.city,
        latitude: range.lat,
        longitude: range.lon,
        timezone: range.timezone,
        isLocal: false,
      };
    }
  }

  // 3. Fallback for unknown public IP
  return {
    country: 'Unknown',
    city: 'Unknown',
    latitude: 0,
    longitude: 0,
    timezone: 'UTC',
    isLocal: false,
  };
};

/**
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula
 */
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === null || lat1 === undefined ||
    lon1 === null || lon1 === undefined ||
    lat2 === null || lat2 === undefined ||
    lon2 === null || lon2 === undefined
  ) {
    return 0;
  }

  // If both locations are at default (0, 0), distance is 0
  if (lat1 === 0 && lon1 === 0 && lat2 === 0 && lon2 === 0) {
    return 0;
  }

  const R = 6371; // Earth's mean radius in kilometers
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Analyzes previous and current session locations for impossible travel velocity
 * @param {Object} previousSession - { latitude, longitude, lastActiveAt, geoCity, geoCountry }
 * @param {Object} currentInfo - { latitude, longitude, timestamp, geoCity, geoCountry }
 * @param {Object} [options] - { maxSpeedKmh: number, minDistanceThresholdKm: number }
 * @returns {{ isImpossible: boolean, distanceKm?: number, timeDiffMinutes?: number, velocityKmh?: number, prevLocation?: string, currentLocation?: string, severity?: 'CRITICAL' | 'HIGH' }}
 */
const detectImpossibleTravel = (previousSession, currentInfo, options = {}) => {
  if (!previousSession || !currentInfo) {
    return { isImpossible: false };
  }

  const prevLat = Number(previousSession.latitude);
  const prevLon = Number(previousSession.longitude);
  const currLat = Number(currentInfo.latitude);
  const currLon = Number(currentInfo.longitude);

  // If neither coordinate is valid, cannot reliably calculate travel
  if (
    Number.isNaN(prevLat) || Number.isNaN(prevLon) ||
    Number.isNaN(currLat) || Number.isNaN(currLon) ||
    (prevLat === 0 && prevLon === 0) ||
    (currLat === 0 && currLon === 0)
  ) {
    return { isImpossible: false };
  }

  const distanceKm = calculateHaversineDistance(prevLat, prevLon, currLat, currLon);

  // Ignore negligible distances (e.g. mobile cell tower or city ISP jumps within 100km)
  const minDistanceThresholdKm = options.minDistanceThresholdKm || 100;
  if (distanceKm < minDistanceThresholdKm) {
    return { isImpossible: false, distanceKm: Math.round(distanceKm) };
  }

  const prevTime = new Date(previousSession.lastActiveAt || previousSession.createdAt || Date.now()).getTime();
  const currTime = new Date(currentInfo.timestamp || Date.now()).getTime();

  const timeDiffMs = Math.abs(currTime - prevTime);
  // Convert to hours (with a floor of 1 second to prevent division by zero)
  const timeDiffHours = Math.max(timeDiffMs / (1000 * 60 * 60), 1 / 3600);
  const velocityKmh = distanceKm / timeDiffHours;

  // Commercial airliner cruising speed threshold (850 km/h)
  const maxSpeedKmh = options.maxSpeedKmh || 850;

  if (velocityKmh > maxSpeedKmh) {
    const timeDiffMinutes = Math.round((timeDiffMs / (1000 * 60)) * 10) / 10;
    const prevLocation = [previousSession.geoCity, previousSession.geoCountry].filter(Boolean).join(', ') || 'Unknown';
    const currentLocation = [currentInfo.geoCity, currentInfo.geoCountry].filter(Boolean).join(', ') || 'Unknown';

    return {
      isImpossible: true,
      distanceKm: Math.round(distanceKm),
      timeDiffMinutes,
      velocityKmh: Math.round(velocityKmh),
      prevLocation,
      currentLocation,
      severity: velocityKmh > 2500 ? 'CRITICAL' : 'HIGH',
    };
  }

  return {
    isImpossible: false,
    distanceKm: Math.round(distanceKm),
    velocityKmh: Math.round(velocityKmh),
  };
};

/**
 * Parses user agent string to extract device type, browser, and OS
 * @param {string} userAgent
 * @returns {{ deviceType: 'desktop' | 'mobile' | 'tablet', browser: string, os: string, raw: string }}
 */
const parseDeviceFingerprint = (userAgent = '') => {
  const ua = String(userAgent);
  let deviceType = 'desktop';
  let browser = 'Unknown';
  let os = 'Unknown';

  // Device detection
  if (/iPad|Tablet|PlayBook/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    deviceType = 'mobile';
  }

  // OS detection
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';

  // Browser detection
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\/|CriOS\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\/|FxiOS\//i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) browser = 'Safari';

  return {
    deviceType,
    browser,
    os,
    raw: ua.substring(0, 500),
  };
};

module.exports = {
  resolveIpLocation,
  calculateHaversineDistance,
  detectImpossibleTravel,
  parseDeviceFingerprint,
  normalizeIp,
  isPrivateIp,
  KNOWN_GEO_RANGES,
};
