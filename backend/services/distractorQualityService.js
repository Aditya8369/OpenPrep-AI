/**
 * @fileoverview Scores the distractors of a generated MCQ on a 0-1 scale so the
 * generation pipeline can decide whether to ask the model for a better set.
 *
 * The length/format symmetry, clue leakage and numeric misconception checks
 * come from distractorScorerService. This module adds an option overlap
 * (mutual exclusivity) check and an answer type check, then combines all of
 * them into one weighted score. Everything here is synchronous heuristics, so
 * scoring adds no extra model calls.
 */

const {
  evaluateGrammarAndSymmetry,
  evaluateClueLeakage,
  evaluateNumericDistractorHeuristics,
} = require('./distractorScorerService');

const QUALITY_THRESHOLD = 0.75;

const WEIGHTS = { symmetry: 0.3, leakage: 0.25, distinctness: 0.25, plausibility: 0.2 };

const OVERLAP_PENALTY = 35;
const OVERLAP_SIMILARITY = 0.8;

// Plausibility for a text distractor when the heuristics have nothing to say
// about it either way. Kept below 100 so text questions are not over-rewarded.
const NEUTRAL_PLAUSIBILITY = 80;
const TYPE_MISMATCH_PLAUSIBILITY = 30;
// evaluateNumericDistractorHeuristics gives 70 to a number that matches none of
// its known slips (sign flip, factor of 2, off-by-one, power of 10).
const UNRELATED_NUMBER_SCORE = 70;

const MISCONCEPTION_GUIDELINES = [
  'Make every wrong option reflect a real student mistake (forgotten minus sign, inverted fraction, wrong unit, off-by-one, confusing two similar terms).',
  'Keep every option the same kind of answer as the correct one (a number for a number, a phrase for a phrase).',
  'Keep all options the same length, grammatical form and capitalisation as the correct answer.',
  'Do not use "always", "never", "all of the above" or "none of the above".',
  'Make sure no two options mean the same thing or contain one another.',
];

function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s.]+$/, '')
    .trim();
}

function tokenSimilarity(a, b) {
  const tokensA = new Set(a.split(' ').filter(Boolean));
  const tokensB = new Set(b.split(' ').filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) shared += 1;
  });
  return shared / Math.max(tokensA.size, tokensB.size);
}

/**
 * Mutual exclusivity check: finds option pairs that are identical, nested in
 * each other, or share almost all their words.
 * @param {Array<string>} options
 * @returns {{ distinctnessScore: number, overlappingPairs: Array<[number, number]> }}
 */
function evaluateOptionOverlap(options) {
  const cleaned = options.map(normalise);
  const overlappingPairs = [];

  for (let i = 0; i < cleaned.length; i++) {
    for (let j = i + 1; j < cleaned.length; j++) {
      const a = cleaned[i];
      const b = cleaned[j];
      // "3" inside "13" is not overlap, so containment only counts when the
      // shorter option is at least two words
      const shorter = a.length <= b.length ? a : b;
      const longer = shorter === a ? b : a;
      const containment = shorter.includes(' ') && longer.includes(shorter);
      if (a === b || containment || tokenSimilarity(a, b) >= OVERLAP_SIMILARITY) {
        overlappingPairs.push([i, j]);
      }
    }
  }

  return {
    distinctnessScore: Math.max(0, 100 - overlappingPairs.length * OVERLAP_PENALTY),
    overlappingPairs,
  };
}

/**
 * Rough answer kind, used to catch a distractor from a different category than
 * the correct answer (a sentence offered next to a number, or the other way
 * round). Short symbols and expressions like "x^2" are left as "other" so math
 * options are not flagged against each other.
 * @param {string} option
 * @returns {'number'|'prose'|'other'}
 */
function answerKind(option) {
  const text = String(option || '').trim();
  if (/^[-+$]?\d/.test(text) && text.split(/\s+/).length <= 2) return 'number';
  if ((text.match(/[a-z]{2,}/gi) || []).length >= 3) return 'prose';
  return 'other';
}

