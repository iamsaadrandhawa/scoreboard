/*
# Reset and recreate complete cricket tournament schema

1. Overview
   Drops ALL existing tables and recreates the full schema from scratch
   for a no-auth single-tenant cricket tournament management app.

2. Tables Created
   - tournaments, pools, teams, players, matches, innings, balls
   - broadcast_state, app_settings
   All id columns are TEXT (app generates string IDs via uid()).

3. Security
   RLS enabled on every table with full CRUD for anon, authenticated
   (no sign-in screen — data is intentionally shared).

4. Storage
   Creates `tournament-assets` bucket for logos/photos.

5. Realtime
   All tables added to supabase_realtime publication.
*/

-- Drop everything in correct FK order
DROP TABLE IF EXISTS balls CASCADE;
DROP TABLE IF EXISTS innings CASCADE;
DROP TABLE IF EXISTS broadcast_state CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS pools CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;

-- ──────────────────────────────────────────────
-- TOURNAMENTS
-- ──────────────────────────────────────────────
CREATE TABLE tournaments (
  id text PRIMARY KEY,
  name text NOT NULL,
  default_overs integer NOT NULL DEFAULT 20,
  is_double_wicket boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_tournaments" ON tournaments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_tournaments" ON tournaments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_tournaments" ON tournaments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_tournaments" ON tournaments FOR DELETE TO anon, authenticated USING (true);

-- ──────────────────────────────────────────────
-- POOLS
-- ──────────────────────────────────────────────
CREATE TABLE pools (
  id text PRIMARY KEY,
  tournament_id text NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_pools" ON pools FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_pools" ON pools FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_pools" ON pools FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_pools" ON pools FOR DELETE TO anon, authenticated USING (true);

-- ──────────────────────────────────────────────
-- TEAMS
-- ──────────────────────────────────────────────
CREATE TABLE teams (
  id text PRIMARY KEY,
  tournament_id text NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  pool_id text REFERENCES pools(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Unnamed Team',
  short_name text,
  color text,
  logo_url text,
  captain_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_teams" ON teams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_teams" ON teams FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_teams" ON teams FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_teams" ON teams FOR DELETE TO anon, authenticated USING (true);

-- ──────────────────────────────────────────────
-- PLAYERS
-- ──────────────────────────────────────────────
CREATE TABLE players (
  id text PRIMARY KEY,
  team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Unnamed Player',
  role text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_players" ON players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_players" ON players FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_players" ON players FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_players" ON players FOR DELETE TO anon, authenticated USING (true);

-- ──────────────────────────────────────────────
-- MATCHES
-- ──────────────────────────────────────────────
CREATE TABLE matches (
  id text PRIMARY KEY,
  tournament_id text NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_a_id text,
  team_b_id text,
  team_a_name text,
  team_b_name text,
  team_a_short text,
  team_b_short text,
  team_a_color text,
  team_b_color text,
  overs_limit integer NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'upcoming',
  venue text,
  toss_winner_id text,
  toss_choice text,
  result_type text,
  winner_id text,
  summary text,
  motm_id text,
  stage text,
  current_innings integer NOT NULL DEFAULT 0,
  result jsonb,
  playing_xi jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_matches" ON matches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_matches" ON matches FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_matches" ON matches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_matches" ON matches FOR DELETE TO anon, authenticated USING (true);

-- ──────────────────────────────────────────────
-- INNINGS
-- ──────────────────────────────────────────────
CREATE TABLE innings (
  id text PRIMARY KEY,
  match_id text NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  innings_num integer NOT NULL DEFAULT 0,
  batting_team_id text,
  bowling_team_id text,
  current_striker_id text,
  current_non_striker_id text,
  current_bowler_id text,
  previous_bowler_id text,
  target integer,
  run_adjustment integer NOT NULL DEFAULT 0,
  is_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE innings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_innings" ON innings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_innings" ON innings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_innings" ON innings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_innings" ON innings FOR DELETE TO anon, authenticated USING (true);

-- ──────────────────────────────────────────────
-- BALLS
-- ──────────────────────────────────────────────
CREATE TABLE balls (
  id text PRIMARY KEY,
  innings_id text NOT NULL REFERENCES innings(id) ON DELETE CASCADE,
  ball_index integer NOT NULL,
  over_num integer NOT NULL,
  batsman_id text,
  non_striker_id text,
  bowler_id text,
  runs_bat integer NOT NULL DEFAULT 0,
  extra text,
  extra_runs integer NOT NULL DEFAULT 0,
  is_wicket boolean NOT NULL DEFAULT false,
  wicket_type text,
  out_batsman_id text,
  fielder_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE balls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_balls" ON balls FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_balls" ON balls FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_balls" ON balls FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_balls" ON balls FOR DELETE TO anon, authenticated USING (true);

-- ──────────────────────────────────────────────
-- BROADCAST STATE
-- ──────────────────────────────────────────────
CREATE TABLE broadcast_state (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tournament_id text NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id text REFERENCES matches(id) ON DELETE SET NULL,
  layers jsonb NOT NULL DEFAULT '{"bug": true}'::jsonb,
  lineup_team_id text,
  show_captain_photos boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id)
);
ALTER TABLE broadcast_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_broadcast_state" ON broadcast_state FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_broadcast_state" ON broadcast_state FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_broadcast_state" ON broadcast_state FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_broadcast_state" ON broadcast_state FOR DELETE TO anon, authenticated USING (true);

-- ──────────────────────────────────────────────
-- APP SETTINGS
-- ──────────────────────────────────────────────
CREATE TABLE app_settings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_app_settings" ON app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_app_settings" ON app_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_app_settings" ON app_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_app_settings" ON app_settings FOR DELETE TO anon, authenticated USING (true);

-- ──────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────
CREATE INDEX idx_teams_tournament_id ON teams(tournament_id);
CREATE INDEX idx_teams_pool_id ON teams(pool_id);
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_innings_match_id ON innings(match_id);
CREATE INDEX idx_balls_innings_id ON balls(innings_id);
CREATE INDEX idx_balls_over_num ON balls(over_num);
CREATE INDEX idx_pools_tournament_id ON pools(tournament_id);
CREATE INDEX idx_broadcast_tournament_id ON broadcast_state(tournament_id);

-- ──────────────────────────────────────────────
-- STORAGE BUCKET
-- ──────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('tournament-assets', 'tournament-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_read_tournament_assets" ON storage.objects;
CREATE POLICY "anon_read_tournament_assets" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'tournament-assets');
DROP POLICY IF EXISTS "anon_insert_tournament_assets" ON storage.objects;
CREATE POLICY "anon_insert_tournament_assets" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'tournament-assets');
DROP POLICY IF EXISTS "anon_update_tournament_assets" ON storage.objects;
CREATE POLICY "anon_update_tournament_assets" ON storage.objects FOR UPDATE
  TO anon, authenticated USING (bucket_id = 'tournament-assets') WITH CHECK (bucket_id = 'tournament-assets');
DROP POLICY IF EXISTS "anon_delete_tournament_assets" ON storage.objects;
CREATE POLICY "anon_delete_tournament_assets" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'tournament-assets');

-- ──────────────────────────────────────────────
-- REALTIME PUBLICATION
-- ──────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE innings;
ALTER PUBLICATION supabase_realtime ADD TABLE balls;
ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_state;