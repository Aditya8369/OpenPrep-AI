const { body, param, query, validationResult } = require('express-validator');

// ---------------------------------------------------------------------------
// Shared: format validation errors consistently with project error format
// ---------------------------------------------------------------------------
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((err) => err.msg);
    return res.status(400).json({
      success: false,
      error: messages.join(', '),
    });
  }
  next();
};

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character'),
  handleValidationErrors,
];

const validateLogin = [
  body('email').trim().isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Please provide a password'),
  handleValidationErrors,
];

const validateForgotPassword = [
  body('email').trim().isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  handleValidationErrors,
];

const validateResetPassword = [
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character'),
  handleValidationErrors,
];

const validateRefreshToken = [
  (req, res, next) => {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!rawToken) {
      return res.status(400).json({ success: false, error: 'Refresh token is required' });
    }
    next();
  }
];

const validateResendVerification = [
  body('email').trim().isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  handleValidationErrors,
];

const validateUpdateSettings = [
  body('leaderboardVisible')
    .optional()
    .isBoolean()
    .withMessage('leaderboardVisible must be a boolean'),
  body('receiveWeeklyDigest')
    .optional()
    .isBoolean()
    .withMessage('receiveWeeklyDigest must be a boolean'),
  body('hideActivityFromSquad')
    .optional()
    .isBoolean()
    .withMessage('hideActivityFromSquad must be a boolean'),
  handleValidationErrors,
];
const validateVerifyOtp = [
  body('email').trim().isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits').isNumeric().withMessage('OTP must be numeric'),
  handleValidationErrors,
];

const validateResetPasswordOtp = [
  body('email').trim().isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits').isNumeric().withMessage('OTP must be numeric'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character'),
  handleValidationErrors,
];

// ---------------------------------------------------------------------------
// Academic routes
// ---------------------------------------------------------------------------
const validateCreateExam = [
  body('name').trim().notEmpty().withMessage('Please provide an exam name'),
  handleValidationErrors,
];

const validateCreateSubject = [
  body('name').trim().notEmpty().withMessage('Please provide a subject name'),
  body('examId').isUUID(4).withMessage('Valid exam ID is required'),
  handleValidationErrors,
];

const validateCreateTopic = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Please provide a topic name')
    .isLength({ max: 100 })
    .withMessage('Topic name must not exceed 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,()&'/]+$/)
    .withMessage('Topic name contains invalid characters')
    .custom((value) => {
      const forbiddenPhrases = [
        'ignore previous instructions',
        'ignore instructions',
        'ignore the instructions',
        'system prompt',
        'bypass instructions',
        'you are now',
        'act as',
        'ignore above',
        'ignore below'
      ];
      const normalized = value.toLowerCase();
      for (const phrase of forbiddenPhrases) {
        if (normalized.includes(phrase)) {
          throw new Error('Invalid topic name format or suspected prompt injection');
        }
      }
      return true;
    }),
  body('subjectId').isUUID(4).withMessage('Valid subject ID is required'),
  handleValidationErrors,
];

const validateUpdateTopic = [
  body('status')
    .optional()
    .isIn(['Weak', 'Medium', 'Strong'])
    .withMessage('Status must be one of: Weak, Medium, Strong'),
  body('weightage')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Weightage must be a non-negative number'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Topic name must not exceed 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,()&'/]+$/)
    .withMessage('Topic name contains invalid characters')
    .custom((value) => {
      const forbiddenPhrases = [
        'ignore previous instructions',
        'ignore instructions',
        'ignore the instructions',
        'system prompt',
        'bypass instructions',
        'you are now',
        'act as',
        'ignore above',
        'ignore below'
      ];
      const normalized = value.toLowerCase();
      for (const phrase of forbiddenPhrases) {
        if (normalized.includes(phrase)) {
          throw new Error('Invalid topic name format or suspected prompt injection');
        }
      }
      return true;
    }),
  handleValidationErrors,
];

// ---------------------------------------------------------------------------
// Flashcard routes
// ---------------------------------------------------------------------------
const validateGenerateAIFlashcards = [
  body('subjectId').isUUID(4).withMessage('Valid subject ID is required'),
  body('count').optional().isInt({ min: 1, max: 50 }).withMessage('Count must be between 1 and 50'),
  handleValidationErrors,
];

