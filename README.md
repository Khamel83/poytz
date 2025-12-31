# Jisr

**Personal URL shortener.** Arabic for "bridge" (جسر).

```
yourdomain.com/photos  →  your server, Google Docs, anywhere
```

---

## Cost

| Item | Cost |
|------|------|
| Domain | ~$12/year (skip if you have one) |
| Cloudflare | $0 |
| Tailscale | $0 (only needed for self-hosting) |
| **Total** | **$0 - $12/year** |

---

## The Code

```javascript
const ROUTES = {
  'resume': 'https://docs.google.com/document/d/xxx',
  'meet': 'https://zoom.us/j/xxx',
  'photos': 'https://your-server.ts.net/photos/',
};

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname.slice(1);
    if (ROUTES[path]) return Response.redirect(ROUTES[path], 302);
    return new Response('Not found', { status: 404 });
  }
};
```

**15 lines.** Add routes, deploy, done.

---

## Setup

### 1. Domain + Cloudflare

- Buy a domain at Cloudflare (~$12/year), or
- Point existing domain's nameservers to Cloudflare

### 2. Create Worker

```bash
npm install -g wrangler
wrangler login
mkdir jisr && cd jisr && mkdir src
```

Create `src/index.js` with your routes (copy from above).

Create `wrangler.toml`:
```toml
name = "jisr"
main = "src/index.js"
compatibility_date = "2024-01-01"
routes = [{ pattern = "yourdomain.com/*", zone_name = "yourdomain.com" }]
```

### 3. Deploy

```bash
wrangler deploy
```

**Done.** `yourdomain.com/resume` now works.

---

## Add a Route

```javascript
// Edit src/index.js
'newpath': 'https://wherever.com/',
```

```bash
wrangler deploy
```

---

## Self-Host with Tailscale

To point routes at your own computer/server:

```bash
# Install Tailscale (once)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Expose a service
sudo tailscale funnel --bg --set-path=/photos http://localhost:8080
```

Add the route:
```javascript
'photos': 'https://your-machine.your-tailnet.ts.net/photos/',
```

Find your machine name: `tailscale status`

---

## Move Between Machines

```bash
# Old machine
sudo tailscale funnel --set-path=/photos off

# New machine
sudo tailscale funnel --bg --set-path=/photos http://localhost:8080
```

Change one line in `src/index.js`. Deploy. Done.

No DNS changes. No cert changes.

---

## How It Works

```
yourdomain.com/photos
       ↓
Cloudflare Worker (15 lines)
       ↓
302 Redirect
       ↓
├── Tailscale Funnel → your server
├── Google Docs
├── Notion
└── Any URL
```

---

## Why

| Before | After |
|--------|-------|
| Traefik | 15 lines |
| nginx configs | 15 lines |
| Let's Encrypt | Automatic |
| Port forwarding | None |
| DNS records | Just Cloudflare |

---

## Free Server (Optional)

Need a computer running 24/7 but don't have one?

**Oracle Cloud Always Free**: https://www.oracle.com/cloud/free/
- Free forever (1 ARM VM, 6GB RAM)
- Install Tailscale, run your services

Or use: your laptop, old desktop, Raspberry Pi, Mac Mini.

---

## Files

```
jisr/
├── src/index.js    ← Routes go here
├── wrangler.toml   ← Cloudflare config
└── README.md
```

---

## Name

Jisr (جسر) = "bridge" in Arabic.

Bridges your short URLs to anywhere.
