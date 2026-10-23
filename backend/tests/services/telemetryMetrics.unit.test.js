const test = require('node:test');
const assert = require('node:assert/strict');
const metricsService = require('../../services/metricsService');
const instrumentation = require('../../instrumentation');

test('OpenTelemetry Distributed Tracing & Prometheus Metrics Pipeline Unit Tests', async (t) => {
  await t.test('Metric instruments record observations without throwing exceptions', () => {
    assert.doesNotThrow(() => {
      metricsService.recordHttpRequest('POST', '/api/quizzes/generate-ai', 201, 0.42);
      metricsService.recordDbQueryDuration(0.025);
      metricsService.recordAiTokenUsage({
        userTier: 'pro',
        operation: 'generate_quiz',
        model: 'gemini-1.5-pro',
        tokens: 450,
      });
      metricsService.recordCacheLookup('hit', 'redis');
      metricsService.recordCacheLookup('miss', 'redis');
      metricsService.recordActiveStudySession(1, 'study_squad');
      metricsService.recordActiveStudySession(-1, 'study_squad');
    });
  });

  await t.test('Custom span lifecycle wrapper captures execution and attributes', async () => {
    let executed = false;
    const result = await instrumentation.traceAiQuizGeneration(
      { promptTokens: 300, model: 'gemini-1.5-flash', durationMs: 120 },
      async () => {
        executed = true;
        return { generated: true };
      }
    );

    assert.equal(executed, true, 'Function inside span must execute');
    assert.deepEqual(result, { generated: true });
  });

  await t.test('Custom span records exceptions on error', async () => {
    await assert.rejects(
      async () => {
        await instrumentation.tracePdfExtractText({ pageCount: 12, fileSizeBytes: 204800 }, async () => {
          throw new Error('Corrupt PDF stream');
        });
      },
      { message: 'Corrupt PDF stream' }
    );
  });

  await t.test('Cache lookup span wraps execution cleanly', async () => {
    const value = await instrumentation.traceCacheLookup({ key: 'quiz:123', hitOrMiss: 'hit' }, async () => {
      return 'cached-value';
    });
    assert.equal(value, 'cached-value');
  });

  await t.test('metricsAuthMiddleware grants access for valid credentials and local calls', () => {
    let called = false;
    const next = () => { called = true; };

    // Test localhost / local IP
    const reqLocal = { headers: {}, ip: '127.0.0.1' };
    const res = { setHeader: () => {}, status: () => ({ send: () => {} }) };
    metricsService.metricsAuthMiddleware(reqLocal, res, next);
    assert.equal(called, true, 'Localhost IP should be authorized');

    // Test basic auth credentials
    called = false;
    const reqAuth = {
      headers: {
        authorization: 'Basic ' + Buffer.from('prometheus:metrics123').toString('base64'),
      },
      ip: '198.51.100.1',
    };
    metricsService.metricsAuthMiddleware(reqAuth, res, next);
    assert.equal(called, true, 'Valid Prometheus basic credentials should be authorized');
  });
});
