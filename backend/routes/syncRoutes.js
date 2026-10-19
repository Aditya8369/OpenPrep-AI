const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { protect } = require('../middleware/auth');

/**
 * @swagger
 * /api/sync/batch:
 *   post:
 *     summary: Process batch of offline queued mutations with LWW conflict resolution
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 */
router.post('/batch', protect, syncController.processBatchSync);

module.exports = router;