const validateGenerateFlashcardsFromNote = [
  body('noteId').isUUID(4).withMessage('Valid note ID is required'),
  body('count').optional().isInt({ min: 1, max: 50 }).withMessage('Count must be between 1 and 50'),
  handleValidationErrors,
];

const validateGenerateFlashcardsFromYouTube = [
  body('youtubeUrl')
    .trim()
    .notEmpty()
    .withMessage('Please provide a YouTube video URL')
    .matches(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i)
    .withMessage('Please provide a valid YouTube URL'),
  body('subjectId').optional().isUUID(4).withMessage('Valid subject ID is required'),
  body('topicId').optional().isUUID(4).withMessage('Valid topic ID is required'),
  body('count')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Count must be between 1 and 50'),
  handleValidationErrors,
];
const validateCreateFlashcard = [  body('front').trim().notEmpty().withMessage('Please provide the front text'),
  body('back').trim().notEmpty().withMessage('Please provide the back text'),
  body('subjectId').isUUID(4).withMessage('Valid subject ID is required'),
  handleValidationErrors,
];

const validateAutoTagFlashcard = [
  body('front').trim().notEmpty().withMessage('Please provide the front text'),
  body('back').trim().notEmpty().withMessage('Please provide the back text'),
  handleValidationErrors,
];
const validateReviewFlashcard = [
  body('quality')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Quality must be a number between 0 and 5'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 4 })
    .withMessage('Rating must be an integer between 1 and 4 (Again: 1, Hard: 2, Good: 3, Easy: 4)'),
  body().custom((val) => {
    if (val.quality === undefined && val.rating === undefined) {
      throw new Error('Either rating (1-4) or quality (0-5) must be provided');
    }
    return true;
  }),
  body('confidence')
    .optional()
    .isIn(['very_unsure', 'unsure', 'confident', 'very_confident'])
    .withMessage('Confidence must be one of: very_unsure, unsure, confident, very_confident'),
  handleValidationErrors,
];

const validateExportFlashcards = [
  query('format')
    .optional()
    .isIn(['json', 'csv', 'apkg'])
    .withMessage('format must be "json", "csv", or "apkg"'),
  query('subjectId').optional().isUUID(4).withMessage('subjectId must be a valid UUID'),
  handleValidationErrors,
];

const validateImportFlashcards = [
  query('subjectId')
    .notEmpty()
    .withMessage('subjectId query parameter is required')
    .isUUID(4)
    .withMessage('subjectId must be a valid UUID'),
  handleValidationErrors,
];

// ---------------------------------------------------------------------------
// Quiz routes
// ---------------------------------------------------------------------------
const validateGenerateAIQuiz = [
  body('subjectId').isUUID(4).withMessage('Valid subject ID is required'),
  body('count').optional().isInt({ min: 1, max: 50 }).withMessage('Count must be between 1 and 50'),
  handleValidationErrors,
];

const validateGenerateRevisionSheet = [
  body('quizAttemptId').optional().isUUID().withMessage('quizAttemptId must be a valid UUID'),
  body('subjectId').optional().isUUID().withMessage('subjectId must be a valid UUID'),
  body('topicId').optional().isUUID().withMessage('topicId must be a valid UUID'),
  body('mistookQuestions').optional().isArray().withMessage('mistookQuestions must be an array'),
  body('saveToNotes').optional().isBoolean().withMessage('saveToNotes must be a boolean'),
  handleValidationErrors,
];

const validateGenerateRemediationPlan = [
  body('quizAttemptId')
    .optional()
    .isUUID()
    .withMessage('quizAttemptId must be a valid UUID'),
  body('subjectId')
    .optional()
    .isUUID()
    .withMessage('subjectId must be a valid UUID'),
  body('topicId')
    .optional()
    .isUUID()
    .withMessage('topicId must be a valid UUID'),
  body('mistookQuestions')
    .optional()
    .isArray()
    .withMessage('mistookQuestions must be an array'),
  body('weakTopics')
    .optional()
    .isArray()
    .withMessage('weakTopics must be an array'),
  body('saveToNotes')
    .optional()
    .isBoolean()
    .withMessage('saveToNotes must be a boolean'),
  handleValidationErrors,
];

const validateEvaluateSubjective = [
  body('questionId').optional().isUUID().withMessage('questionId must be a valid UUID'),
  body('userAnswerText').isString().withMessage('userAnswerText must be a string'),
  handleValidationErrors,
];

