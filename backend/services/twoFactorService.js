/**
 * @fileoverview Two-Factor Authentication (2FA) Service using RFC 6238 TOTP.
 * Handles secret generation, QR code data URI generation, clock-drift tolerant
 * token verification, and cryptographically secure single-use backup codes.
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/**
 * Generates an RFC 6238 compliant base32 TOTP secret and QR code data URI.
 * 
 * @param {string} userEmail
 * @param {string} [issuer='OpenPrep-AI']
 * @returns {Promise<{ secret: string, otpauthUrl: string, qrCodeDataUrl: string }>}
 */
async function generateTwoFactorSecret(userEmail, issuer = 'OpenPrep-AI') {
  const secretObj = speakeasy.generateSecret({
    name: `${issuer} (${userEmail})`,
    issuer: issuer,
    length: 20,
  });

  const qrCodeDataUrl = await QRCode.toDataURL(secretObj.otpauth_url);

  return {
    secret: secretObj.base32,
    otpauthUrl: secretObj.otpauth_url,
    qrCodeDataUrl,
  };
}

/**
 * Verifies a 6-digit TOTP token against a base32 secret with +-1 time-step window (30s drift tolerance).
 * 
 * @param {string} base32Secret
 * @param {string} token 6-digit TOTP code
 * @param {number} [window=1] Tolerance steps (1 step = 30 seconds before/after)
 * @returns {boolean}
 */
function verifyTwoFactorToken(base32Secret, token, window = 1) {
  if (!base32Secret || !token) {
    return false;
  }

  // Clean input token (remove spaces or hyphens)
  const cleanToken = String(token).replace(/[\s-]/g, '').trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  return speakeasy.totp.verify({
    secret: base32Secret,
    encoding: 'base32',
    token: cleanToken,
    window,
  });
}

/**
 * Generates N cryptographically secure alphanumeric backup codes.
 * Formatted as 8-character hex strings (e.g., 'a1b2c3d4').
 * 
 * @param {number} [count=8]
 * @returns {string[]} Plaintext backup codes
 */
function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex'));
  }
  return codes;
}

/**
 * Hashes an array of plaintext backup codes with bcrypt before database storage.
 * 
 * @param {string[]} plainCodes
 * @returns {Promise<string[]>} Array of hashed codes
 */
async function hashBackupCodes(plainCodes) {
  if (!Array.isArray(plainCodes)) {
    return [];
  }
  const salt = await bcrypt.genSalt(10);
  return Promise.all(plainCodes.map((code) => bcrypt.hash(code.toLowerCase().trim(), salt)));
}

/**
 * Verifies a provided backup code against stored hashed codes and consumes it if valid.
 * 
 * @param {string} rawCode Candidate backup code provided by user
 * @param {string[]} hashedBackupCodes Array of bcrypt-hashed backup codes from DB
 * @returns {Promise<{ valid: boolean, remainingHashedCodes: string[] }>}
 */
async function verifyAndConsumeBackupCode(rawCode, hashedBackupCodes) {
  if (!rawCode || !Array.isArray(hashedBackupCodes) || hashedBackupCodes.length === 0) {
    return { valid: false, remainingHashedCodes: hashedBackupCodes || [] };
  }

  const cleanRawCode = String(rawCode).replace(/[\s-]/g, '').toLowerCase().trim();

  for (let i = 0; i < hashedBackupCodes.length; i++) {
    const isMatch = await bcrypt.compare(cleanRawCode, hashedBackupCodes[i]);
    if (isMatch) {
      // Consume the code by returning remaining list without this index
      const remainingHashedCodes = hashedBackupCodes.filter((_, idx) => idx !== i);
      return {
        valid: true,
        remainingHashedCodes,
      };
    }
  }

  return {
    valid: false,
    remainingHashedCodes: hashedBackupCodes,
  };
}

module.exports = {
  generateTwoFactorSecret,
  verifyTwoFactorToken,
  generateBackupCodes,
  hashBackupCodes,
  verifyAndConsumeBackupCode,
};
