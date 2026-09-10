CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  played_at TIMESTAMPTZ,
  my_leader_card_id TEXT,
  opp_leader_card_id TEXT,
  went_first BOOLEAN,
  result TEXT CHECK (result IN ('win', 'loss', 'unknown')),
  raw_log_path TEXT,
  coaching_status TEXT DEFAULT 'pending' CHECK (coaching_status IN ('pending', 'analyzing', 'heuristic_complete', 'complete', 'done', 'error')),
  optcgsim_version TEXT,
  room_id TEXT
);

ALTER TABLE games
  DROP CONSTRAINT IF EXISTS games_coaching_status_check,
  ADD CONSTRAINT games_coaching_status_check CHECK (coaching_status IN ('pending', 'analyzing', 'heuristic_complete', 'complete', 'done', 'error'));

CREATE TABLE IF NOT EXISTS turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  player INTEGER NOT NULL CHECK (player IN (1, 2)),
  actions_json JSONB,
  board_state_json JSONB
);

CREATE TABLE IF NOT EXISTS coaching_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  turn_id UUID REFERENCES turns(id) ON DELETE CASCADE,
  layer TEXT NOT NULL CHECK (layer IN ('rule', 'llm')),
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
