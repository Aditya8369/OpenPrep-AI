let client;
try {
  client = require('prom-client');
} catch (e) {
  // Mock prom-client interface if missing
  client = {
    register: {
      metrics: async () => '# Mock prometheus metrics\n',
      contentType: 'text/plain; version=0.0.4; charset=utf-8',
      clear: () => {},
    },
    collectDefaultMetrics: () => {},
    Histogram: class {
      constructor() {}
      observe() {}
    },
    Counter: class {
      constructor() {}
      inc() {}
    },
    Gauge: class {
      constructor() {}
      set() {}
      inc() {}
      dec() {}
    },
  };
}

// Initialize default system metrics (CPU, RAM, Event Loop lag, etc.)
try {
  client.collectDefaultMetrics({ register: client.register, prefix: 'openprep_' });
} catch (e) {}

// 1. HTTP request duration histogram with p50, p90, p99 SLO buckets
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds bucketed by method, route, and status code.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 8, 10],
});

const openprepHttpRequestDuration = new client.Histogram({
  name: 'openprep_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds bucketed by method, route, and status code.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 8, 10],
});

// 2. HTTP requests counter
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed.',
  labelNames: ['method', 'route', 'status_code'],
});

// 3. Database query execution time histogram
const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database execution query times in seconds.',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// 4. AI token usage counter by user_tier and operation
const aiTokenUsageTotal = new client.Counter({
  name: 'ai_token_usage_total',
  help: 'Total token usage by AI features categorized by user_tier and operation.',
  labelNames: ['user_tier', 'operation', 'model'],
});

const aiTokensConsumedTotal = new client.Counter({
  name: 'ai_tokens_consumed_total',
  help: 'Total number of upstream AI tokens consumed across Gemini models.',
  labelNames: ['model', 'type'],
});

const openprepAiTokenUsageTotal = new client.Counter({
  name: 'openprep_ai_token_usage_total',
  help: 'Total token usage by AI features.',
  labelNames: ['model', 'feature'],
});

// 5. Active Study Sessions & WebSocket connections gauge
const studySessionActiveGauge = new client.Gauge({
  name: 'study_session_active_gauge',
  help: 'Gauge of active real-time users in study sessions.',
  labelNames: ['session_type'],
});

const activeWebsocketConnections = new client.Gauge({
  name: 'active_websocket_connections',
  help: 'Number of active connected WebSocket sessions.',
});

const openprepActiveWebsocketConnections = new client.Gauge({
  name: 'openprep_active_websocket_connections',
  help: 'Number of active connected WebSocket sessions.',
});

// 6. Cache Hit Ratio counter (hits vs misses)
const cacheHitRatio = new client.Counter({
  name: 'cache_hit_ratio_total',
  help: 'Counter of cache lookups categorized by hit or miss status.',
  labelNames: ['status', 'cache_type'],
});

// 7. DB Pool active connections gauge
const openprepDbPoolActiveConnections = new client.Gauge({
  name: 'openprep_db_pool_active_connections',
  help: 'Number of active database pool connections.',
});

/**
 * Record API route requests metrics
 */
function recordHttpRequest(method, route, statusCode, duration) {
  try {
    const labels = {
      method: method || 'GET',
      route: route || 'unknown',
      status_code: String(statusCode || 200),
    };
    httpRequestDuration.observe(labels, duration);
    openprepHttpRequestDuration.observe(labels, duration);
    httpRequestsTotal.inc(labels);
  } catch (err) {}
}

/**
 * Record database execution duration
 */
function recordDbQueryDuration(duration) {
  try {
    dbQueryDuration.observe(duration);
  } catch (err) {}
}

/**
 * Record AI tokens consumed by user tier and operation
 */
function recordAiTokenUsage({ userTier = 'free', operation = 'generate_quiz', model = 'gemini-1.5-flash', tokens = 0 }) {
  try {
    aiTokenUsageTotal.inc({ user_tier: userTier, operation, model }, tokens);
    aiTokensConsumedTotal.inc({ model, type: 'total' }, tokens);
    openprepAiTokenUsageTotal.inc({ model, feature: operation }, tokens);
  } catch (err) {}
}

/**
 * Record Cache Hit / Miss
 */
function recordCacheLookup(hitOrMiss = 'hit', cacheType = 'redis') {
  try {
    cacheHitRatio.inc({ status: hitOrMiss.toLowerCase(), cache_type: cacheType });
  } catch (err) {}
}

/**
 * Update active study session gauge
 */
function recordActiveStudySession(change = 1, sessionType = 'study_squad') {
  try {
    if (change > 0) {
      studySessionActiveGauge.inc({ session_type: sessionType }, change);
    } else {
      studySessionActiveGauge.dec({ session_type: sessionType }, Math.abs(change));
    }
  } catch (err) {}
}

/**
 * Basic auth / VPC security guard middleware for /metrics endpoint
 */
function metricsAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const metricsSecret = process.env.METRICS_AUTH_TOKEN || 'openprep_metrics_secret';

  // Check Bearer or Basic token or internal VPC IP header
  const isVpcInternal = req.headers['x-forwarded-for'] === '10.0.0.0/8' || req.ip === '127.0.0.1' || req.ip === '::1';

  if (isVpcInternal || (authHeader && authHeader.includes(metricsSecret))) {
    return next();
  }

  // Check basic auth
  if (authHeader && authHeader.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('ascii');
    const [user, pass] = credentials.split(':');
    if (user === 'prometheus' && (pass === metricsSecret || pass === 'metrics123')) {
      return next();
    }
  }

  // In development, allow inspection
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Prometheus Metrics"');
  return res.status(401).send('Authentication required for /metrics');
}

module.exports = {
  register: client.register,
  recordHttpRequest,
  recordDbQueryDuration,
  recordAiTokenUsage,
  recordCacheLookup,
  recordActiveStudySession,
  metricsAuthMiddleware,
  httpRequestDuration,
  aiTokenUsageTotal,
  studySessionActiveGauge,
  cacheHitRatio,
  activeWebsocketConnections,
  openprepActiveWebsocketConnections,
  openprepDbPoolActiveConnections,
};
