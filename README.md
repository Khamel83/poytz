# Jisr

**Personal URL shortener.** Arabic for "bridge" (جسر).

```
yourdomain.com/photos  →  your server, Google Docs, anywhere
```

**30 minutes to set up. Runs forever. Zero maintenance.**

---

## What You Need

| Item | Cost | Time |
|------|------|------|
| Domain | ~$12/year (skip if you have one) | 5 min |
| Cloudflare account | $0 | 5 min |
| Tailscale account | $0 (only for self-hosting) | 5 min |
| **Total** | **$0 - $12/year** | **30 min** |

---

## Step 1: Cloudflare Account + Domain

> **One-time setup.** After this, you never touch DNS again.

### Create Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with email (free, no credit card)

### Add Your Domain to Cloudflare

**Option A: Buy at Cloudflare** (~$10-15/year)
1. Cloudflare Dashboard → Domain Registration → Register Domain
2. Search for your domain, buy it
3. Done - already configured, skip to Step 2

**Option B: Use Existing Domain (Squarespace/Google Domains)**

If you have a domain at Squarespace (they bought Google Domains) or anywhere else:

1. **In Cloudflare:**
   - Dashboard → Add a Site → Enter your domain (e.g., `yourdomain.com`)
   - Select **Free** plan → Continue
   - Cloudflare shows you two nameservers, like:
     ```
     ada.ns.cloudflare.com
     bob.ns.cloudflare.com
     ```
   - Copy these (you'll need them next)

2. **In Squarespace:**
   - Go to https://domains.squarespace.com
   - Click your domain → DNS → DNS Settings
   - Click "Edit" next to Nameservers
   - Change from Squarespace nameservers to Cloudflare's:
     ```
     ada.ns.cloudflare.com
     bob.ns.cloudflare.com
     ```
   - Save

3. **Wait 5-30 minutes** for DNS to propagate

4. **In Cloudflare:** Refresh - it should show "Active"

**Other registrars:** Same process. Find "Nameservers" or "DNS" settings, point to Cloudflare's nameservers.

---

## Step 2: Create Cloudflare API Token

> **One-time setup.** Set it to never expire and forget about it.

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Click **Use template** next to "Edit Cloudflare Workers"
4. Under Account Resources: Select your account
5. Under Zone Resources: Select "All zones" or your specific domain
6. **TTL (Expiration):** Leave blank or set far future (never expire)
7. Click **Continue to summary** → **Create Token**
8. **Copy the token** (you won't see it again)

Save it somewhere safe (password manager, notes app). You'll use it like:
```bash
CLOUDFLARE_API_TOKEN=your-token-here wrangler deploy
```

**Token never expires = zero maintenance.** You'll only need it when adding new routes.

---

## Step 3: Create the Worker

### Install Wrangler (Cloudflare CLI)

```bash
npm install -g wrangler
```

### Create Project

```bash
mkdir jisr && cd jisr && mkdir src
```

### Create `src/index.js`

```javascript
const ROUTES = {
  'resume': 'https://docs.google.com/document/d/xxx',
  'meet': 'https://zoom.us/j/xxx',
};

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname.slice(1);
    if (ROUTES[path]) return Response.redirect(ROUTES[path], 302);
    return new Response('Not found', { status: 404 });
  }
};
```

### Create `wrangler.toml`

```toml
name = "jisr"
main = "src/index.js"
compatibility_date = "2024-01-01"
routes = [{ pattern = "yourdomain.com/*", zone_name = "yourdomain.com" }]
```

Replace `yourdomain.com` with your actual domain.

### Deploy

```bash
CLOUDFLARE_API_TOKEN=your-token-here wrangler deploy
```

**Done.** Visit `yourdomain.com/resume` - it redirects.

---

## Step 4: Self-Hosting with Tailscale (Optional)

Skip this if you only want to redirect to external URLs (Google Docs, Notion, etc.).

### Create Tailscale Account

1. Go to https://tailscale.com
2. Sign up (free for personal use - 100 devices, 3 users)
3. No credit card needed

### Install Tailscale on Your Server

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

First time: opens a browser to authenticate. Click to approve.

### Enable Funnel (Public Access)

Funnel lets the public internet reach your server without port forwarding.

```bash
# Expose a service running on port 8080
sudo tailscale funnel --bg --set-path=/photos http://localhost:8080
```

Find your machine's public URL:
```bash
tailscale status
# Shows: your-machine.your-tailnet.ts.net
```

### Add Route to Your Worker

```javascript
const ROUTES = {
  'photos': 'https://your-machine.your-tailnet.ts.net/photos/',
};
```

Deploy again:
```bash
CLOUDFLARE_API_TOKEN=your-token wrangler deploy
```

---

## Adding More Routes

Edit `src/index.js`:
```javascript
const ROUTES = {
  'resume': 'https://docs.google.com/document/d/xxx',
  'meet': 'https://zoom.us/j/xxx',
  'photos': 'https://your-machine.ts.net/photos/',
  'blog': 'https://notion.so/your-blog',
  'newroute': 'https://anywhere.com/',
};
```

Deploy:
```bash
CLOUDFLARE_API_TOKEN=your-token wrangler deploy
```

---

## Moving a Service Between Machines

```bash
# Stop on old machine
sudo tailscale funnel --set-path=/photos off

# Start on new machine
sudo tailscale funnel --bg --set-path=/photos http://localhost:8080
```

Update one line in `src/index.js` (change the machine name). Deploy.

No DNS changes. No cert changes.

---

## Troubleshooting

### "wrangler: command not found"
```bash
npm install -g wrangler
```

### "Authentication error" on deploy
Your token is wrong or expired. Create a new one at:
https://dash.cloudflare.com/profile/api-tokens

### Site shows Cloudflare error
DNS hasn't propagated yet. Wait 5-30 minutes.

### Tailscale Funnel not working
```bash
# Check funnel status
tailscale serve status

# Make sure your service is actually running
curl http://localhost:8080
```

---

## How It Works

```
yourdomain.com/photos
       ↓
Cloudflare (runs your 15 lines of JS)
       ↓
302 Redirect to target
       ↓
├── Tailscale Funnel → your server
├── Google Docs, Notion, etc.
└── Any URL
```

---

## Free Server (Optional)

Don't have a computer running 24/7?

**Oracle Cloud Always Free**: https://www.oracle.com/cloud/free/
- 1 ARM VM, 6GB RAM, free forever
- Sign up, create VM, install Tailscale

Or use: old laptop, Raspberry Pi, Mac Mini.

---

## Why This Works

| Before | After |
|--------|-------|
| Traefik config files | 15 lines of JS |
| nginx reverse proxy | 15 lines of JS |
| Let's Encrypt certs | Automatic (Tailscale) |
| Port forwarding | None |
| Complex DNS | Just Cloudflare |

---

## Files

```
jisr/
├── src/index.js    ← Your routes
├── wrangler.toml   ← Cloudflare config
└── README.md
```

---

## Token Summary

| Token | Where to Get It | What It Does |
|-------|-----------------|--------------|
| Cloudflare API Token | dash.cloudflare.com/profile/api-tokens | Deploy workers |
| Tailscale | Automatic on `tailscale up` | Secure tunnel |

---

## Name

Jisr (جسر) = "bridge" in Arabic.

Bridges your short URLs to anywhere.
