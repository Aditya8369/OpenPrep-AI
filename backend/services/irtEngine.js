/**
 * 2-Parameter Logistic Item Response Theory (2PL-IRT) Engine
 * Implements Bayesian EAP ability estimation, Fisher Information maximization,
 * CAT stopping rules, and percentile calibration.
 */

// Quadrature points for numerical integration in EAP (41 points from -4.0 to +4.0)
const QUAD_POINTS = [];
const QUAD_WEIGHTS = [];
const NUM_POINTS = 41;
const MIN_THETA = -4.0;
const MAX_THETA = 4.0;
const STEP = (MAX_THETA - MIN_THETA) / (NUM_POINTS - 1);

for (let i = 0; i < NUM_POINTS; i++) {
  const x = MIN_THETA + i * STEP;
  QUAD_POINTS.push(x);
  // Standard normal prior density phi(x)
  const weight = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x) * STEP;
  QUAD_WEIGHTS.push(weight);
}

/**
 * 2PL-IRT Probability of a correct response: P(theta) = 1 / (1 + exp(-a * (theta - b)))
 * @param {number} theta - Student latent ability (-3.0 to +3.0)
 * @param {number} b - Item difficulty (-3.0 to +3.0)
 * @param {number} [a=1.0] - Item discrimination (0.5 to 2.5)
 * @returns {number} Probability between 0 and 1
 */
function calculateProbability(theta, b, a = 1.0) {
  const z = a * (theta - b);
  // Prevent overflow / underflow
  if (z > 35) return 1.0;
  if (z < -35) return 0.0;
  return 1 / (1 + Math.exp(-z));
}

/**
 * Calculates Fisher Information for a single item at a given theta:
 * I(theta) = a^2 * P(theta) * (1 - P(theta))
 * @param {number} theta 
 * @param {number} b 
 * @param {number} [a=1.0] 
 * @returns {number}
 */
function calculateFisherInformation(theta, b, a = 1.0) {
  const p = calculateProbability(theta, b, a);
  const q = 1 - p;
  return a * a * p * q;
}

/**
 * Expected A Posteriori (EAP) Bayesian ability estimation.
 * Provides stable, bounded ability estimates even on pure 0s or pure 1s.
 * 
 * @param {Array<{ difficulty: number, discrimination?: number, correct: boolean|number }>} responses 
 * @returns {{ theta: number, sem: number, totalInformation: number }}
 */
function estimateAbilityEAP(responses = []) {
  if (!responses || responses.length === 0) {
    return {
      theta: 0.0,
      sem: 1.0, // Standard error of prior distribution N(0, 1)
      totalInformation: 1.0,
    };
  }

  // Pre-calculate likelihood at each quadrature point
  const likelihoods = new Float64Array(NUM_POINTS);

  for (let k = 0; k < NUM_POINTS; k++) {
    const qTheta = QUAD_POINTS[k];
    let logLikelihood = 0;

    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i];
      const a = Number(resp.discrimination) || 1.0;
      const b = Number(resp.difficulty) || 0.0;
      const isCorrect = resp.correct === true || resp.correct === 1;

      const p = calculateProbability(qTheta, b, a);
      const safeP = Math.max(1e-12, Math.min(1 - 1e-12, p));

      logLikelihood += isCorrect ? Math.log(safeP) : Math.log(1 - safeP);
    }

    // Likelihood with numerical stability clamping
    likelihoods[k] = Math.exp(Math.max(-700, Math.min(700, logLikelihood)));
  }

  // Compute posterior mean (EAP theta)
  let numerator = 0;
  let denominator = 0;

  for (let k = 0; k < NUM_POINTS; k++) {
    const product = likelihoods[k] * QUAD_WEIGHTS[k];
    numerator += QUAD_POINTS[k] * product;
    denominator += product;
  }

  if (denominator <= 0 || !isFinite(denominator)) {
    return { theta: 0.0, sem: 1.0, totalInformation: 1.0 };
  }

  const thetaEAP = numerator / denominator;

  // Compute posterior variance & SEM
  let varNumerator = 0;
  for (let k = 0; k < NUM_POINTS; k++) {
    const diff = QUAD_POINTS[k] - thetaEAP;
    varNumerator += diff * diff * likelihoods[k] * QUAD_WEIGHTS[k];
  }

  const variance = Math.max(0.01, varNumerator / denominator);
  const sem = Math.sqrt(variance);

  // Calculate empirical test information sum at estimated theta
  let totalInfo = 0;
  responses.forEach(resp => {
    const a = Number(resp.discrimination) || 1.0;
    const b = Number(resp.difficulty) || 0.0;
    totalInfo += calculateFisherInformation(thetaEAP, b, a);
  });

  return {
    theta: Math.round(thetaEAP * 1000) / 1000,
    sem: Math.round(sem * 1000) / 1000,
    totalInformation: Math.round(totalInfo * 1000) / 1000,
  };
}

