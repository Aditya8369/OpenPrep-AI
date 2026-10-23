/**
 * @fileoverview Code Linting and Algorithmic Analysis Service
 * Performs syntax verification, static code structure analysis,
 * asymptotic time complexity estimation (O(1), O(N), O(N^2), O(log N)),
 * space efficiency, and edge case coverage checks for JS, Python, C++, and Java.
 */

/**
 * Estimates algorithmic time complexity via loop nesting and recursive pattern scanning
 */
function estimateTimeComplexity(code = '', language = 'javascript') {
  const cleanCode = code.replace(/\/\/.*|\/\*[\s\S]*?\*\/|#.*/g, ''); // strip comments

  // Check for nested loops
  let maxLoopDepth = 0;
  let currentDepth = 0;

  const lines = cleanCode.split('\n');
  const loopRegex = /(for\s*\(|while\s*\(|for\s+\w+\s+in|while\s+)/;

  lines.forEach((line) => {
    if (loopRegex.test(line)) {
      currentDepth++;
      if (currentDepth > maxLoopDepth) {
        maxLoopDepth = currentDepth;
      }
    }
    // Block endings
    const closeBraces = (line.match(/\}/g) || []).length;
    const openBraces = (line.match(/\{/g) || []).length;
    if (closeBraces > openBraces) {
      currentDepth = Math.max(0, currentDepth - (closeBraces - openBraces));
    }
  });

  // Check log N patterns (binary search, dividing by 2)
  const hasLogarithmicPattern = /(>>>?|>>=|<<=|\/=\s*2|\bMath\.floor\s*\(\s*\w+\s*\/\s*2\b|\/\/=2)/.test(cleanCode);

  if (maxLoopDepth >= 3) {
    return { complexity: 'O(N^3)', rationale: 'Triple nested iterative loop detected. May exceed time limits for large inputs.' };
  } else if (maxLoopDepth === 2) {
    return { complexity: 'O(N^2)', rationale: 'Quadratic time complexity due to nested loops. Consider hashing or two pointers for O(N).' };
  } else if (maxLoopDepth === 1) {
    if (hasLogarithmicPattern) {
      return { complexity: 'O(N log N)', rationale: 'Linear iteration combined with divide-and-conquer / binary step.' };
    }
    return { complexity: 'O(N)', rationale: 'Single linear scan across input elements.' };
  } else if (hasLogarithmicPattern) {
    return { complexity: 'O(log N)', rationale: 'Logarithmic step reduction detected (binary search pattern).' };
  }

  return { complexity: 'O(1)', rationale: 'Constant time operations with no loops or recursive calls.' };
}

/**
 * Checks for commonly missed algorithmic edge cases
 */
function checkMissedEdgeCases(code = '') {
  const missedCases = [];

  // 1. Empty input / null check
  if (!/(=== null|=== undefined|== null|\.length === 0|!arr|!nums|len\(\w+\)\s*==\s*0)/.test(code)) {
    missedCases.push('Empty or null input validation (e.g. empty array or null pointer)');
  }

  // 2. Single-element or boundary
  if (!/(length === 1|len\(\w+\)\s*==\s*1|<=\s*1|==\s*0)/.test(code)) {
    missedCases.push('Single element / base boundary condition');
  }

  // 3. Integer overflow or negative values
  if (!/(< 0|negative|MAX_SAFE_INTEGER|MIN_SAFE_INTEGER|Integer\.MAX_VALUE)/.test(code)) {
    missedCases.push('Negative numbers or integer boundary overflow guard');
  }

  return missedCases;
}

/**
 * Checks syntax and basic linting for multiple languages
 */
function lintCodeSubmission({ code = '', language = 'javascript' }) {
  const issues = [];
  const normalizedLang = language.toLowerCase();

  // Basic syntax bracket matching check across all languages
  const stack = [];
  const pairs = { '(': ')', '{': '}', '[': ']' };
  let hasSyntaxError = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (pairs[ch]) {
      stack.push({ ch, pos: i });
    } else if (ch === ')' || ch === '}' || ch === ']') {
      if (stack.length === 0) {
        issues.push({ line: 1, message: `Unmatched closing bracket '${ch}'`, severity: 'error' });
        hasSyntaxError = true;
        break;
      }
      const last = stack.pop();
      if (pairs[last.ch] !== ch) {
        issues.push({ line: 1, message: `Mismatched bracket '${last.ch}' closed with '${ch}'`, severity: 'error' });
        hasSyntaxError = true;
        break;
      }
    }
  }

  if (stack.length > 0 && !hasSyntaxError) {
    issues.push({ line: 1, message: `Unclosed bracket '${stack[0].ch}' in code submission`, severity: 'error' });
    hasSyntaxError = true;
  }

  // Language specific checks
  if (normalizedLang === 'javascript' || normalizedLang === 'typescript') {
    if (/\bvar\b/.test(code)) {
      issues.push({ line: 1, message: 'Use let or const instead of var for block scoping.', severity: 'warning' });
    }
    if (/[^!=]==[^=]/.test(code)) {
      issues.push({ line: 1, message: 'Use strict equality (===) instead of loose equality (==).', severity: 'warning' });
    }
  } else if (normalizedLang === 'python') {
    if (/;\s*$/.test(code)) {
      issues.push({ line: 1, message: 'Trailing semicolons are unidiomatic in Python.', severity: 'info' });
    }
  }

  const timeComplexity = estimateTimeComplexity(code, normalizedLang);
  const missedEdgeCases = checkMissedEdgeCases(code);

  const spaceComplexity = /(new Map|new Set|new Array|dict\(\)|set\(\)|\[\]|\{\})/.test(code)
    ? 'O(N) Auxiliary Space'
    : 'O(1) In-Place Space';

  return {
    validSyntax: !hasSyntaxError,
    language: normalizedLang,
    issues,
    timeComplexity,
    spaceComplexity,
    missedEdgeCases,
  };
}

module.exports = {
  lintCodeSubmission,
  estimateTimeComplexity,
  checkMissedEdgeCases,
};
