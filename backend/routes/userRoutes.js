const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  updateAvatar,
  deleteAvatar,
  getQuota,
  getExamCountdownPreferences,
  updateExamCountdownPreferences,
  updateTimezone,
  getDashboardLayout,
  updateDashboardLayout,
} = require('../controllers/userController');
const { exportAccountData, deleteAccount } = require('../controllers/accountDataController');
const { protect } = require('../middleware/auth');
const avatarUpload = require('../middleware/avatarUpload');
const { RATE_LIMIT } = require('../config/constants');

const router = express.Router();

const shouldSkip = () => process.env.NODE_ENV === 'test';

// Building the archive touches every table the user owns, so it is far more
// expensive than an ordinary GET and gets its own tighter budget.
const exportLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOWS.ONE_HOUR,
  max: 5,
  skip: shouldSkip,
  message: {
    success: false,
    error: 'Too many export requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Deletion is irreversible and password-guarded; this limit exists to blunt
// brute-forcing the password confirmation, not to throttle legitimate use.
const deleteAccountLimiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOWS.FIFTEEN_MINUTES,
  max: 5,
  skip: shouldSkip,
  message: {
    success: false,
    error: 'Too many account deletion attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile management endpoints
 */

/**
 * @swagger
 * /api/users/quota:
 *   get:
 *     summary: Get remaining daily AI requests quota
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quota retrieved successfully
 */

/**
 * @swagger
 * /api/users/avatar:
 *   put:
 *     summary: Upload or replace the authenticated user's avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     avatar:
 *                       type: string
 *                       example: "/uploads/avatars/avatar-1a2b3c-169900.png"
 *       400:
 *         description: No file uploaded or invalid file type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Remove the authenticated user's avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Avatar removed successfully
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// Get remaining daily AI requests quota
router.get('/quota', protect, getQuota);
// Exam countdown preferences
router.get('/exam-countdown', protect, getExamCountdownPreferences);
router.put('/exam-countdown', protect, updateExamCountdownPreferences);
// Timezone preference (IANA)
router.put('/preferences/timezone', protect, updateTimezone);
// Dashboard custom layout persistence
router.get('/dashboard', protect, getDashboardLayout);
router.post('/dashboard', protect, updateDashboardLayout);
// Upload/replace the authenticated user's avatar
router.put('/avatar', protect, avatarUpload.single('avatar'), updateAvatar);

// Remove the authenticated user's avatar
router.delete('/avatar', protect, deleteAvatar);

/**
 * @swagger
 * /api/users/me/export:
 *   get:
 *     summary: Download a JSON archive of every piece of data the account owns
 *     description: >
 *       Returns a versioned archive containing the user's profile plus all
 *       owned notes, flashcards (with SM-2 scheduling state), quiz attempts,
 *       study plans, progress, gamification state, focus sessions and activity
 *       logs. Secrets (password hash, refresh tokens, reset tokens, encrypted
 *       OAuth tokens) are never included. Rows are capped per entity; anything
 *       truncated is listed in `meta.truncated`.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Archive generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 schemaVersion:
 *                   type: integer
 *                   example: 1
 *                 exportedAt:
 *                   type: string
 *                   format: date-time
 *                 profile:
 *                   type: object
 *                 data:
 *                   type: object
 *                 meta:
 *                   type: object
 *                   properties:
 *                     counts:
 *                       type: object
 *                     truncated:
 *                       type: array
 *                       items:
 *                         type: string
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many export requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/me/export', protect, exportLimiter, exportAccountData);

/**
 * @swagger
 * /api/users/me:
 *   delete:
 *     summary: Permanently delete the authenticated account and all owned data
 *     description: >
 *       Irreversible. Accounts with a password must re-enter it; accounts that
 *       authenticate only through an OAuth provider must instead send the exact
 *       confirmation phrase "DELETE MY ACCOUNT". All owned rows are removed in a
 *       single transaction and uploaded files are unlinked from disk.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: Required for accounts with a local password
 *               confirmation:
 *                 type: string
 *                 description: Required for OAuth-only accounts; must be "DELETE MY ACCOUNT"
 *     responses:
 *       200:
 *         description: Account deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                     deleted:
 *                       type: object
 *                     filesRemoved:
 *                       type: integer
 *       400:
 *         description: Missing password or incorrect confirmation phrase
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Not authenticated, or the supplied password was incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many deletion attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/me', protect, deleteAccountLimiter, deleteAccount);

// Multi-Channel External Notification Integrations (Discord Webhook & Telegram Bot)
const {
  updateNotificationIntegrations,
  testNotificationIntegration,
} = require('../controllers/notificationIntegrationController');

router.put('/notifications/integrations', protect, updateNotificationIntegrations);
router.post('/notifications/integrations/test', protect, testNotificationIntegration);

module.exports = router;