/**
 * Semantic plausibility and misconception targeting. Distractors of a
 * different kind than the correct answer score low. When every option is a
 * number, each distractor is scored by how close it is to a common calculation
 * slip, using the numeric heuristics from distractorScorerService.
 * @param {Array<string>} options
 * @param {number} correctIndex
 * @returns {{ plausibilityScore: number, mismatchedIndexes: Array<number>, unrelatedNumberIndexes: Array<number> }}
 */
function evaluatePlausibility(options, correctIndex) {
  const kinds = options.map(answerKind);
  const correctKind = kinds[correctIndex];
  const allNumbers = kinds.every((kind) => kind === 'number');
  const numeric = allNumbers ? evaluateNumericDistractorHeuristics(options, correctIndex) : null;

  const mismatchedIndexes = [];
  const unrelatedNumberIndexes = [];
  const scores = [];

  options.forEach((_, idx) => {
    if (idx === correctIndex) return;
    const kind = kinds[idx];
    const mismatch =
      (kind === 'number' && correctKind === 'prose') ||
      (kind === 'prose' && correctKind === 'number');

    if (mismatch) {
      mismatchedIndexes.push(idx);
      scores.push(TYPE_MISMATCH_PLAUSIBILITY);
    } else if (numeric && numeric[idx]) {
      const heuristicScore = numeric[idx].heuristicScore;
      if (heuristicScore <= UNRELATED_NUMBER_SCORE) unrelatedNumberIndexes.push(idx);
      scores.push(heuristicScore);
    } else {
      scores.push(NEUTRAL_PLAUSIBILITY);
    }
  });

  const plausibilityScore = scores.length
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : 0;

  return { plausibilityScore, mismatchedIndexes, unrelatedNumberIndexes };
}

function findCorrectIndex(options, correctAnswer) {
  if (Number.isInteger(correctAnswer) && correctAnswer >= 0 && correctAnswer < options.length) {
    return correctAnswer;
  }
  const exact = options.indexOf(correctAnswer);
  if (exact !== -1) return exact;
  const target = normalise(correctAnswer);
  const loose = options.findIndex((opt) => normalise(opt) === target);
  return loose === -1 ? 0 : loose;
}

/**
 * Scores a generated question's distractors.
 * @param {{ options: Array<string>, correctAnswer: string|number }} question
 *   correctAnswer can be the option text or its 0-based index
 * @returns {{ score: number, passes: boolean, issues: Array<string>, breakdown: Object }}
 *   score is between 0 and 1, breakdown holds the 0-100 sub scores
 */
function scoreDistractorQuality(question) {
  const options = Array.isArray(question && question.options) ? question.options : [];
  if (options.length < 2) {
    return {
      score: 0,
      passes: false,
      issues: ['Question needs at least two options.'],
      breakdown: null,
    };
  }

  const correctIndex = findCorrectIndex(options, question.correctAnswer);

  const symmetry = evaluateGrammarAndSymmetry(options, correctIndex);
  const leakage = evaluateClueLeakage(options);
  const overlap = evaluateOptionOverlap(options);
  const plausibility = evaluatePlausibility(options, correctIndex);

  const breakdown = {
    symmetry: symmetry.symmetryScore,
    leakage: leakage.clueLeakageScore,
    distinctness: overlap.distinctnessScore,
    plausibility: plausibility.plausibilityScore,
  };
  const weighted = Object.keys(WEIGHTS).reduce(
    (sum, key) => sum + breakdown[key] * WEIGHTS[key],
    0
  );
  const score = Math.round(weighted) / 100;

  const issues = [];
  if (symmetry.outlierWarning) issues.push(symmetry.outlierWarning);
  if (symmetry.symmetryScore < 80) {
    issues.push('Options differ too much in length or formatting.');
  }
  leakage.optionLeakage.forEach((entry) => {
    if (entry.hasLeakage) {
      issues.push(
        `Option ${entry.index + 1} contains giveaway wording: ${entry.flaggedTerms.join(', ')}.`
      );
    }
  });
  overlap.overlappingPairs.forEach(([i, j]) => {
    issues.push(`Options ${i + 1} and ${j + 1} overlap in meaning.`);
  });
  plausibility.mismatchedIndexes.forEach((idx) => {
    issues.push(`Option ${idx + 1} is a different kind of answer than the correct one.`);
  });
  plausibility.unrelatedNumberIndexes.forEach((idx) => {
    issues.push(`Option ${idx + 1} does not come from a common calculation mistake.`);
  });

  return { score, passes: score >= QUALITY_THRESHOLD, issues, breakdown };
}

