// lib/scheduler.js — Campaign/Coupon Status-Übergänge, ohne Silent Failures (Direktive §40)
const { query } = require('../db');
const { addTransaction } = require('./ledger');

const JOB_NAME = 'lifecycle_status_sync';
const BIRTHDAY_JOB_NAME = 'birthday_bonus_grant';
const BIRTHDAY_BONUS_POINTS = 100;

async function ensureJobRow(name = JOB_NAME) {
  const { rows } = await query(`SELECT id FROM job_runs WHERE job_name = $1`, [name]);
  if (!rows[0]) await query(`INSERT INTO job_runs (job_name, status) VALUES ($1, 'idle')`, [name]);
}

// Vergibt einmal pro Kalenderjahr automatisch einen Punkte-Bonus am Geburtstag des Kunden.
// birthday_bonus_year verhindert Doppelvergabe bei mehrfachem Job-Lauf am selben Tag.
async function runBirthdayBonusGrant() {
  await ensureJobRow(BIRTHDAY_JOB_NAME);
  await query(`UPDATE job_runs SET last_run = NOW(), status = 'running' WHERE job_name = $1`, [BIRTHDAY_JOB_NAME]);
  try {
    const { rows } = await query(`
      SELECT id, tenant_id FROM customers
      WHERE birthday IS NOT NULL
        AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE)
        AND (birthday_bonus_year IS NULL OR birthday_bonus_year <> EXTRACT(YEAR FROM CURRENT_DATE)::int)
    `);
    for (const c of rows) {
      await addTransaction(c.tenant_id, c.id, BIRTHDAY_BONUS_POINTS, 'birthday_bonus', 'birthday', 'system', null);
      await query(`UPDATE customers SET birthday_bonus_year = EXTRACT(YEAR FROM CURRENT_DATE)::int WHERE id = $1`, [c.id]);
    }
    await query(`UPDATE job_runs SET last_success = NOW(), status = 'ok', retry_count = 0 WHERE job_name = $1`, [BIRTHDAY_JOB_NAME]);
    return { ok: true, granted: rows.length };
  } catch (err) {
    await query(`
      UPDATE job_runs SET last_failure = NOW(), last_error = $1, status = 'failed', retry_count = retry_count + 1
      WHERE job_name = $2
    `, [String(err && err.message || err), BIRTHDAY_JOB_NAME]);
    return { ok: false, error: err };
  }
}

async function runLifecycleSync() {
  await ensureJobRow();
  await query(`UPDATE job_runs SET last_run = NOW(), status = 'running' WHERE job_name = $1`, [JOB_NAME]);

  try {
    await query(`
      UPDATE campaigns SET status = 'live', updated_at = NOW()
      WHERE status = 'scheduled' AND start_at IS NOT NULL AND start_at <= NOW()
    `);

    await query(`
      UPDATE campaigns SET status = 'expired', updated_at = NOW()
      WHERE status = 'live' AND end_at IS NOT NULL AND end_at < NOW()
    `);

    await query(`
      UPDATE coupons SET status = 'live'
      WHERE status = 'scheduled' AND valid_from IS NOT NULL AND valid_from <= NOW()
    `);

    await query(`
      UPDATE coupons SET status = 'expired'
      WHERE status = 'live' AND valid_until IS NOT NULL AND valid_until < NOW()
    `);

    // Abgelaufene Sessions aufraeumen — verhindert unbegrenztes Tabellenwachstum (Free-Tier-DB-Limit).
    await query(`DELETE FROM sessions WHERE expires_at < NOW()`);

    await runBirthdayBonusGrant();

    await query(`UPDATE job_runs SET last_success = NOW(), status = 'ok', retry_count = 0 WHERE job_name = $1`, [JOB_NAME]);
    return { ok: true };
  } catch (err) {
    await query(`
      UPDATE job_runs SET last_failure = NOW(), last_error = $1, status = 'failed', retry_count = retry_count + 1
      WHERE job_name = $2
    `, [String(err && err.message || err), JOB_NAME]);
    return { ok: false, error: err };
  }
}

function startScheduler(intervalMs = 30_000) {
  runLifecycleSync().catch((err) => console.error('[scheduler] initial run failed:', err.message));
  return setInterval(() => {
    runLifecycleSync().catch((err) => console.error('[scheduler] run failed:', err.message));
  }, intervalMs);
}

module.exports = { runLifecycleSync, runBirthdayBonusGrant, startScheduler, JOB_NAME, BIRTHDAY_JOB_NAME };
