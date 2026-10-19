CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE login_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  csrf TEXT NOT NULL
);
CREATE TABLE cards (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title_line1 TEXT NOT NULL DEFAULT '',
  title_line2 TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  accent_color TEXT NOT NULL DEFAULT '#1F4E79',
  photo_file TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE card_slug_history (
  old_slug TEXT PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE
);
CREATE TABLE card_links (
  id INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('linkedin','facebook','instagram','x','youtube','website','other')),
  url TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE card_fields (
  id INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  event_date TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (card_id, slug)
);
CREATE TABLE scans (
  card_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (card_id, event_id, day)
);
CREATE TABLE leads (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  card_id INTEGER NOT NULL,
  event_id INTEGER,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  consent_at TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'pending',
  folk_status TEXT NOT NULL DEFAULT 'pending',
  folk_attempts INTEGER NOT NULL DEFAULT 0,
  folk_next_at TEXT,
  folk_person_id TEXT,
  last_error TEXT
);
CREATE INDEX leads_card_created ON leads(card_id, created_at);
CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, email)
);
