-- 0005: app_settings, label_templates, customer_sequences, saved_templates táblák

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS label_templates (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL DEFAULT '',
  type               TEXT NOT NULL DEFAULT 'label',
  html               TEXT NOT NULL DEFAULT '',
  css                TEXT NOT NULL DEFAULT '',
  timestamp          TEXT NOT NULL DEFAULT '',
  description        TEXT,
  margins            TEXT NOT NULL DEFAULT '{}',
  labels_per_page    INTEGER,
  labels_per_row     INTEGER,
  labels_per_column  INTEGER,
  cell_settings      TEXT,
  font_settings      TEXT,
  alignment_settings TEXT,
  print_settings     TEXT,
  padding_settings   TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS customer_sequences (
  customer_id TEXT PRIMARY KEY,
  sequence    INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS saved_templates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  type       TEXT NOT NULL DEFAULT 'delivery',
  data       TEXT NOT NULL DEFAULT '{}',
  timestamp  TEXT NOT NULL DEFAULT '',
  size       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
