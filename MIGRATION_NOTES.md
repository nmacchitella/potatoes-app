# Migration notes — potatoes → Beelink self-host

Potatoes moved off Fly.io (backend + frontend + SQLite volume) onto the
self-hosted **Beelink** (`giaggi.tail66af38.ts.net`), the same Docker host that
runs eilish-ops. Public URL: **https://potatoes.macchitella.xyz** (Cloudflare
Tunnel → `caddy:80` → `potatoes-api` / `potatoes-web`).

The infra files (docker-compose, Caddyfile, deploy scripts, .env) live on the
Beelink at `~/server/`, NOT in this repo. This repo only carries the app +
Dockerfiles + the GitHub Actions deploy workflow.

## 1. Database: SQLite → Postgres

The app is written against **synchronous** SQLAlchemy (`create_engine` in
`database.py`). On the Beelink it uses the shared Postgres 17 container, DB
`potatoes`, via the **sync** driver:

    DATABASE_URL=postgresql+psycopg2://<user>:<pass>@postgres:5432/potatoes

- `database.py` only passes `check_same_thread` for `sqlite://` URLs, so no code
  change was needed — just the `psycopg2-binary` dependency (added to
  `requirements.txt`). It is **psycopg2, not asyncpg** (the engine is sync).
- Locally you can still run on SQLite (the default `DATABASE_URL`); nothing here
  forces Postgres.

### ⚠ Three migrations are SQLite-only and crash on Postgres

`alembic upgrade head` against a **fresh** Postgres DB will fail:

| Migration | Why it breaks on PG |
|---|---|
| `fix_schema_drift.py` | queries `sqlite_master` |
| `add_oauth_authorization_codes.py` | queries `sqlite_master` |
| `remove_grocery_list_user_unique.py` | SQLite "rebuild table" (CREATE new / copy / drop / rename) |

So we do **not** replay history on a fresh PG DB. Instead:

- **Migrating existing data** (the path used for the Beelink cutover): pgloader
  copies the schema + rows from the Fly SQLite file into Postgres, then
  `python scripts/bootstrap_pg.py --stamp-only` marks Alembic at `head` without
  running any migration.
- **Fresh empty DB**: `python scripts/bootstrap_pg.py` runs
  `Base.metadata.create_all()` (current correct schema) + `alembic stamp head`.

After either, `start.sh`'s `alembic upgrade head` is a no-op until the **next**
migration is added — and that next migration **must be Postgres-safe** (no
`sqlite_master`, no table-rebuild dance; use `op.alter_column` / proper
`batch_alter_table` ops that render on PG).

## 2. URLs / same-origin

Frontend and backend are served from the **same origin**
(`potatoes.macchitella.xyz`); Caddy routes `/api/*`, `/mcp*`, `/oauth/*`,
`/.well-known/oauth-*` to the backend and everything else to Next.js.

- `NEXT_PUBLIC_API_URL=https://potatoes.macchitella.xyz/api` (baked at build).
- Backend `BACKEND_URL` / `FRONTEND_URL` = `https://potatoes.macchitella.xyz`.
  `BACKEND_URL` also seeds the OAuth-server metadata (issuer, MCP resource) and
  the Google redirect URIs, so it must be the public https URL.
- CSP `connect-src` was tightened from `'self' https://*.fly.dev` to just
  `'self'` (`frontend/next.config.js`) since the API is now same-origin.

## 3. No paused features

Unlike eilish-ops (Playwright/Meta), none of potatoes' deps are heavy enough to
pause — `yt-dlp`, `youtube-transcript-api`, `beautifulsoup4`, `lxml`,
`google-genai` are all pure-Python. The only optional capability is **AI recipe
import**, gated by `GEMINI_API_KEY`: if unset, import-from-URL/YouTube fails at
call time but the app boots fine. The key is set in `~/server/.env` on the
Beelink.

## 4. Secrets / OAuth on cutover

- `POTATOES_SECRET_KEY` is freshly generated on the Beelink (the repo/local one
  was a placeholder). Changing it invalidates existing JWTs/sessions → everyone
  re-logs-in once. Data is untouched.
- Google Cloud Console — authorized redirect URIs to add for the new domain:
  - `https://potatoes.macchitella.xyz/api/auth/google/callback` (web login)
  - `https://potatoes.macchitella.xyz/oauth/google-callback` (MCP OAuth flow)
  - JS origin: `https://potatoes.macchitella.xyz`
- claude.ai "Potatoes Kitchen" connector → `https://potatoes.macchitella.xyz/mcp`.

## 5. Deploy

`.github/workflows/deploy-prod.yml` no longer deploys to Fly; on push to `main`
it joins the tailnet and SSHes to the Beelink to run
`~/server/scripts/auto-pull.sh`, which fast-forwards `~/apps/potatoes` and
rebuilds `potatoes-api` + `potatoes-web`. Repo secrets required: `TS_AUTHKEY`,
`BEELINK_SSH_KEY`. (`deploy-dev.yml` still targets Fly dev — left as-is.)
