const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateSubmission,
  checkSubmissionEdgeCases,
  evaluateHeuristicFallback,
} = require('../../services/rubricEvaluatorService');
const {
  lintCodeSubmission,
  estimateTimeComplexity,
  checkMissedEdgeCases,
} = require('../../services/codeLintService');

test('AI Subjective Essay & Code Solution Rubric-Based Auto-Grader Unit Tests', async (t) => {
  const sampleRubric = [
    { criterion: 'Lock-and-Key vs Induced Fit Models', maxPoints: 3 },
    { criterion: 'Activation Energy Mechanism', maxPoints: 3 },
    { criterion: 'Environmental Factors (pH, Temp)', maxPoints: 4 },
  ];

  await t.test('checkSubmissionEdgeCases detects blank and gibberish inputs', () => {
    const emptyCheck = checkSubmissionEdgeCases('');
    assert.equal(emptyCheck.isBlank, true);

    const whitespaceCheck = checkSubmissionEdgeCases('    \n\t  ');
    assert.equal(whitespaceCheck.isBlank, true);

    const shortCheck = checkSubmissionEdgeCases('short');
    assert.equal(shortCheck.isBlank, true);

    const gibberishCheck = checkSubmissionEdgeCases('zzzzzzzzbbbbbbbbcccccccdddddddwwww');
    assert.equal(gibberishCheck.isOffTopic, true);

    const validCheck = checkSubmissionEdgeCases('Enzymes accelerate chemical reactions by lowering activation energy barriers.');
    assert.equal(validCheck.isBlank, false);
    assert.equal(validCheck.isOffTopic, false);
  });

  await t.test('evaluateSubmission evaluates valid essay and calculates rubric criteria mathematically', async () => {
    const result = await evaluateSubmission({
      questionPrompt: 'Explain enzyme catalysis mechanism.',
      studentSubmission: `Enzymes catalyze biochemical processes by reducing the required activation energy.
Under the Induced Fit model, the active site reshapes to stabilize transition states.
Temperature and pH variations directly influence reaction velocity and enzyme stability.`,
      scoringRubric: sampleRubric,
    });

    assert.equal(result.success, true);
    assert.equal(typeof result.totalScore, 'number');
    assert.equal(result.maxScore, 10);
    assert.ok(result.totalScore > 0);
    assert.equal(result.criteria.length, 3);
    assert.ok(Array.isArray(result.annotations));
    assert.ok(result.annotations.length > 0);
    assert.ok(result.modelExemplarAnswer);
  });

  await t.test('evaluateSubmission handles blank submission gracefully with 0 score', async () => {
    const blankResult = await evaluateSubmission({
      questionPrompt: 'Explain enzyme catalysis mechanism.',
      studentSubmission: '   ',
      scoringRubric: sampleRubric,
    });

    assert.equal(blankResult.success, true);
    assert.equal(blankResult.totalScore, 0);
    assert.equal(blankResult.gradePercentage, 0);
    assert.ok(blankResult.edgeCase);
    assert.equal(blankResult.edgeCase.isBlank, true);
  });

  await t.test('estimateTimeComplexity accurately identifies O(1), O(N), and O(N^2)', () => {
    const codeO1 = `function add(a, b) { return a + b; }`;
    const resO1 = estimateTimeComplexity(codeO1);
    assert.equal(resO1.complexity, 'O(1)');

    const codeON = `
      function sum(arr) {
        let total = 0;
        for (let i = 0; i < arr.length; i++) {
          total += arr[i];
        }
        return total;
      }
    `;
    const resON = estimateTimeComplexity(codeON);
    assert.equal(resON.complexity, 'O(N)');

    const codeON2 = `
      function bubbleSort(arr) {
        for (let i = 0; i < arr.length; i++) {
          for (let j = 0; j < arr.length; j++) {
            if (arr[i] < arr[j]) swap(arr, i, j);
          }
        }
      }
    `;
    const resON2 = estimateTimeComplexity(codeON2);
    assert.equal(resON2.complexity, 'O(N^2)');
  });

  await t.test('lintCodeSubmission verifies bracket syntax and flags unmatched brackets', () => {
    const invalidCode = `function test() { if (true) { console.log("Missing close brace"); }`;
    const lintInvalid = lintCodeSubmission({ code: invalidCode, language: 'javascript' });
    assert.equal(lintInvalid.validSyntax, false);
    assert.ok(lintInvalid.issues.length > 0);

    const validCode = `function test(arr) { if (!arr) return 0; return arr.length; }`;
    const lintValid = lintCodeSubmission({ code: validCode, language: 'javascript' });
    assert.equal(lintValid.validSyntax, true);
  });
});
