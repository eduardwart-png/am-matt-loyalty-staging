// routes/staff.js — Staff Mode: QR scannen -> Kunde erkannt -> Punkte buchen / Coupon prüfen -> bestätigen -> fertig
const express = require('express');
const { query } = require('../db');
const { verifyPassword } = require('../lib/crypto');
const { createSession, authMiddleware } = require('../lib/session');
const { addTransaction } = require('../lib/ledger');
const { canRedeem, redeem } = require('../lib/coupons');
const { loginRateLimit } = require('../lib/rateLimit');

const router = express.Router();

async function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'] || 'TENANT_001';
  const { rows } = await query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
  if (!rows[0]) return res.status(404).json({ error: 'tenant_not_found' });
  req.tenant = rows[0];
  next();
}
router.use((req, res, next) => { requireTenant(req, res, next).catch(next); });

router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const { rows } = await query(
      `SELECT * FROM staff_users WHERE tenant_id = $1 AND username = $2 AND active = 1`,
      [req.tenant.id, username]
    );
    const staff = rows[0];
    if (!staff || !verifyPassword(password, staff.password_hash, staff.password_salt)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const token = createSession(req.tenant.id, 'staff', staff.id);
    res.json({ sessionToken: token, role: staff.role, username: staff.username });
  } catch (err) { next(err); }
});

// QR SCANNEN -> Kunde erkannt
router.get('/customer/by-qr/:qrToken', authMiddleware('staff'), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT id, display_name, email, points_balance FROM customers
      WHERE tenant_id = $1 AND qr_code_token = $2
    `, [req.tenant.id, req.params.qrToken]);
    if (!rows[0]) return res.status(404).json({ error: 'customer_not_found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Punkte buchen (z.B. nach Bezahlung, manuelle Eingabe durch Personal)
router.post('/customer/:customerId/add-points', authMiddleware('staff'), async (req, res, next) => {
  try {
    const { value, reason = 'purchase' } = req.body || {};
    if (!Number.isInteger(value) || value === 0) return res.status(400).json({ error: 'invalid_value' });

    const staffRes = await query(`SELECT username FROM staff_users WHERE id = $1`, [req.session.subjectId]);
    const customerId = Number(req.params.customerId);
    const custRes = await query(`SELECT id FROM customers WHERE id = $1 AND tenant_id = $2`, [customerId, req.tenant.id]);
    if (!custRes.rows[0]) return res.status(404).json({ error: 'customer_not_found' });

    const result = await addTransaction(req.tenant.id, customerId, value, reason, 'staff_scan', staffRes.rows[0].username);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

// Coupon prüfen (vor Einlösung dem Personal anzeigen)
router.get('/coupon/:couponId/check/:customerId', authMiddleware('staff'), async (req, res, next) => {
  try {
    const check = await canRedeem(req.tenant.id, Number(req.params.couponId), Number(req.params.customerId));
    res.json(check);
  } catch (err) { next(err); }
});

// Coupon per Code nachschlagen (für Personal-Eingabe per Tastatur statt ID)
router.get('/coupon/by-code/:code', authMiddleware('staff'), async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM coupons WHERE tenant_id = $1 AND code = $2`, [req.tenant.id, req.params.code.toUpperCase()]);
    if (!rows[0]) return res.status(404).json({ error: 'coupon_not_found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Coupon einlösen -> bestätigen -> fertig (mit Doppeleinlösung-Schutz)
router.post('/coupon/:couponId/redeem/:customerId', authMiddleware('staff'), async (req, res, next) => {
  try {
    const staffRes = await query(`SELECT username FROM staff_users WHERE id = $1`, [req.session.subjectId]);
    const result = await redeem(req.tenant.id, Number(req.params.couponId), Number(req.params.customerId), staffRes.rows[0].username);
    if (!result.ok) return res.status(409).json(result);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
