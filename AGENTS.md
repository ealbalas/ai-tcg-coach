# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.

## Dev environment

```bash
docker compose up         # builds everything and starts postgres + api + web
```

- Frontend: http://localhost:3000
- API: http://localhost:3001/health

For local iteration without Docker: start `docker compose up postgres redis`, then `npm run dev` in each package with the env vars from `.env.example`.
Set `ANTHROPIC_API_KEY` in the environment for LLM coaching to work.

## Project structure

```
packages/api/   Node.js + Fastify REST API (ESM, no TypeScript)
packages/web/   Next.js 14 + Tailwind frontend (TypeScript)
data/logs/      Raw uploaded log files, one per game (volume-mounted in Docker)
```

Migrations run automatically at API startup (`packages/api/src/index.js`) applying `packages/api/migrations/001_initial.sql`.

## OPTCGSim log format

See `packages/api/src/parser.js` for the full field-by-field documentation.
Summary of confirmed field meanings:

**Header section (plain text lines before event lines):**
- `Waiting for a Connection with Room ID:<ID>` - room identifier
- `<Name>#<disc> Has Connected` - player join; first connector = player 1, second = player 2
- `Version is <ver>` - OPTCGSim client version
- `[<Name>] Leader is <card_name> ["<id>"><id>]` - leader card declaration
- `[<Name>] Chose to go Second` - determines who goes first

**Event lines (pipe-delimited, prefix `RZ1`):**

ACTION line: `RZ1|<seq>|<player>|<card_id>|<f4..f12>`
- `seq`: monotonic action sequence number
- `player`: 1 or 2
- `card_id`: OPTCG format `SET-NNN` (e.g. `OP17-094`)
- `f5` (index 1 after card_id): card position/zone index (0-based, increments per card in zone)
- `f7` (index 3 after card_id): phase card count (how many cards placed so far in this phase)
- All other numeric fields: unknown, stored raw

CHK line: `RZ1|CHK|<seq>|<player>|<f0..f9>`
- `seq`: matches preceding action
- `f0`: always 50 in sample (likely deck size / constant)
- `f4`: always 10 in sample (possibly life total constant)
- `f8`: phase-complete flag (0 during setup, 1 when setup phase ends)
- All other numeric fields: unknown, stored raw

**Important limitation:** the available sample only covers the card-placement setup phase.
In-game action types (attacks, DON!!, card plays) have not been confirmed from real game logs.
The parser stores all unknown fields raw so they can be reinterpreted once richer samples arrive.

## Card name lookup

Implementation: `packages/api/src/cards.js`
`loadCards()` is called non-blocking at startup: it tries two remote community JSON URLs, falls back to a hardcoded leader map if both fail.
`getCardName(cardId)` returns the cached name or `null`.
The startup race window (requests arriving before the cache is warm) is accepted: coaching notes written during that window will simply lack a leader-recognition note.

## Heuristic coaching engine

Implementation: `packages/api/src/coaching.js`
Runs synchronously after upload; notes stored in `coaching_notes` table with `layer='rule'`.
Game-level notes (not tied to a turn) are stored with `turn_id = NULL`.

Implemented heuristics:
- **Turn 1 setup** (`checkFirstTurnSetup`): `severity='warning'` if ≤3 actions on turn 1 (incomplete life zone placement); `severity='info'` if exactly 4 (one card short) or ≥6 (more events than expected).
- **Empty turn** (`checkEmptyTurn`): `severity='info'` for any non-turn-1 turn with zero recorded actions.
- **Leader recognition** (`checkLeaderRecognition`): game-level note (turn_id = NULL). Card name resolved via `getCardName`. `OP` prefix: set number ≤5 = classic tip, >5 = newer-meta tip. `ST` prefix = starter-deck tip. Other prefixes = generic recognition note.

Heuristics intentionally skipped (and why):
- **DON!! unused**: requires confirmed action-type fields for DON!! gain/attach/cost - not yet reverse-engineered from log samples.
- **No attacks made**: same - attack action codes are not confirmed from available samples.

Future work: collect real in-game OPTCGSim logs that include attacks, DON!!, and main-phase card plays, then update the parser field documentation and enable the skipped heuristics.

## LLM coaching pipeline

Implementation: `packages/api/src/queue.js`
BullMQ queue named `'coaching'` backed by Redis (`REDIS_URL` env var, default `redis://localhost:6379`).
Requires `ioredis` as a peer dependency (installed).

Upload flow: after heuristic notes are committed, a job is enqueued and `coaching_status` set to `'analyzing'`.
Worker: calls Claude claude-sonnet-4-6 via `@anthropic-ai/sdk`, parses JSON response, inserts `layer='llm'` notes, sets status `'done'` (or `'error'`).

**Queue injection pattern:** `gamesRoutes` accepts `opts.coachingQueue` (injected from `index.js`).
Tests omit this option so no Redis connection is opened - do not import from `queue.js` in test files.

`GET /api/games/:id` enriches each action in `actions_json` with `cardName: string | null` at response time (not stored in DB).
`GET /api/games/:id/coaching-status` returns current `coaching_status` for polling.

Frontend polls every 5 s while status is `'pending'` or `'analyzing'`; refetches full game on `'done'`.
LLM notes (`layer='llm'`) render with purple/violet styling and "AI Coach" label instead of severity.
