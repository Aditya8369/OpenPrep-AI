/**
 * MathParser - Safe, high-performance AST & mathematical expression evaluator
 * for 2D/3D functions, parametric curves, and geometry calculations.
 */

// Math constants
const CONSTANTS = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
  tau: Math.PI * 2,
  TAU: Math.PI * 2,
};

// Supported functions
const MATH_FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sec: (x) => {
    const c = Math.cos(x);
    return Math.abs(c) < 1e-12 ? NaN : 1 / c;
  },
  csc: (x) => {
    const s = Math.sin(x);
    return Math.abs(s) < 1e-12 ? NaN : 1 / s;
  },
  cot: (x) => {
    const t = Math.tan(x);
    return Math.abs(t) < 1e-12 ? NaN : 1 / t;
  },
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  sqrt: (x) => (x < 0 ? NaN : Math.sqrt(x)),
  cbrt: Math.cbrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  sgn: Math.sign,
};

/**
 * Preprocesses formula string:
 * - normalizes exponents: ^ to **
 * - inserts explicit multiplication for implicit patterns (2x -> 2*x, 3(x) -> 3*(x))
 * - replaces unicode symbols: × -> *, ÷ -> /, π -> pi, √ -> sqrt
 */
export function normalizeFormula(formula) {
  if (!formula || typeof formula !== 'string') return '';

  let expr = formula.trim();

  // Strip y = or f(x) = or z =
  expr = expr.replace(/^(?:y|f\s*\(\s*x\s*\)|z|f\s*\(\s*x\s*,\s*y\s*\))\s*=\s*/i, '');

  // Unicode replacements
  expr = expr
    .replace(/[×✕]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/π/g, ' pi ')
    .replace(/θ/g, ' theta ')
    .replace(/√\s*([a-zA-Z0-9_]+)/g, 'sqrt($1)');

  // Normalize power operator
  // Avoid changing **
  expr = expr.replace(/\^/g, '**');

  // Insert explicit * between:
  // 1. number and variable/identifier: 2x -> 2*x, 3.5sin -> 3.5*sin
  expr = expr.replace(/(\d+(\.\d+)?)\s*([a-zA-Z_])/g, '$1 * $3');

  // 2. number and opening parenthesis: 2(x+1) -> 2*(x+1)
  expr = expr.replace(/(\d+(\.\d+)?)\s*\(/g, '$1 * (');

  // 3. closing parenthesis and opening parenthesis: (x+1)(x-1) -> (x+1)*(x-1)
  expr = expr.replace(/\)\s*\(/g, ') * (');

  // 4. closing parenthesis and variable: (x+1)x -> (x+1)*x
  expr = expr.replace(/\)\s*([a-zA-Z_])/g, ') * $1');

  // 5. variable and variable/function where previous wasn't a known multi-char func:
  // e.g., x y -> x * y, x sin(x) -> x * sin(x), pi x -> pi * x
  expr = expr.replace(/\b([xyztr]|pi|theta|tau)\s+([a-zA-Z_])/g, '$1 * $2');
  expr = expr.replace(/\b([xyztr]|pi|theta|tau)\s*\(/g, '$1 * (');
  expr = expr.replace(/\s+/g, ' ');

  return expr;
}

/**
 * Tokenizer for mathematical expressions
 */
export function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const len = expr.length;

  while (i < len) {
    const ch = expr[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number literal (supports integers, decimals, and scientific notation e.g. 1e-4)
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(expr[i + 1] || ''))) {
      let numStr = '';
      while (i < len && (/[\d.]/.test(expr[i]) || (/[eE]/.test(expr[i]) && /[+-]?\d/.test(expr.slice(i + 1, i + 3))))) {
        numStr += expr[i];
        if (/[eE]/.test(expr[i]) && (expr[i + 1] === '+' || expr[i + 1] === '-')) {
          i++;
          numStr += expr[i];
        }
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }

    // Identifiers (variable names, functions, constants)
    if (/[a-zA-Z_]/.test(ch)) {
      let name = '';
      while (i < len && /[a-zA-Z0-9_]/.test(expr[i])) {
        name += expr[i];
        i++;
      }
      tokens.push({ type: 'IDENTIFIER', value: name });
      continue;
    }

    // Two-character operators
    if (expr.slice(i, i + 2) === '**') {
      tokens.push({ type: 'OPERATOR', value: '^' });
      i += 2;
      continue;
    }

    // Single-character operators and punctuation
    if ('+-*/%^(),'.includes(ch)) {
      tokens.push({ type: ch === '(' ? 'LPAREN' : ch === ')' ? 'RPAREN' : ch === ',' ? 'COMMA' : 'OPERATOR', value: ch });
      i++;
      continue;
    }

    // Unknown character, skip
    i++;
  }

  return tokens;
}

