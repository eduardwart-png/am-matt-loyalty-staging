// routes/admin.js — Vertical Slice 2: Operations Studio (Kampagnen erstellen, terminieren, sehen)
const express = require('express');
const { db } = require('../db');
const { verifyPassword, createSession, authMiddleware } = (() => {
  const crypto = require('../lib/crypto');
  const session = require('../lib/session');
  return { ...crypto, ...session };
})();

const router = express.Router();

function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'] || 'TENANT_001';
  const tenant = db.prepare(`SELECT * FROM tenants WHERE id = ?`).get(tenantId);
  if (!tenant) return res.status(404).json({ error: 'tenant_not_found' });
  req.tenant = tenant;
  next();
}
router.use(requireTenant);

function requireAdmin(req, res, next) {
  const staff = db.prepare(`SELECT * FROM staff_users WHERE id = ?`).get(req.session.subjectId);
  if (!staff || staff.role !== 'admin') return res.status(403).json({ error: 'admin_only' });
  next();
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const staff = db.prepare(`SELECT * FROM staff_users WHERE tenant_id = ? AND username = ? AND role = 'admin' AND active = 1`)
    .get(req.tenant.id, username);
  if (!staff || !verifyPassword(password, staff.password_hash, staff.password_salt)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const token = createSession(req.tenant.id, 'staff', staff.id);
  res.json({ sessionToken: token });
});

router.use(authMiddleware('staff'), requireAdmin);

// --- Kampagnen CRUD ---
router.get('/campaigns', (req, res) => {
  const rows = db.prepare(`SELECT * FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC`).all(req.tenant.id);
  res.json(rows);
});

router.post('/campaigns', (req, res) => {
  const c = req.body || {};
  const info = db.prepare(`
    INSERT INTO campaigns (tenant_id, title, description, image_url, cta_label, cta_link, campaign_type,
      target_segment, start_at, end_at, valid_weekdays, recurrence_rule, points_bonus, linked_coupon_id,
      visibility, push_enabled, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.tenant.id, c.title, c.description || null, c.image_url || null, c.cta_label || null, c.cta_link || null,
    c.campaign_type || 'offer', c.target_segment || 'all', c.start_at || null, c.end_at || null,
    c.valid_weekdays ? JSON.stringify(c.valid_weekdays) : null, c.recurrence_rule || null,
    c.points_bonus || 0, c.linked_coupon_id || null, c.visibility || 'app', c.push_enabled ? 1 : 0,
    c.status || 'draft', req.session.subjectId
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

router.patch('/campaigns/:id', (req, res) => {
  const c = req.body || {};
  const fields = [];
  const values = [];
  for (const key of ['title','description','image_url','cta_label','cta_link','campaign_type',
    'target_segment','start_at','end_at','points_bonus','visibility','push_enabled','status']) {
    if (key in c) { fields.push(`${key} = ?`); values.push(c[key]); }
  }
  if (!fields.length) return res.status(400).json({ error: 'no_fields' });
  values.push(req.params.id, req.tenant.id);
  db.prepare(`UPDATE campaigns SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`)
    .run(...values);
  res.json({ ok: true });
});

// --- Coupon CRUD ---
router.get('/coupons', (req, res) => {
  res.json(db.prepare(`SELECT * FROM coupons WHERE tenant_id = ? ORDER BY created_at DESC`).all(req.tenant.id));
});

router.post('/coupons', (req, res) => {
  const c = req.body || {};
  const info = db.prepare(`
    INSERT INTO coupons (tenant_id, code, title, description, discount_type, discount_value, valid_from,
      valid_until, valid_weekdays, valid_time_from, valid_time_until, min_order_value, target_segment,
      max_uses_total, max_uses_per_customer, combinable, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.tenant.id, c.code, c.title, c.description || null, c.discount_type || 'percent', c.discount_value || 0,
    c.valid_from || null, c.valid_until || null, c.valid_weekdays ? JSON.stringify(c.valid_weekdays) : null,
    c.valid_time_from || null, c.valid_time_until || null, c.min_order_value || null, c.target_segment || 'all',
    c.max_uses_total || null, c.max_uses_per_customer ?? 1, c.combinable ? 1 : 0, c.status || 'draft'
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

// --- Transaktionen (Admin sieht Ledger, Direktive §34 Endpunkt) ---
router.get('/ledger', (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, c.display_name, c.email FROM loyalty_ledger l
    JOIN customers c ON c.id = l.customer_id
    WHERE l.tenant_id = ? ORDER BY l.id DESC LIMIT 200
  `).all(req.tenant.id);
  res.json(rows);
});

// --- Menü-Verwaltung ---
router.get('/menu', (req, res) => {
  const categories = db.prepare(`SELECT * FROM menu_categories WHERE tenant_id = ? ORDER BY sort_order`).all(req.tenant.id);
  const items = db.prepare(`SELECT * FROM menu_items WHERE tenant_id = ? ORDER BY category_id, sort_order`).all(req.tenant.id);
  res.json({ categories, items });
});

router.patch('/menu/items/:id', (req, res) => {
  const c = req.body || {};
  const fields = [];
  const values = [];
  for (const key of ['name','description','price','allergen_info','vegetarian','seasonal','status']) {
    if (key in c) { fields.push(`${key} = ?`); values.push(c[key]); }
  }
  if (!fields.length) return res.status(400).json({ error: 'no_fields' });
  values.push(req.params.id, req.tenant.id);
  db.prepare(`UPDATE menu_items SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`).run(...values);
  res.json({ ok: true });
});

// --- Job-Status (Scheduler-Transparenz, Direktive §40) ---
router.get('/jobs/status', (req, res) => {
  res.json(db.prepare(`SELECT * FROM job_runs`).all());
});

module.exports = router;
