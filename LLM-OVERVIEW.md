# LLM Overview — poytz
*Updated: 2026-05-10 07:35 UTC | Tier: standard | Auto-updated: daily cron*

## What This Is
**Personal cloud infrastructure on Cloudflare Workers.** Write once, run forever, $0/month.

## Current State
*Status: 🟢 active from local git history*

**Active work:**
- a8503e0 chore: bootstrap LLM-OVERVIEW files 2026-05-10
- 223fba2 fix: remove duplicate header rows from session index
- bbd6076 docs: Add Poytz API troubleshooting fix
- 5627e03 fix: redirect OAuth callback to root instead of admin
- 1092bed fix: handle legacy routes for / root redirect
- 72d1d4e fix: correct handleRootProxy URL handling

**Known issues:**
- No known issue found in recent commit subjects or local TODO/BLOCKERS docs.

**Recent changes (7 days):**
- `a8503e0 chore: bootstrap LLM-OVERVIEW files 2026-05-10`
- `830079b Archive — replaced by khamel-tunnel Cloudflare Tunnel`

## Architecture
- Stack marker: Node/JavaScript
- Top-level entry: `ARCHIVED.md`
- Top-level entry: `docs/`
- Top-level entry: `LLM-OVERVIEW.md`
- Top-level entry: `OPERATIONS.md`
- Top-level entry: `package-lock.json`
- Top-level entry: `package.json`
- Top-level entry: `README.md`
- Top-level entry: `src/`

## Key Commands
- `npm run deploy  # wrangler deploy`
- `npm run dev  # wrangler dev`
- `npm run tail  # wrangler tail`
- `git status --short`
- `git log --oneline -5`

## Dependencies
- **Runs on:** Not declared in local repo evidence.
- **Calls out to:** See repo docs and config files.
- **Called by:** Not declared in local repo evidence.
- **Env vars required:** No `.env.example` keys found.

## Critical Rules
- Preserve repo-local instructions in `AGENTS.md`, `CLAUDE.md`, or README when present.
- Do not infer behavior from the repository name alone; verify against local docs and source.

## Gotchas
- Generated from local evidence only: git history, top-level structure, README/CLAUDE/AGENTS/docs, and env examples.