const validateGenerateRemediationQuiz = [
  body('deckId').isUUID(4).withMessage('Valid deck (subject) ID is required'),
  body('failedCardIds')
    .isArray({ min: 2 })
    .withMessage('failedCardIds must be an array with at least 2 card IDs'),
  body('failedCardIds.*').isUUID(4).withMessage('Each failedCardId must be a valid UUID'),
  body('count')
    .optional()
    .isInt({ min: 5, max: 10 })
    .withMessage('count must be between 5 and 10'),
  handleValidationErrors,
];


const validateSubmitQuizAttempt = [
  body('answers').isArray({ min: 1 }).withMessage('Answers must be a non-empty array'),
  body('answers.*.questionId')
    .notEmpty()
    .withMessage('Each answer must have a questionId')
    .isUUID(4)
    .withMessage('Each questionId must be a valid UUID'),
  body('answers.*.selectedAnswer')
    .isInt({ min: 0, max: 3 })
    .withMessage('Each answer must have a valid selectedAnswer option index'),
  body('timeSpent')
    .optional()
    .isFloat({ min: 0, max: 86400 })
    .withMessage('timeSpent must be a non-negative number no greater than 86400 (24 hours)'),
  handleValidationErrors,
];

// ---------------------------------------------------------------------------
// AI routes
// ---------------------------------------------------------------------------
const validateGenerateMindMap = [
  body('noteId').optional().isUUID().withMessage('noteId must be a valid UUID'),
  body('subjectId').optional().isUUID().withMessage('subjectId must be a valid UUID'),
  body('topicId').optional().isUUID().withMessage('topicId must be a valid UUID'),
  body('textContext').optional().isString().withMessage('textContext must be a string'),
  handleValidationErrors,
];

const validateExplainQuestion = [
  body('question')
    .trim()
    .notEmpty()
    .withMessage('Question text is required')
    .isLength({ max: 2000 })
    .withMessage('Question text must be at most 2000 characters'),
  body('options')
    .isArray({ min: 2, max: 6 })
    .withMessage('Options must be an array of 2 to 6 choices'),
  body('options.*')
    .isString()
    .withMessage('Each option must be a string')
    .notEmpty()
    .withMessage('Each option must be non-empty')
    .isLength({ max: 500 })
    .withMessage('Each option must be at most 500 characters'),
  body('correctAnswer')
    .exists()
    .withMessage('correctAnswer is required')
    .custom((value, { req }) => {
      const options = req.body.options;
      if (!Array.isArray(options)) return true; // options rule handles this case
      const idx = typeof value === 'number' ? value : options.indexOf(value);
      if (!Number.isInteger(idx) || idx < 0 || idx >= options.length) {
        throw new Error(
          'correctAnswer must be a valid option index or one of the provided options'
        );
      }
      return true;
    }),
  body('userAnswer')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      const options = req.body.options;
      if (!Array.isArray(options)) return true; // options rule handles this case
      if (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 0 &&
        value < options.length
      ) {
        return true;
      }
      if (typeof value === 'string' && options.includes(value)) {
        return true;
      }
      throw new Error(
        'userAnswer must be a valid option index, one of the provided options, or null'
      );
    }),
  body('mode').optional().isIn(['hint', 'full']).withMessage('mode must be "hint" or "full"'),
  body('explanation')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Explanation must be at most 2000 characters'),
  body('subjectName')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('subjectName must be at most 200 characters'),
  body('topicName')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('topicName must be at most 200 characters'),
  handleValidationErrors,
];

const validateToggleQuizBookmark = [
  body('quizId').optional().isUUID(4).withMessage('Valid quiz ID is required'),
  handleValidationErrors,
];

// ---------------------------------------------------------------------------
// Note routes
// ---------------------------------------------------------------------------
const validateUploadNote = [
  body('title').trim().notEmpty().withMessage('Please provide a note title'),
  body('subjectId').isUUID(4).withMessage('Valid subject ID is required'),
  body('content').optional().trim(),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
  handleValidationErrors,
];

const validateImportNotes = [
  body('subjectId').isUUID(4).withMessage('Valid subject ID is required'),
  body('topicId').optional().isUUID(4).withMessage('Valid topic ID is required'),
  handleValidationErrors,
];
// ---------------------------------------------------------------------------
// PYQ routes
// ---------------------------------------------------------------------------
const validateUploadPYQ = [
  body('subjectId').isUUID(4).withMessage('Valid subject ID is required'),
  body('year').optional().isInt({ min: 1900, max: 2100 }).withMessage('Year must be a valid year'),
  body('difficulty')
    .optional()
    .isIn(['Easy', 'Medium', 'Hard'])
    .withMessage('Difficulty must be "Easy", "Medium", or "Hard"'),
  handleValidationErrors,
];

