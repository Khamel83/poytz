# Poytz v2: Admin UI + Dynamic Routes

> **Status**: Name confirmed ✓. Next: Buy poytz.app, rename repo, implement admin UI.
> **Domain**: poytz.app (buy from Cloudflare Registrar)
> **Repo**: github.com/Khamel83/jisr → rename to poytz

---

## Required Services (The Full Stack)

**Everything you need, nothing else:**

| Service | Purpose | Cost | Account Needed |
|---------|---------|------|----------------|
| **Cloudflare** | Workers + KV + DNS | $0 (free tier) | Yes |
| **Google Cloud** | OAuth authentication | $0 forever | Yes (console.cloud.google.com) |
| **Lemon Squeezy** | Payments + tax handling | 5% + $0.50/tx | Yes |
| **Tailscale** | Funnel for self-hosted | $0 (personal) | Yes (your services only) |

**NOT required:** GitHub (for auth), Apple (for auth), Stripe (direct), email provider, any other auth system.

**Single auth provider:** Google OAuth only. Everyone has Google. It works with everything. Zero maintenance.

---

## Completed Work (v1)

- [x] Created Cloudflare Worker with hardcoded routes
- [x] Deployed to khamel.com/*
- [x] Set up 11 Tailscale Funnels (jellyfin, photos, recipes, etc.)
- [x] Archived khamel-redirector (will become poytz)
- [x] Comprehensive README with Squarespace migration guide

---

## Research Findings

### Competitive Analysis (25+ projects reviewed)

| Project | Stars | Gap |
|---------|-------|-----|
| **Dub.co** | 22.8k | Enterprise-focused, complex |
| **Sink** | 6k | Requires external auth (Clerk) |
| **xyTom/Url-Shorten-Worker** | 1.7k | No auth on admin |
| **judge2020/workers-link-shortener** | 200+ | No auth, complex setup |

**Key Finding**: No simple personal URL shortener with embedded admin UI and Basic Auth. Poytz fills this gap.

**Name Uniqueness**: "Poytz" has no existing projects on GitHub or npm.

### Cloudflare KV Free Tier (Absurdly Generous)

| Limit | Amount | What It Means For You |
|-------|--------|----------------------|
| Reads | 100,000/day | 50 people x 2,000 clicks/day. You'll use ~50. |
| Writes | 1,000/day | Add 1,000 routes/day. You'll add 1/week. |
| Storage | 1 GB | 10 million routes. You have 15. |
| Namespaces | 100 | Poytz needs 1. |

**Why it's free**: Cloudflare makes money on enterprise. Personal projects are rounding errors in their billing system. Free tier is customer acquisition.

**README copy**:
> *To hit the free tier limits, you'd need 50 friends clicking your links 2,000 times a day while you frantically add 500 new routes. If that sounds absurd, you're not even at 1%.*

---

## Poytz v2 Implementation Plan

### Architecture

```
khamel.com/admin  ──→  Basic Auth  ──→  Admin UI (HTML)
                                              ↓
                                        Edit routes in KV
                                              ↓
khamel.com/photos ──→  KV lookup  ──→  302 Redirect to target
```

### File: `src/index.js` (~200 lines)

```javascript
// Single file, no dependencies
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);

    // Admin routes (password protected)
    if (path === 'admin' || path.startsWith('admin/')) {
      return handleAdmin(request, env);
    }

    // Public redirects (from KV)
    const target = await env.ROUTES.get(path);
    if (target) {
      return Response.redirect(target, 302);
    }

    // Landing page or 404
    return path === '' ? landingPage(env) : notFound();
  }
};

async function handleAdmin(request, env) {
  // Basic Auth check
  const auth = request.headers.get('Authorization');
  if (!isValidAuth(auth, env.ADMIN_PASSWORD)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Poytz Admin"' }
    });
  }

  // GET: Show admin UI
  // POST: Update route
  // DELETE: Remove route
}
```

### Admin UI Design

**"Sexy Spreadsheet"** - Dark theme, minimal, functional:

```
┌──────────────────────────────────────────────────┐
│  POYTZ ADMIN                             [Logout] │
├──────────────────────────────────────────────────┤
│  Path          │  Target                         │
├────────────────┼─────────────────────────────────┤
│  photos        │  https://homelab...ts.net/photos│ [x]
│  jellyfin      │  https://homelab...ts.net/jelly │ [x]
│  recipes       │  https://homelab...ts.net/mealie│ [x]
├────────────────┼─────────────────────────────────┤
│  [+ Add Route]                                   │
└──────────────────────────────────────────────────┘
```

- Dark background (#1a1a2e)
- Monospace font
- Inline editing (click to edit)
- Delete button per row
- Add button at bottom

### wrangler.toml Updates

```toml
name = "poytz"
main = "src/index.js"
compatibility_date = "2024-01-01"

routes = [
  { pattern = "khamel.com/*", zone_name = "khamel.com" }
]

[[kv_namespaces]]
binding = "ROUTES"
id = "<create-via-wrangler>"

[vars]
# Password set via wrangler secret
```

### Setup Commands

```bash
# Create KV namespace
wrangler kv:namespace create ROUTES
# Copy the ID to wrangler.toml

# Set admin password
wrangler secret put ADMIN_PASSWORD
# Enter password when prompted

# Migrate existing routes to KV
wrangler kv:key put --binding=ROUTES "photos" "https://homelab.deer-panga.ts.net/photos/"
wrangler kv:key put --binding=ROUTES "jellyfin" "https://homelab.deer-panga.ts.net/jellyfin/"
# ... etc

# Deploy
npx wrangler deploy
```

---

## Documentation Plan (3-Tier)

### README.md (Sizzle)
- Value proposition in 30 seconds
- "30 minutes to set up. Runs forever."
- Quick start (5 steps)
- Screenshot of admin UI

### GUIDE.md (Steak)
- Detailed walkthrough
- Cloudflare account setup
- Domain configuration
- Tailscale Funnel setup
- Admin UI usage

### SETUP.md (Dessert)
- Screenshots of every step
- Troubleshooting common issues
- FAQ

---

## Implementation Steps

1. **Create KV namespace**
   ```bash
   wrangler kv:namespace create ROUTES
   ```

2. **Update wrangler.toml** with KV binding

3. **Implement src/index.js**
   - Basic Auth middleware
   - Admin UI HTML (embedded)
   - CRUD routes for KV
   - Public redirect logic

4. **Migrate existing routes to KV**
   - Script to bulk-add current routes

5. **Test locally**
   ```bash
   wrangler dev
   ```

6. **Deploy**
   ```bash
   CLOUDFLARE_API_TOKEN=xxx npx wrangler deploy
   ```

7. **Visual polish with Playwright**
   - Screenshot admin UI
   - Iterate on CSS until 10/10

8. **Update documentation**
   - Add admin UI section to README
   - Create GUIDE.md and SETUP.md

---

## Critical Files

| File | Purpose |
|------|---------|
| `~/github/poytz/src/index.js` | Worker code (to rewrite) |
| `~/github/poytz/wrangler.toml` | Config (add KV binding) |
| `~/github/poytz/README.md` | Update with admin docs |

---

## Security Considerations

- Basic Auth over HTTPS (Cloudflare enforces)
- Password stored as Wrangler secret (not in code)
- Admin path not guessable from landing page
- No session tokens (stateless)

---

## Rollback Plan

If KV causes issues, revert to hardcoded routes:
1. Keep backup of current src/index.js
2. Routes also documented in README
3. Can restore in <5 minutes

---

## Success Criteria

- [ ] Admin UI accessible at khamel.com/admin
- [ ] Password protection working
- [ ] Can add/edit/delete routes via UI
- [ ] All existing routes migrated to KV
- [ ] Landing page shows routes dynamically
- [ ] 3-tier documentation complete
- [ ] Screenshots in SETUP.md

---

# Poytz Micro-SaaS Business Model

## The Deal

**$X once. Good for 5 years. Probably forever.**

- Pay once, get `yourname.poytz.app/*` for minimum 5 years
- If nothing breaks and you're chill, it just keeps working forever
- No renewal, no subscription switch, no bullshit

**If we ever need to part ways:**
1. Full refund of whatever you paid
2. Equal donation to Electronic Frontier Foundation
3. 30 days notice (unless illegal, then immediate)
4. We part as friends

*You literally cannot lose money on this.*

---

## Branding

**Name:** poytz (pronounced "points.app")

*Not really, it's just the best URL we could find where everything was available.*

---

## Build Order

**Phase 1: Prove on yourself first (cost: $0)**
- Buy poytz.app from Cloudflare Registrar
- Set up khamel.poytz.app as your own subdomain
- Migrate current routes to KV storage
- Test: Can YOU manage routes via admin UI?

**Phase 2: Multi-tenant for friends (cost: $0)**
- Add subdomain routing: `friend.poytz.app`
- Manually add 2-3 friends to test
- Test: Does it work for someone who isn't you?

**Phase 3: Self-service signup (cost: $0)**
- Google OAuth for auth
- Lemon Squeezy for payments
- Landing page with escalating price

**If it works for you, it works for a million people.** The entire infrastructure is stateless KV lookups.

---

## Pricing: Shrinking Tiers (The Crank)

**Lemon Squeezy fees:** $0.50 + 5% per transaction

| Users | Price | Slots | Your Take | Running Total |
|-------|-------|-------|-----------|---------------|
| 1-50 | $1.00 | 50 | $0.45 | $22.50 |
| 51-90 | $1.25 | 40 | $0.69 | $50.10 |
| 91-120 | $1.50 | 30 | $0.93 | $77.90 |
| 121-145 | $1.75 | 25 | $1.16 | $106.90 |
| 146-165 | $2.00 | 20 | $1.40 | $134.90 |
| 166-180 | $2.25 | 15 | $1.64 | $159.50 |
| 181-192 | $2.50 | 12 | $1.88 | $182.06 |
| 193-202 | $2.75 | 10 | $2.11 | $203.16 |
| 203-211 | $3.00 | 9 | $2.35 | $224.31 |
| 212+ | $5.00 | ∞ | $4.25 | +$4.25/user |

**The crank:** Tiers shrink (50 → 40 → 30 → 25 → 20 → 15 → 12 → 10 → 9...) so price accelerates.

**Display on landing page:**
```
Current price: $1.25
↑ was $1.00 (50 people got it)
↓ next: $1.50 (in 8 slots)

42/50 slots remaining at this price
```

**Revenue at 200 users:** ~$200 pure profit (domain is sunk cost)

---

## Lemon Squeezy (Payment Processor)

**Fees:** $0.50 + 5% per transaction

| Price | Fee | You Keep | Keep % |
|-------|-----|----------|--------|
| $1.00 | $0.55 | $0.45 | 45% |
| $1.50 | $0.58 | $0.92 | 61% |
| $2.00 | $0.60 | $1.40 | 70% |
| $5.00 | $0.75 | $4.25 | 85% |

**Why Lemon Squeezy:**
- Handles sales tax globally (they're merchant of record)
- Apple Pay, Google Pay, PayPal
- No 1099 headache
- Acquired by Stripe in 2024 → stable

**$1 is a loss leader** (45% to fees), but it's fine for early users. Price accelerates to profitable quickly.

---

## The Economics

**Your costs:**
| Item | Cost | When |
|------|------|------|
| poytz.app domain | $15/year | Sunk cost (you'd own it anyway) |
| Cloudflare Workers | $0 | Until 30,000 users |
| Cloudflare KV | $0 | Until 100k reads/day |
| Lemon Squeezy | 5% + $0.50 | Per transaction |
| Google OAuth | $0 | Forever |

**Profit from user #1.** Domain is sunk cost. Everything else is pay-per-use.

**Cash-flow positive from user #1:**
- User 1 pays $1 → you keep $0.95
- Domain would exist regardless
- **You are profitable from the first dollar**

**At scale:**
- 100 users × $1.50 avg = $150 revenue
- Lemon Squeezy takes 5% = $7.50
- Net: $142.50 pure profit (domain is sunk cost)

**Lemon Squeezy minimum: $1.00**
Most payment processors require $1 minimum. So pricing is:
- Users 1-100: $1.00
- Users 101-200: $1.25
- Users 201-300: $1.50
- ... up to $5 cap

After that, every new user is nearly pure profit:
- User 101 pays $2 → you keep $1.90
- No incremental infrastructure cost
- No support burden (what would they even ask?)

**The "doing nothing" business:**
- Initial build: ~20 hours
- Ongoing maintenance: ~0 hours (it's 200 lines of JS on Cloudflare)
- Revenue: $100-5000+ depending on traction
- Hourly rate: Infinite (no ongoing hours)

---

## Terms of Service (The Whole Thing)

```
POYTZ TERMS OF SERVICE

1. You pay once. You get 5 years minimum. Probably forever.

2. Don't use this service in bad faith.
   - No illegal stuff (obvious)
   - No harming others (phishing, malware, spam)
   - No being a jerk (you know if you're being one)

3. If we decide you're abusing the service:
   - Full refund to you
   - Equal amount donated to Electronic Frontier Foundation
   - 30 days notice (unless illegal, then immediate)
   - We part as friends

4. We might disappear someday. Buses exist.
   - We'll try to give notice
   - We'll open source everything if we shut down
   - Your redirects are just URLs. Recreate them anywhere.

5. That's it. Go make some short URLs.
```

**The deal:** Unless you're using this in bad faith, your purchase is yours forever. If we ever say otherwise, you get your money back AND we donate the same amount to EFF. You literally cannot lose.

---

## Username Rules

- Lowercase letters (a-z) and numbers (0-9) only
- No dots, dashes, underscores, or special characters
- 3-20 characters
- First-come-first-served
- One username per payment

Examples: `sarah2024`, `acme`, `photos123`

**Reserved usernames (blocked):**
```javascript
const RESERVED = [
  'admin', 'api', 'www', 'app', 'mail', 'ftp', 'ssh',
  'omar', 'khamel', 'poytz', 'support', 'help', 'billing',
  'login', 'auth', 'oauth', 'callback', 'webhook',
  'test', 'demo', 'example', 'null', 'undefined'
];
```

---

## Technical Changes for Multi-Tenant

**Current (single-tenant):**
```javascript
// KV key: "photos" → "https://target.com/photos"
const target = await env.ROUTES.get(path);
```

**Multi-tenant:**
```javascript
// KV key: "khamel:photos" → "https://target.com/photos"
// URL: khamel.poytz.app/photos
const subdomain = getSubdomain(request);
const target = await env.ROUTES.get(`${subdomain}:${path}`);
```

**User management:**
```javascript
// KV key: "user:omar" → { email, created, plan }
// On signup webhook from Lemon Squeezy:
await env.USERS.put(`user:${username}`, JSON.stringify({
  email: webhookData.email,
  created: Date.now(),
  plan: 'lifetime'
}));
```

---

## Two Products, Same Codebase

### Product 1: Poytz Open Source (Free)
**"Here's how to do this yourself"**
- Public GitHub repo
- README explains the 15-line version
- For: Nerds who want to self-host
- Revenue: $0 (and that's fine)

### Product 2: Poytz Hosted (Paid)
**"Pay $1, we do it for you"**
- Same code, multi-tenant
- For: People who don't want to touch Cloudflare
- Revenue: $1-5 per user, lifetime
- What you're selling: Convenience + a subdomain + "someone else maintains this"

---

## Authentication: Google OAuth Only

**Why just Google:**
- $0 forever (Google maintains it)
- Everyone has a Google account (or can make one in 30 seconds)
- Tailscale uses Google → guaranteed compatible with our users
- One provider = zero maintenance, zero edge cases
- No email sending costs (magic links), no per-user pricing (Cloudflare Access)

**We explicitly do NOT support GitHub, Apple, or anything else.** One provider that works with everything.

**How it works:**
1. User clicks "Sign in with Google"
2. Google shows consent screen, user approves
3. Google redirects back with auth code
4. We exchange code for user info (email, ID)
5. Store session in cookie, user is logged in

**Implementation (~50 lines):**
```javascript
// OAuth callback handler
async function handleOAuthCallback(request, env) {
  const code = new URL(request.url).searchParams.get('code');

  // Exchange code for tokens
  const tokens = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'https://poytz.app/auth/callback',
      grant_type: 'authorization_code'
    })
  }).then(r => r.json());

  // Get user info
  const user = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  }).then(r => r.json());

  // Create session
  const sessionId = crypto.randomUUID();
  await env.SESSIONS.put(sessionId, JSON.stringify({
    email: user.email,
    username: lookupUsername(user.email)
  }), { expirationTtl: 30 * 24 * 60 * 60 });

  // Set cookie and redirect to admin
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/admin',
      'Set-Cookie': `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
    }
  });
}
```

**Setup once:**
1. Create Google Cloud project (free)
2. Enable OAuth, get client ID + secret
3. Store as Wrangler secrets
4. Done forever

---

## Privacy Stance

**What we store:**
```
user:omar → {
  email: "omar@example.com",      // For magic links
  lemon_squeezy_id: "cust_xxx"   // For refunds
}
```

**What we DON'T store:**
- Passwords (no passwords exist)
- Usage analytics
- IP addresses
- Click counts
- Anything else

**The honest pitch:**
> "We only know who you are when we need to refund you. That's it. No tracking, no analytics, no selling data. We literally don't have the infrastructure to spy on you even if we wanted to."

This is true. You're storing the bare minimum to:
1. Let them log in (email)
2. Refund them if needed (Lemon Squeezy ID)

Cloudflare handles rate limiting. Abuse would be obvious at the edge. You don't need analytics.

---

## Build Order (Incremental)

### Step 1: Single-User Admin UI (NOW)
- You already have the Worker
- Add Basic Auth admin page
- Add KV storage for routes
- Test: Can YOU add/edit/delete routes?

### Step 2: Multi-Tenant Layer
- Add subdomain routing (`omar.khamel.com`)
- Prefix KV keys with username (`omar:photos`)
- Test with 2-3 friends manually added

### Step 3: Self-Service Signup
- Landing page with pricing
- Lemon Squeezy checkout
- Webhook creates user in KV
- Magic link email for login

### Step 4: Open Source Release
- Clean up code
- Write README (15-line minimal version)
- Post to GitHub
- "Here's how to do this yourself for free"

### Step 5: Launch Hosted Version
- Buy poytz.app domain
- Deploy multi-tenant Worker
- Announce

---

## Revised Launch Checklist

**Phase 1: Make It Work For You**
- [ ] Admin UI with Basic Auth
- [ ] KV storage for routes
- [ ] Test on khamel.com

**Phase 2: Multi-Tenant (Still Free)**
- [ ] Subdomain routing
- [ ] User prefixes in KV
- [ ] Manual signup for 2-3 friends
- [ ] Magic link auth

**Phase 3: Payments**
- [ ] Lemon Squeezy product
- [ ] Webhook integration
- [ ] Self-service signup flow

**Phase 4: Open Source + Launch**
- [ ] Clean up code
- [ ] Write minimal README
- [ ] Buy poytz.app
- [ ] Deploy
- [ ] Announce

---

## Project Tracking

**Set up beads on poytz repo:**
- Track each planning session
- Save prompts and decisions to markdown
- Keep history of architectural choices

```bash
# Initialize beads in poytz project
cd ~/github/poytz
# Set up beads tracking (first action after exiting plan mode)
```

**Key decisions to document:**
1. Tailscale Funnel + Cloudflare Worker architecture
2. OAuth over magic links (cost: $0 forever)
3. Pinboard-style escalating pricing ($1→$5)
4. 5-year deal with EFF refund clause
5. Multi-tenant via KV key prefixes
6. Lemon Squeezy for payments (handles tax)

---

## Name Search Status

### WINNER: **poytz**

| Domain | Status |
|--------|--------|
| poytz.app | **AVAILABLE** - Buy this one |
| poytz.com | AVAILABLE |
| poytz.io | AVAILABLE |
| poytz.dev | AVAILABLE |
| poytz.ai | AVAILABLE |
| All others | AVAILABLE (only 1 of 100+ taken) |

| Check | Status |
|-------|--------|
| GitHub | **CLEAR** - No repos/users |
| npm | **CLEAR** - No packages |
| Language check | **SAFE** - "potz" is archaic German for "goodness gracious!" |

**Pronunciation:** "points" → evokes destinations/endpoints
**Why it works:** 5 letters, unique, memorable, all domains free

### Rejected (TAKEN)
- jisr - looks like "jizz"
- routz - 37 domains taken, .app taken
- slinq - .app taken
- waygo - .app $12,999
- hop, goto, zap, warp - npm/GitHub
- relay, glide, pivot, drift, hinge, trail, blaze - .app taken
- ponte, glyph, sprig, frond - npm
- voy, dux, lux, qix - premium
- shurl, sendy, redir, yoink, boop, bonk, yokto - npm
- pinge, pikel - conflicts

### Action Required
**Buy from Cloudflare Registrar:** `poytz.app`
