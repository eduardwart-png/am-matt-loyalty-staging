// lib/segments.js — echte Kundensegmentierung (kein Fake "alle sehen alles" mehr).
// Segmente: 'new' (frisch registriert), 'regular' (mehrfacher Besuch), 'vip' (Vielbesucher/hohe Punkte).
// Ein Coupon/Kampagne mit target_segment='all' erreicht jeden; alles andere nur das passende Segment.
const { query } = require('../db');

const VIP_VISIT_THRESHOLD = 8;   // >= 8 Punktebuchungen aus 'purchase'/'staff_scan' gilt als Vielbesucher
const REGULAR_VISIT_THRESHOLD = 2; // >= 2 Besuche gilt als Stammgast
const NEW_CUSTOMER_DAYS = 30;

async function computeSegment(tenantId, customerId) {
  const custRes = await query(`SELECT created_at, birthday FROM customers WHERE id = $1 AND tenant_id = $2`, [customerId, tenantId]);
  const customer = custRes.rows[0];
  if (!customer) return 'new';

  const visitsRes = await query(
    `SELECT COUNT(*) as n FROM loyalty_ledger
     WHERE tenant_id = $1 AND customer_id = $2 AND status = 'confirmed' AND source IN ('purchase','staff_scan')`,
    [tenantId, customerId]
  );
  const visits = Number(visitsRes.rows[0].n);

  const ageMs = Date.now() - new Date(customer.created_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (visits >= VIP_VISIT_THRESHOLD) return 'vip';
  if (visits >= REGULAR_VISIT_THRESHOLD) return 'regular';
  if (ageDays <= NEW_CUSTOMER_DAYS) return 'new';
  return 'regular';
}

// Segment-Hierarchie: vip-Kunden sehen auch 'regular'-Angebote, aber nicht umgekehrt.
// 'all' erreicht jeden. Verhindert, dass ein Neukunde ein VIP-Exklusivangebot sieht (echte Personalisierung).
const SEGMENT_VISIBILITY = {
  new: new Set(['all', 'new']),
  regular: new Set(['all', 'new', 'regular']),
  vip: new Set(['all', 'new', 'regular', 'vip']),
};

function isVisibleToSegment(targetSegment, customerSegment) {
  const seg = targetSegment || 'all';
  const visible = SEGMENT_VISIBILITY[customerSegment] || SEGMENT_VISIBILITY.new;
  return visible.has(seg);
}

module.exports = { computeSegment, isVisibleToSegment, VIP_VISIT_THRESHOLD, REGULAR_VISIT_THRESHOLD };
