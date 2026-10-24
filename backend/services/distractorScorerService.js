/**
 * @fileoverview Intelligent Question Distractor Quality Scoring & Plausibility Metric Engine.
 * Evaluates wrong choices (distractors) in quiz questions for conceptual plausibility,
 * grammar & length symmetry, and dead-giveaway clue leakage. Uses Gemini API for auto-enhancing weak distractors.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini client if API key exists
const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
if (apiKey && apiKey !== 'your_gemini_api_key_here') {
  genAI = new GoogleGenerativeAI(apiKey);
}

// Dead giveaway words & absolute terms to detect clue leakage
const ABSOLUTE_GIVEAWAY_WORDS = [
  'always', 'never', 'all of the above', 'none of the above',
  'obviously', 'definitely', '100%', 'must be', 'cannot be',
  'without exception', 'impossible', 'every single'
];

/**
 * Evaluates Grammar and Length Symmetry across options to detect visual giveaways.
 * @param {Array<string>} options - Array of option strings
 * @param {number} correctAnswerIndex - 0-indexed correct answer position
 */
function evaluateGrammarAndSymmetry(options, correctAnswerIndex) {
  if (!Array.isArray(options) || options.length === 0) {
    return { symmetryScore: 100, optionMetrics: [] };
  }

  const optionMetrics = options.map((opt, idx) => {
    const text = String(opt || '').trim();
    const charCount = text.length;
    const wordCount = text ? text.split(/\s+/).length : 0;
    const startsWithCapital = /^[A-Z0-9]/.test(text);
    const endsWithPunctuation = /[.!?]$/.test(text);
    return {
      index: idx,
      text,
      charCount,
      wordCount,
      startsWithCapital,
      endsWithPunctuation
    };
  });

  const totalChars = optionMetrics.reduce((sum, o) => sum + o.charCount, 0);
  const avgCharCount = totalChars / optionMetrics.length || 1;

  // Check correct option length outlier ratio
  const correctOpt = optionMetrics[correctAnswerIndex] || optionMetrics[0];
  const distractorMetrics = optionMetrics.filter((_, idx) => idx !== correctAnswerIndex);
  const avgDistractorChars = distractorMetrics.reduce((sum, o) => sum + o.charCount, 0) / (distractorMetrics.length || 1);

  let lengthVariancePenalty = 0;
  optionMetrics.forEach(opt => {
    const deviation = Math.abs(opt.charCount - avgCharCount) / Math.max(avgCharCount, 1);
    if (deviation > 0.6) {
      lengthVariancePenalty += 15;
    } else if (deviation > 0.35) {
      lengthVariancePenalty += 8;
    }
  });

  // Outlier penalty if correct answer is noticeably longer or shorter than distractors
  let outlierWarning = null;
  if (correctOpt.charCount > avgDistractorChars * 1.6 && avgDistractorChars > 10) {
    outlierWarning = 'Correct answer is significantly longer than distractors (visual giveaway).';
    lengthVariancePenalty += 20;
  } else if (correctOpt.charCount < avgDistractorChars * 0.4 && avgDistractorChars > 15) {
    outlierWarning = 'Correct answer is unnaturally shorter than distractors.';
    lengthVariancePenalty += 15;
  }

  // Grammar formatting consistency check
  const capitalCounts = optionMetrics.filter(o => o.startsWithCapital).length;
  const punctCounts = optionMetrics.filter(o => o.endsWithPunctuation).length;
  let formattingPenalty = 0;

  if (capitalCounts > 0 && capitalCounts < optionMetrics.length) {
    formattingPenalty += 10; // Inconsistent capitalization
  }
  if (punctCounts > 0 && punctCounts < optionMetrics.length) {
    formattingPenalty += 10; // Inconsistent punctuation
  }

  const symmetryScore = Math.max(0, Math.min(100, Math.round(100 - lengthVariancePenalty - formattingPenalty)));

  return {
    symmetryScore,
    avgCharCount: Math.round(avgCharCount),
    outlierWarning,
    optionMetrics: optionMetrics.map(o => ({
      index: o.index,
      charCount: o.charCount,
      wordCount: o.wordCount,
      lengthScore: Math.max(0, Math.round(100 - (Math.abs(o.charCount - avgCharCount) / Math.max(avgCharCount, 1)) * 100))
    }))
  };
}

/**
 * Detects Clue Leakage and dead giveaway terminology in question distractors.
 * @param {Array<string>} options - Array of option strings
 */
