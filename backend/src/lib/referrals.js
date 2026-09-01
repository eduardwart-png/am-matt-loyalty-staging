// lib/referrals.js — Freunde-werben-Programm (Lidl-Plus-Paritaet: Partnervorteile/Empfehlung).
const { query } = require('../db');
const { randomToken } = require('./crypto');
const { addTransaction } = require('./ledger');

const REFERRER_BONUS_POINTS = 50;
const REFERRED_BONUS_POINTS = 25;

function generateCode(displayName) {
  const base = (displayName || 'GAST').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 6) || 'GAST';
  return base + randomToken(3).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

async function ensureReferralCode(tenantId, customerId) {
  const { rows } = await query(`SELECT referral_code, display_name FROM customers WHERE id = $1 AND tenant_id = $2`, [customerId, tenantId]);
  const customer = rows[0];
  if (!customer) return null;
  if (customer.referral_code) return customer.referral_code;

  // Kollisionssichere Vergabe (sehr unwahrscheinlich bei randomToken, aber additiv abgesichert).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(customer.display_name);
    try {
      await query(`UPDATE customers SET referral_code = $1 WHERE id = $2 AND tenant_id = $3`, [code, customerId, tenantId]);
      return code;
    } catch (err) {
      if (err.code !== '23505') throw err; // nur bei Code-Kollision erneut versuchen
    }
  }
  throw new Error('referral_code_generation_failed');
}

// Wird beim Registrieren eines NEUEN Kunden aufgerufen, wenn er einen Empfehlungscode eingegeben hat.
async function applyReferralOnSignup(tenantId, newCustomerId, referralCodeInput) {
  if (!referralCodeInput) return { applied: false };
  const code = String(referralCodeInput).trim().toUpperCase();
  const referrerRes = await query(
    `SELECT id FROM customers WHERE tenant_id = $1 AND referral_code = $2`,
    [tenantId, code]
  );
  const referrer = referrerRes.rows[0];
  if (!referrer) return { applied: false, reason: 'code_not_found' };
  if (referrer.id === newCustomerId) return { applied: false, reason: 'self_referral_blocked' };

  const insert = await query(`
    INSERT INTO referrals (tenant_id, referrer_customer_id, referred_customer_id, code, status)
    VALUES ($1, $2, $3, $4, 'redeemed') RETURNING id
  `, [tenantId, referrer.id, newCustomerId, code]);

  await addTransaction(tenantId, referrer.id, REFERRER_BONUS_POINTS, 'referral_bonus_referrer', 'referral', 'system', String(insert.rows[0].id));
  await addTransaction(tenantId, newCustomerId, REFERRED_BONUS_POINTS, 'referral_bonus_new_customer', 'referral', 'system', String(insert.rows[0].id));

  await query(`UPDATE referrals SET reward_granted = 1, redeemed_at = NOW() WHERE id = $1`, [insert.rows[0].id]);
  return { applied: true, referrerId: referrer.id, referrerBonus: REFERRER_BONUS_POINTS, referredBonus: REFERRED_BONUS_POINTS };
}

async function listReferrals(tenantId, customerId) {
  const { rows } = await query(`
    SELECT r.*, c.display_name as referred_name FROM referrals r
    LEFT JOIN customers c ON c.id = r.referred_customer_id
    WHERE r.tenant_id = $1 AND r.referrer_customer_id = $2 ORDER BY r.created_at DESC
  `, [tenantId, customerId]);
  return rows;
}

module.exports = { ensureReferralCode, applyReferralOnSignup, listReferrals, REFERRER_BONUS_POINTS, REFERRED_BONUS_POINTS };
