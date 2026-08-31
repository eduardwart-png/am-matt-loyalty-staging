-- GASTRO LOYALTY PLATFORM — Datenmodell (SQLite via node:sqlite)
-- Multi-Tenant von Anfang an: jede Tabelle trägt tenant_id.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,                 -- z.B. 'TENANT_001'
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  address_street TEXT,
  address_zip TEXT,
  address_city TEXT,
  phone TEXT,
  email TEXT,
  brand_primary_color TEXT DEFAULT '#1B4D3E',
  brand_accent_color TEXT DEFAULT '#C9A24B',
  logo_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Öffnungszeiten: einmal zentral, nicht mehrfach hardcoden.
CREATE TABLE IF NOT EXISTS opening_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL,            -- 0=Sonntag .. 6=Samstag
  is_closed INTEGER NOT NULL DEFAULT 0,
  open_time TEXT,                      -- '11:30'
  close_time TEXT,                     -- '14:30'
  slot_order INTEGER NOT NULL DEFAULT 0 -- für mehrere Zeitfenster pro Tag (Mittag/Abend)
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  birthday TEXT,                       -- YYYY-MM-DD, für Geburtstagsbonus
  qr_code_token TEXT UNIQUE NOT NULL,  -- fester, rotierbarer Kundenkarten-Token
  points_balance INTEGER NOT NULL DEFAULT 0,  -- denormalisiert, aus ledger berechnet
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  push_consent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, email)
);

CREATE TABLE IF NOT EXISTS staff_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',  -- staff | admin
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, username)
);

-- Loyalty Ledger: JEDE Transaktion, nicht nur Gesamtwert (Direktive §22).
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  value INTEGER NOT NULL,              -- positiv = Gutschrift, negativ = Abbuchung
  reason TEXT NOT NULL,                -- 'purchase' | 'redeem_reward' | 'birthday_bonus' | 'manual_adjustment' | ...
  source TEXT NOT NULL,                -- 'staff_scan' | 'system' | 'admin'
  actor TEXT,                          -- staff_users.username oder 'system'
  reference TEXT,                      -- z.B. Coupon-Code, Reward-ID
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | reversed
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Coupon Engine (regelbasiert, Direktive §23)
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent', -- percent | fixed | free_item
  discount_value REAL NOT NULL DEFAULT 0,
  valid_from TEXT,
  valid_until TEXT,
  valid_weekdays TEXT,                 -- JSON-Array [0..6] oder NULL = alle Tage
  valid_time_from TEXT,                -- 'HH:MM'
  valid_time_until TEXT,
  min_order_value REAL,
  target_segment TEXT DEFAULT 'all',   -- all | new_customer | returning_customer | birthday
  max_uses_total INTEGER,
  max_uses_per_customer INTEGER DEFAULT 1,
  combinable INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | review | scheduled | live | expired | archived
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  redeemed_by_staff TEXT,
  redeemed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(coupon_id, customer_id, redeemed_at)  -- Doppeleinlösung-Schutz zusätzlich per Anwendungslogik geprüft
);

-- Campaign Engine (Direktive §21) — Banner/Angebote mit Recurrence + Status
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_link TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'offer', -- offer | seasonal | daily | weekly | monthly | event
  target_segment TEXT DEFAULT 'all',
  start_at TEXT,
  end_at TEXT,
  valid_weekdays TEXT,                 -- JSON-Array [0..6] oder NULL
  recurrence_rule TEXT,                -- 'daily' | 'weekly' | 'monthly' | 'once' | JSON für Ausnahmen
  points_bonus INTEGER DEFAULT 0,
  linked_coupon_id INTEGER REFERENCES coupons(id),
  visibility TEXT NOT NULL DEFAULT 'app', -- app | staff_only | both
  push_enabled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | review | scheduled | live | expired | archived
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Speisekarte (konfigurierbar, nicht hardcoded im Frontend)
CREATE TABLE IF NOT EXISTS menu_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price REAL,
  allergen_info TEXT,
  vegetarian INTEGER NOT NULL DEFAULT 0,
  seasonal INTEGER NOT NULL DEFAULT 0,
  source TEXT,                         -- Referenz auf SOURCE_MANIFEST Zeile
  last_verified TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'verified' -- verified | unverified
);

-- Scheduler-Transparenz (Direktive §40 — keine Silent Failures)
CREATE TABLE IF NOT EXISTS job_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_name TEXT NOT NULL,              -- 'campaign_status_sync' etc.
  last_run TEXT,
  last_success TEXT,
  last_failure TEXT,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'idle', -- idle | running | ok | failed
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ledger_customer ON loyalty_ledger(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
