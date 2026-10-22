import { useMemo } from 'react';

/**
 * Strips LaTeX command prefixes to yield clean evaluate-able expressions
 */
export function cleanLatexForPlotting(latex) {
  if (!latex || typeof latex !== 'string') return '';

  let clean = latex.trim();

  // Strip dollar signs
  clean = clean.replace(/^\${1,2}/, '').replace(/\${1,2}$/, '').trim();

  // Replace fractions: \frac{a}{b} -> ((a)/(b))
  clean = clean.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '(($1)/($2))');

  // Replace roots: \sqrt{a} -> sqrt(a)
  clean = clean.replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)');
  clean = clean.replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, '($2)^(1/($1))');

  // Common LaTeX symbols
  clean = clean.replace(/\\cdot/g, '*');
  clean = clean.replace(/\\times/g, '*');
  clean = clean.replace(/\\div/g, '/');
  clean = clean.replace(/\\pm/g, '+');
  clean = clean.replace(/\\pi/g, 'pi');
  clean = clean.replace(/\\theta/g, 'theta');
  clean = clean.replace(/\\phi/g, 'phi');

  // LaTeX function slashes: \sin -> sin, \cos -> cos, \ln -> ln, \exp -> exp
  clean = clean.replace(/\\(sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh|exp|ln|log|sqrt)/g, '$1');

  // Remove \left and \right
  clean = clean.replace(/\\left/g, '').replace(/\\right/g, '');

  // Power braces: ^{2} -> ^2, ^{x+1} -> ^(x+1)
  clean = clean.replace(/\^{([^}]+)}/g, '^($1)');
  // Subscripts: x_{1} -> x1
  clean = clean.replace(/_{([^}]+)}/g, '$1');

  // Clean trailing spaces
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Parses markdown or math text and detects graphable mathematical expressions
 */
export function detectGraphableEquations(text) {
  if (!text || typeof text !== 'string') return [];

  const detected = [];
  const seenFormulas = new Set();

  // Pattern 1: Explicit functions y = ... or f(x) = ...
  // Matches e.g. y = 2x + 1, f(x) = x^2 - 4, y = \sin(x) \cdot e^{-0.1x}
  const explicit2DRegex = /(?:y|f\s*\(\s*x\s*\))\s*=\s*([^,;\n$]+)/gi;
  let match;

  while ((match = explicit2DRegex.exec(text)) !== null) {
    const rawRhs = match[1].trim();
    const cleanFormula = cleanLatexForPlotting(rawRhs);

    // Filter out trivial constants or non-math expressions
    if (cleanFormula && /[a-zA-Z]/.test(cleanFormula) && !seenFormulas.has(cleanFormula)) {
      seenFormulas.add(cleanFormula);
      detected.push({
        id: `func-${detected.length + 1}`,
        raw: match[0],
        formula: cleanFormula,
        displayLabel: `y = ${rawRhs.replace(/\$/g, '')}`,
        type: 'explicit2D',
        dimension: '2D',
      });
    }
  }

  // Pattern 2: 3D Surface z = f(x, y) or z = ...
  const explicit3DRegex = /(?:z|f\s*\(\s*x\s*,\s*y\s*\))\s*=\s*([^,;\n$]+)/gi;
  while ((match = explicit3DRegex.exec(text)) !== null) {
    const rawRhs = match[1].trim();
    const cleanFormula = cleanLatexForPlotting(rawRhs);

    if (cleanFormula && !seenFormulas.has(cleanFormula)) {
      seenFormulas.add(cleanFormula);
      detected.push({
        id: `surface3d-${detected.length + 1}`,
        raw: match[0],
        formula: cleanFormula,
        displayLabel: `z = ${rawRhs.replace(/\$/g, '')}`,
        type: 'surface3D',
        dimension: '3D',
      });
    }
  }

  // Pattern 3: Conic sections (Circle, Ellipse, Hyperbola, Parabola)
  // e.g. x^2 + y^2 = 25 or x^2 / 9 + y^2 / 16 = 1
  const circleRegex = /(?:x(?:\s*-\s*\d+)?\s*\^?\s*2\s*\+\s*y(?:\s*-\s*\d+)?\s*\^?\s*2)\s*=\s*(\d+(?:\.\d+)?)/gi;
  while ((match = circleRegex.exec(text)) !== null) {
    const rSquared = parseFloat(match[1]);
    const radius = Math.sqrt(rSquared);
    const id = `conic-circle-${detected.length + 1}`;
    if (!seenFormulas.has(id)) {
      seenFormulas.add(id);
      detected.push({
        id,
        raw: match[0],
        formula: `sqrt(${rSquared} - x^2)`,
        negativeFormula: `-sqrt(${rSquared} - x^2)`,
        displayLabel: match[0],
        type: 'conic',
        conicType: 'circle',
        radius,
        dimension: '2D',
      });
    }
  }

  // Pattern 4: Parametric curves (x(t) = ..., y(t) = ...)
  const parametricRegex = /x\s*\(\s*t\s*\)\s*=\s*([^,;\n$]+)[,;\s]+y\s*\(\s*t\s*\)\s*=\s*([^,;\n$]+)/gi;
  while ((match = parametricRegex.exec(text)) !== null) {
    const xExpr = cleanLatexForPlotting(match[1]);
    const yExpr = cleanLatexForPlotting(match[2]);
    const id = `parametric-${detected.length + 1}`;
    if (!seenFormulas.has(id)) {
      seenFormulas.add(id);
      detected.push({
        id,
        raw: match[0],
        xFormula: xExpr,
        yFormula: yExpr,
        displayLabel: `x(t)=${match[1].trim()}, y(t)=${match[2].trim()}`,
        type: 'parametric',
        dimension: '2D',
      });
    }
  }

  // Pattern 5: Vector 3D e.g. v = [1, 2, 3] or \vec{v} = (a, b, c)
  const vectorRegex = /(?:\\vec\{?[a-zA-Z]\}?|[a-zA-Z]\s*vector)\s*=\s*[[({]\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*[\])}]/gi;
  while ((match = vectorRegex.exec(text)) !== null) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const z = parseFloat(match[3]);
    const id = `vector3d-${detected.length + 1}`;
    if (!seenFormulas.has(id)) {
      seenFormulas.add(id);
      detected.push({
        id,
        raw: match[0],
        vector: [x, y, z],
        displayLabel: `v = [${x}, ${y}, ${z}]`,
        type: 'vector3D',
        dimension: '3D',
      });
    }
  }

  return detected;
}

/**
 * Custom React Hook for automatically detecting graphable math expressions in text
 */
export default function useAutoGraphDetection(solutionMarkdown = '') {
  const detectedEquations = useMemo(() => {
    return detectGraphableEquations(solutionMarkdown);
  }, [solutionMarkdown]);

  return {
    equations: detectedEquations,
    hasGraphableEquations: detectedEquations.length > 0,
    count: detectedEquations.length,
  };
}
