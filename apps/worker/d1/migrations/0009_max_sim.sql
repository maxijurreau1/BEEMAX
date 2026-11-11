-- MAX SIM records are stored in the Portal Worker D1 database. Keep simulation
-- evidence separate from Marketplace customer data and constrain tree integrity.
CREATE TABLE max_sim_runs (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL CHECK(length(game_id) BETWEEN 1 AND 120),
  sport TEXT NOT NULL CHECK(sport IN ('NFL','NBA','MLB','NHL','NCAA','SOCCER')),
  baseline_win_prob REAL NOT NULL DEFAULT 50.0 CHECK(baseline_win_prob BETWEEN 0 AND 100),
  executed_by_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK(status IN ('PENDING','COMPLETED','FAILED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sim_runs_game ON max_sim_runs(game_id, created_at DESC);

CREATE TABLE max_sim_nodes (
  id TEXT PRIMARY KEY,
  sim_run_id TEXT NOT NULL REFERENCES max_sim_runs(id) ON DELETE CASCADE,
  parent_node_id TEXT,
  condition TEXT NOT NULL CHECK(length(condition) BETWEEN 1 AND 1000),
  probability REAL NOT NULL CHECK(probability BETWEEN 0 AND 100),
  impact_vector TEXT NOT NULL CHECK(length(impact_vector) BETWEEN 1 AND 500),
  flow_delta REAL NOT NULL DEFAULT 0.0 CHECK(flow_delta BETWEEN -100 AND 100),
  outcome_state TEXT NOT NULL DEFAULT 'NEUTRAL' CHECK(outcome_state IN ('FAVORABLE','NEUTRAL','CRITICAL_RISK')),
  depth INTEGER NOT NULL DEFAULT 0 CHECK(depth BETWEEN 0 AND 16),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sim_run_id,id),
  CHECK((parent_node_id IS NULL AND depth=0) OR (parent_node_id IS NOT NULL AND depth>0)),
  FOREIGN KEY(sim_run_id,parent_node_id) REFERENCES max_sim_nodes(sim_run_id,id) ON DELETE CASCADE
);
CREATE INDEX idx_sim_nodes_tree ON max_sim_nodes(sim_run_id, depth, id);
