# Tunnl.gg vs Poytz Research

## Executive Summary

**Tunnl.gg** and **Poytz** serve different use cases in the tunneling/routing space:

- **Tunnl.gg**: Temporary localhost exposure via SSH reverse tunnels (like serveo, ngrok)
- **Poytz**: Personal cloud infrastructure for permanent service routing via Cloudflare Workers

They are **complementary tools**, not direct competitors.

---

## Tunnl.gg Overview

**Purpose:** Expose localhost to the internet with a single SSH command

### Architecture
```
ssh -t -R 80:localhost:8080 proxy.tunnl.gg
→ https://happy-tiger-a1b2c3d4.tunnl.gg
```

- **Language:** Go
- **Protocol:** SSH reverse tunnels
- **Hosting:** Self-hosted on your own server
- **SSL:** Let's Encrypt (you manage certificates)

### Key Features

| Feature | Description |
|---------|-------------|
| Memorable subdomains | `happy-tiger-a1b2c3d4.tunnl.gg` (auto-generated) |
| Zero client config | Just SSH, no agent required |
| WebSocket support | Full WebSocket passthrough |
| Rate limiting | 10 req/s burst 20, token bucket |
| Abuse protection | Phishing interstitial, IP blocking |
| No authentication | Open to anyone with limits |
| Stats endpoint | `localhost:9090` metrics |

### Limits & Protection

| Limit | Value |
|-------|-------|
| Tunnels per IP | 3 concurrent |
| Total tunnels | 1000 server-wide |
| Tunnel lifetime | 24 hours max |
| Inactivity timeout | 2 hours |
| Request body | 128 MB |
| WebSocket transfer | 1 GB per direction |

### Deployment

Requires:
- Domain with wildcard DNS (`A *.domain.com → IP`)
- SSL certificates (certbot)
- Port 22 for SSH (move system SSH to 2222)
- Docker or systemd service

### Use Cases

- **Development testing**: Share localhost with stakeholders
- **Webhook testing**: Receive webhooks during dev
- **Quick demos**: Temporary public access
- **Pen testing**: Expose tools briefly

---

## Poytz Overview

**Purpose:** Personal cloud infrastructure on Cloudflare Workers

### Architecture
```
khamel.com/photos → Poytz Worker (302) → Tailscale Funnel → homelab service
```

- **Platform:** Cloudflare Workers (serverless)
- **Storage:** Cloudflare KV
- **Access:** Tailscale Funnel for homelab
- **SSL:** Cloudflare handles automatically

### Key Features

| Feature | Description |
|---------|-------------|
| URL shortener | Custom paths like `/photos` |
| 302 redirects | Clean URLs to any destination |
| Admin UI | Web interface for route management |
| Public API | CRUD routes programmatically |
| Auth proxy | OAuth-protected redirects |
| Clipboard sync | Copy/paste across devices |
| Paste sharing | Share text with short URLs |
| Webhook receiver | Store webhooks for processing |
| Home Assistant | Trigger HA actions |
| Status page | Public health dashboard |

### Deployment

Requires:
- Cloudflare account with domain
- Wrangler CLI
- Google OAuth app
- Tailscale with Funnel enabled
- ~$15/year (domain only)

### Use Cases

- **Homelab access**: Permanent clean URLs for services
- **Personal tools**: Clipboard sync, paste sharing
- **Automation**: Webhooks, HA integration
- **URL management**: Centralized routing

---

## Feature Comparison

| Aspect | Tunnl.gg | Poytz |
|--------|----------|-------|
| **Primary purpose** | Temporary localhost exposure | Permanent service routing |
| **URL style** | Random subdomain | Custom domain paths |
| **Persistence** | Sessions only (max 24h) | Permanent routes |
| **Client setup** | SSH command required | No client needed (302 redirect) |
| **Hosting** | Self-hosted Go server | Cloudflare Workers (serverless) |
| **Traffic flow** | SSH tunnel → server → app | 302 → Tailscale → app |
| **SSL management** | Manual (certbot) | Automatic (Cloudflare) |
| **Authentication** | None (open with limits) | OAuth + API keys |
| **Rate limiting** | Built-in (10 req/s) | Cloudflare handles |
| **WebSocket** | Full support | Via destination |
| **Setup complexity** | Medium (DNS, SSL, SSH port) | Medium (Cloudflare, Tailscale) |
| **Cost** | Your server only | $0 (free tiers) |
| **Maintenance** | Server updates, cert renewal | Deploy with `wrangler deploy` |

---

## Technical Architecture Comparison

### Tunnl.gg
```
┌─────────────────────────────────────────────────────────────────┐
│                        TUNNL SERVER (self-hosted)               │
│  SSH :22 ← SSH reverse tunnel → HTTP :80/HTTPS :443 → your app  │
└─────────────────────────────────────────────────────────────────┘
```

### Poytz
```
┌─────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKERS (global edge)                   │
│  khamel.com/path → 302 redirect → Tailscale Funnel → homelab   │
└─────────────────────────────────────────────────────────────────┘
```

---

## When to Use Which

### Use Tunnl.gg if:
- You need to expose localhost **temporarily**
- You're testing webhooks during development
- You want to share a quick demo without setup
- You don't have Cloudflare configured
- You need WebSocket support from localhost
- You want self-hosted control

### Use Poytz if:
- You want **permanent** clean URLs for services
- You already use Cloudflare for your domain
- You want extra features (clipboard, paste, webhooks, HA)
- You value zero-config client experience
- You want admin UI for route management
- You need OAuth protection on routes

### Use Both:
- Tunnl.gg for temporary dev sharing
- Poytz for permanent homelab access

---

## Alternatives Mentioned in Research

From [DEV Community - Top 10 Cloudflare Tunnel Alternatives](https://dev.to/lightningdev123/top-10-cloudflare-tunnel-alternatives-in-2026-a-practical-guide-for-developers-2akg):

| Tool | Type | Notes |
|------|------|-------|
| **ngrok** | SaaS | Popular, paid tiers, authtoken required |
| **Cloudflare Tunnel** | SaaS | cloudflared daemon, integrates with CF |
| **serveo** | SSH-based | Similar to tunnl.gg, public service |
| **localtunnel** | Node.js | Simple, public option |
| **pagekite** | Python | Older, self-hostable |
| **frp** | Go | Fast reverse proxy, self-hosted |
| **bore** | Rust | Minimal, CLI only |
| **localhost.run** | SSH-based | Public service, simple |
| **Pinggy** | SaaS/SSh | Web UI + SSH |

**Tunnl.gg's advantage**: Self-hosted, Go (fast), good abuse protection, memorable subdomains.

---

## Conclusion

Tunnl.gg is **not a better version of Poytz** — they solve different problems:

- **Tunnl.gg** = "Quick share this localhost thing temporarily"
- **Poytz** = "Personal cloud infrastructure with permanent clean URLs"

The key difference is **transience vs permanence** and **random vs custom URLs**.

For your homelab setup, Poytz remains the better choice for permanent service access. Tunnl.gg could complement it for temporary development work.

---

## Sources

- [Tunnl.gg GitHub Repository](https://github.com/klipitkas/tunnl.gg)
- [Top 10 Cloudflare Tunnel Alternatives in 2026 - DEV Community](https://dev.to/lightningdev123/top-10-cloudflare-tunnel-alternatives-in-2026-a-practical-guide-for-developers-2akg)
- Poytz local codebase and documentation
