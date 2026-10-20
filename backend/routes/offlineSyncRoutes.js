const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { protect } = require('../middleware/auth');

// Allow both authenticated and optional token for backward compatibility
router.post('/batch', (req, res, next) => {
  if (req.headers.authorization || req.cookies?.token) {
    return protect(req, res, next);
  }
  next();
}, syncController.processBatchSync);

module.exports = router;
