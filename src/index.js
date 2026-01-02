/**
 * Poytz - Personal Cloud Infrastructure
 *
 * Features:
 * - URL Shortener (redirects)
 * - Public API (route management)
 * - Webhook Receiver (store for later)
 * - Clipboard Sync (cross-device)
 * - Paste/Share (short URLs for text)
 * - Status Page (health dashboard)
 * - Auth Proxy (OAuth for any service)
 * - Home API (Home Assistant triggers)
 * - Cron Jobs (health checks, cleanup)
 *
 * Cost: $0/month forever (Cloudflare Workers free tier)
 */

const AUTHORIZED_EMAIL = 'zoheri@gmail.com';
const USERNAME = 'khamel';
const FUNNEL_BASE = 'https://homelab.deer-panga.ts.net';

// ============================================================================
// MAIN ROUTER
// ============================================================================

export default {
  // HTTP Handler
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Static routes
      if (path === '/') return homepage(env);
      if (path === '/status') return statusPage(env);

      // Auth routes
      if (path === '/auth/login') return handleOAuthLogin(request, env);
      if (path === '/auth/callback') return handleOAuthCallback(request, env);
      if (path === '/auth/logout') return handleLogout(env);

      // Admin UI (session auth)
      if (path === '/admin' || path.startsWith('/admin/')) {
        return handleAdmin(request, env, path);
      }

      // Public API (API key or session auth)
      if (path.startsWith('/api/')) {
        return handleAPI(request, env, path);
      }

      // Webhook receiver (no auth - external services send here)
      if (path.startsWith('/hooks/')) {
        return handleWebhook(request, env, path);
      }

      // Clipboard sync (API key auth)
      if (path === '/clip' || path.startsWith('/clip/')) {
        return handleClipboard(request, env);
      }

      // Paste/share
      if (path.startsWith('/p/')) {
        return handlePasteRead(request, env, path);
      }
      if (path === '/paste') {
        return handlePasteCreate(request, env);
      }

      // Auth proxy (OAuth protected redirects)
      if (path.startsWith('/secure/')) {
        return handleSecureProxy(request, env, path);
      }

      // Home Assistant API
      if (path.startsWith('/home/')) {
        return handleHomeAPI(request, env, path);
      }

      // Default: URL shortener redirect
      return handleRedirect(path, env);

    } catch (error) {
      console.error('Error:', error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },

  // Cron Handler (runs every 5 minutes)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runHealthChecks(env));
    ctx.waitUntil(cleanupOldWebhooks(env));
  }
};

// ============================================================================
// HELPERS
// ============================================================================

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...rest] = c.trim().split('=');
      return [key, rest.join('=')];
    })
  );
}

function getDomain(env) {
  return env.DOMAIN || 'khamel.com';
}

function getRedirectUri(env) {
  return env.OAUTH_REDIRECT_URI || `https://${getDomain(env)}/auth/callback`;
}

function generateShortId(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function truncateUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function authenticate(request, env) {
  // Try session cookie first
  const session = await getSession(request, env);
  if (session) return { type: 'session', user: session };

  // Try API key
  const apiKey = request.headers.get('X-API-Key');
  if (apiKey && apiKey === env.POYTZ_API_KEY) {
    return { type: 'api', user: { username: USERNAME, email: AUTHORIZED_EMAIL } };
  }

  return null;
}

async function getSession(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sessionId = cookies.session;

  if (!sessionId) return null;

  const sessionData = await env.SESSIONS.get(sessionId);
  if (!sessionData) return null;

  return JSON.parse(sessionData);
}

// ============================================================================
// GOOGLE OAUTH
// ============================================================================

function handleOAuthLogin(request, env) {
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('return') || '';

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(env),
    response_type: 'code',
    scope: 'email profile',
    access_type: 'online',
    state: returnUrl // Pass return URL in state
  });

  return Response.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    302
  );
}

