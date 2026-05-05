# Archived

Poytz has been replaced by the Cloudflare Tunnel (`khamel-tunnel`) running on homelab.

The Cloudflare Worker may still be deployed but is no longer the primary routing mechanism. All `khamel.com/*` traffic now goes through:

1. Cloudflare DNS → Cloudflare Tunnel (khamel-tunnel on homelab)
2. → funnel-proxy (nginx on homelab) → Authentik SSO → Docker services

See `~/github/homelab/services/khamel-tunnel/` and `~/github/homelab/services/funnel-proxy/` for current architecture.
