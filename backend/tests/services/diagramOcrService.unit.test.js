import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const {
  validateImage,
  parseOcrResponse,
  solveDiagram,
  InvalidImageError,
  NonMathImageError,
  GeminiRateLimitError,
} = require('../../services/diagramOcrService');

describe('diagramOcrService', () => {
  describe('validateImage', () => {
    it('throws InvalidImageError if buffer is empty or null', () => {
      expect(() => validateImage(null, 'image/jpeg')).toThrow(InvalidImageError);
      expect(() => validateImage(Buffer.alloc(0), 'image/jpeg')).toThrow(
        /empty or missing/i
      );
    });

    it('throws InvalidImageError if buffer exceeds 5MB', () => {
      const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 100);
      expect(() => validateImage(largeBuffer, 'image/jpeg')).toThrow(
        /exceeds maximum limit of 5MB/i
      );
    });

    it('throws InvalidImageError if mime type is unsupported', () => {
      const dummyBuf = Buffer.from('hello world');
      expect(() => validateImage(dummyBuf, 'image/gif')).toThrow(
        /Supported formats are JPEG, PNG, and WebP/i
      );
      expect(() => validateImage(dummyBuf, 'text/plain')).toThrow(
        /Supported formats are JPEG, PNG, and WebP/i
      );
    });

    it('validates successfully for allowed mime types in test environment', () => {
      const dummyBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(validateImage(dummyBuf, 'image/jpeg')).toBe(true);
      expect(validateImage(dummyBuf, 'image/png')).toBe(true);
      expect(validateImage(dummyBuf, 'image/webp')).toBe(true);
    });
  });

  describe('parseOcrResponse', () => {
    it('throws error on empty or whitespace response', () => {
      expect(() => parseOcrResponse('')).toThrow(/empty response/i);
      expect(() => parseOcrResponse('   \n\t ')).toThrow(/empty response/i);
    });

    it('throws error on malformed JSON', () => {
      expect(() => parseOcrResponse('{ invalid json : true ')).toThrow(
        /Failed to parse OCR response as JSON/i
      );
    });

    it('throws NonMathImageError when isStemContent is false', () => {
      const nonMathJson = JSON.stringify({
        isStemContent: false,
        rejectionReason: 'The uploaded image appears to be a landscape with no math.',
      });

      expect(() => parseOcrResponse(nonMathJson)).toThrow(NonMathImageError);
      expect(() => parseOcrResponse(nonMathJson)).toThrow(
        /landscape with no math/i
      );
    });

    it('correctly parses JSON wrapped in markdown code fences', () => {
      const responsePayload = {
        isStemContent: true,
        problemStatement: 'Solve $\\int x^2 dx$',
        diagramDescription: null,
        knownVariables: [],
        targetUnknown: { symbol: 'I', description: 'Definite integral' },
        governingLaws: ['Power rule of integration: $\\int x^n dx = \\frac{x^{n+1}}{n+1}$'],
        derivationSteps: [
          {
            stepNumber: 1,
            title: 'Apply Power Rule',
            latex: '\\int x^2 dx = \\frac{x^3}{3} + C',
            explanation: 'Increase exponent by 1 and divide by new exponent.',
            whyStepHappened: 'Fundamental theorem of calculus integration power rule.',
          },
        ],
        finalAnswer: { latex: '\\frac{x^3}{3} + C', value: 'x^3/3 + C', unit: '' },
        pitfallsAndTraps: ['Forgetting the integration constant $+ C$'],
        conceptTags: ['Calculus', 'Integration'],
      };

      const markdownWrapped = `\`\`\`json\n${JSON.stringify(responsePayload, null, 2)}\n\`\`\``;
      const parsed = parseOcrResponse(markdownWrapped);

      expect(parsed.isStemContent).toBe(true);
      expect(parsed.problemStatement).toContain('\\int x^2 dx');
      expect(parsed.derivationSteps).toHaveLength(1);
      expect(parsed.derivationSteps[0].latex).toContain('\\frac{x^3}{3}');
      expect(parsed.finalAnswer.value).toBe('x^3/3 + C');
      expect(parsed.conceptTags).toContain('Calculus');
    });

    it('normalizes missing fields with sensible fallbacks', () => {
      const minimalJson = JSON.stringify({
        isStemContent: true,
      });

      const parsed = parseOcrResponse(minimalJson);
      expect(parsed.isStemContent).toBe(true);
      expect(parsed.knownVariables).toEqual([]);
      expect(parsed.governingLaws).toEqual([]);
      expect(parsed.derivationSteps).toEqual([]);
      expect(parsed.conceptTags).toEqual(['STEM', 'Mathematics']);
    });
  });

  describe('solveDiagram', () => {
    it('returns offline/mock derivation when GEMINI_API_KEY is not configured', async () => {
      const dummyBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const prevKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const result = await solveDiagram({
        buffer: dummyBuf,
        mimeType: 'image/jpeg',
        subjectHint: 'Physics',
      });

      expect(result).toBeDefined();
      expect(result.isStemContent).toBe(true);
      expect(result.problemStatement).toContain('particle of mass');
      expect(result.knownVariables.length).toBeGreaterThan(0);
      expect(result.derivationSteps.length).toBeGreaterThan(0);
      expect(result.finalAnswer.value).toBe('9.90');

      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    });
  });
});
