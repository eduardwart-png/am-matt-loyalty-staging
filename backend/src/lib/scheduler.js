// lib/scheduler.js — Campaign/Coupon Status-Übergänge, ohne Silent Failures (Direktive §40)
const { query } = require('../db');

const JOB_NAME = 'lifecycle_status_sync';

async function ensureJobRow() {
  const { rows } = await query(`SELECT id FROM job_runs WHERE job_name = $1`, [JOB_NAME]);
  if (!rows[0]) await query(`INSERT INTO job_runs (job_name, status) VALUES ($1, 'idle')`, [JOB_NAME]);
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

module.exports = { runLifecycleSync, startScheduler, JOB_NAME };