/**
 * Shunting-yard algorithm to convert infix tokens to Reverse Polish Notation (RPN)
 */
const PRECEDENCE = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
  'NEG': 3, // unary minus
  '^': 4,
};

const RIGHT_ASSOCIATIVE = {
  '^': true,
  'NEG': true,
};

export function toRPN(tokens) {
  const output = [];
  const opStack = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'NUMBER') {
      output.push(token);
    } else if (token.type === 'IDENTIFIER') {
      // Check if it's a function call (followed by '(')
      const next = tokens[i + 1];
      if (next && next.type === 'LPAREN') {
        opStack.push({ type: 'FUNCTION', value: token.value });
      } else {
        output.push(token); // Variable or constant
      }
    } else if (token.type === 'COMMA') {
      while (opStack.length > 0 && opStack[opStack.length - 1].type !== 'LPAREN') {
        output.push(opStack.pop());
      }
    } else if (token.type === 'OPERATOR') {
      let op = token.value;
      // Detect unary minus
      const prev = tokens[i - 1];
      if (op === '-' && (!prev || prev.type === 'OPERATOR' || prev.type === 'LPAREN' || prev.type === 'COMMA')) {
        op = 'NEG';
      }

      const prec = PRECEDENCE[op] || 0;
      const isRightAssoc = !!RIGHT_ASSOCIATIVE[op];

      while (opStack.length > 0) {
        const top = opStack[opStack.length - 1];
        if (top.type === 'OPERATOR') {
          const topPrec = PRECEDENCE[top.value] || 0;
          if ((!isRightAssoc && prec <= topPrec) || (isRightAssoc && prec < topPrec)) {
            output.push(opStack.pop());
            continue;
          }
        } else if (top.type === 'FUNCTION') {
          output.push(opStack.pop());
          continue;
        }
        break;
      }

      opStack.push({ type: 'OPERATOR', value: op });
    } else if (token.type === 'LPAREN') {
      opStack.push(token);
    } else if (token.type === 'RPAREN') {
      while (opStack.length > 0 && opStack[opStack.length - 1].type !== 'LPAREN') {
        output.push(opStack.pop());
      }
      if (opStack.length > 0 && opStack[opStack.length - 1].type === 'LPAREN') {
        opStack.pop(); // discard '('
      }
      // If function is on top of stack, pop to output
      if (opStack.length > 0 && opStack[opStack.length - 1].type === 'FUNCTION') {
        output.push(opStack.pop());
      }
    }
  }

  while (opStack.length > 0) {
    const op = opStack.pop();
    if (op.type !== 'LPAREN' && op.type !== 'RPAREN') {
      output.push(op);
    }
  }

  return output;
}

/**
 * Compiles a formula string into an evaluator function: (vars) => number
 */
export function compileExpression(formula) {
  try {
    const normalized = normalizeFormula(formula);
    if (!normalized) {
      return () => NaN;
    }
    const tokens = tokenize(normalized);
    const rpn = toRPN(tokens);

    return (variables = {}) => {
      const stack = [];

      for (let i = 0; i < rpn.length; i++) {
        const item = rpn[i];

        if (item.type === 'NUMBER') {
          stack.push(item.value);
        } else if (item.type === 'IDENTIFIER') {
          const name = item.value;
          if (name in variables) {
            stack.push(Number(variables[name]));
          } else if (name in CONSTANTS) {
            stack.push(CONSTANTS[name]);
          } else if (name in MATH_FUNCTIONS) {
            // Function passed without args?
            stack.push(NaN);
          } else {
            // Unknown variable
            stack.push(0);
          }
        } else if (item.type === 'OPERATOR') {
          const op = item.value;
          if (op === 'NEG') {
            const a = stack.pop() ?? 0;
            stack.push(-a);
          } else {
            const b = stack.pop() ?? 0;
            const a = stack.pop() ?? 0;
            switch (op) {
              case '+':
                stack.push(a + b);
                break;
              case '-':
                stack.push(a - b);
                break;
              case '*':
                stack.push(a * b);
                break;
              case '/':
                stack.push(Math.abs(b) < 1e-15 ? NaN : a / b);
                break;
              case '%':
                stack.push(a % b);
                break;
              case '^':
                // Guard against fractional powers of negative numbers
                if (a < 0 && !Number.isInteger(b)) {
                  stack.push(NaN);
                } else {
                  stack.push(Math.pow(a, b));
                }
                break;
              default:
                stack.push(NaN);
            }
          }
        } else if (item.type === 'FUNCTION') {
          const fnName = item.value.toLowerCase();
          const fn = MATH_FUNCTIONS[fnName];
          if (fn) {
            const arg = stack.pop() ?? 0;
            stack.push(fn(arg));
          } else {
            stack.push(NaN);
          }
        }
      }

      const result = stack.pop();
      return typeof result === 'number' && !isNaN(result) && isFinite(result) ? result : NaN;
    };
  } catch {
    return () => NaN;
  }
}

