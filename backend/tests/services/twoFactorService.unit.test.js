import { describe, it, expect } from 'vitest';
import speakeasy from 'speakeasy';
import {
  generateTwoFactorSecret,
  verifyTwoFactorToken,
  generateBackupCodes,
  hashBackupCodes,
  verifyAndConsumeBackupCode,
} from '../../services/twoFactorService';

describe('twoFactorService', () => {
  describe('generateTwoFactorSecret', () => {
    it('generates a base32 secret, otpauth URL and QR code data URL', async () => {
      const result = await generateTwoFactorSecret('student@example.com');

      expect(result).toBeDefined();
      expect(result.secret).toMatch(/^[A-Z2-7]{16,32}$/);
      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.otpauthUrl).toContain('student%40example.com');
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('verifyTwoFactorToken', () => {
    it('verifies a valid 6-digit TOTP token', () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      const validToken = speakeasy.totp({
        secret,
        encoding: 'base32',
      });

      const isValid = verifyTwoFactorToken(secret, validToken);
      expect(isValid).toBe(true);
    });

    it('handles clock drift within window = 1', () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      // Token generated 30 seconds ago (1 step back)
      const pastToken = speakeasy.totp({
        secret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000) - 30,
      });

      const isValid = verifyTwoFactorToken(secret, pastToken, 1);
      expect(isValid).toBe(true);
    });

    it('rejects an invalid TOTP token', () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      const isValid = verifyTwoFactorToken(secret, '000000');
      expect(isValid).toBe(false);
    });

    it('rejects malformed or empty token strings', () => {
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      expect(verifyTwoFactorToken(secret, '')).toBe(false);
      expect(verifyTwoFactorToken(secret, 'abc')).toBe(false);
      expect(verifyTwoFactorToken(secret, '1234567')).toBe(false);
      expect(verifyTwoFactorToken(null, '123456')).toBe(false);
    });
  });

  describe('generateBackupCodes & hashBackupCodes', () => {
    it('generates 8 unique alphanumeric 8-character backup codes', () => {
      const codes = generateBackupCodes(8);
      expect(codes).toHaveLength(8);

      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(8);

      codes.forEach((code) => {
        expect(code).toMatch(/^[a-f0-9]{8}$/i);
      });
    });

    it('hashes backup codes with bcrypt', async () => {
      const plainCodes = ['a1b2c3d4', 'e5f6a7b8'];
      const hashedCodes = await hashBackupCodes(plainCodes);

      expect(hashedCodes).toHaveLength(2);
      expect(hashedCodes[0]).toMatch(/^\$2[aby]\$\d+\$/);
      expect(hashedCodes[0]).not.toEqual(plainCodes[0]);
    });
  });

  describe('verifyAndConsumeBackupCode', () => {
    it('successfully consumes a valid backup code and returns remaining codes', async () => {
      const plainCodes = ['code0001', 'code0002', 'code0003'];
      const hashedCodes = await hashBackupCodes(plainCodes);

      const result = await verifyAndConsumeBackupCode('code0002', hashedCodes);
      expect(result.valid).toBe(true);
      expect(result.remainingHashedCodes).toHaveLength(2);

      // Verify that code0002 cannot be used a second time
      const secondTry = await verifyAndConsumeBackupCode('code0002', result.remainingHashedCodes);
      expect(secondTry.valid).toBe(false);
      expect(secondTry.remainingHashedCodes).toHaveLength(2);
    });

    it('rejects invalid or missing backup codes', async () => {
      const plainCodes = ['code0001'];
      const hashedCodes = await hashBackupCodes(plainCodes);

      const result = await verifyAndConsumeBackupCode('invalidcode', hashedCodes);
      expect(result.valid).toBe(false);
      expect(result.remainingHashedCodes).toHaveLength(1);
    });

    it('handles empty inputs gracefully', async () => {
      const result = await verifyAndConsumeBackupCode('', []);
      expect(result.valid).toBe(false);
    });
  });
});
