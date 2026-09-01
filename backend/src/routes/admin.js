// routes/admin.js — Vertical Slice 2: Operations Studio (Kampagnen erstellen, terminieren, sehen)
const express = require('express');
const { query } = require('../db');
const { verifyPassword } = require('../lib/crypto');
const { createSession, authMiddleware } = require('../lib/session');

const router = express.Router();

async function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'] || 'TENANT_001';
  const { rows } = await query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
  if (!rows[0]) return res.status(404).json({ error: 'tenant_not_found' });
  req.tenant = rows[0];
  next();
}
router.use((req, res, next) => { requireTenant(req, res, next).catch(next); });

async function requireAdmin(req, res, next) {
  const { rows } = await query(`SELECT * FROM staff_users WHERE id = $1`, [req.session.subjectId]);
  const staff = rows[0];
  if (!staff || staff.role !== 'admin') return res.status(403).json({ error: 'admin_only' });
  next();
}

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const { rows } = await query(`
      SELECT * FROM staff_users WHERE tenant_id = $1 AND username = $2 AND role = 'admin' AND active = 1
    `, [req.tenant.id, username]);
    const staff = rows[0];
    if (!staff || !verifyPassword(password, staff.password_hash, staff.password_salt)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const token = createSession(req.tenant.id, 'staff', staff.id);
    res.json({ sessionToken: token });
  } catch (err) { next(err); }
});

router.use(authMiddleware('staff'), (req, res, next) => { requireAdmin(req, res, next).catch(next); });

// --- Kampagnen CRUD ---
router.get('/campaigns', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM campaigns WHERE tenant_id = $1 ORDER BY created_at DESC`, [req.tenant.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/campaigns', async (req, res, next) => {
  try {
    const c = req.body || {};
    const insert = await query(`
      INSERT INTO campaigns (tenant_id, title, description, image_url, cta_label, cta_link, campaign_type,
        target_segment, start_at, end_at, valid_weekdays, recurrence_rule, points_bonus, linked_coupon_id,
        visibility, push_enabled, status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id
    `, [
      req.tenant.id, c.title, c.description || null, c.image_url || null, c.cta_label || null, c.cta_link || null,
      c.campaign_type || 'offer', c.target_segment || 'all', c.start_at || null, c.end_at || null,
      c.valid_weekdays ? JSON.stringify(c.valid_weekdays) : null, c.recurrence_rule || null,
      c.points_bonus || 0, c.linked_coupon_id || null, c.visibility || 'app', c.push_enabled ? 1 : 0,
      c.status || 'draft', req.session.subjectId
    ]);
    res.status(201).json({ id: insert.rows[0].id });
  } catch (err) { next(err); }
});

router.patch('/campaigns/:id', async (req, res, next) => {
  try {
    const c = req.body || {};
    const fields = [];
    const values = [];
    let i = 1;
    for (const key of ['title','description','image_url','cta_label','cta_link','campaign_type',
      'target_segment','start_at','end_at','points_bonus','visibility','push_enabled','status']) {
      if (key in c) { fields.push(`${key} = $${i++}`); values.push(c[key]); }
    }
    if (!fields.length) return res.status(400).json({ error: 'no_fields' });
    values.push(req.params.id, req.tenant.id);
    await query(`UPDATE campaigns SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i++} AND tenant_id = $${i}`, values);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// --- Coupon CRUD ---
router.get('/coupons', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM coupons WHERE tenant_id = $1 ORDER BY created_at DESC`, [req.tenant.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/coupons', async (req, res, next) => {
  try {
    const c = req.body || {};
    const insert = await query(`
      INSERT INTO coupons (tenant_id, code, title, description, discount_type, discount_value, valid_from,
        valid_until, valid_weekdays, valid_time_from, valid_time_until, min_order_value, target_segment,
        max_uses_total, max_uses_per_customer, combinable, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id
    `, [
      req.tenant.id, c.code, c.title, c.description || null, c.discount_type || 'percent', c.discount_value || 0,
      c.valid_from || null, c.valid_until || null, c.valid_weekdays ? JSON.stringify(c.valid_weekdays) : null,
      c.valid_time_from || null, c.valid_time_until || null, c.min_order_value || null, c.target_segment || 'all',
      c.max_uses_total || null, c.max_uses_per_customer ?? 1, c.combinable ? 1 : 0, c.status || 'draft'
    ]);
    res.status(201).json({ id: insert.rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'code_already_exists' });
    next(err);
  }
});