async function handleOAuthCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const returnUrl = url.searchParams.get('state') || '';

  if (error) {
    return new Response(`OAuth error: ${error}`, { status: 400 });
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: getRedirectUri(env),
      grant_type: 'authorization_code'
    })
  });

  const tokens = await tokenResponse.json();

  if (tokens.error) {
    return new Response(`Token error: ${tokens.error_description || tokens.error}`, { status: 400 });
  }

  // Get user info
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  const user = await userResponse.json();

  // Check if authorized user
  if (user.email !== AUTHORIZED_EMAIL) {
    return new Response(unauthorizedPage(user.email), {
      status: 403,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Create session
  const sessionId = crypto.randomUUID();
  await env.SESSIONS.put(sessionId, JSON.stringify({
    email: user.email,
    username: USERNAME
  }), { expirationTtl: 30 * 24 * 60 * 60 }); // 30 days

  const domain = getDomain(env);

  // Check for return URL (from secure proxy)
  if (returnUrl && returnUrl.startsWith('https://')) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': returnUrl,
        'Set-Cookie': `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Domain=.${domain}; Max-Age=${30 * 24 * 60 * 60}; Path=/`
      }
    });
  }

  // Default redirect to admin
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `https://${domain}/admin`,
      'Set-Cookie': `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Domain=.${domain}; Max-Age=${30 * 24 * 60 * 60}; Path=/`
    }
  });
}

function handleLogout(env) {
  const domain = getDomain(env);
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': `session=; HttpOnly; Secure; SameSite=Lax; Domain=.${domain}; Max-Age=0; Path=/`
    }
  });
}

// ============================================================================
// URL SHORTENER (REDIRECTS)
// ============================================================================

async function handleRedirect(path, env) {
  const routePath = path.slice(1);
  if (!routePath) return homepage(env);

  const [route, ...rest] = routePath.split('/');
  const target = await env.ROUTES.get(`${USERNAME}:${route}`);

  if (!target) {
    return new Response(`Route not found: /${route}`, { status: 404 });
  }

  const subpath = rest.join('/');
  const finalTarget = subpath ? `${target.replace(/\/$/, '')}/${subpath}` : target;
  return Response.redirect(finalTarget, 307);
}

async function getRoutes(env) {
  const prefix = `${USERNAME}:`;
  const list = await env.ROUTES.list({ prefix });

  const routes = [];
  for (const key of list.keys) {
    const target = await env.ROUTES.get(key.name);
    routes.push({
      path: key.name.replace(prefix, ''),
      target
    });
  }

  return routes;
}

// ============================================================================
// PUBLIC API
// ============================================================================

async function handleAPI(request, env, path) {
  const auth = await authenticate(request, env);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, {
      status: 401,
      headers: { 'WWW-Authenticate': 'API key via X-API-Key header' }
    });
  }

  const method = request.method;

  // GET /api/routes - List all routes
  if (method === 'GET' && path === '/api/routes') {
    const routes = await getRoutes(env);
    return Response.json({ routes });
  }

  // POST /api/routes - Create route
  if (method === 'POST' && path === '/api/routes') {
    const { path: routePath, target } = await request.json();
    if (!routePath || !target) {
      return Response.json({ error: 'Missing path or target' }, { status: 400 });
    }
    if (!/^[a-z0-9_-]+$/i.test(routePath)) {
      return Response.json({ error: 'Invalid path format' }, { status: 400 });
    }
    await env.ROUTES.put(`${USERNAME}:${routePath}`, target);
    return Response.json({ success: true, path: routePath, target });
  }

  // DELETE /api/routes/:path - Delete route
  if (method === 'DELETE' && path.startsWith('/api/routes/')) {
    const routePath = decodeURIComponent(path.replace('/api/routes/', ''));
    await env.ROUTES.delete(`${USERNAME}:${routePath}`);
    return Response.json({ success: true, deleted: routePath });
  }

  // GET /api/webhooks - List webhooks
  if (method === 'GET' && path === '/api/webhooks') {
    const webhooks = await getWebhooks(env);
    return Response.json({ webhooks });
  }

  // POST /api/webhooks/:id/processed - Mark webhook as processed
  if (method === 'POST' && path.match(/^\/api\/webhooks\/[^/]+\/processed$/)) {
    const id = path.split('/')[3];
    const data = await env.WEBHOOKS.get(id);
    if (!data) {
      return Response.json({ error: 'Webhook not found' }, { status: 404 });
    }
    const webhook = JSON.parse(data);
    webhook.processed = true;
    await env.WEBHOOKS.put(id, JSON.stringify(webhook));
    return Response.json({ success: true });
  }

  // GET /api/status - Get service status
  if (method === 'GET' && path === '/api/status') {
    const status = await getServiceStatus(env);
    return Response.json({ services: status });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

// ============================================================================
// WEBHOOK RECEIVER
// ============================================================================

async function handleWebhook(request, env, path) {
  // Extract source from path: /hooks/github, /hooks/stripe, etc.
  const source = path.replace('/hooks/', '').split('/')[0] || 'unknown';

  // Only accept POST
  if (request.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405 });
  }

  // Store webhook with timestamp
  const timestamp = Date.now();
  const id = `hook:${source}:${timestamp}`;

  const payload = {
    source,
    timestamp,
    headers: Object.fromEntries(request.headers),
    body: await request.text(),
    processed: false
  };

  // Store for 7 days
  await env.WEBHOOKS.put(id, JSON.stringify(payload), {
    expirationTtl: 7 * 24 * 60 * 60
  });

  return Response.json({
    success: true,
    id,
    message: 'Webhook stored for processing'
  });
}

