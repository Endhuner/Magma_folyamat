-- Migration 0006: Gyártástervező táblák + machines.photo_url mező
-- machine_planning_assignments: aktuális gép-rendelés hozzárendelések
-- machine_planning_log: gépalap audit log (append-only)
-- machines: photo_url mező hozzáadása

-- Gép-rendelés hozzárendelések tábla
CREATE TABLE IF NOT EXISTS machine_planning_assignments (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  planned_hours_override TEXT NOT NULL DEFAULT '',
  assigned_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_mpa_order_id
  ON machine_planning_assignments(order_id);
--> statement-breakpoint
-- Gépalap audit log tábla
CREATE TABLE IF NOT EXISTS machine_planning_log (
  id TEXT PRIMARY KEY,
  machine_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  action TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  designation TEXT NOT NULL DEFAULT '',
  own_order_number TEXT NOT NULL DEFAULT '',
  customer TEXT NOT NULL DEFAULT '',
  from_machine_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  user_name TEXT NOT NULL DEFAULT '',
  timestamp TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_mpl_machine_id
  ON machine_planning_log(machine_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_mpl_order_id
  ON machine_planning_log(order_id);
--> statement-breakpoint
-- Gép foto URL mező hozzáadása
ALTER TABLE machines ADD COLUMN photo_url TEXT NOT NULL DEFAULT '';
