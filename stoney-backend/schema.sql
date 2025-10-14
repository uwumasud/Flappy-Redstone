CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  photo_url TEXT DEFAULT '',
  best_score INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_best ON scores(best_score DESC, updated_at DESC);
