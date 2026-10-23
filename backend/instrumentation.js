/**
 * @fileoverview OpenTelemetry Distributed Tracing Instrumentation
 * Initializes NodeSDK prior to application boot with auto-instrumentations
 * and provides custom trace span handlers for AI, PDF processing, and cache lookup pipelines.
 */

let sdk = null;
let api = null;

try {
  api = require('@opentelemetry/api');
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  });

  sdk = new NodeSDK({
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-redis-4': { enabled: true },
        '@opentelemetry/instrumentation-http': { enabled: true },
      }),
    ],
    serviceName: process.env.OTEL_SERVICE_NAME || 'openprep-ai-backend',
  });

  sdk.start();
  console.log('[Instrumentation] OpenTelemetry NodeSDK initialized with auto-instrumentation.');
} catch (err) {
  // Graceful no-op fallback when running in testing or optional dependencies missing
  sdk = null;
}

/**
 * Returns tracer instance
 */
function getTracer(name = 'openprep-tracer') {
  if (api && api.trace) {
    return api.trace.getTracer(name);
  }
  return {
    startActiveSpan: (spanName, fn) => {
      const mockSpan = {
        setAttribute: () => mockSpan,
        setAttributes: () => mockSpan,
        setStatus: () => mockSpan,
        recordException: () => mockSpan,
        end: () => {},
      };
      return fn(mockSpan);
    },
    startSpan: () => ({
      setAttribute: () => {},
      setAttributes: () => {},
      setStatus: () => {},
      recordException: () => {},
      end: () => {},
    }),
  };
}

/**
 * Custom span helper for AI Gemini quiz generation
 */
async function traceAiQuizGeneration({ promptTokens = 0, model = 'gemini-1.5-flash', durationMs = 0 }, fn) {
  const tracer = getTracer();
  return tracer.startActiveSpan('ai.gemini.generate_quiz', async (span) => {
    try {
      span.setAttributes({
        'ai.prompt_tokens': promptTokens,
        'ai.model': model,
        'ai.duration_ms': durationMs,
      });
      const result = typeof fn === 'function' ? await fn() : null;
      span.setStatus({ code: 1 }); // OK
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Custom span helper for PDF text extraction
 */
async function tracePdfExtractText({ pageCount = 1, fileSizeBytes = 0 }, fn) {
  const tracer = getTracer();
  return tracer.startActiveSpan('pdf.extract_text', async (span) => {
    try {
      span.setAttributes({
        'pdf.page_count': pageCount,
        'pdf.file_size_bytes': fileSizeBytes,
      });
      const result = typeof fn === 'function' ? await fn() : null;
      span.setStatus({ code: 1 });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Custom span helper for Cache lookup
 */
async function traceCacheLookup({ key = '', hitOrMiss = 'miss' }, fn) {
  const tracer = getTracer();
  return tracer.startActiveSpan('cache.lookup', async (span) => {
    try {
      span.setAttributes({
        'cache.key': key,
        'cache.hit_or_miss': hitOrMiss,
      });
      const result = typeof fn === 'function' ? await fn() : null;
      span.setStatus({ code: 1 });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

module.exports = {
  sdk,
  getTracer,
  traceAiQuizGeneration,
  tracePdfExtractText,
  traceCacheLookup,
};