/**
 * Builds the extra prompt text used when a question is regenerated.
 * @param {Array<string>} issues
 * @returns {string}
 */
function buildMisconceptionHints(issues = []) {
  const problems = issues.length
    ? `The previous attempt had these problems:\n${issues.map((i) => `- ${i}`).join('\n')}\n`
    : '';
  const guidelines = MISCONCEPTION_GUIDELINES.map((g) => `- ${g}`).join('\n');
  return `${problems}Rewrite the wrong options following these guidelines:\n${guidelines}`;
}

function isUsableReplacement(original, replacement) {
  if (!replacement || typeof replacement !== 'object') return false;
  if (typeof replacement.questionText !== 'string' || !replacement.questionText.trim()) {
    return false;
  }
  const { options } = replacement;
  if (!Array.isArray(options) || options.length !== original.options.length) return false;
  if (!options.every((opt) => typeof opt === 'string' && opt.trim())) return false;
  if (new Set(options.map(normalise)).size !== options.length) return false;
  const answer = Number(replacement.correctAnswer);
  return Number.isInteger(answer) && answer >= 0 && answer < options.length;
}

/**
 * Scores every MCQ in a generated quiz and asks for one batched rewrite of the
 * weak ones. A rewrite is only kept when it is well formed and scores higher
 * than the question it replaces. Any error in this step is logged and the
 * original questions are returned, so it can never fail quiz generation.
 *
 * @param {Array<Object>} questions - quiz questions ({ questionText, options, correctAnswer index, explanation })
 * @param {Function} regenerateWeak - async ([{ question, issues }]) => Array of replacement questions in the same order
 * @param {Object} [opts]
 * @param {number} [opts.maxRegenerations=5] - most questions sent for a rewrite per quiz
 * @param {Object} [opts.logger]
 * @returns {Promise<Array<Object>>}
 */
async function refineWeakQuestions(questions, regenerateWeak, opts = {}) {
  const { maxRegenerations = 5, logger = require('../utils/logger') } = opts;
  if (!Array.isArray(questions) || typeof regenerateWeak !== 'function') return questions;

  try {
    const weak = [];
    questions.forEach((question, index) => {
      if (!question || !Array.isArray(question.options) || question.options.length < 2) return;
      const quality = scoreDistractorQuality(question);
      if (!quality.passes)
        weak.push({ index, question, issues: quality.issues, score: quality.score });
    });
    if (weak.length === 0) return questions;

    // weakest first, so the cap spends the one rewrite call where it helps most
    const batch = weak.sort((a, b) => a.score - b.score).slice(0, maxRegenerations);
    logger.info(
      `Distractor quality: ${weak.length}/${questions.length} questions under ${QUALITY_THRESHOLD}, regenerating ${batch.length}`
    );

    const replacements = await regenerateWeak(
      batch.map(({ question, issues }) => ({ question, issues }))
    );
    if (!Array.isArray(replacements)) return questions;

    const refined = questions.slice();
    batch.forEach((item, i) => {
      const replacement = replacements[i];
      if (!isUsableReplacement(item.question, replacement)) return;
      const candidate = {
        ...item.question,
        questionText: replacement.questionText,
        options: replacement.options,
        correctAnswer: Number(replacement.correctAnswer),
        explanation: replacement.explanation || item.question.explanation,
      };
      if (scoreDistractorQuality(candidate).score > item.score) refined[item.index] = candidate;
    });
    return refined;
  } catch (error) {
    logger.warn(`Distractor refinement skipped: ${error.message}`);
    return questions;
  }
}

module.exports = {
  QUALITY_THRESHOLD,
  scoreDistractorQuality,
  evaluateOptionOverlap,
  evaluatePlausibility,
  buildMisconceptionHints,
  refineWeakQuestions,
};
