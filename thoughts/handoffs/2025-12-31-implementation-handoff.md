# Handoff: Poytz Implementation Ready for Deploy

**Created**: 2025-12-31
**Status**: Code complete, awaiting Google OAuth setup + deploy

---

## Quick Resume

```bash
cd ~/github/poytz
cat thoughts/handoffs/2025-12-31-implementation-handoff.md
```

Or just say: **"resume poytz"**

---

## What's Done

- [x] wrangler.toml configured for khamel.com (POC)
- [x] src/index.js fully rewritten (~740 lines)
  - Google OAuth flow
  - Session management (KV-based, 30-day expiry)
  - Admin UI ("sexy spreadsheet" dark theme)
  - Multi-tenant routing (subdomain:path)
  - Landing page with "Coming Soon"
- [x] KV namespaces created:
  - ROUTES: `dc824698371b4c28b31593edf3b5ea0d`
  - USERS: `32cabb6d5b364f598d1b26ce6a278d9d`
  - SESSIONS: `acd826daab8845fe9b613a127c567424`
- [x] All 11 routes migrated to KV with `khamel:` prefix
- [x] User account created: `zoheri@gmail.com` → `khamel`
- [x] Local test passed (landing page renders)

---

## What's Left (10 min)

### 1. Google Cloud Console (browser)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create project "poytz" (or use existing)
3. **APIs & Services → OAuth consent screen**
   - User Type: External
   - App name: Poytz
   - Add `zoheri@gmail.com` as test user
4. **Credentials → Create OAuth 2.0 Client ID**
   - Application type: Web application
   - Name: Poytz
   - Authorized redirect URI: `https://khamel.com/auth/callback`
5. Copy **Client ID** and **Client Secret**

### 2. Add Secrets (terminal)

```bash
cd ~/github/poytz
npx wrangler secret put GOOGLE_CLIENT_ID
# paste client ID, press enter

npx wrangler secret put GOOGLE_CLIENT_SECRET
# paste secret, press enter
```

### 3. Deploy

```bash
npx wrangler deploy
```

### 4. Test

| URL | Expected |
|-----|----------|
| `https://khamel.com` | Landing page |
| `https://khamel.com/auth/login` | Redirect to Google |
| After OAuth | Redirect to `khamel.khamel.com/admin` |
| `https://khamel.khamel.com/photos` | Redirect to homelab |

---

## Architecture

```
khamel.com/                    → Landing page (public)
khamel.com/auth/login          → Google OAuth redirect
khamel.com/auth/callback       → OAuth callback, creates session
khamel.khamel.com/admin        → Admin UI (authenticated)
khamel.khamel.com/photos       → KV lookup → 302 redirect
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/index.js` | Worker code (complete) |
| `wrangler.toml` | Config with KV bindings |
| `thoughts/PLAN.md` | Full plan with business model |

---

## After POC Works → Production

Once khamel.com POC is verified:

1. Buy `poytz.app` from Cloudflare Registrar (~$15/year)
2. Update wrangler.toml:
   - Change routes to `poytz.app`
   - Change `DOMAIN` to `poytz.app`
   - Change `OAUTH_REDIRECT_URI` to `https://poytz.app/auth/callback`
3. Add `https://poytz.app/auth/callback` to Google OAuth redirect URIs
4. Re-migrate routes with new prefix (or keep `khamel:` as your username)
5. Deploy

---

## Costs

| Item | Cost |
|------|------|
| khamel.com (existing) | $0 |
| Google OAuth | $0 |
| Cloudflare Workers/KV | $0 |
| **POC Total** | **$0** |

---

*Tomorrow: "resume poytz" → finish in 10 minutes*
