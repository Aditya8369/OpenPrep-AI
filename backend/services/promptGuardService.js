/**
 * Prompt Injection & Jailbreak Guardrail Service
 * Defense-in-depth sanitization pipeline detecting instruction overrides,
 * jailbreak signatures, delimiter bypasses, and invisible Unicode exploits.
 */

const KNOWN_INJECTION_PATTERNS = [
  // Direct Instruction Overrides
  /ignore\s+(?:all\s+)?(?:previous\s+|prior\s+|above\s+)?(?:instructions|rules|prompts)/i,
  /disregard\s+(?:all\s+)?(?:previous\s+|prior\s+|above\s+)?(?:guidelines|rules|instructions|prompts)/i,
  /forget\s+(?:all\s+)?(?:previous\s+|prior\s+)?(?:rules|prompts|instructions)/i,
  /override\s+(?:system|safety|developer)\s+(?:prompt|instructions|protocol|rules)/i,
  /system\s+override/i,
  /bypass\s+(?:safety|content)\s+(?:filters|policies|rules)/i,

  // Jailbreak Personas & Unrestricted Modes
  /you\s+are\s+now\s+(?:DAN|jailbroken|unrestricted|unfiltered|chaos\s*gpt|evil\s*gpt)/i,
  /do\s+anything\s+now/i,
  /act\s+as\s+an?\s+(?:unrestricted|unfiltered|ruleless)\s+AI/i,
  /developer\s+mode\s+(?:enabled|activated)/i,
  /operating\s+without\s+(?:ethical|safety|policy)\s+(?:constraints|rules|filters)/i,
  /pretend\s+you\s+have\s+no\s+(?:limits|rules|safety\s+filters)/i,

  // Prompt Exfiltration & Leakage
  /(?:output|print|reveal|display|leak)\s+(?:the\s+|your\s+)?(?:system\s+prompt|initial\s+instructions|secret\s+instructions|hidden\s+instructions)/i,
  /repeat\s+(?:the\s+)?(?:words\s+above|text\s+before|developer\s+prompt)/i,
  /what\s+are\s+your\s+(?:initial|hidden|system|developer)?\s*(?:system\s+)?instructions/i,

  // Special Token / Delimiter Enclosure Bypasses
  /<\|(?:im_start|im_end|endoftext)\|>/i,
  /\[\s*INST\s*\]/i,
  /<<\s*SYS\s*>>/i,
  /```\s*(?:system|assistant|admin)\b/i,
  /"""\s*(?:system|override)\b/i,
  /\bSYSTEM:\s*(?:you\s+are|new\s+task)/i,
];

// Zero-width Unicode characters and invisible control codes
const INVISIBLE_UNICODE_REGEX = /[\u200B-\u200D\u2060\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

// Repetition attack detector (e.g., repeating the same character or short word 50+ times to flood context)
const REPETITION_REGEX = /(.)\1{49,}|(\b\w+\b\s+)\2{20,}/i;

const MAX_PROMPT_LENGTH = 4000;

/**
 * Strips invisible Unicode characters, normalizes whitespace, and enforces length bounds.
 * @param {string} input 
 * @returns {string}
 */
function sanitizeInputText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(INVISIBLE_UNICODE_REGEX, '')
    .trim()
    .slice(0, MAX_PROMPT_LENGTH);
}

/**
 * Evaluates whether text contains prompt injection or jailbreak attempts.
 * 
 * @param {string} rawText 
 * @returns {{ isSafe: boolean, code?: string, reason?: string, sanitizedText: string, riskScore: number, matchedPatterns: string[] }}
 */
function evaluatePromptSafety(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      isSafe: true,
      sanitizedText: '',
      riskScore: 0,
      matchedPatterns: [],
    };
  }

  const sanitized = sanitizeInputText(rawText);
  const matchedPatterns = [];

  // Check 1: Invisible zero-width character flood
  const invisibleMatches = rawText.match(INVISIBLE_UNICODE_REGEX);
  if (invisibleMatches && invisibleMatches.length > 5) {
    matchedPatterns.push('INVISIBLE_UNICODE_ANOMALY');
  }

  // Check 2: Repetition attack / buffer overflow
  if (REPETITION_REGEX.test(rawText)) {
    matchedPatterns.push('EXCESSIVE_TOKEN_REPETITION');
  }

  // Check 3: Known injection signatures
  for (const pattern of KNOWN_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      matchedPatterns.push(pattern.source);
    }
  }

  const isSafe = matchedPatterns.length === 0;
  const riskScore = isSafe ? 0 : Math.min(100, matchedPatterns.length * 40);

  if (!isSafe) {
    return {
      isSafe: false,
      code: 'ERR_AI_SAFETY_VIOLATION',
      reason: 'Disallowed system instruction override or prompt injection signature detected.',
      sanitizedText: sanitized,
      riskScore,
      matchedPatterns,
    };
  }

  return {
    isSafe: true,
    sanitizedText: sanitized,
    riskScore: 0,
    matchedPatterns: [],
  };
}

/**
 * Express middleware that inspects prompt parameters across req.body, req.query, and req.params.
 */
function promptGuardMiddleware(req, res, next) {
  const fieldsToInspect = [];

  // Check string bodies or nested properties
  function extractStrings(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string' && val.length > 2) {
        fieldsToInspect.push(val);
      } else if (typeof val === 'object') {
        extractStrings(val);
      }
    }
  }

  extractStrings(req.body);
  if (req.query?.prompt) fieldsToInspect.push(req.query.prompt);
  if (req.query?.q) fieldsToInspect.push(req.query.q);

  for (const text of fieldsToInspect) {
    const safetyResult = evaluatePromptSafety(text);
    if (!safetyResult.isSafe) {
      return res.status(400).json({
        success: false,
        error: safetyResult.reason,
        code: safetyResult.code,
        riskScore: safetyResult.riskScore,
        details: 'OpenPrep AI security guardrails prevent prompt injection and unauthorized system overrides.',
      });
    }
  }

  next();
}

module.exports = {
  evaluatePromptSafety,
  sanitizeInputText,
  promptGuardMiddleware,
  KNOWN_INJECTION_PATTERNS,
};
