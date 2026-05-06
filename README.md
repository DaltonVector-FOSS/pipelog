# Pipelog

Capture command output from your terminal, store it in a workspace, and share it with your team. This repository contains a **Rust CLI**, a **Fastify + PostgreSQL API**, and a **React (Vite)** web app.

## Repository layout

| Path | Purpose |
|------|---------|
| `cli/` | `pipelog` CLI: run commands, pipe output, auth, search, replay, share links |
| `backend/` | HTTP API (`npm run dev`), migrations, JWT auth |
| `web/` | Dashboard UI (`vite`) |

## Run everything with Docker

From the repo root:

```bash
docker compose up --build
```

- **API**: [http://localhost:3001](http://localhost:3001) (health: `/health`)
- **Web**: [http://localhost:5173](http://localhost:5173)
- **Postgres**: port `5432` (default credentials in compose file)

The API container runs migrations (`db:migrate`) then `dev`. Source trees are mounted for hot reload (`backend/src`, `web/src`).

### Environment variables (optional)

Override defaults by exporting variables or using a `.env` file read by Docker Compose:

| Variable | Role |
|----------|------|
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Database |
| `DATABASE_URL` | API connection string (must match Postgres service) |
| `API_PORT` | API listen port (host and container) |
| `WEB_PORT` | Vite dev server port |
| `JWT_SECRET` | Signing secret for API tokens |
| `WEB_URL` | Allowed CORS origin when `CORS_ORIGINS` is unset |
| `CORS_ORIGINS` | Comma-separated origins (replaces single `WEB_URL` behavior) |
| `VITE_API_URL` | Browser-visible API base URL |
| `VITE_PROXY_TARGET` | Vite proxy target inside Docker (usually `http://api:3001`) |

**Production:** change `JWT_SECRET` and database credentials; do not rely on compose defaults.

## CLI

Build and install from source:

```bash
cd cli
cargo build --release
# Binary: target/release/pipelog
```

Typical flow:

1. `pipelog auth login` — stores token in your user config (see `pipelog config`).
2. Run a command and capture: `pipelog run -- npm test` or pipe: `npm test 2>&1 | pipelog -T "CI run"`.
3. List or search: `pipelog list`, `pipelog search "error"`.
4. Open the UI: `pipelog dashboard`.

Other commands include `replay`, `share`, `show`, `delete`, `tag`, and `init` (shell integration). Use `pipelog --help` and `pipelog <command> --help` for options.

### CLI and API URL

By default the CLI targets the hosted API and web app. For local development, after `docker compose up`, point the CLI at your stack:

```bash
pipelog config   # shows config path and current values
```

Edit the JSON at the printed path and set `api_url` to `http://localhost:3001` and `web_url` to `http://localhost:5173`, or use whatever host ports you mapped.

## Local development without Docker

1. Start PostgreSQL 16 and create a database (match `DATABASE_URL`).
2. **Backend** (`backend/`): `npm ci`, set `DATABASE_URL`, `JWT_SECRET`, `PORT`, `WEB_URL` (or `CORS_ORIGINS`), then `npm run db:migrate` and `npm run dev`.
3. **Web** (`web/`): `npm ci`, set `VITE_API_URL` to the API URL the browser will call, then `npm run dev`.
