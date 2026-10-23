const express = require('express');
const router = express.Router();
const { evaluateSubmission } = require('../services/rubricEvaluatorService');
const { lintCodeSubmission } = require('../services/codeLintService');
const { protect } = require('../middleware/auth');

/**
 * @route   POST /api/evaluator/evaluate
 * @desc    Evaluate student subjective essay or code against structured rubric
 * @access  Private / Public demo
 */
router.post('/evaluate', async (req, res, next) => {
  try {
    const { questionPrompt, studentSubmission, scoringRubric = [] } = req.body;

    if (!questionPrompt) {
      return res.status(400).json({ success: false, error: 'questionPrompt is required' });
    }

    const result = await evaluateSubmission({
      questionPrompt,
      studentSubmission,
      scoringRubric,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/evaluator/lint
 * @desc    Run static analysis and time/space complexity analysis on code submission
 * @access  Private / Public demo
 */
router.post('/lint', (req, res, next) => {
  try {
    const { code, language = 'javascript' } = req.body;

    if (!code && code !== '') {
      return res.status(400).json({ success: false, error: 'code string is required' });
    }

    const result = lintCodeSubmission({ code, language });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
