# Handoff: Poytz Initial Planning Complete

**Created**: 2025-12-31
**Repo**: github.com/Khamel83/poytz
**Plan**: `thoughts/PLAN.md`

## Quick Summary

Completed comprehensive planning for Poytz - a personal URL shortener that scales to micro-SaaS. Name confirmed (poytz.app), pricing designed (shrinking tiers $1→$5), tech stack chosen (Cloudflare + Google OAuth + Lemon Squeezy). Ready to implement.

## Current State

### What's Done
- [x] GitHub repo renamed from jisr to poytz
- [x] Name search - verified poytz.app and all major TLDs available
- [x] Verified GitHub and npm are clear for "poytz"
- [x] Designed shrinking tier pricing model
- [x] Chose Google OAuth as ONLY auth provider
- [x] Chose Lemon Squeezy for payments
- [x] Full implementation plan written (700+ lines)
- [x] TOS designed with EFF refund clause

### Not Started
- [ ] Buy poytz.app domain from Cloudflare Registrar
- [ ] Update wrangler.toml with new name
- [ ] Create KV namespace
- [ ] Implement admin UI with Basic Auth
- [ ] Migrate routes to KV storage
- [ ] Implement Google OAuth
- [ ] Set up Lemon Squeezy

## Key Files

```
~/github/poytz/
├── thoughts/
│   ├── PLAN.md                    # Full implementation plan
│   └── handoffs/
│       └── 2025-12-31-initial-planning-handoff.md  # This file
├── src/
│   └── index.js                   # Current Worker (to rewrite)
├── wrangler.toml                  # Cloudflare config
└── README.md                      # Docs (to update)
```

## Required Services

| Service | Purpose | Cost | Setup |
|---------|---------|------|-------|
| **Cloudflare** | Workers + KV + DNS | $0 | Have account |
| **Google Cloud** | OAuth | $0 | Need to create project |
| **Lemon Squeezy** | Payments | 5% + $0.50/tx | Need account |
| **Tailscale** | Self-hosted funnels | $0 | Have account |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Name: poytz | All domains available, GitHub/npm clear |
| Google OAuth only | $0 forever, zero maintenance, everyone has account |
| Lemon Squeezy | Handles global sales tax automatically |
| Shrinking tiers | Creates urgency, price accelerates |
| EFF refund clause | If we kick you: full refund + equal EFF donation |

## Pricing Model

```
Users 1-50:    $1.00  (50 slots)  → You keep $0.45
Users 51-90:   $1.25  (40 slots)  → You keep $0.69
Users 91-120:  $1.50  (30 slots)  → You keep $0.93
...tiers shrink, price accelerates...
Users 212+:    $5.00  (cap)       → You keep $4.25
```

## Domain Status (Verified 2025-12-31)

| Domain | Status |
|--------|--------|
| poytz.app | **AVAILABLE** - Buy this |
| poytz.com | AVAILABLE |
| poytz.io | AVAILABLE |
| poytz.dev | AVAILABLE |
| poytz.ai | AVAILABLE |

## Build Order

### Phase 1: Make it work for you
1. Buy poytz.app from Cloudflare
2. Update wrangler.toml (name = "poytz", add KV binding)
3. Create KV namespace: `wrangler kv:namespace create ROUTES`
4. Implement admin UI with Basic Auth
5. Test at khamel.poytz.app

### Phase 2: Multi-tenant
1. Add subdomain routing
2. KV key prefix: `username:path`
3. Test with 2-3 friends

### Phase 3: Self-service
1. Implement Google OAuth
2. Set up Lemon Squeezy product
3. Connect payment webhook
4. Launch

## Resume Instructions

```bash
cd ~/github/poytz

# Read the full plan
cat thoughts/PLAN.md

# Check current state
git status
cat src/index.js
cat wrangler.toml
```

**Next Steps:**
1. Buy poytz.app domain
2. Run `wrangler kv:namespace create ROUTES`
3. Start implementing admin UI

---

*When ready to continue: "resume poytz implementation"*
