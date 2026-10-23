import { describe, it, expect } from 'vitest';
const {
  resolveIpLocation,
  calculateHaversineDistance,
  detectImpossibleTravel,
  parseDeviceFingerprint,
  normalizeIp,
  isPrivateIp,
} = require('../../utils/geoIp');

describe('GeoIP Utility & Impossible Travel Detection', () => {
  describe('normalizeIp & isPrivateIp', () => {
    it('normalizes IPv6-mapped IPv4 addresses', () => {
      expect(normalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1');
      expect(normalizeIp('  103.21.244.1  ')).toBe('103.21.244.1');
      expect(normalizeIp(null)).toBe('127.0.0.1');
    });

    it('identifies private / loopback IP addresses correctly', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('::1')).toBe(true);
      expect(isPrivateIp('localhost')).toBe(true);
      expect(isPrivateIp('10.0.0.15')).toBe(true);
      expect(isPrivateIp('192.168.0.1')).toBe(true);
      expect(isPrivateIp('172.20.10.2')).toBe(true);
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('103.21.244.1')).toBe(false);
    });
  });

  describe('resolveIpLocation', () => {
    it('returns local development fallback for private IP addresses', () => {
      const result = resolveIpLocation('127.0.0.1');
      expect(result.isLocal).toBe(true);
      expect(result.city).toBe('Development');
      expect(result.country).toBe('Local');
    });

    it('resolves known public IP ranges to coordinates and cities', () => {
      const mumbaiResult = resolveIpLocation('103.21.244.1');
      expect(mumbaiResult.city).toBe('Mumbai');
      expect(mumbaiResult.country).toBe('IN');
      expect(mumbaiResult.latitude).toBeCloseTo(19.0760, 2);
      expect(mumbaiResult.longitude).toBeCloseTo(72.8777, 2);

      const londonResult = resolveIpLocation('81.2.69.142');
      expect(londonResult.city).toBe('London');
      expect(londonResult.country).toBe('GB');
      expect(londonResult.latitude).toBeCloseTo(51.5074, 2);

      const sydneyResult = resolveIpLocation('1.1.1.1');
      expect(sydneyResult.city).toBe('Sydney');
      expect(sydneyResult.country).toBe('AU');
    });

    it('returns safe fallback object for unknown public IP without crashing', () => {
      const result = resolveIpLocation('203.0.113.195');
      expect(result).toHaveProperty('country');
      expect(result).toHaveProperty('city');
      expect(result).toHaveProperty('latitude');
      expect(result).toHaveProperty('longitude');
    });
  });

  describe('calculateHaversineDistance', () => {
    it('returns 0 when coordinates are identical or missing', () => {
      expect(calculateHaversineDistance(19.0760, 72.8777, 19.0760, 72.8777)).toBe(0);
      expect(calculateHaversineDistance(null, null, 19.0, 72.0)).toBe(0);
      expect(calculateHaversineDistance(0, 0, 0, 0)).toBe(0);
    });

    it('accurately calculates distance between Mumbai and London (~7,192 km)', () => {
      const distance = calculateHaversineDistance(19.0760, 72.8777, 51.5074, -0.1278);
      expect(Math.round(distance)).toBeGreaterThan(7100);
      expect(Math.round(distance)).toBeLessThan(7300);
    });

    it('accurately calculates distance between New York and London (~5,570 km)', () => {
      const distance = calculateHaversineDistance(40.7128, -74.0060, 51.5074, -0.1278);
      expect(Math.round(distance)).toBeGreaterThan(5500);
      expect(Math.round(distance)).toBeLessThan(5700);
    });
  });

  describe('detectImpossibleTravel', () => {
    it('flags CRITICAL alert when Mumbai and London logins occur 10 minutes apart', () => {
      const previousSession = {
        latitude: 19.0760,
        longitude: 72.8777,
        lastActiveAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        geoCity: 'Mumbai',
        geoCountry: 'IN',
      };
      const currentLocation = {
        latitude: 51.5074,
        longitude: -0.1278,
        timestamp: new Date(),
        geoCity: 'London',
        geoCountry: 'GB',
      };

      const result = detectImpossibleTravel(previousSession, currentLocation);
      expect(result.isImpossible).toBe(true);
      expect(result.severity).toBe('CRITICAL');
      expect(result.velocityKmh).toBeGreaterThan(40000);
      expect(result.prevLocation).toBe('Mumbai, IN');
      expect(result.currentLocation).toBe('London, GB');
    });

    it('does not flag normal feasible travel (e.g. 100 km in 3 hours)', () => {
      const previousSession = {
        latitude: 19.0760,
        longitude: 72.8777,
        lastActiveAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago (~33 km/h)
        geoCity: 'Mumbai',
        geoCountry: 'IN',
      };
      // Pune is approx 120km from Mumbai
      const currentLocation = {
        latitude: 18.5204,
        longitude: 73.8567,
        timestamp: new Date(),
        geoCity: 'Pune',
        geoCountry: 'IN',
      };

      const result = detectImpossibleTravel(previousSession, currentLocation);
      expect(result.isImpossible).toBe(false);
      expect(result.velocityKmh).toBeLessThan(100);
    });

    it('ignores distances below minimum threshold (e.g. mobile cell tower jitter < 100km)', () => {
      const previousSession = {
        latitude: 19.0760,
        longitude: 72.8777,
        lastActiveAt: new Date(Date.now() - 1 * 60 * 1000), // 1 min ago
        geoCity: 'Mumbai South',
        geoCountry: 'IN',
      };
      // Point 5km away
      const currentLocation = {
        latitude: 19.1000,
        longitude: 72.8800,
        timestamp: new Date(),
        geoCity: 'Mumbai North',
        geoCountry: 'IN',
      };

      const result = detectImpossibleTravel(previousSession, currentLocation, { minDistanceThresholdKm: 100 });
      expect(result.isImpossible).toBe(false);
    });

    it('handles missing or zero coordinates safely', () => {
      const previousSession = { latitude: 0, longitude: 0, lastActiveAt: new Date() };
      const currentLocation = { latitude: 51.5, longitude: -0.1, timestamp: new Date() };

      const result = detectImpossibleTravel(previousSession, currentLocation);
      expect(result.isImpossible).toBe(false);
    });
  });

  describe('parseDeviceFingerprint', () => {
    it('detects desktop Windows Chrome', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
      const fp = parseDeviceFingerprint(ua);
      expect(fp.deviceType).toBe('desktop');
      expect(fp.os).toBe('Windows');
      expect(fp.browser).toBe('Chrome');
    });

    it('detects mobile iPhone Safari', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1';
      const fp = parseDeviceFingerprint(ua);
      expect(fp.deviceType).toBe('mobile');
      expect(fp.os).toBe('iOS');
      expect(fp.browser).toBe('Safari');
    });

    it('detects tablet iPad Safari', () => {
      const ua = 'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
      const fp = parseDeviceFingerprint(ua);
      expect(fp.deviceType).toBe('tablet');
      expect(fp.os).toBe('iOS');
      expect(fp.browser).toBe('Safari');
    });

    it('detects Linux Firefox', () => {
      const ua = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0';
      const fp = parseDeviceFingerprint(ua);
      expect(fp.deviceType).toBe('desktop');
      expect(fp.os).toBe('Linux');
      expect(fp.browser).toBe('Firefox');
    });
  });
});