async function getWebhooks(env, source = null, onlyUnprocessed = false) {
  const prefix = source ? `hook:${source}:` : 'hook:';
  const list = await env.WEBHOOKS.list({ prefix });

  const webhooks = [];
  for (const key of list.keys) {
    const data = await env.WEBHOOKS.get(key.name);
    if (data) {
      const parsed = JSON.parse(data);
      if (!onlyUnprocessed || !parsed.processed) {
        webhooks.push({ id: key.name, ...parsed });
      }
    }
  }

  return webhooks.sort((a, b) => b.timestamp - a.timestamp);
}

// ============================================================================
// CLIPBOARD SYNC
// ============================================================================

async function handleClipboard(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const key = `clip:${USERNAME}`;

  // GET - retrieve clipboard
  if (request.method === 'GET') {
    const data = await env.CLIPBOARD.get(key);
    if (!data) {
      return new Response('', { status: 204 });
    }
    const parsed = JSON.parse(data);
    return new Response(parsed.content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Clipboard-Timestamp': parsed.timestamp.toString()
      }
    });
  }

  // POST - set clipboard
  if (request.method === 'POST') {
    const content = await request.text();
    const data = {
      content,
      timestamp: Date.now()
    };
    // Keep for 24 hours
    await env.CLIPBOARD.put(key, JSON.stringify(data), {
      expirationTtl: 24 * 60 * 60
    });
    return Response.json({ success: true, length: content.length });
  }

  // DELETE - clear clipboard
  if (request.method === 'DELETE') {
    await env.CLIPBOARD.delete(key);
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}

// ============================================================================
// PASTE / SHARE
// ============================================================================

async function handlePasteCreate(request, env) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405 });
  }

  // Optional auth - if authed, paste is linked to user
  const auth = await authenticate(request, env);

  const content = await request.text();
  if (!content) {
    return Response.json({ error: 'Empty content' }, { status: 400 });
  }

  // Generate short ID
  const id = generateShortId();
  const url = new URL(request.url);

  // Get expiry from query param (default 7 days, max 30)
  const expiryDays = Math.min(
    parseInt(url.searchParams.get('expire') || '7'),
    30
  );

  const paste = {
    content,
    created: Date.now(),
    expires: Date.now() + (expiryDays * 24 * 60 * 60 * 1000),
    owner: auth?.user?.username || null,
    views: 0
  };

  await env.PASTES.put(`paste:${id}`, JSON.stringify(paste), {
    expirationTtl: expiryDays * 24 * 60 * 60
  });

  const pasteUrl = `https://${url.host}/p/${id}`;

  return new Response(pasteUrl + '\n', {
    headers: {
      'Content-Type': 'text/plain',
      'X-Paste-Id': id,
      'X-Paste-Url': pasteUrl
    }
  });
}

