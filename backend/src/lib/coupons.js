// lib/coupons.js — Coupon Engine: Regelprüfung + Doppeleinlösung-Schutz
const { query, pool } = require('../db');

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

async function canRedeem(tenantId, couponId, customerId) {
  const { rows } = await query(`SELECT * FROM coupons WHERE id = $1 AND tenant_id = $2`, [couponId, tenantId]);
  const coupon = rows[0];
  if (!coupon) return { ok: false, reason: 'not_found' };

  const validity = isCouponCurrentlyValid(coupon);
  if (!validity.ok) return validity;

  const usedRes = await query(
    `SELECT COUNT(*) as n FROM coupon_redemptions WHERE coupon_id = $1 AND customer_id = $2`,
    [couponId, customerId]
  );
  const usedByCustomer = Number(usedRes.rows[0].n);
  const maxPerCustomer = coupon.max_uses_per_customer ?? 1;
  if (usedByCustomer >= maxPerCustomer) {
    return { ok: false, reason: 'already_redeemed', coupon }; // DOPPELEINLÖSUNG BLOCKIERT
  }

  if (coupon.max_uses_total != null) {
    const totalRes = await query(`SELECT COUNT(*) as n FROM coupon_redemptions WHERE coupon_id = $1`, [couponId]);
    if (Number(totalRes.rows[0].n) >= coupon.max_uses_total) return { ok: false, reason: 'limit_reached', coupon };
  }

  return { ok: true, coupon };
}

// Race-Condition-Schutz bei Doppeleinlösung: Transaktion mit Row-Lock statt reinem Read-then-Write.
async function redeem(tenantId, couponId, customerId, staffUsername) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const couponRes = await client.query(
      `SELECT * FROM coupons WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [couponId, tenantId]
    );
    const coupon = couponRes.rows[0];
    if (!coupon) { await client.query('ROLLBACK'); return { ok: false, reason: 'not_found' }; }

    const validity = isCouponCurrentlyValid(coupon);
    if (!validity.ok) { await client.query('ROLLBACK'); return validity; }

    const usedRes = await client.query(
      `SELECT COUNT(*) as n FROM coupon_redemptions WHERE coupon_id = $1 AND customer_id = $2`,
      [couponId, customerId]
    );
    const maxPerCustomer = coupon.max_uses_per_customer ?? 1;
    if (Number(usedRes.rows[0].n) >= maxPerCustomer) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'already_redeemed', coupon }; // DOPPELEINLÖSUNG BLOCKIERT
    }

    if (coupon.max_uses_total != null) {
      const totalRes = await client.query(`SELECT COUNT(*) as n FROM coupon_redemptions WHERE coupon_id = $1`, [couponId]);
      if (Number(totalRes.rows[0].n) >= coupon.max_uses_total) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'limit_reached', coupon };
      }
    }

    const insertRes = await client.query(
      `INSERT INTO coupon_redemptions (tenant_id, coupon_id, customer_id, redeemed_by_staff)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, couponId, customerId, staffUsername]
    );
    await client.query('COMMIT');
    return { ok: true, redemptionId: insertRes.rows[0].id, coupon };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { isCouponCurrentlyValid, canRedeem, redeem };
