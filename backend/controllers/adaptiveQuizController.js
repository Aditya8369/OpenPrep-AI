const crypto = require('crypto');
const {
  estimateAbilityEAP,
  selectNextOptimalQuestion,
  checkTerminationCriteria,
  thetaToPercentile,
  calculateFisherInformation,
} = require('../services/irtEngine');

// In-memory CAT session store (in production this hydrates/persists to database or Redis)
const catSessions = new Map();

/**
 * Standard calibrated item bank with difficulty (b), discrimination (a), and STEM domain topics.
 */
const DEFAULT_ITEM_BANK = [
  {
    id: 'q_001',
    subject: 'Mathematics',
    topic: 'Algebra',
    questionText: 'What is the solution to 2x + 7 = 15?',
    options: ['x = 3', 'x = 4', 'x = 5', 'x = 8'],
    correctOption: 1, // 'x = 4'
    difficulty: -2.2, // Very Easy
    discrimination: 1.1,
    explanation: 'Subtract 7 from both sides to get 2x = 8, then divide by 2 to get x = 4.',
  },
  {
    id: 'q_002',
    subject: 'Computer Science',
    topic: 'Basic Syntax',
    questionText: 'Which data structure follows a First-In-First-Out (FIFO) access order?',
    options: ['Stack', 'Queue', 'Binary Tree', 'Priority Heap'],
    correctOption: 1, // 'Queue'
    difficulty: -1.7, // Easy
    discrimination: 1.3,
    explanation: 'A Queue operates strictly on a FIFO (First-In, First-Out) principle.',
  },
  {
    id: 'q_003',
    subject: 'Physics',
    topic: 'Mechanics',
    questionText: 'According to Newton’s Second Law, force is the product of mass and which quantity?',
    options: ['Velocity', 'Acceleration', 'Displacement', 'Momentum'],
    correctOption: 1, // 'Acceleration'
    difficulty: -1.0, // Easy-Moderate
    discrimination: 1.2,
    explanation: 'F = m * a, where mass is multiplied by acceleration.',
  },
  {
    id: 'q_004',
    subject: 'Mathematics',
    topic: 'Calculus',
    questionText: 'What is the limit of (sin x) / x as x approaches 0?',
    options: ['0', '1', 'Infinity', 'Undefined'],
    correctOption: 1, // '1'
    difficulty: -0.2, // Moderate
    discrimination: 1.4,
    explanation: 'The fundamental trigonometric limit lim(x->0) (sin x)/x = 1.',
  },
  {
    id: 'q_005',
    subject: 'Computer Science',
    topic: 'Algorithms',
    questionText: 'What is the average time complexity of QuickSort on an array of length N?',
    options: ['O(N)', 'O(N log N)', 'O(N^2)', 'O(log N)'],
    correctOption: 1, // 'O(N log N)'
    difficulty: 0.1, // Moderate
    discrimination: 1.5,
    explanation: 'QuickSort has an expected average-case complexity of O(N log N).',
  },
  {
    id: 'q_006',
    subject: 'Mathematics',
    topic: 'Calculus',
    questionText: 'What is the derivative of f(x) = ln(3x^2 + 1) with respect to x?',
    options: ['6x / (3x^2 + 1)', '1 / (3x^2 + 1)', '6x', '3 / (3x^2 + 1)'],
    correctOption: 0, // '6x / (3x^2 + 1)'
    difficulty: 0.7, // Above Average
    discrimination: 1.6,
    explanation: 'By the chain rule: f\'(x) = (1 / (3x^2 + 1)) * d/dx(3x^2 + 1) = 6x / (3x^2 + 1).',
  },
  {
    id: 'q_007',
    subject: 'Physics',
    topic: 'Electromagnetism',
    questionText: 'Which Maxwell equation asserts that magnetic monopoles do not exist in classical electrodynamics?',
    options: ['Gauss\'s Law for Electricity', 'Gauss\'s Law for Magnetism (div B = 0)', 'Faraday\'s Law', 'Ampere-Maxwell Law'],
    correctOption: 1, // Gauss's Law for Magnetism
    difficulty: 1.3, // Hard
    discrimination: 1.7,
    explanation: 'div B = 0 states that the magnetic flux through any closed surface is zero, ruling out isolated monopoles.',
  },
  {
    id: 'q_008',
    subject: 'Computer Science',
    topic: 'Advanced Algorithms',
    questionText: 'Which algorithm finds all-pairs shortest paths in a weighted directed graph allowing negative edges (without negative cycles)?',
    options: ['Dijkstra', 'Floyd-Warshall', 'Kruskal', 'Prim'],
    correctOption: 1, // Floyd-Warshall
    difficulty: 1.8, // Hard
    discrimination: 1.8,
    explanation: 'Floyd-Warshall computes all-pairs shortest paths in O(V^3) time and supports negative edges.',
  },
  {
    id: 'q_009',
    subject: 'Mathematics',
    topic: 'Differential Geometry',
    questionText: 'What geometric invariant remains unchanged under local isometric deformations of a smooth surface (Theorema Egregium)?',
    options: ['Mean Curvature', 'Gaussian Curvature', 'Principal Directions', 'Normal Vector Field'],
    correctOption: 1, // Gaussian Curvature
    difficulty: 2.3, // Very Hard
    discrimination: 1.9,
    explanation: 'Gauss\'s Theorema Egregium states that the Gaussian curvature K is an intrinsic invariant preserved under local isometry.',
  },
  {
    id: 'q_010',
    subject: 'Computer Science',
    topic: 'Complexity Theory',
    questionText: 'If a problem L is in NP and every problem in NP can be polynomial-time reduced to L, L is classified as:',
    options: ['NP-Complete', 'NP-Hard only', 'P-Space', 'Undecidable'],
    correctOption: 0, // NP-Complete
    difficulty: 2.0, // Very Hard
    discrimination: 1.8,
    explanation: 'A decision problem is NP-Complete if it is both in NP and NP-Hard.',
  },
  {
    id: 'q_011',
    subject: 'Mathematics',
    topic: 'Linear Algebra',
    questionText: 'If a square matrix A has det(A) = 0, which statement is guaranteed to be true?',
    options: ['A is invertible', 'A has at least one eigenvalue equal to 0', 'Trace of A is 0', 'A is symmetric'],
    correctOption: 1, // eigenvalue equal to 0
    difficulty: 0.4, // Moderate
    discrimination: 1.4,
    explanation: 'det(A) equals the product of its eigenvalues, so det(A) = 0 implies at least one eigenvalue is zero.',
  },
  {
    id: 'q_012',
    subject: 'Physics',
    topic: 'Quantum Mechanics',
    questionText: 'In the time-independent Schrödinger equation Hψ = Eψ, what operator does H represent?',
    options: ['Hamiltonian (Total Energy)', 'Lagrangian', 'Momentum Operator', 'Position Operator'],
    correctOption: 0, // Hamiltonian
    difficulty: 1.1, // Hard
    discrimination: 1.6,
    explanation: 'The Hamiltonian operator H represents the sum of kinetic and potential energy operators.',
  },
];

