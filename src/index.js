/**
 * Khamel Redirector - Cloudflare Worker
 *
 * Maps short URLs to Tailscale Funnel endpoints.
 * Example: khamel.com/fd → homelab.deer-panga.ts.net/frontdoor
 */

const ROUTES = {
  // Homelab Services
  'fd': 'https://homelab.deer-panga.ts.net/frontdoor/',      // Front Door - Idea refinement
  'jellyfin': 'https://homelab.deer-panga.ts.net/jellyfin/', // Media streaming
  'requests': 'https://homelab.deer-panga.ts.net/requests/', // Jellyseerr - media requests
  'tv': 'https://homelab.deer-panga.ts.net/tv/',             // Sonarr - TV shows
  'movies': 'https://homelab.deer-panga.ts.net/movies/',     // Radarr - Movies
  'music': 'https://homelab.deer-panga.ts.net/music/',       // Lidarr - Music
  'docs': 'https://homelab.deer-panga.ts.net/docs/',         // Paperless - documents
  'photos': 'https://homelab.deer-panga.ts.net/photos/',     // Immich - photos
  'recipes': 'https://homelab.deer-panga.ts.net/recipes/',   // Mealie - recipes
  'code': 'https://homelab.deer-panga.ts.net/code/',         // Code Server - VS Code
  'stats': 'https://homelab.deer-panga.ts.net/stats/',       // Netdata - monitoring
};

// Landing page when visiting root
const LANDING_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>khamel.com</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 {
      color: #00ff88;
      font-size: 2rem;
      margin-bottom: 2rem;
    }
    .links {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    a {
      color: #88aaff;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border: 1px solid #333;
      border-radius: 4px;
      transition: all 0.2s;
    }
    a:hover {
      border-color: #00ff88;
      color: #00ff88;
    }
    .muted {
      color: #666;
      font-size: 0.8rem;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>khamel.com</h1>
    <div class="links">
      ${Object.keys(ROUTES).map(k => `<a href="/${k}">/${k}</a>`).join('\n      ')}
    </div>
    <p class="muted">Powered by Tailscale Funnel</p>
  </div>
</body>
</html>`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1); // Remove leading /

    // Root path - show landing page
    if (!path || path === '') {
      return new Response(LANDING_HTML, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Check for direct route match
    if (ROUTES[path]) {
      return Response.redirect(ROUTES[path], 302);
    }

    // Check for route with subpath (e.g., /fd/api/something)
    const [route, ...rest] = path.split('/');
    if (ROUTES[route]) {
      const subpath = rest.join('/');
      const target = ROUTES[route] + (subpath ? subpath : '');
      return Response.redirect(target, 302);
    }

    // 404 - Not found
    return new Response(`Not found: /${path}\n\nAvailable routes:\n${Object.keys(ROUTES).map(k => `  /${k}`).join('\n')}`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
