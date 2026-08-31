// routes/customer.js — Vertical Slice 1: Registrierung, Login, Punkte, Coupons, QR
const express = require('express');
const { db } = require('../db');
const { hashPassword, verifyPassword, randomToken } = require('../lib/crypto');
const { createSession, authMiddleware, destroySession } = require('../lib/session');
const { getBalance, listTransactions } = require('../lib/ledger');
const { isCouponCurrentlyValid } = require('../lib/coupons');

const router = express.Router();

function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'] || 'TENANT_001';
  const tenant = db.prepare(`SELECT * FROM tenants WHERE id = ?`).get(tenantId);
  if (!tenant) return res.status(404).json({ error: 'tenant_not_found' });
  req.tenant = tenant;
  next();
}
router.use(requireTenant);

// --- Registrierung ---
router.post('/register', (req, res) => {
  const { email, password, displayName, birthday } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });

  const existing = db.prepare(`SELECT id FROM customers WHERE tenant_id = ? AND email = ?`)
    .get(req.tenant.id, email);
  if (existing) return res.status(409).json({ error: 'email_already_registered' });

  const { hash, salt } = hashPassword(password);
  const qrToken = randomToken(16);
  const info = db.prepare(`
    INSERT INTO customers (tenant_id, email, display_name, password_hash, password_salt, birthday, qr_code_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.tenant.id, email, displayName || null, hash, salt, birthday || null, qrToken);

  const token = createSession(req.tenant.id, 'customer', info.lastInsertRowid);
  res.status(201).json({ sessionToken: token, customerId: info.lastInsertRowid, qrCodeToken: qrToken });
});

// --- Login ---
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const customer = db.prepare(`SELECT * FROM customers WHERE tenant_id = ? AND email = ?`)
    .get(req.tenant.id, email);
  if (!customer || !verifyPassword(password, customer.password_hash, customer.password_salt)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const token = createSession(req.tenant.id, 'customer', customer.id);
  res.json({ sessionToken: token, customerId: customer.id });
});

router.post('/logout', authMiddleware('customer'), (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  destroySession(token);
  res.json({ ok: true });
});

// --- Profil / Startseite ---
router.get('/me', authMiddleware('customer'), (req, res) => {
  const customer = db.prepare(`SELECT id, email, display_name, birthday, points_balance, qr_code_token, marketing_consent, push_consent
    FROM customers WHERE id = ? AND tenant_id = ?`).get(req.session.subjectId, req.tenant.id);
  if (!customer) return res.status(404).json({ error: 'not_found' });
  res.json(customer);
});

router.get('/points', authMiddleware('customer'), (req, res) => {
  const balance = getBalance(req.tenant.id, req.session.subjectId);
  const transactions = listTransactions(req.tenant.id, req.session.subjectId, 20);
  res.json({ balance, transactions });
});

router.get('/rewards', authMiddleware('customer'), (req, res) => {
  const rewards = db.prepare(`SELECT * FROM rewards WHERE tenant_id = ? AND active = 1 ORDER BY points_cost ASC`)
    .all(req.tenant.id);
  res.json(rewards);
});

// --- Coupons (nur aktuell gültige, für die Startseite/Coupons-Tab) ---
router.get('/coupons', authMiddleware('customer'), (req, res) => {
  const coupons = db.prepare(`SELECT * FROM coupons WHERE tenant_id = ? AND status = 'live'`).all(req.tenant.id);
  const valid = coupons.filter(c => isCouponCurrentlyValid(c).ok);
  res.json(valid);
});

// --- Aktuelle Kampagnen (Startseite-Widget) ---
router.get('/campaigns/live', (req, res) => {
  const campaigns = db.prepare(`SELECT * FROM campaigns WHERE tenant_id = ? AND status = 'live'
    AND visibility IN ('app','both') ORDER BY start_at DESC`).all(req.tenant.id);
  res.json(campaigns);
});

// --- Speisekarte (öffentlich, kein Login nötig für Vorschau) ---
router.get('/menu', (req, res) => {
  const categories = db.prepare(`SELECT * FROM menu_categories WHERE tenant_id = ? ORDER BY sort_order`)
    .all(req.tenant.id);
  const items = db.prepare(`SELECT * FROM menu_items WHERE tenant_id = ? ORDER BY category_id, sort_order`)
    .all(req.tenant.id);
  const byCategory = categories.map(cat => ({
    ...cat,
    items: items.filter(i => i.category_id === cat.id)
  }));
  res.json(byCategory);
});

// --- Öffnungszeiten (zentral, konfigurierbar) ---
router.get('/opening-hours', (req, res) => {
  const rows = db.prepare(`SELECT * FROM opening_hours WHERE tenant_id = ? ORDER BY weekday, slot_order`)
    .all(req.tenant.id);
  res.json(rows);
});

// --- Tenant-Branding/Info (für Frontend-Theming) ---
router.get('/tenant-info', (req, res) => {
  const { id, name, address_street, address_zip, address_city, phone, email,
    brand_primary_color, brand_accent_color, logo_url } = req.tenant;
  res.json({ id, name, address_street, address_zip, address_city, phone, email,
    brand_primary_color, brand_accent_color, logo_url });
});

module.exports = router;