/**
 * Strips confidential answer keys from question object before sending to client.
 */
function sanitizeQuestionForClient(q) {
  if (!q) return null;
  const { correctOption, explanation, ...sanitized } = q;
  return sanitized;
}

/**
 * POST /api/quiz/adaptive/start
 * Initializes a new Computerized Adaptive Testing session.
 */
async function startAdaptiveQuiz(req, res) {
  try {
    const userId = req.user ? req.user.id : (req.body.userId || 'guest_user');
    const subject = req.body.subject || null;
    const initialTheta = Number(req.body.initialTheta) || 0.0; // Neutral prior
    const targetSEM = Number(req.body.targetSEM) || 0.30;
    const maxQuestions = Number(req.body.maxQuestions) || 10;
    const minQuestions = Number(req.body.minQuestions) || 5;

    const sessionId = `cat_${crypto.randomUUID()}`;

    // Filter question pool by subject if specified
    const questionPool = subject
      ? DEFAULT_ITEM_BANK.filter(q => q.subject.toLowerCase() === subject.toLowerCase())
      : DEFAULT_ITEM_BANK;

    const pool = questionPool.length >= 5 ? questionPool : DEFAULT_ITEM_BANK;

    // Pick first question maximizing Fisher info at initialTheta
    const firstQuestion = selectNextOptimalQuestion(pool, [], initialTheta);

    const session = {
      sessionId,
      userId,
      subject: subject || 'All Topics',
      theta: initialTheta,
      sem: 1.0,
      totalInformation: 1.0,
      responses: [],
      administeredQuestionIds: firstQuestion ? [firstQuestion.id] : [],
      trajectory: [
        {
          questionNumber: 0,
          theta: initialTheta,
          sem: 1.0,
          difficulty: null,
          isCorrect: null,
        },
      ],
      targetSEM,
      minQuestions,
      maxQuestions,
      isFinished: false,
      startTime: Date.now(),
      questionPool: pool,
    };

    catSessions.set(sessionId, session);

    return res.status(201).json({
      success: true,
      sessionId,
      theta: session.theta,
      sem: session.sem,
      questionNumber: 1,
      maxQuestions: session.maxQuestions,
      question: sanitizeQuestionForClient(firstQuestion),
    });
  } catch (error) {
    console.error('[adaptiveQuizController] startAdaptiveQuiz error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to initiate adaptive quiz session.',
    });
  }
}

