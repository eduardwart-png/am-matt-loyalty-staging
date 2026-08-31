// lib/coupons.js — Coupon Engine: Regelprüfung + Doppeleinlösung-Schutz
const { db } = require('../db');

function isCouponCurrentlyValid(coupon) {
  const now = new Date();
  if (coupon.status !== 'live') return { ok: false, reason: 'not_live' };
  if (coupon.valid_from && new Date(coupon.valid_from) > now) return { ok: false, reason: 'not_started' };
  if (coupon.valid_until && new Date(coupon.valid_until) < now) return { ok: false, reason: 'expired' };
  if (coupon.valid_weekdays) {
    const allowed = JSON.parse(coupon.valid_weekdays);
    if (!allowed.includes(now.getDay())) return { ok: false, reason: 'wrong_weekday' };
  }
  if (coupon.valid_time_from && coupon.valid_time_until) {
    const hhmm = now.toTimeString().slice(0, 5);
    if (hhmm < coupon.valid_time_from || hhmm > coupon.valid_time_until) {
      return { ok: false, reason: 'wrong_time' };
    }
  }
  return { ok: true };
}

function canRedeem(tenantId, couponId, customerId) {
  const coupon = db.prepare(`SELECT * FROM coupons WHERE id = ? AND tenant_id = ?`).get(couponId, tenantId);
  if (!coupon) return { ok: false, reason: 'not_found' };

  const validity = isCouponCurrentlyValid(coupon);
  if (!validity.ok) return validity;

  const usedByCustomer = db.prepare(
    `SELECT COUNT(*) as n FROM coupon_redemptions WHERE coupon_id = ? AND customer_id = ?`
  ).get(couponId, customerId).n;
  const maxPerCustomer = coupon.max_uses_per_customer ?? 1;
  if (usedByCustomer >= maxPerCustomer) {
    return { ok: false, reason: 'already_redeemed', coupon }; // DOPPELEINLÖSUNG BLOCKIERT
  }

  if (coupon.max_uses_total != null) {
    const totalUsed = db.prepare(`SELECT COUNT(*) as n FROM coupon_redemptions WHERE coupon_id = ?`).get(couponId).n;
    if (totalUsed >= coupon.max_uses_total) return { ok: false, reason: 'limit_reached', coupon };
  }

  return { ok: true, coupon };
}

function redeem(tenantId, couponId, customerId, staffUsername) {
  const check = canRedeem(tenantId, couponId, customerId);
  if (!check.ok) return check;

  const info = db.prepare(
    `INSERT INTO coupon_redemptions (tenant_id, coupon_id, customer_id, redeemed_by_staff)
     VALUES (?, ?, ?, ?)`
  ).run(tenantId, couponId, customerId, staffUsername);

  return { ok: true, redemptionId: info.lastInsertRowid, coupon: check.coupon };
}

module.exports = { isCouponCurrentlyValid, canRedeem, redeem };