async function handlePasteRead(request, env, path) {
  const id = path.replace('/p/', '');
  const data = await env.PASTES.get(`paste:${id}`);

  if (!data) {
    return new Response('Paste not found or expired', { status: 404 });
  }

  const paste = JSON.parse(data);

  // Increment view count (fire and forget)
  paste.views++;
  env.PASTES.put(`paste:${id}`, JSON.stringify(paste));

  // Return raw content
  return new Response(paste.content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Paste-Created': new Date(paste.created).toISOString(),
      'X-Paste-Views': paste.views.toString()
    }
  });
}

// ============================================================================
// STATUS PAGE + HEALTH CHECKS
// ============================================================================

async function statusPage(env) {
  const services = await getServiceStatus(env);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Status - khamel.com</title>
  <meta http-equiv="refresh" content="60">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 2rem;
      min-height: 100vh;
    }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { color: #888; font-size: 1rem; margin-bottom: 2rem; }
    h1 span { color: #00ff88; }
    .service {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      border-bottom: 1px solid #222;
    }
    .service:hover { background: #1a1a2e; }
    .service-name { color: #e0e0e0; }
    .status-up { color: #00ff88; }
    .status-down { color: #ff6b6b; }
    .status-unknown { color: #888; }
    .summary {
      margin-top: 2rem;
      padding: 1rem;
      background: #1a1a2e;
      border-radius: 8px;
    }
    .summary-line { color: #888; font-size: 0.85rem; margin-bottom: 0.5rem; }
    .summary-line:last-child { margin-bottom: 0; }
    .uptime-good { color: #00ff88; }
    .uptime-warn { color: #ffaa00; }
    .uptime-bad { color: #ff6b6b; }
    a { color: #888; text-decoration: none; }
    a:hover { color: #00ff88; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SYSTEM <span>STATUS</span></h1>
      <a href="/">← Home</a>
    </div>

    ${services.length === 0 ? '<p style="color:#666">No services configured yet. Health checks run every 5 minutes.</p>' : ''}

    ${services.map(s => `
      <div class="service">
        <span class="service-name">${s.name}</span>
        <span class="status-${s.status}">${s.status.toUpperCase()}</span>
      </div>
    `).join('')}

    <div class="summary">
      <div class="summary-line">Last checked: ${new Date().toISOString()}</div>
      ${services.length > 0 ? `
        <div class="summary-line">
          Uptime: <span class="${getUptimeClass(services)}">${services.filter(s => s.status === 'up').length}/${services.length}</span> services
        </div>
      ` : ''}
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function getUptimeClass(services) {
  const upCount = services.filter(s => s.status === 'up').length;
  const ratio = upCount / services.length;
  if (ratio >= 0.9) return 'uptime-good';
  if (ratio >= 0.5) return 'uptime-warn';
  return 'uptime-bad';
}

async function runHealthChecks(env) {
  // Services to check - these should have health endpoints
  const services = [
    { name: 'jellyfin', url: `${FUNNEL_BASE}/jellyfin/health` },
    { name: 'photos', url: `${FUNNEL_BASE}/photos/api/server-info/ping` },
    { name: 'recipes', url: `${FUNNEL_BASE}/recipes/api/app/about` },
    { name: 'request', url: `${FUNNEL_BASE}/request/api/v1/status` },
    { name: 'portainer', url: `${FUNNEL_BASE}/portainer/api/system/status` },
    { name: 'home', url: `${FUNNEL_BASE}/home/` },
  ];

  for (const service of services) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(service.url, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      await env.STATUS.put(`status:${service.name}`, JSON.stringify({
        status: response.ok ? 'up' : 'down',
        code: response.status,
        checked: Date.now()
      }));
    } catch (error) {
      await env.STATUS.put(`status:${service.name}`, JSON.stringify({
        status: 'down',
        error: error.message,
        checked: Date.now()
      }));
    }
  }
}

async function getServiceStatus(env) {
  const list = await env.STATUS.list({ prefix: 'status:' });
  const services = [];

  for (const key of list.keys) {
    const name = key.name.replace('status:', '');
    const data = await env.STATUS.get(key.name);
    const parsed = data ? JSON.parse(data) : { status: 'unknown' };
    services.push({ name, ...parsed });
  }

  return services.sort((a, b) => a.name.localeCompare(b.name));
}

// ============================================================================
// AUTH PROXY (OAUTH FOR ANY SERVICE)
// ============================================================================

async function handleSecureProxy(request, env, path) {
  const session = await getSession(request, env);

  if (!session) {
    // Store intended destination and redirect to login
    const returnUrl = new URL(request.url).href;
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('return', returnUrl);
    return Response.redirect(loginUrl.href, 302);
  }

  // User is authenticated - redirect to actual service
  // /secure/jellyfin → homelab.deer-panga.ts.net/jellyfin
  const servicePath = path.replace('/secure/', '');
  const target = `${FUNNEL_BASE}/${servicePath}`;

  return Response.redirect(target, 302);
}

// ============================================================================
// HOME ASSISTANT API
// ============================================================================

async function handleHomeAPI(request, env, path) {
  const auth = await authenticate(request, env);
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse action from path: /home/light/office/toggle
  const parts = path.replace('/home/', '').split('/');
  const [domain, entity, action] = parts;

  if (!domain || !entity) {
    return Response.json({
      error: 'Usage: /home/{domain}/{entity}/{action}',
      examples: [
        '/home/light/office/toggle',
        '/home/switch/fan/turn_on',
        '/home/script/goodnight/turn_on'
      ]
    }, { status: 400 });
  }

  // Check if HA_TOKEN is configured
  if (!env.HA_TOKEN) {
    return Response.json({
      error: 'Home Assistant token not configured',
      hint: 'Add HA_TOKEN secret via: npx wrangler secret put HA_TOKEN'
    }, { status: 503 });
  }

  // Forward to Home Assistant via Tailscale
  const haUrl = `${FUNNEL_BASE}/assistant/api/services/${domain}/${action || 'toggle'}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(haUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.HA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        entity_id: `${domain}.${entity}`
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      return Response.json({
        error: 'Home Assistant error',
        status: response.status,
        details: text
      }, { status: 502 });
    }

    return Response.json({
      success: true,
      action: `${domain}.${entity} → ${action || 'toggle'}`
    });
  } catch (error) {
    return Response.json({
      error: 'Failed to reach Home Assistant',
      message: error.message
    }, { status: 503 });
  }
}

// ============================================================================
// CRON CLEANUP JOBS
// ============================================================================

async function cleanupOldWebhooks(env) {
  // Delete processed webhooks older than 24 hours
  const list = await env.WEBHOOKS.list({ prefix: 'hook:' });
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);

  for (const key of list.keys) {
    const data = await env.WEBHOOKS.get(key.name);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.processed && parsed.timestamp < cutoff) {
        await env.WEBHOOKS.delete(key.name);
      }
    }
  }
}

// ============================================================================
// ADMIN UI
// ============================================================================

async function handleAdmin(request, env, path) {
  const session = await getSession(request, env);

  if (!session) {
    const domain = getDomain(env);
    return Response.redirect(`https://${domain}/auth/login`, 302);
  }

  // API routes
  if (path.startsWith('/admin/api/')) {
    return handleAdminAPI(request, env, path);
  }

  // Admin UI
  const routes = await getRoutes(env);
  return new Response(adminPage(routes), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleAdminAPI(request, env, path) {
  const method = request.method;

  // GET /admin/api/routes - List routes
  if (method === 'GET' && path === '/admin/api/routes') {
    const routes = await getRoutes(env);
    return Response.json(routes);
  }

  // POST /admin/api/routes - Create route
  if (method === 'POST' && path === '/admin/api/routes') {
    const { path: routePath, target } = await request.json();

    if (!routePath || !target) {
      return Response.json({ error: 'Missing path or target' }, { status: 400 });
    }

    if (!/^[a-z0-9_-]+$/i.test(routePath)) {
      return Response.json({ error: 'Invalid path format' }, { status: 400 });
    }

    await env.ROUTES.put(`${USERNAME}:${routePath}`, target);
    return Response.json({ success: true });
  }

  // DELETE /admin/api/routes/:path - Delete route
  if (method === 'DELETE' && path.startsWith('/admin/api/routes/')) {
    const routePath = decodeURIComponent(path.replace('/admin/api/routes/', ''));
    await env.ROUTES.delete(`${USERNAME}:${routePath}`);
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

// ============================================================================
// HTML PAGES
// ============================================================================

async function homepage(env) {
  const routes = await getRoutes(env);
  const domain = getDomain(env);

  const routeItems = routes.map(r => `
    <a href="/${r.path}" class="route-item">
      <span class="route-path">/${r.path}</span>
      <span class="route-arrow">→</span>
      <span class="route-target">${truncateUrl(r.target)}</span>
    </a>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Poytz - ${domain}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      background: #0a0a0a;
      color: #e0e0e0;
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #333;
    }
    .header h1 {
      font-size: 1rem;
      font-weight: normal;
      color: #888;
    }
    .header h1 span { color: #00ff88; }
    .header-links {
      display: flex;
      gap: 1rem;
    }
    .header a {
      color: #666;
      text-decoration: none;
      font-size: 0.85rem;
      padding: 0.5rem 1rem;
      border: 1px solid #333;
      border-radius: 4px;
    }
    .header a:hover {
      color: #00ff88;
      border-color: #00ff88;
    }
    .routes {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .route-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: #1a1a2e;
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s;
    }
    .route-item:hover {
      background: #252540;
      transform: translateX(4px);
    }
    .route-path {
      color: #00ff88;
      font-weight: 500;
      min-width: 100px;
    }
    .route-arrow {
      color: #444;
    }
    .route-target {
      color: #888;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .empty {
      text-align: center;
      padding: 3rem;
      color: #666;
    }
    .empty a { color: #00ff88; }
    .features {
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid #222;
    }
    .features h2 {
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 1rem;
      font-weight: normal;
    }
    .feature-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .feature-item {
      font-size: 0.8rem;
      color: #888;
      padding: 0.25rem 0.75rem;
      background: #1a1a2e;
      border-radius: 4px;
      text-decoration: none;
    }
    .feature-item:hover {
      color: #00ff88;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MY <span>SHORTCUTS</span></h1>
      <div class="header-links">
        <a href="/status">status</a>
        <a href="/admin">edit</a>
      </div>
    </div>

    <div class="routes">
      ${routeItems || '<div class="empty">No shortcuts yet. <a href="/admin">Add one</a></div>'}
    </div>

    <div class="features">
      <h2>ALSO AVAILABLE</h2>
      <div class="feature-list">
        <a href="/status" class="feature-item">/status</a>
        <span class="feature-item">/clip</span>
        <span class="feature-item">/paste</span>
        <span class="feature-item">/hooks/*</span>
        <span class="feature-item">/secure/*</span>
        <span class="feature-item">/home/*</span>
        <span class="feature-item">/api/*</span>
      </div>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function unauthorizedPage(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unauthorized</title>
  <style>
    body {
      font-family: 'SF Mono', Monaco, monospace;
      background: #0a0a0a;
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .container { text-align: center; max-width: 400px; }
    h1 { color: #ff6b6b; margin-bottom: 1rem; }
    p { color: #888; margin-bottom: 1rem; }
    code { background: #1a1a2e; padding: 0.25rem 0.5rem; border-radius: 4px; }
    a { color: #00ff88; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Unauthorized</h1>
    <p><code>${email}</code> is not authorized.</p>
    <p><a href="/">← Back</a></p>
  </div>
</body>
</html>`;
}

function adminPage(routes) {
  const routeRows = routes.map(r => `
    <tr data-path="${r.path}">
      <td><code>${r.path}</code></td>
      <td class="target-cell">
        <input type="text" value="${r.target}" class="target-input" readonly>
      </td>
      <td>
        <button class="btn-delete" onclick="deleteRoute('${r.path}')">×</button>
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin - Poytz</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      background: #1a1a2e;
      color: #e0e0e0;
      min-height: 100vh;
      padding: 2rem;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #333;
    }
    .header h1 {
      font-size: 1rem;
      font-weight: normal;
    }
    .header h1 span { color: #00ff88; }
    .header-links { display: flex; gap: 1rem; }
    .header a {
      color: #666;
      text-decoration: none;
      font-size: 0.9rem;
    }
    .header a:hover { color: #fff; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
    }
    th {
      text-align: left;
      padding: 0.75rem;
      color: #666;
      font-weight: normal;
      border-bottom: 1px solid #333;
    }
    td {
      padding: 0.75rem;
      border-bottom: 1px solid #222;
    }
    code {
      color: #00ff88;
    }
    .target-cell {
      width: 60%;
    }
    .target-input {
      width: 100%;
      background: transparent;
      border: 1px solid transparent;
      color: #888;
      font-family: inherit;
      font-size: inherit;
      padding: 0.25rem;
      border-radius: 4px;
    }
    .target-input:focus {
      outline: none;
      border-color: #00ff88;
      color: #e0e0e0;
    }
    .btn-delete {
      background: transparent;
      border: 1px solid #444;
      color: #666;
      width: 28px;
      height: 28px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
    }
    .btn-delete:hover {
      border-color: #ff6b6b;
      color: #ff6b6b;
    }
    .add-form {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .add-form input {
      background: #0a0a0a;
      border: 1px solid #333;
      color: #e0e0e0;
      padding: 0.75rem;
      border-radius: 4px;
      font-family: inherit;
    }
    .add-form input:focus {
      outline: none;
      border-color: #00ff88;
    }
    .add-form input[name="path"] { width: 150px; }
    .add-form input[name="target"] { flex: 1; }
    .btn-add {
      background: #00ff88;
      color: #0a0a0a;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      font-family: inherit;
    }
    .btn-add:hover {
      background: #00cc6a;
    }
    .message {
      padding: 0.75rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      display: none;
    }
    .message.success {
      background: #1a3d1a;
      color: #00ff88;
      display: block;
    }
    .message.error {
      background: #3d1a1a;
      color: #ff6b6b;
      display: block;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>POYTZ · <span>ADMIN</span></h1>
    <div class="header-links">
      <a href="/">← Home</a>
      <a href="/status">Status</a>
      <a href="/auth/logout">Logout</a>
    </div>
  </div>

  <div id="message" class="message"></div>

  <table>
    <thead>
      <tr>
        <th>Path</th>
        <th>Target</th>
        <th></th>
      </tr>
    </thead>
    <tbody id="routes">
      ${routeRows}
    </tbody>
  </table>

  <form class="add-form" onsubmit="addRoute(event)">
    <input type="text" name="path" placeholder="path" required pattern="[a-z0-9_-]+">
    <input type="url" name="target" placeholder="https://target.url" required>
    <button type="submit" class="btn-add">+ Add</button>
  </form>

  <script>
    function showMessage(text, type) {
      const msg = document.getElementById('message');
      msg.textContent = text;
      msg.className = 'message ' + type;
      setTimeout(() => { msg.className = 'message'; }, 3000);
    }

    async function addRoute(e) {
      e.preventDefault();
      const form = e.target;
      const path = form.path.value.toLowerCase();
      const target = form.target.value;

      try {
        const res = await fetch('/admin/api/routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, target })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to add route');
        }

        const tbody = document.getElementById('routes');
        const tr = document.createElement('tr');
        tr.dataset.path = path;
        tr.innerHTML = \`
          <td><code>\${path}</code></td>
          <td class="target-cell">
            <input type="text" value="\${target}" class="target-input" readonly>
          </td>
          <td>
            <button class="btn-delete" onclick="deleteRoute('\${path}')">×</button>
          </td>
        \`;
        tbody.appendChild(tr);

        form.reset();
        showMessage('Route added!', 'success');
      } catch (err) {
        showMessage(err.message, 'error');
      }
    }

    async function deleteRoute(path) {
      if (!confirm('Delete /' + path + '?')) return;

      try {
        const res = await fetch('/admin/api/routes/' + encodeURIComponent(path), {
          method: 'DELETE'
        });

        if (!res.ok) throw new Error('Failed to delete');

        document.querySelector(\`tr[data-path="\${path}"]\`).remove();
        showMessage('Route deleted', 'success');
      } catch (err) {
        showMessage(err.message, 'error');
      }
    }
  </script>
</body>
</html>`;
}
