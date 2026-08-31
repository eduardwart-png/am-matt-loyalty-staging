// routes/staff.js — Staff Mode: QR scannen -> Kunde erkannt -> Punkte buchen / Coupon prüfen -> bestätigen
const express = require('express');
const { db } = require('../db');
const { hashPassword, verifyPassword } = require('../lib/crypto');
const { createSession, authMiddleware } = require('../lib/session');
const { addTransaction } = require('../lib/ledger');
const { canRedeem, redeem } = require('../lib/coupons');

const router = express.Router();

function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'] || 'TENANT_001';
  const tenant = db.prepare(`SELECT * FROM tenants WHERE id = ?`).get(tenantId);
  if (!tenant) return res.status(404).json({ error: 'tenant_not_found' });
  req.tenant = tenant;
  next();
}
router.use(requireTenant);

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const staff = db.prepare(`SELECT * FROM staff_users WHERE tenant_id = ? AND username = ? AND active = 1`)
    .get(req.tenant.id, username);
  if (!staff || !verifyPassword(password, staff.password_hash, staff.password_salt)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const token = createSession(req.tenant.id, 'staff', staff.id);
  res.json({ sessionToken: token, role: staff.role, username: staff.username });
});

// QR SCANNEN -> Kunde erkannt
router.get('/customer/by-qr/:qrToken', authMiddleware('staff'), (req, res) => {
  const customer = db.prepare(`SELECT id, display_name, email, points_balance FROM customers
    WHERE tenant_id = ? AND qr_code_token = ?`).get(req.tenant.id, req.params.qrToken);
  if (!customer) return res.status(404).json({ error: 'customer_not_found' });
  res.json(customer);
});

// Punkte buchen (z.B. nach Bezahlung, manuelle Eingabe durch Personal)
router.post('/customer/:customerId/add-points', authMiddleware('staff'), (req, res) => {
  const { value, reason = 'purchase' } = req.body || {};
  if (!Number.isInteger(value) || value === 0) return res.status(400).json({ error: 'invalid_value' });

  const staffRow = db.prepare(`SELECT username FROM staff_users WHERE id = ?`).get(req.session.subjectId);
  const customerId = Number(req.params.customerId);
  const customer = db.prepare(`SELECT id FROM customers WHERE id = ? AND tenant_id = ?`)
    .get(customerId, req.tenant.id);
  if (!customer) return res.status(404).json({ error: 'customer_not_found' });

  const result = addTransaction(req.tenant.id, customerId, value, reason, 'staff_scan', staffRow.username);
  res.json({ ok: true, ...result });
});

// Coupon prüfen (vor Einlösung dem Personal anzeigen)
router.get('/coupon/:couponId/check/:customerId', authMiddleware('staff'), (req, res) => {
  const check = canRedeem(req.tenant.id, Number(req.params.couponId), Number(req.params.customerId));
  res.json(check);
});

// Coupon per Code nachschlagen (für Personal-Eingabe per Tastatur statt ID)
router.get('/coupon/by-code/:code', authMiddleware('staff'), (req, res) => {
  const coupon = db.prepare(`SELECT * FROM coupons WHERE tenant_id = ? AND code = ?`)
    .get(req.tenant.id, req.params.code.toUpperCase());
  if (!coupon) return res.status(404).json({ error: 'coupon_not_found' });
  res.json(coupon);
});

// Coupon einlösen -> bestätigen -> fertig (mit Doppeleinlösung-Schutz)
router.post('/coupon/:couponId/redeem/:customerId', authMiddleware('staff'), (req, res) => {
  const staffRow = db.prepare(`SELECT username FROM staff_users WHERE id = ?`).get(req.session.subjectId);
  const result = redeem(req.tenant.id, Number(req.params.couponId), Number(req.params.customerId), staffRow.username);
  if (!result.ok) return res.status(409).json(result);
  res.json(result);
});

module.exports = router;
