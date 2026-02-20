# Poytz

**Personal cloud infrastructure on Cloudflare Workers.** Write once, run forever, $0/month.

```
khamel.com/photos  →  homelab.deer-panga.ts.net/photos/  →  Immich
```

---

## Why Poytz?

### The Problem

You have a homelab. You want to access it from anywhere. The usual options:

| Approach | Downsides |
|----------|-----------|
| Port forwarding | Security risk, needs static IP, ISP blocks ports |
| Cloudflare Tunnel | Another service to manage, can go down |
| Traefik/Caddy | SSL certs, config files, labels on every container |
| VPN only | Can't share links with family, no public access |

### The Solution

Poytz + Tailscale Funnel = **zero maintenance external access**.

- **Cloudflare Workers** run your redirects (free tier: 100k req/day)
- **Tailscale Funnel** exposes your homelab (free, punches through NAT)
- **One nginx config** routes to all services (vs labels on every container)

### This Is For You If

- You have a homelab and want external access without complexity
- You want `yourdomain.com/photos` instead of `192.168.1.50:2283`
- You're tired of managing SSL certificates
- You want features like clipboard sync, paste sharing, webhooks for free
- You value simplicity over flexibility

### This Is NOT For You If

- You need to hide the destination URL (Poytz uses 307 redirects)
- You need load balancing or advanced routing rules
- You're running a production SaaS (this is personal infrastructure)
- You need sub-millisecond latency (there's a redirect hop)

---

## What This Does

| Feature | Endpoint | Description |
|---------|----------|-------------|
| URL Shortener | `khamel.com/photos` | 307 redirect to any URL |
| Public API | `/api/routes` | CRUD routes programmatically |
| Webhook Receiver | `/hooks/*` | Store webhooks for later processing |
| Clipboard Sync | `/clip` | Copy on one device, paste on another |
| Paste/Share | `/paste`, `/p/*` | Share text with short URLs |
| Status Page | `/status` | Public health dashboard |
| Admin UI | `/admin` | Web interface for route management |
| Auth Proxy | `/secure/*` | OAuth-protected redirects |
| Home API | `/home/*` | Trigger Home Assistant actions |

---

## Architecture

```
                    CLOUDFLARE (Always On, Free Forever)
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   khamel.com/* ──→ Poytz Worker ──→ KV Storage                     │
│                         │                                           │
│                         ├── /photos      → 307 redirect             │
│                         ├── /api/*       → CRUD routes              │
│                         ├── /hooks/*     → Store webhook → KV       │
│                         ├── /clip        → GET/POST clipboard       │
│                         ├── /p/*         → Serve paste              │
│                         ├── /status      → Health dashboard         │
│                         ├── /secure/*    → OAuth → redirect         │
│                         ├── /home/*      → Forward to HA            │
│                         └── /admin       → Web UI                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    TAILSCALE FUNNELS (Always On, Free)
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   homelab.deer-panga.ts.net/* ──→ funnel-proxy (nginx) ──→ Docker  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Cloudflare account with a domain
- Wrangler CLI (`npm install -g wrangler`)
- Google Cloud project for OAuth

### 1. Clone and Install

```bash
git clone https://github.com/Khamel83/poytz.git
cd poytz
npm install
```

### 2. Create KV Namespaces

```bash
npx wrangler kv:namespace create ROUTES
npx wrangler kv:namespace create SESSIONS
npx wrangler kv:namespace create WEBHOOKS
npx wrangler kv:namespace create CLIPBOARD
npx wrangler kv:namespace create PASTES
npx wrangler kv:namespace create STATUS
```

Copy the IDs to `wrangler.toml`.

### 3. Set Up Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create project → OAuth consent screen → Credentials
3. Create OAuth 2.0 Client ID (Web application)
4. Set redirect URI: `https://yourdomain.com/auth/callback`
5. Add secrets:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put POYTZ_API_KEY  # openssl rand -hex 32
```

### 4. Configure wrangler.toml

```toml
name = "poytz"
main = "src/index.js"
compatibility_date = "2024-01-01"

routes = [
  { pattern = "yourdomain.com/*", zone_name = "yourdomain.com" }
]

[vars]
DOMAIN = "yourdomain.com"
OAUTH_REDIRECT_URI = "https://yourdomain.com/auth/callback"

[[kv_namespaces]]
binding = "ROUTES"
id = "your-routes-id"

# ... add all namespace IDs
```

### 5. Deploy

```bash
npx wrangler deploy
```

---

## API Usage

All API endpoints require authentication via `X-API-Key` header or session cookie.

### Routes API

```bash
# List all routes
curl https://khamel.com/api/routes -H "X-API-Key: $KEY"

# Add a route
curl -X POST https://khamel.com/api/routes \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"path": "photos", "target": "https://photos.example.com/"}'

# Delete a route
curl -X DELETE https://khamel.com/api/routes/photos -H "X-API-Key: $KEY"
```

### Clipboard Sync

```bash
# Copy (set clipboard)
echo "some text" | curl -X POST https://khamel.com/clip -H "X-API-Key: $KEY" -d @-

# Paste (get clipboard)
curl https://khamel.com/clip -H "X-API-Key: $KEY"

# Clear clipboard
curl -X DELETE https://khamel.com/clip -H "X-API-Key: $KEY"
```

### Paste/Share

```bash
# Create a paste (returns URL)
echo "share this text" | curl -X POST https://khamel.com/paste -d @-
# Output: https://khamel.com/p/abc123

# Create with custom expiry (days, max 30)
curl -X POST "https://khamel.com/paste?expire=1" -d "expires tomorrow"

# Read a paste
curl https://khamel.com/p/abc123
```

### Webhooks

```bash
# Receive webhooks (no auth required)
curl -X POST https://khamel.com/hooks/github -d '{"event": "push"}'

# List webhooks (auth required)
curl https://khamel.com/api/webhooks -H "X-API-Key: $KEY"

# Mark webhook processed
curl -X POST https://khamel.com/api/webhooks/hook:github:123456/processed -H "X-API-Key: $KEY"
```

### Home Assistant

```bash
# Toggle a light
curl https://khamel.com/home/light/office/toggle -H "X-API-Key: $KEY"

# Turn on a switch
curl https://khamel.com/home/switch/fan/turn_on -H "X-API-Key: $KEY"

# Run a script
curl https://khamel.com/home/script/goodnight/turn_on -H "X-API-Key: $KEY"
```

---

## KV Namespaces

| Namespace | Purpose | Key Format |
|-----------|---------|------------|
| ROUTES | URL shortener routes | `khamel:path` → `target_url` |
| SESSIONS | Auth sessions | `session_id` → `{user, expires}` |
| WEBHOOKS | Stored webhooks | `hook:source:timestamp` → `{payload}` |
| CLIPBOARD | Clipboard sync | `clip:username` → `{content, timestamp}` |
| PASTES | Shared pastes | `paste:id` → `{content, created, views}` |
| STATUS | Health check cache | `status:service` → `{status, checked}` |

---

## Secrets

| Secret | Purpose |
|--------|---------|
| GOOGLE_CLIENT_ID | OAuth authentication |
| GOOGLE_CLIENT_SECRET | OAuth authentication |
| POYTZ_API_KEY | API authentication |
| HA_TOKEN | Home Assistant long-lived token (optional) |

---

## Files

```
poytz/
├── src/index.js      ← Worker code (~1300 lines)
├── wrangler.toml     ← Cloudflare config
├── README.md         ← This file
└── thoughts/         ← Planning docs
```

---

## Costs

| Item | Cost |
|------|------|
| Cloudflare Workers | $0 (free tier: 100k req/day) |
| Cloudflare KV | $0 (free tier: 100k reads/day) |
| Google OAuth | $0 forever |
| Tailscale | $0 (free tier) |
| Domain | ~$15/year |
| **Total** | **~$15/year** |

---

## Integration with Homelab

Poytz replaces Traefik + Cloudflare Tunnel for external access:

**Old way:**
```
khamel.com → Cloudflare Tunnel → Traefik → Docker container
```

**New way:**
```
khamel.com → Poytz (307) → Tailscale Funnel → funnel-proxy → Docker container
```

See `homelab/services/funnel-proxy/` for the nginx configuration.

---

## Current Routes

| Path | Target |
|------|--------|
| /jellyfin | Jellyfin media server |
| /photos | Immich photo library |
| /recipes | Mealie recipes |
| /request | Jellyseerr media requests |
| /sonarr | TV automation |
| /radarr | Movie automation |
| /books | Calibre-Web ebooks |
| /docs | Paperless-NGX documents |
| /portainer | Docker management |
| /home | Homepage dashboard |
| ... | 26 total routes |

---

## Local Development

```bash
# Run locally
npx wrangler dev

# Deploy to production
npx wrangler deploy

# View logs
npx wrangler tail
```

---

## Rollback

If something breaks, restore Pi-hole override:

```bash
echo 'address=/.khamel.com/192.168.7.10' >> /mnt/main-drive/appdata/pihole/etc-dnsmasq.d/99-local-domains.conf
docker restart pihole
```

Then restore Traefik:

```bash
mv ~/github/homelab/services/.archive/traefik-20260101 ~/github/homelab/services/traefik
cd ~/github/homelab/services/traefik && docker compose up -d
```
