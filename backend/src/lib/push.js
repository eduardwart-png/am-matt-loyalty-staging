// lib/push.js — echte Web-Push-Zustellung (VAPID). Kein Fake-Toggle mehr, sondern reale Browser-Notification.
const webpush = require('web-push');
const { query } = require('../db');

let configured = false;

function configurePush() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:kontakt@am-matt.example';
  if (!pub || !priv) {
    console.warn('[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY fehlen — Push-Versand deaktiviert, Subscriptions werden trotzdem gespeichert.');
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

async function saveSubscription(tenantId, customerId, subscription) {
  const { endpoint, keys } = subscription || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return { ok: false, reason: 'invalid_subscription' };
  }
  await query(`
    INSERT INTO push_subscriptions (tenant_id, customer_id, endpoint, p256dh, auth)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (customer_id, endpoint) DO UPDATE SET p256dh = $4, auth = $5
  `, [tenantId, customerId, endpoint, keys.p256dh, keys.auth]);
  await query(`UPDATE customers SET push_consent = 1 WHERE id = $1 AND tenant_id = $2`, [customerId, tenantId]);
  return { ok: true };
}

async function removeSubscription(tenantId, customerId, endpoint) {
  await query(`DELETE FROM push_subscriptions WHERE tenant_id = $1 AND customer_id = $2 AND endpoint = $3`, [tenantId, customerId, endpoint]);
  return { ok: true };
}

// Sendet an alle Subscriptions eines Kunden; entfernt automatisch abgelaufene (410/404) Endpoints.
async function sendToCustomer(tenantId, customerId, payload) {
  if (!configurePush()) return { ok: false, reason: 'vapid_not_configured' };
  const { rows } = await query(`SELECT * FROM push_subscriptions WHERE tenant_id = $1 AND customer_id = $2`, [tenantId, customerId]);
  let sent = 0;
  for (const sub of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]);
      } else {
        console.error('[push] Versand fehlgeschlagen fuer subscription', sub.id, err.message);
      }
    }
  }
  return { ok: true, sent, targeted: rows.length };
}

module.exports = { configurePush, saveSubscription, removeSubscription, sendToCustomer };
