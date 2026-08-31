// routes/customer.js — Vertical Slice 1: Registrierung, Login, Punkte, Coupons, QR
const express = require('express');
const { query } = require('../db');
const { hashPassword, verifyPassword, randomToken } = require('../lib/crypto');
const { createSession, authMiddleware, destroySession } = require('../lib/session');
const { getBalance, listTransactions } = require('../lib/ledger');
const { isCouponCurrentlyValid } = require('../lib/coupons');

const router = express.Router();

async function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'] || 'TENANT_001';
  const { rows } = await query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
  if (!rows[0]) return res.status(404).json({ error: 'tenant_not_found' });
  req.tenant = rows[0];
  next();
}
router.use((req, res, next) => { requireTenant(req, res, next).catch(next); });

// --- Registrierung ---
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName, birthday } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });

    const existing = await query(`SELECT id FROM customers WHERE tenant_id = $1 AND email = $2`, [req.tenant.id, email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'email_already_registered' });

    const { hash, salt } = hashPassword(password);
    const qrToken = randomToken(16);
    const insert = await query(`
      INSERT INTO customers (tenant_id, email, display_name, password_hash, password_salt, birthday, qr_code_token)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [req.tenant.id, email, displayName || null, hash, salt, birthday || null, qrToken]);

    const token = createSession(req.tenant.id, 'customer', insert.rows[0].id);
    res.status(201).json({ sessionToken: token, customerId: insert.rows[0].id, qrCodeToken: qrToken });
  } catch (err) { next(err); }
});

// --- Login ---
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const { rows } = await query(`SELECT * FROM customers WHERE tenant_id = $1 AND email = $2`, [req.tenant.id, email]);
    const customer = rows[0];
    if (!customer || !verifyPassword(password, customer.password_hash, customer.password_salt)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const token = createSession(req.tenant.id, 'customer', customer.id);
    res.json({ sessionToken: token, customerId: customer.id });
  } catch (err) { next(err); }
});

router.post('/logout', authMiddleware('customer'), (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  destroySession(token);
  res.json({ ok: true });
});

// --- Profil / Startseite ---
router.get('/me', authMiddleware('customer'), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT id, email, display_name, birthday, points_balance, qr_code_token, marketing_consent, push_consent
      FROM customers WHERE id = $1 AND tenant_id = $2
    `, [req.session.subjectId, req.tenant.id]);
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/points', authMiddleware('customer'), async (req, res, next) => {
  try {
    const balance = await getBalance(req.tenant.id, req.session.subjectId);
    const transactions = await listTransactions(req.tenant.id, req.session.subjectId, 20);
    res.json({ balance, transactions });
  } catch (err) { next(err); }
});

router.get('/rewards', authMiddleware('customer'), async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM rewards WHERE tenant_id = $1 AND active = 1 ORDER BY points_cost ASC`, [req.tenant.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// --- Coupons (nur aktuell gültige, für die Startseite/Coupons-Tab) ---
router.get('/coupons', authMiddleware('customer'), async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM coupons WHERE tenant_id = $1 AND status = 'live'`, [req.tenant.id]);
    const valid = rows.filter(c => isCouponCurrentlyValid(c).ok);
    res.json(valid);
  } catch (err) { next(err); }
});

// --- Aktuelle Kampagnen (Startseite-Widget) ---
router.get('/campaigns/live', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT * FROM campaigns WHERE tenant_id = $1 AND status = 'live'
      AND visibility IN ('app','both') ORDER BY start_at DESC
    `, [req.tenant.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// --- Speisekarte (öffentlich, kein Login nötig für Vorschau) ---
router.get('/menu', async (req, res, next) => {
  try {
    const catRes = await query(`SELECT * FROM menu_categories WHERE tenant_id = $1 ORDER BY sort_order`, [req.tenant.id]);
    const itemRes = await query(`SELECT * FROM menu_items WHERE tenant_id = $1 ORDER BY category_id, sort_order`, [req.tenant.id]);
    const byCategory = catRes.rows.map(cat => ({
      ...cat,
      items: itemRes.rows.filter(i => i.category_id === cat.id)
    }));
    res.json(byCategory);
  } catch (err) { next(err); }
});

// --- Öffnungszeiten (zentral, konfigurierbar) ---
router.get('/opening-hours', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM opening_hours WHERE tenant_id = $1 ORDER BY weekday, slot_order`, [req.tenant.id]);
    res.json(rows);
  } catch (err) { next(err); }
});

// --- Tenant-Branding/Info (für Frontend-Theming) ---
router.get('/tenant-info', (req, res) => {
  const { id, name, address_street, address_zip, address_city, phone, email,
    brand_primary_color, brand_accent_color, logo_url } = req.tenant;
  res.json({ id, name, address_street, address_zip, address_city, phone, email,
    brand_primary_color, brand_accent_color, logo_url });
});

module.exports = router;
