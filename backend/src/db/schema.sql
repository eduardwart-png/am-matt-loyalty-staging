-- GASTRO LOYALTY PLATFORM — Datenmodell (PostgreSQL, Railway-Staging)
-- Multi-Tenant von Anfang an: jede Tabelle trägt tenant_id.

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opening_hours (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL,
  is_closed INTEGER NOT NULL DEFAULT 0,
  open_time TEXT,
  close_time TEXT,
  slot_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  birthday TEXT,
  qr_code_token TEXT UNIQUE NOT NULL,
  points_balance INTEGER NOT NULL DEFAULT 0,
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  push_consent INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT UNIQUE,
  birthday_bonus_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE IF NOT EXISTS staff_users (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, username)
);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  value INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  actor TEXT,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rewards (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value REAL NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  valid_weekdays TEXT,
  valid_time_from TEXT,
  valid_time_until TEXT,
  min_order_value REAL,
  target_segment TEXT DEFAULT 'all',
  max_uses_total INTEGER,
  max_uses_per_customer INTEGER DEFAULT 1,
  combinable INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  redeemed_by_staff TEXT,
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_link TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'offer',
  target_segment TEXT DEFAULT 'all',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  valid_weekdays TEXT,
  recurrence_rule TEXT,
  points_bonus INTEGER DEFAULT 0,
  linked_coupon_id INTEGER REFERENCES coupons(id),
  visibility TEXT NOT NULL DEFAULT 'app',
  push_enabled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price REAL,
  allergen_info TEXT,
  vegetarian INTEGER NOT NULL DEFAULT 0,
  seasonal INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  source TEXT,
  last_verified TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'verified'
);

-- Lidl-Plus-Paritaet: Favoriten (Kunde merkt sich Lieblingsgerichte)
CREATE TABLE IF NOT EXISTS customer_favorites (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, menu_item_id)
);

-- Freunde-werben-Programm: Empfehlungscode je Kunde, Bonus fuer beide Seiten
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  referrer_customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  referred_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending -> redeemed
  reward_granted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ,
  UNIQUE(tenant_id, code)
);

-- Web Push Subscriptions (echte Browser-Push, kein Fake-Toggle mehr)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, endpoint)
);

CREATE TABLE IF NOT EXISTS job_runs (
  id SERIAL PRIMARY KEY,
  job_name TEXT NOT NULL UNIQUE,
  last_run TIMESTAMPTZ,
  last_success TIMESTAMPTZ,
  last_failure TIMESTAMPTZ,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ledger_customer ON loyalty_ledger(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);

-- Sessions DB-gestuetzt (nicht nur In-Memory) — ueberlebt Render-Free-Tier-Neustarts/Cold-Starts,
-- sonst wird bei jedem Neustart/Deploy jeder eingeloggte Kunde/Staff/Admin ausgeloggt (Eddy: "vollkommen funktional").
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