/**
 * Computes numerical derivative using central finite difference
 * f'(x) = [f(x + h) - f(x - h)] / (2h)
 */
export function numericalDerivative(fn, x, vars = {}, h = 1e-5) {
  const yPlus = fn({ ...vars, x: x + h });
  const yMinus = fn({ ...vars, x: x - h });
  if (isNaN(yPlus) || isNaN(yMinus)) return NaN;
  return (yPlus - yMinus) / (2 * h);
}

/**
 * Converts standard math expressions to clean KaTeX LaTeX syntax
 */
export function formulaToKatex(raw) {
  if (!raw) return '';
  let tex = raw.trim();

  // Handle explicit assignments
  tex = tex.replace(/^y\s*=\s*/i, 'y = ');
  tex = tex.replace(/^f\(x\)\s*=\s*/i, 'f(x) = ');
  tex = tex.replace(/^z\s*=\s*/i, 'z = ');

  // Power: x^2 -> x^{2}, (x+1)^3 -> (x+1)^{3}
  tex = tex.replace(/\^([a-zA-Z0-9_]+)/g, '^{$1}');
  tex = tex.replace(/\*\*/g, '^');

  // Fractions: (a)/(b) -> \frac{a}{b}
  tex = tex.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}');

  // Multiplication symbol: * -> \cdot
  tex = tex.replace(/\*/g, ' \\cdot ');

  // Greek and special constants
  tex = tex.replace(/\bpi\b/gi, '\\pi');
  tex = tex.replace(/\btheta\b/gi, '\\theta');
  tex = tex.replace(/\bphi\b/gi, '\\phi');
  tex = tex.replace(/\bsqrt\(([^()]+)\)/g, '\\sqrt{$1}');

  // Standard math functions
  const funcs = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'exp', 'ln', 'log'];
  for (const fn of funcs) {
    const reg = new RegExp(`\\b${fn}\\b`, 'g');
    tex = tex.replace(reg, `\\${fn}`);
  }

  return tex;
}

/**
 * Detects roots (zeros) of f(x) within [xMin, xMax]
 */
export function findRoots(fn, xMin, xMax, vars = {}, steps = 200) {
  const roots = [];
  const dx = (xMax - xMin) / steps;
  let prevX = xMin;
  let prevY = fn({ ...vars, x: prevX });

  for (let i = 1; i <= steps; i++) {
    const currX = xMin + i * dx;
    const currY = fn({ ...vars, x: currX });

    if (!isNaN(prevY) && !isNaN(currY)) {
      if (prevY === 0) {
        roots.push(Number(prevX.toFixed(4)));
      } else if (prevY * currY < 0 && Math.abs(currY - prevY) < 50) {
        // Linear interpolation root approximation
        const root = prevX - prevY * ((currX - prevX) / (currY - prevY));
        roots.push(Number(root.toFixed(4)));
      }
    }
    prevX = currX;
    prevY = currY;
  }

  // Deduplicate near roots
  return roots.filter((val, idx, arr) => idx === 0 || Math.abs(val - arr[idx - 1]) > 0.05);
}

/**
 * Evaluates points for parametric equations: x(t) and y(t)
 */
export function evaluateParametric(xFormula, yFormula, tMin = 0, tMax = Math.PI * 2, steps = 300, vars = {}) {
  const evalX = compileExpression(xFormula);
  const evalY = compileExpression(yFormula);
  const points = [];
  const dt = (tMax - tMin) / steps;

  for (let i = 0; i <= steps; i++) {
    const t = tMin + i * dt;
    const x = evalX({ ...vars, t });
    const y = evalY({ ...vars, t });
    if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
      points.push({ x, y, t });
    }
  }

  return points;
}