/**
 * POST /api/quiz/adaptive/respond
 * Processes user answer, updates ability estimate theta and SEM, and fetches next optimal question.
 */
async function submitAdaptiveResponse(req, res) {
  try {
    const { sessionId, questionId, selectedOption } = req.body;

    if (!sessionId || questionId === undefined || selectedOption === undefined) {
      return res.status(400).json({
        success: false,
        error: 'sessionId, questionId, and selectedOption are required.',
      });
    }

    const session = catSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Adaptive testing session not found or expired.',
      });
    }

    if (session.isFinished) {
      return res.status(400).json({
        success: false,
        error: 'Adaptive testing session is already completed.',
      });
    }

    // Lookup current question from pool
    const currentQuestion = session.questionPool.find(q => String(q.id) === String(questionId));
    if (!currentQuestion) {
      return res.status(400).json({
        success: false,
        error: 'Question not found in active session bank.',
      });
    }

    const isCorrect = Number(selectedOption) === currentQuestion.correctOption;

    // Record response item
    const responseRecord = {
      questionId: currentQuestion.id,
      difficulty: currentQuestion.difficulty,
      discrimination: currentQuestion.discrimination,
      correct: isCorrect,
    };
    session.responses.push(responseRecord);

    // Run Bayesian EAP ability estimation
    const updatedEstimate = estimateAbilityEAP(session.responses);
    session.theta = updatedEstimate.theta;
    session.sem = updatedEstimate.sem;
    session.totalInformation = updatedEstimate.totalInformation;

    // Track trajectory
    session.trajectory.push({
      questionNumber: session.responses.length,
      questionId: currentQuestion.id,
      difficulty: currentQuestion.difficulty,
      isCorrect,
      theta: session.theta,
      sem: session.sem,
      timestamp: Date.now(),
    });

    // Check stopping rule
    const termination = checkTerminationCriteria(session, {
      targetSEM: session.targetSEM,
      minQuestions: session.minQuestions,
      maxQuestions: session.maxQuestions,
    });

    let nextQuestion = null;
    if (termination.isFinished) {
      session.isFinished = true;
      session.finishReason = termination.reason;
    } else {
      nextQuestion = selectNextOptimalQuestion(
        session.questionPool,
        session.administeredQuestionIds,
        session.theta
      );

      if (nextQuestion) {
        session.administeredQuestionIds.push(nextQuestion.id);
      } else {
        session.isFinished = true;
        session.finishReason = 'QUESTION_POOL_EXHAUSTED';
      }
    }

    catSessions.set(sessionId, session);

    return res.status(200).json({
      success: true,
      isCorrect,
      explanation: currentQuestion.explanation,
      theta: session.theta,
      sem: session.sem,
      questionNumber: session.responses.length + (session.isFinished ? 0 : 1),
      isFinished: session.isFinished,
      finishReason: session.finishReason || null,
      nextQuestion: sanitizeQuestionForClient(nextQuestion),
      trajectory: session.trajectory,
    });
  } catch (error) {
    console.error('[adaptiveQuizController] submitAdaptiveResponse error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record adaptive response.',
    });
  }
}

