CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS login_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS banned_users (
  user_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  theme TEXT NOT NULL DEFAULT 'dark',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tag_votes (
  video_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  mood INTEGER NOT NULL,
  rhythm INTEGER NOT NULL,
  melody INTEGER NOT NULL,
  origin INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (video_id, user_id)
);

CREATE TABLE IF NOT EXISTS adv_tag_votes (
  video_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  selected INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (video_id, user_id, tag)
);

CREATE TABLE IF NOT EXISTS likes (
  video_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (video_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'other',
  comment TEXT NOT NULL DEFAULT '',
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  addr TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'other',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_cache (
  cache_key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS songs_cache (
  video_id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  artist TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  year INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  lyrics TEXT NOT NULL DEFAULT '',
  sort_date TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tag_votes_user ON tag_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_adv_tag_votes_video ON adv_tag_votes(video_id);
CREATE INDEX IF NOT EXISTS idx_likes_video ON likes(video_id);
CREATE INDEX IF NOT EXISTS idx_reports_video ON reports(video_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_songs_cache_year_sort ON songs_cache(year, sort_date, video_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_created_at ON login_events(created_at);