router.patch('/coupons/:id', async (req, res, next) => {
  try {
    const c = req.body || {};
    const fields = [];
    const values = [];
    let i = 1;
    for (const key of ['title','description','image_url','discount_type','discount_value',
      'valid_from','valid_until','max_uses_total','max_uses_per_customer','status']) {
      if (key in c) { fields.push(`${key} = $${i++}`); values.push(c[key]); }
    }
    if (!fields.length) return res.status(400).json({ error: 'no_fields' });
    values.push(req.params.id, req.tenant.id);
    await query(`UPDATE coupons SET ${fields.join(', ')} WHERE id = $${i++} AND tenant_id = $${i}`, values);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// --- Transaktionen (Admin sieht Ledger) ---
router.get('/ledger', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT l.*, c.display_name, c.email FROM loyalty_ledger l
      JOIN customers c ON c.id = l.customer_id
      WHERE l.tenant_id = $1 ORDER BY l.id DESC LIMIT 200
    `, [req.tenant.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// --- Menü-Verwaltung ---
router.get('/menu', async (req, res, next) => {
  try {
    const catRes = await query(`SELECT * FROM menu_categories WHERE tenant_id = $1 ORDER BY sort_order`, [req.tenant.id]);
    const itemRes = await query(`SELECT * FROM menu_items WHERE tenant_id = $1 ORDER BY category_id, sort_order`, [req.tenant.id]);
    res.json({ categories: catRes.rows, items: itemRes.rows });
  } catch (err) { next(err); }
});

router.patch('/menu/items/:id', async (req, res, next) => {
  try {
    const c = req.body || {};
    const fields = [];
    const values = [];
    let i = 1;
    for (const key of ['name','description','price','allergen_info','vegetarian','seasonal','status']) {
      if (key in c) { fields.push(`${key} = $${i++}`); values.push(c[key]); }
    }
    if (!fields.length) return res.status(400).json({ error: 'no_fields' });
    values.push(req.params.id, req.tenant.id);
    await query(`UPDATE menu_items SET ${fields.join(', ')} WHERE id = $${i++} AND tenant_id = $${i}`, values);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// --- Job-Status (Scheduler-Transparenz, Direktive §40) ---
router.get('/jobs/status', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM job_runs`);
    res.json(rows);
  } catch (err) { next(err); }
});

// --- Test-Kunden-Bereinigung (nur eng abgegrenzte E2E-Testmuster, nie echte Kundendaten) ---
// Loescht ausschliesslich Kunden, deren E-Mail exakt mit einem der bekannten Test-Praefixe beginnt
// (aus den automatisierten Testsuiten) und deren Name eines der bekannten Test-Namensmuster ist.
// Schutz: Beide Bedingungen muessen zutreffen, sonst wird der Datensatz nicht angefasst.
router.delete('/customers/test-data', async (req, res, next) => {
  try {
    const testNames = ['E2E Testkunde', 'Pilot Vorfuehrung', 'QR Tiefentest'];
    const { rows } = await query(
      `SELECT id, email, display_name FROM customers
       WHERE tenant_id = $1 AND display_name = ANY($2)
       AND (email LIKE 'e2e-full-%' OR email LIKE 'qr-deep-%' OR email LIKE 'pilot-final-%')`,
      [req.tenant.id, testNames]
    );
    if (!rows.length) return res.json({ ok: true, deleted: 0 });
    const ids = rows.map(r => r.id);
    await query(`DELETE FROM loyalty_ledger WHERE tenant_id = $1 AND customer_id = ANY($2)`, [req.tenant.id, ids]);
    await query(`DELETE FROM customers WHERE tenant_id = $1 AND id = ANY($2)`, [req.tenant.id, ids]);
    res.json({ ok: true, deleted: rows.length, removed: rows.map(r => r.email) });
  } catch (err) { next(err); }
});

module.exports = router;