/**
 * POST /api/quiz/adaptive/finish
 * Finalizes adaptive quiz session and returns calibrated score, percentile, and mastery analysis.
 */
async function finishAdaptiveQuiz(req, res) {
  try {
    const { sessionId } = req.body;
    const session = catSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Adaptive testing session not found.',
      });
    }

    session.isFinished = true;
    const totalAnswered = session.responses.length;
    const correctCount = session.responses.filter(r => r.correct).length;
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const percentile = thetaToPercentile(session.theta);

    // Subject and topic mastery breakdown
    const topicStats = {};
    session.responses.forEach(r => {
      const q = session.questionPool.find(item => item.id === r.questionId);
      const topicName = q ? q.topic : 'General';
      if (!topicStats[topicName]) {
        topicStats[topicName] = { total: 0, correct: 0 };
      }
      topicStats[topicName].total++;
      if (r.correct) topicStats[topicName].correct++;
    });

    const masteryBreakdown = Object.entries(topicStats).map(([topic, stats]) => ({
      topic,
      total: stats.total,
      correct: stats.correct,
      percentage: Math.round((stats.correct / stats.total) * 100),
    }));

    return res.status(200).json({
      success: true,
      sessionId,
      finalTheta: session.theta,
      finalSEM: session.sem,
      percentile,
      totalAnswered,
      correctCount,
      accuracy,
      trajectory: session.trajectory,
      masteryBreakdown,
      elapsedSeconds: Math.round((Date.now() - session.startTime) / 1000),
    });
  } catch (error) {
    console.error('[adaptiveQuizController] finishAdaptiveQuiz error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to finalize adaptive testing session.',
    });
  }
}

/**
 * Backward compatibility handler for legacy adaptive question queries.
 */
async function getNextAdaptiveQuestion(req, res, next) {
  try {
    const { currentStreak, streakType, currentDifficulty, answeredQuestionIds } = req.body;

    let nextDifficulty = currentDifficulty || 'Medium';

    if (currentStreak >= 3) {
      if (streakType === 'correct' && currentDifficulty === 'Easy') nextDifficulty = 'Medium';
      else if (streakType === 'correct' && currentDifficulty === 'Medium') nextDifficulty = 'Hard';
      else if (streakType === 'incorrect' && currentDifficulty === 'Hard') nextDifficulty = 'Medium';
      else if (streakType === 'incorrect' && currentDifficulty === 'Medium') nextDifficulty = 'Easy';
    }

    const available = DEFAULT_ITEM_BANK.filter(q => !answeredQuestionIds?.includes(q.id));
    const question = available[0] || DEFAULT_ITEM_BANK[0];

    return res.status(200).json({
      success: true,
      difficulty: nextDifficulty,
      question,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  startAdaptiveQuiz,
  submitAdaptiveResponse,
  finishAdaptiveQuiz,
  getNextAdaptiveQuestion,
  catSessions,
  DEFAULT_ITEM_BANK,
};
