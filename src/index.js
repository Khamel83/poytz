/**
 * Poytz - Personal URL Shortener
 *
 * Routes:
 * - poytz.app/           → Landing page
 * - poytz.app/auth/login → Google OAuth redirect
 * - poytz.app/auth/callback → OAuth callback
 * - user.poytz.app/admin → Admin UI (authenticated)
 * - user.poytz.app/*     → Redirect to target
 */

// ============================================================================
// MAIN ROUTER
// ============================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const path = url.pathname;

    try {
      // Extract subdomain (null if apex domain like poytz.app)
      const subdomain = getSubdomain(hostname);

      // Apex domain routes (poytz.app)
      if (!subdomain) {
        if (path === '/') return landingPage(env);
        if (path === '/auth/login') return handleOAuthLogin(env);
        if (path === '/auth/callback') return handleOAuthCallback(request, env);
        if (path === '/auth/logout') return handleLogout();
        return notFound();
      }

      // Subdomain routes (user.poytz.app)
      if (path === '/admin' || path.startsWith('/admin/')) {
        return handleAdmin(request, env, subdomain);
      }

      // Public redirect
      return handleRedirect(subdomain, path, env);
    } catch (error) {
      console.error('Error:', error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  }
};

// ============================================================================
// HELPERS
// ============================================================================

function getSubdomain(hostname) {
  // Handle localhost for dev
  if (hostname === 'localhost' || hostname.startsWith('127.')) {
    return null;
  }

  const parts = hostname.split('.');
  // poytz.app = 2 parts, user.poytz.app = 3 parts
  if (parts.length <= 2) return null;
  return parts[0];
}

function notFound() {
  return new Response('Not found', { status: 404 });
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(s => s.trim()))
  );
}

// ============================================================================
// GOOGLE OAUTH
// ============================================================================

function handleOAuthLogin(env) {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(env),
    response_type: 'code',
    scope: 'email profile',
    access_type: 'online'
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

  // Look up username by email
  const username = await env.USERS.get(`email:${user.email}`);

  if (!username) {
    return new Response(noAccountPage(user.email), {
      status: 403,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Create session
  const sessionId = crypto.randomUUID();
  await env.SESSIONS.put(sessionId, JSON.stringify({
    email: user.email,
    username
  }), { expirationTtl: 30 * 24 * 60 * 60 }); // 30 days

  // Redirect to admin with session cookie
  const domain = getDomain(env);
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `https://${username}.${domain}/admin`,
      'Set-Cookie': `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Domain=.${domain}; Max-Age=${30 * 24 * 60 * 60}; Path=/`
    }
  });
}

function handleLogout() {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/'
    }
  });
}

function getRedirectUri(env) {
  // Use env var or default to poytz.app
  return env.OAUTH_REDIRECT_URI || 'https://poytz.app/auth/callback';
}