/**
 * Selects the next optimal question from the pool that maximizes Fisher Information at current theta.
 * 
 * @param {Array<object>} questionPool - Available items with difficulty (b) and discrimination (a)
 * @param {Array<string|number>} answeredQuestionIds - Items already administered
 * @param {number} currentTheta - Current estimated latent ability
 * @returns {object|null} Next optimal question item
 */
function selectNextOptimalQuestion(questionPool = [], answeredQuestionIds = [], currentTheta = 0.0) {
  const answeredSet = new Set(answeredQuestionIds.map(String));
  const availableItems = questionPool.filter(q => !answeredSet.has(String(q.id)));

  if (availableItems.length === 0) return null;

  let bestItem = null;
  let maxInformation = -Infinity;

  for (const item of availableItems) {
    const b = Number(item.difficulty ?? item.b ?? 0.0);
    const a = Number(item.discrimination ?? item.a ?? 1.2);
    const info = calculateFisherInformation(currentTheta, b, a);

    if (info > maxInformation) {
      maxInformation = info;
      bestItem = item;
    }
  }

  return bestItem;
}

/**
 * Checks CAT stopping criteria.
 * Stops when:
 * 1. Standard Error of Measurement (SEM) <= targetSEM (default 0.30) AND answered >= minQuestions
 * 2. Or answered >= maxQuestions (default 15)
 * 3. Or question bank is exhausted
 * 
 * @param {object} session
 * @param {object} [options]
 * @returns {{ isFinished: boolean, reason: string }}
 */
function checkTerminationCriteria(session, options = {}) {
  const targetSEM = options.targetSEM || 0.30;
  const minQuestions = options.minQuestions || 5;
  const maxQuestions = options.maxQuestions || 15;

  const answeredCount = session.responses ? session.responses.length : 0;
  const currentSEM = session.sem !== undefined ? session.sem : 1.0;

  if (answeredCount >= maxQuestions) {
    return { isFinished: true, reason: 'MAX_QUESTIONS_REACHED' };
  }

  if (answeredCount >= minQuestions && currentSEM <= targetSEM) {
    return { isFinished: true, reason: 'CONVERGENCE_ACHIEVED' };
  }

  return { isFinished: false, reason: 'IN_PROGRESS' };
}

/**
 * Converts latent ability theta (-3.0 to +3.0) to percentile rank (0 to 100).
 * Standard Gaussian cumulative distribution function.
 * @param {number} theta 
 * @returns {number} Percentile integer between 1 and 99
 */
function thetaToPercentile(theta) {
  // Approximate standard normal CDF
  const t = theta;
  const z = t / Math.sqrt(2);
  // Abramowitz and Stegun erf approximation
  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z);
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const k = 1 / (1 + p * absZ);
  const erf = 1 - ((((a5 * k + a4) * k + a3) * k + a2) * k + a1) * k * Math.exp(-absZ * absZ);
  const cdf = 0.5 * (1 + sign * erf);

  const percentile = Math.round(cdf * 100);
  return Math.max(1, Math.min(99, percentile));
}

module.exports = {
  calculateProbability,
  calculateFisherInformation,
  estimateAbilityEAP,
  selectNextOptimalQuestion,
  checkTerminationCriteria,
  thetaToPercentile,
};