const validateGetPYQClusters = [
  param('subjectId').isUUID(4).withMessage('Valid subject ID is required'),
  handleValidationErrors,
];
// ---------------------------------------------------------------------------
// Study Plan routes// ---------------------------------------------------------------------------
const validateGenerateAIPlan = [
  body('examId').isUUID(4).withMessage('Valid exam ID is required'),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid ISO date')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('studyHoursPerDay')
    .optional()
    .isFloat({ min: 0.5, max: 24 })
    .withMessage('Study hours per day must be between 0.5 and 24'),
  handleValidationErrors,
];

const validateToggleTask = [
  body('completed').optional().isBoolean().withMessage('Completed must be a boolean'),
  body('studyTimeMinutes')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Study time must be a non-negative number'),
  handleValidationErrors,
];

const validateMoveTaskDate = [
  body('newDate').isISO8601().withMessage('A valid newDate is required'),
  handleValidationErrors,
];
// ---------------------------------------------------------------------------
// Progress routes
// ---------------------------------------------------------------------------
const validateTrackStudyTime = [
  body('studyHours').isFloat({ min: 0.01 }).withMessage('Study hours must be a positive number'),
  body('subjectId').optional().isUUID(4).withMessage('Subject ID must be a valid UUID'),
  body('topicId').optional().isUUID(4).withMessage('Topic ID must be a valid UUID'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be at most 500 characters'),
  handleValidationErrors,
];

const validateFocusSession = [
  body('activeSeconds')
    .isInt({ min: 0 })
    .withMessage('Active seconds must be a non-negative integer'),
  body('pausedSeconds')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Paused seconds must be a non-negative integer'),
  body('interruptions')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Interruptions must be a non-negative integer'),
  body('subjectId').optional().isUUID(4).withMessage('Subject ID must be a valid UUID'),
  handleValidationErrors,
];

const validateUpdateTopicProgress = [
  body('completionPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Completion percentage must be between 0 and 100'),
  body('studyHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Study hours must be a non-negative number'),
  body('flashcardsMastered')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Flashcards mastered must be a non-negative integer'),
  body('quizScores').optional().isArray().withMessage('Quiz scores must be an array'),
  handleValidationErrors,
];

// ---------------------------------------------------------------------------
// Community routes
// ---------------------------------------------------------------------------
const validateSubmitFeedback = [
  body('title').trim().notEmpty().withMessage('Please provide a feedback title'),
  body('description').trim().notEmpty().withMessage('Please provide a description'),
  body('type')
    .trim()
    .isIn(['bug', 'feature_request'])
    .withMessage('Type must be either "bug" or "feature_request"'),
  handleValidationErrors,
];

module.exports = {
  // Auth
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateRefreshToken,
  validateUpdateSettings,
  // Academic
  validateCreateExam,
  validateCreateSubject,
  validateCreateTopic,
  validateUpdateTopic,
// Flashcard
validateGenerateAIFlashcards,
  validateGenerateFlashcardsFromNote,
  validateGenerateFlashcardsFromYouTube,validateCreateFlashcard,  validateReviewFlashcard,
  validateAutoTagFlashcard,
  validateExportFlashcards,
  validateImportFlashcards, // Quiz
  validateGenerateAIQuiz,
  validateExplainQuestion,
  validateEvaluateSubjective,
  validateGenerateRevisionSheet,
  validateGenerateRemediationPlan,
  validateGenerateRemediationQuiz,
  validateSubmitQuizAttempt,
  validateToggleQuizBookmark,
// Note
  validateUploadNote,
  validateImportNotes,
// PYQ
  validateUploadPYQ,
  validateGetPYQClusters,// Study Plan
  validateGenerateAIPlan,
  validateToggleTask,
  validateMoveTaskDate, // Progress
  validateTrackStudyTime,
  validateUpdateTopicProgress,
  validateFocusSession, // Community
  validateSubmitFeedback,
  validateGenerateMindMap,
  validateResendVerification,
  validateVerifyOtp,
  validateResetPasswordOtp,
};