function getDomain(env) {
  return env.DOMAIN || 'poytz.app';
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

async function getSession(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const sessionId = cookies.session;

  if (!sessionId) return null;

  const sessionData = await env.SESSIONS.get(sessionId);
  if (!sessionData) return null;

  return JSON.parse(sessionData);
}

// ============================================================================
// ADMIN UI
// ============================================================================

async function handleAdmin(request, env, subdomain) {
  const session = await getSession(request, env);

  // Not logged in - redirect to login
  if (!session) {
    const domain = getDomain(env);
    return Response.redirect(`https://${domain}/auth/login`, 302);
  }

  // Wrong user - can't access another user's admin
  if (session.username !== subdomain) {
    return new Response('Forbidden: This is not your subdomain', { status: 403 });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  // API routes
  if (path.startsWith('/admin/api/')) {
    return handleAdminAPI(request, env, subdomain, path);
  }

  // Admin UI
  const routes = await getRoutesForUser(env, subdomain);
  return new Response(adminPage(subdomain, routes), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleAdminAPI(request, env, subdomain, path) {
  const method = request.method;

  // GET /admin/api/routes - List routes
  if (method === 'GET' && path === '/admin/api/routes') {
    const routes = await getRoutesForUser(env, subdomain);
    return Response.json(routes);
  }

  // POST /admin/api/routes - Create route
  if (method === 'POST' && path === '/admin/api/routes') {
    const { path: routePath, target } = await request.json();

    if (!routePath || !target) {
      return Response.json({ error: 'Missing path or target' }, { status: 400 });
    }

    // Validate path (alphanumeric, dashes, underscores)
    if (!/^[a-z0-9_-]+$/i.test(routePath)) {
      return Response.json({ error: 'Invalid path format' }, { status: 400 });
    }

    await env.ROUTES.put(`${subdomain}:${routePath}`, target);
    return Response.json({ success: true });
  }

  // DELETE /admin/api/routes/:path - Delete route
  if (method === 'DELETE' && path.startsWith('/admin/api/routes/')) {
    const routePath = decodeURIComponent(path.replace('/admin/api/routes/', ''));
    await env.ROUTES.delete(`${subdomain}:${routePath}`);
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

async function getRoutesForUser(env, username) {
  const prefix = `${username}:`;
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
// REDIRECT HANDLER
// ============================================================================

async function handleRedirect(subdomain, path, env) {
  const routePath = path.slice(1); // Remove leading /

  // Handle root path
  if (!routePath) {
    return userLandingPage(subdomain);
  }

  // Check for direct route match
  const [route, ...rest] = routePath.split('/');
  const target = await env.ROUTES.get(`${subdomain}:${route}`);

  if (!target) {
    return new Response(`Route not found: /${route}`, { status: 404 });
  }

  // Append subpath if present
  const subpath = rest.join('/');
  const finalTarget = subpath ? `${target.replace(/\/$/, '')}/${subpath}` : target;

  return Response.redirect(finalTarget, 302);
}

// ============================================================================
// HTML PAGES
// ============================================================================

function landingPage(env) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Poytz - Personal URL Shortener</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .container { text-align: center; max-width: 500px; }
    h1 {
      font-size: 1.5rem;
      color: #888;
      margin-bottom: 0.5rem;
    }
    .hero {
      font-size: 2rem;
      color: #00ff88;
      margin-bottom: 0.5rem;
      font-family: monospace;
    }
    .arrow {
      font-size: 1.5rem;
      color: #444;
      margin: 0.5rem 0;
    }
    .subtitle {
      font-size: 1.5rem;
      color: #00ff88;
      margin-bottom: 2rem;
      font-family: monospace;
    }
    .cta {
      background: #1a1a2e;
      padding: 2rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    }
    .price-badge {
      background: #00ff88;
      color: #0a0a0a;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-weight: bold;
      display: inline-block;
      margin-bottom: 1rem;
    }
    .coming-soon {
      color: #666;
      font-size: 0.9rem;
    }
    .login-section {
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 1px solid #333;
    }
    .login-section p {
      color: #666;
      margin-bottom: 1rem;
    }
    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      text-decoration: none;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn-google {
      background: #fff;
      color: #333;
    }
    .btn-google:hover {
      background: #f0f0f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>poytz</h1>
    <div class="hero">yourname.poytz.app</div>
    <div class="arrow">↓</div>
    <div class="subtitle">anywhere</div>

    <div class="cta">
      <div class="price-badge">Coming Soon</div>
      <p class="coming-soon">Free while in beta.<br>$1-5 once at launch, forever.</p>
    </div>

    <div class="login-section">
      <p>Already have an account?</p>
      <a href="/auth/login" class="btn btn-google">Sign in with Google</a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function userLandingPage(username) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${username}.poytz.app</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { text-align: center; }
    h1 { color: #00ff88; font-family: monospace; }
    p { color: #666; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${username}.poytz.app</h1>
    <p>Personal URL shortener</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function noAccountPage(email) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>No Account - Poytz</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
    <h1>No Account Found</h1>
    <p>No Poytz account is associated with <code>${email}</code></p>
    <p>Signups coming soon!</p>
    <p><a href="/">← Back to home</a></p>
  </div>
</body>
</html>`;
}

function adminPage(username, routes) {
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
  <title>Admin - ${username}.poytz.app</title>
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
    <h1>POYTZ · <span>${username}</span></h1>
    <a href="/auth/logout">Logout</a>
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

        // Add to table
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

        // Remove from table
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
