# AI TCG Coach

AI-powered coaching platform for One Piece TCG players.
Upload your OPTCGSim game logs, get turn-by-turn analysis, and learn where you could have made better plays.

## Quick start

```bash
docker compose up
```

The first run builds both images, starts PostgreSQL, and runs migrations automatically.

- Frontend: http://localhost:3000
- API: http://localhost:3001
- Health check: http://localhost:3001/health

## How to use

1. Open http://localhost:3000
2. Create an account or log in
3. Click **Upload a game** and select a `.txt` log file exported from OPTCGSim
4. The game is parsed and heuristic coaching runs immediately
5. Click the game in the list to see the turn timeline with coaching notes
6. Click **Card Database** in the navigation to browse and search the full One Piece TCG card catalog

## Configuration

Copy `.env.example` to `.env` and set `JWT_SECRET` to a random string before deploying to any shared environment.

```bash
cp .env.example .env
```

The Docker Compose file reads `JWT_SECRET` from the environment (or defaults to `change-me-in-production`).

## Development

Run the API and web packages independently for local development:

```bash
# API (requires a running PostgreSQL)
cd packages/api && npm install && DATABASE_URL=postgres://tcgcoach:tcgcoach@localhost:5433/tcgcoach JWT_SECRET=dev npm run dev

# Web
cd packages/web && npm install && NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
```

Or run just the database via Docker and the apps locally:

```bash
docker compose up postgres
```