function evaluateClueLeakage(options) {
  if (!Array.isArray(options)) return { clueLeakageScore: 100, optionLeakage: [] };

  const optionLeakage = options.map((opt, idx) => {
    const text = String(opt || '').toLowerCase();
    const flaggedTerms = [];

    ABSOLUTE_GIVEAWAY_WORDS.forEach(word => {
      if (text.includes(word)) {
        flaggedTerms.push(word);
      }
    });

    // Detect option self-referencing leaks (e.g. "both A and B", "refer to choice 1")
    if (/(both|either|neither)\s+([a-d1-4]|\w+\s+and\s+\w+)/.test(text) || /refer\s+to\s+option/.test(text)) {
      flaggedTerms.push('cross-option hint leak');
    }

    return {
      index: idx,
      flaggedTerms,
      hasLeakage: flaggedTerms.length > 0
    };
  });

  const totalFlagged = optionLeakage.reduce((sum, o) => sum + o.flaggedTerms.length, 0);
  const clueLeakageScore = Math.max(0, 100 - (totalFlagged * 25));

  return {
    clueLeakageScore,
    optionLeakage
  };
}

/**
 * Mathematical & Heuristic numeric distractor analysis.
 */
function evaluateNumericDistractorHeuristics(options, correctAnswerIndex) {
  const numericOptions = options.map(opt => {
    const match = String(opt).match(/-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
  });

  const correctVal = numericOptions[correctAnswerIndex];
  if (correctVal === null || numericOptions.filter(n => n !== null).length < 2) {
    return null;
  }

  const numericPlauibility = options.map((opt, idx) => {
    if (idx === correctAnswerIndex) return { index: idx, heuristicScore: 100 };
    const val = numericOptions[idx];
    if (val === null) return { index: idx, heuristicScore: 50 };

    let score = 70;
    let mathematicalRelation = 'numeric variation';

    // Sign flip error check
    if (val === -correctVal) {
      score = 95;
      mathematicalRelation = 'sign flip misconception (x * -1)';
    }
    // Doubled or halved misconception check
    else if (val === correctVal * 2 || val === correctVal / 2) {
      score = 90;
      mathematicalRelation = 'factor of 2 multiplier error';
    }
    // Off-by-one misconception check
    else if (Math.abs(val - correctVal) === 1) {
      score = 88;
      mathematicalRelation = 'off-by-one calculation error';
    }
    // Power of 10 magnitude error check
    else if (val === correctVal * 10 || val === correctVal / 10) {
      score = 85;
      mathematicalRelation = 'decimal magnitude / unit conversion error';
    }

    return {
      index: idx,
      heuristicScore: score,
      mathematicalRelation
    };
  });

  return numericPlauibility;
}

/**
 * Main Distractor Evaluation Engine incorporating Heuristics & Gemini AI Auto-Enhancer.
 * @param {Object} payload - { question, options, correctAnswerIndex, context }
 */
async function evaluateDistractors({ question, options, correctAnswerIndex = 0, context = '' }) {
  if (!question || !Array.isArray(options) || options.length === 0) {
    throw new Error('Invalid input: Question text and options array are required.');
  }

  const symmetryResult = evaluateGrammarAndSymmetry(options, correctAnswerIndex);
  const leakageResult = evaluateClueLeakage(options);
  const numericHeuristics = evaluateNumericDistractorHeuristics(options, correctAnswerIndex);

  let optionEvaluations = options.map((opt, idx) => ({
    optionIndex: idx,
    text: opt,
    isCorrect: idx === correctAnswerIndex,
    plausibilityScore: idx === correctAnswerIndex ? 100 : (numericHeuristics?.[idx]?.heuristicScore || 70),
    misconceptionType: idx === correctAnswerIndex ? 'Correct Answer' : (numericHeuristics?.[idx]?.mathematicalRelation || 'Plausible Distractor'),
    analysis: idx === correctAnswerIndex ? 'Valid target answer.' : 'Standard choice evaluation.'
  }));

  let overallQualityScore = Math.round(
    (symmetryResult.symmetryScore * 0.3) +
    (leakageResult.clueLeakageScore * 0.3) +
    (70 * 0.4)
  );

  let suggestedEnhancements = [];

  // Use Gemini API for deep conceptual plausibility & distractor auto-enhancer
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `
You are an expert psychometrician and quiz item evaluator.
Analyze the following multiple-choice question distractors (wrong options) for conceptual plausibility, common student misconceptions, and mathematical/logical errors.

Question: "${question}"
Options: ${JSON.stringify(options)}
Correct Answer Index: ${correctAnswerIndex} ("${options[correctAnswerIndex]}")
Context/Subject: "${context || 'General Education'}"

Instructions:
1. Score the plausibility (0-100) of each wrong distractor option based on whether it reflects a real, realistic student misconception or calculation mistake (e.g. sign error, formula confusion, misreading key term).
2. If any distractor option scores low plausibility (< 65), suggest 3 mathematically/conceptually derived alternative distractors with rationales.

Return valid JSON in this exact structure:
{
  "optionEvaluations": [
    {
      "optionIndex": 0,
      "plausibilityScore": 85,
      "misconceptionType": "Short phrase explaining student error",
      "analysis": "1 sentence breakdown of why this option is plausible or weak"
    }
  ],
  "overallPlausibilityScore": 80,
  "suggestedEnhancements": [
    {
      "targetOptionIndex": 1,
      "currentOption": "Option text",
      "suggestions": [
        {
          "alternativeText": "Suggested Distractor 1",
          "misconceptionRationale": "Rationale for distractor 1"
        },
        {
          "alternativeText": "Suggested Distractor 2",
          "misconceptionRationale": "Rationale for distractor 2"
        },
        {
          "alternativeText": "Suggested Distractor 3",
          "misconceptionRationale": "Rationale for distractor 3"
        }
      ]
    }
  ]
}
`;

      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        if (Array.isArray(parsed.optionEvaluations)) {
          optionEvaluations = optionEvaluations.map((opt, idx) => {
            const aiEval = parsed.optionEvaluations.find(e => e.optionIndex === idx);
            if (aiEval) {
              return {
                ...opt,
                plausibilityScore: idx === correctAnswerIndex ? 100 : Math.min(100, Math.max(0, aiEval.plausibilityScore || 70)),
                misconceptionType: idx === correctAnswerIndex ? 'Correct Answer' : (aiEval.misconceptionType || opt.misconceptionType),
                analysis: aiEval.analysis || opt.analysis
              };
            }
            return opt;
          });
        }

        if (Array.isArray(parsed.suggestedEnhancements)) {
          suggestedEnhancements = parsed.suggestedEnhancements;
        }

        const avgPlausibility = parsed.overallPlausibilityScore || 75;
        overallQualityScore = Math.round(
          (symmetryResult.symmetryScore * 0.3) +
          (leakageResult.clueLeakageScore * 0.3) +
          (avgPlausibility * 0.4)
        );
      }
    } catch (aiErr) {
      console.warn('Gemini Distractor Auto-Enhancer fallback:', aiErr.message);
    }
  }

  // Fallback enhancement generator if Gemini API key was missing or failed and low plausibility options exist
  if (suggestedEnhancements.length === 0) {
    optionEvaluations.forEach(opt => {
      if (!opt.isCorrect && opt.plausibilityScore < 65) {
        suggestedEnhancements.push({
          targetOptionIndex: opt.optionIndex,
          currentOption: opt.text,
          suggestions: [
            {
              alternativeText: `${opt.text} (Revised for common sign flip error)`,
              misconceptionRationale: 'Reflects inverted sign misconception in calculation'
            },
            {
              alternativeText: `Partial calculation result based on step 1 of ${question.slice(0, 20)}...`,
              misconceptionRationale: 'Reflects incomplete multi-step calculation'
            },
            {
              alternativeText: `${opt.text} (Adjusted for formula application mismatch)`,
              misconceptionRationale: 'Reflects incorrect formula substitution'
            }
          ]
        });
      }
    });
  }

  return {
    question,
    overallQualityScore,
    metrics: {
      plausibilityScore: Math.round(
        optionEvaluations.filter(o => !o.isCorrect).reduce((sum, o) => sum + o.plausibilityScore, 0) /
        Math.max(1, optionEvaluations.filter(o => !o.isCorrect).length)
      ),
      symmetryScore: symmetryResult.symmetryScore,
      clueLeakageScore: leakageResult.clueLeakageScore
    },
    symmetryAnalysis: {
      avgCharCount: symmetryResult.avgCharCount,
      outlierWarning: symmetryResult.outlierWarning,
      optionMetrics: symmetryResult.optionMetrics
    },
    clueLeakageAnalysis: leakageResult.optionLeakage,
    optionEvaluations,
    suggestedEnhancements
  };
}

module.exports = {
  evaluateDistractors,
  evaluateGrammarAndSymmetry,
  evaluateClueLeakage,
  evaluateNumericDistractorHeuristics,
};
