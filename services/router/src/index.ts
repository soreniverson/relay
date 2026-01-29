import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie } from 'hono/cookie';
import { rateLimiter } from './middleware/rate-limit.js';
import { extractApiKey, validateApiKey, resolveRegion } from './lib/auth.js';

type Bindings = {
  US_WEST_API: string;
  EU_WEST_API: string;
  API_KEY_CACHE: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    exposeHeaders: ['X-Request-ID', 'X-Region'],
    maxAge: 86400,
  })
);

// Health check (doesn't need routing)
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'router' });
});

// Rate limiting for SDK endpoints
app.use('/v1/*', rateLimiter());

// Main routing logic
app.all('/v1/*', async (c) => {
  const apiKey = extractApiKey(c.req);

  if (!apiKey) {
    return c.json(
      { error: 'missing_api_key', message: 'API key is required' },
      401
    );
  }

  // Validate API key and get region
  const keyData = await validateApiKey(apiKey, c.env.API_KEY_CACHE);

  if (!keyData) {
    return c.json(
      { error: 'invalid_api_key', message: 'Invalid or expired API key' },
      401
    );
  }

  // Resolve target region
  const targetUrl = resolveRegion(keyData.region, c.env);

  if (!targetUrl) {
    return c.json(
      { error: 'invalid_region', message: 'Unable to route to region' },
      500
    );
  }

  // Forward request to region
  const url = new URL(c.req.url);
  const forwardUrl = `${targetUrl}${url.pathname}${url.search}`;

  const headers = new Headers(c.req.raw.headers);
  headers.set('X-Forwarded-For', c.req.header('CF-Connecting-IP') || '');
  headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  headers.set('X-Original-Host', url.host);
  headers.set('X-Project-ID', keyData.projectId);
  headers.set('X-API-Key-ID', keyData.keyId);

  try {
    const response = await fetch(forwardUrl, {
      method: c.req.method,
      headers,
      body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
    });

    // Clone response and add routing headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Region', keyData.region);
    responseHeaders.set('X-Request-ID', crypto.randomUUID());

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Forwarding error:', error);
    return c.json(
      { error: 'upstream_error', message: 'Failed to reach region' },
      502
    );
  }
});

// Widget serving (CDN cached)
app.get('/widget.js', async (c) => {
  // In production, this would be served from CDN
  // For now, proxy to US-West as default
  const targetUrl = c.env.US_WEST_API;

  const response = await fetch(`${targetUrl}/widget.js`);

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

// Dashboard API routing (uses session cookie for auth)
app.all('/api/*', async (c) => {
  // Extract region from cookie or header
  const region = c.req.header('X-Region') ||
    getCookie(c, 'relay_region') ||
    'us-west';

  const targetUrl = resolveRegion(region, c.env);

  if (!targetUrl) {
    return c.json({ error: 'invalid_region' }, 400);
  }

  const url = new URL(c.req.url);
  const forwardUrl = `${targetUrl}${url.pathname}${url.search}`;

  const headers = new Headers(c.req.raw.headers);
  headers.set('X-Forwarded-For', c.req.header('CF-Connecting-IP') || '');

  const response = await fetch(forwardUrl, {
    method: c.req.method,
    headers,
    body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
});

// Catch all
app.all('*', (c) => {
  return c.json({ error: 'not_found', message: 'Route not found' }, 404);
});

export default app;
