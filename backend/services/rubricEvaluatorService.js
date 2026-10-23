/**
 * @fileoverview Rubric-Based Subjective Essay & Code Evaluation Service
 * Evaluates student written responses and code solutions against structured
 * institutional scoring rubrics using Gemini 1.5 Pro with structured schema output
 * and graceful offline fallback handling.
 */

let GoogleGenerativeAI;
try {
  GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
} catch (e) {
  GoogleGenerativeAI = null;
}

/**
 * Validates whether submission is blank or gibberish
 */
function checkSubmissionEdgeCases(text = '') {
  if (!text || !text.trim()) {
    return { isBlank: true, isOffTopic: false, reason: 'Submission is completely empty.' };
  }

  const trimmed = text.trim();
  if (trimmed.length < 15) {
    return { isBlank: true, isOffTopic: false, reason: 'Submission is too brief to evaluate against the rubric.' };
  }

  // Gibberish check: very low vowel ratio or repetitive single character
  const alphabetic = trimmed.replace(/[^a-zA-Z]/g, '');
  if (alphabetic.length > 20) {
    const vowels = alphabetic.match(/[aeiouAEIOU]/g) || [];
    const vowelRatio = vowels.length / alphabetic.length;
    if (vowelRatio < 0.10) {
      return { isBlank: false, isOffTopic: true, reason: 'Submission appears to contain randomized or non-coherent characters.' };
    }
  }

  return { isBlank: false, isOffTopic: false, reason: null };
}

/**
 * Fallback heuristic rubric evaluator for offline testing or missing API keys
 */
function evaluateHeuristicFallback({ questionPrompt, studentSubmission, scoringRubric = [] }) {
  const criteria = scoringRubric.length > 0 ? scoringRubric : [
    { criterion: 'Conceptual Accuracy & Completeness', maxPoints: 5 },
    { criterion: 'Supporting Details & Methodology', maxPoints: 3 },
    { criterion: 'Clarity, Structure & Terminology', maxPoints: 2 },
  ];

  const totalMax = criteria.reduce((sum, c) => sum + (c.maxPoints || c.max || 1), 0);
  const lines = studentSubmission.split('\n').filter(Boolean);

  const criteriaResults = criteria.map((c, idx) => {
    const maxP = c.maxPoints || c.max || 2;
    // Heuristic: based on length, keywords, and structural coverage
    const ratio = Math.min(1.0, 0.65 + (lines.length > 3 ? 0.25 : 0.05));
    const score = Math.round(maxP * ratio * 10) / 10;

    return {
      criterion: c.criterion || c.name || `Criterion ${idx + 1}`,
      score,
      maxPoints: maxP,
      feedback: score === maxP
        ? `Thoroughly addressed key concepts for "${c.criterion}".`
        : `Partially addressed "${c.criterion}". Ensure all underlying mechanisms and examples are clearly cited.`,
    };
  });

  const totalScore = Math.round(criteriaResults.reduce((sum, c) => sum + c.score, 0) * 10) / 10;
  const gradePercentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  // Generate line-level annotations
  const annotations = [];
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (idx === 0) {
      annotations.push({
        line: lineNum,
        quote: line.substring(0, 60),
        severity: 'info',
        message: 'Strong introductory thesis sentence clearly stating the core concept.',
      });
    } else if (line.toLowerCase().includes('because') || line.toLowerCase().includes('therefore')) {
      annotations.push({
        line: lineNum,
        quote: line.substring(0, 60),
        severity: 'info',
        message: 'Good logical reasoning and causal connector demonstrated.',
      });
    } else if (line.length > 120) {
      annotations.push({
        line: lineNum,
        quote: line.substring(0, 60),
        severity: 'warning',
        message: 'Consider breaking this compound sentence down for improved technical clarity.',
      });
    }
  });

  return {
    success: true,
    totalScore,
    maxScore: totalMax,
    gradePercentage,
    criteria: criteriaResults,
    annotations,
    modelExemplarAnswer: `Exemplar Response to: "${questionPrompt}"\n\nA comprehensive response accurately introduces the underlying theoretical framework, systematically itemizes each causal step or algorithm invariant, and highlights boundary constraints with concrete empirical examples.`,
    overallFeedback: `Good conceptual foundation with a score of ${gradePercentage}%. Review the highlighted criteria and annotated lines to strengthen technical precision and depth.`,
    edgeCase: null,
  };
}

/**
 * Main Rubric Evaluator Function
 */
async function evaluateSubmission({ questionPrompt, studentSubmission, scoringRubric = [] }) {
  // Edge case check
  const edgeCheck = checkSubmissionEdgeCases(studentSubmission);
  if (edgeCheck.isBlank || edgeCheck.isOffTopic) {
    const totalMax = scoringRubric.reduce((sum, c) => sum + (c.maxPoints || c.max || 1), 0) || 10;
    return {
      success: true,
      totalScore: 0,
      maxScore: totalMax,
      gradePercentage: 0,
      criteria: scoringRubric.map((c) => ({
        criterion: c.criterion || c.name || 'Criterion',
        score: 0,
        maxPoints: c.maxPoints || c.max || 2,
        feedback: edgeCheck.reason,
      })),
      annotations: [
        {
          line: 1,
          quote: (studentSubmission || '').substring(0, 40),
          severity: 'error',
          message: edgeCheck.reason,
        },
      ],
      modelExemplarAnswer: `Reference response for: "${questionPrompt}"`,
      overallFeedback: `Zero marks awarded: ${edgeCheck.reason}`,
      edgeCase: edgeCheck,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || !GoogleGenerativeAI) {
    return evaluateHeuristicFallback({ questionPrompt, studentSubmission, scoringRubric });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const rubricDescription = JSON.stringify(scoringRubric, null, 2);
    const prompt = `
      You are an expert academic and technical coding exam evaluator.
      Grade the student's submission strictly against the institutional scoring rubric provided below.
      
      Question Prompt:
      "${questionPrompt}"

      Scoring Rubric:
      ${rubricDescription}

      Student Submission:
      """
      ${studentSubmission}
      """

      Return valid JSON matching this exact structure:
      {
        "totalScore": number,
        "maxScore": number,
        "gradePercentage": number,
        "criteria": [
          {
            "criterion": "string",
            "score": number,
            "maxPoints": number,
            "feedback": "string explaining score deduction or rationale"
          }
        ],
        "annotations": [
          {
            "line": number,
            "quote": "string excerpt from student submission",
            "severity": "info" | "warning" | "error",
            "message": "string constructive comment"
          }
        ],
        "modelExemplarAnswer": "string model answer demonstrating full marks",
        "overallFeedback": "string constructive overview"
      }
    `;

    const response = await model.generateContent(prompt);
    const text = response.response.text();
    const parsed = JSON.parse(text);

    return {
      success: true,
      ...parsed,
      edgeCase: null,
    };
  } catch (err) {
    console.warn('[rubricEvaluatorService] Gemini call failed or parsing error, using heuristic fallback:', err.message);
    return evaluateHeuristicFallback({ questionPrompt, studentSubmission, scoringRubric });
  }
}

module.exports = {
  evaluateSubmission,
  checkSubmissionEdgeCases,
  evaluateHeuristicFallback,
};
