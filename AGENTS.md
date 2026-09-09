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

For local iteration without Docker: start `docker compose up postgres`, then `npm run dev` in each package with the env vars from `.env.example`.

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

## Heuristic coaching engine

Implementation: `packages/api/src/coaching.js`
Runs synchronously after upload; notes stored in `coaching_notes` table with `layer='rule'`.

Implemented heuristics:
- **Turn 1 low action count** (`checkFirstTurnSetup`): flags `severity='info'` if turn 1 has fewer than 2 actions, suggesting setup may be incomplete.

Heuristics intentionally skipped (and why):
- **DON!! unused**: requires confirmed action-type fields for DON!! gain/attach/cost - not yet reverse-engineered from log samples.
- **No attacks made**: same - attack action codes are not confirmed from available samples.

Future work: collect real in-game OPTCGSim logs that include attacks, DON!!, and main-phase card plays, then update the parser field documentation and enable the skipped heuristics.
