// lib/scheduler.js — Campaign/Coupon Status-Übergänge, ohne Silent Failures (Direktive §40)
const { db } = require('../db');

const JOB_NAME = 'lifecycle_status_sync';

function ensureJobRow() {
  const row = db.prepare(`SELECT id FROM job_runs WHERE job_name = ?`).get(JOB_NAME);
  if (!row) db.prepare(`INSERT INTO job_runs (job_name, status) VALUES (?, 'idle')`).run(JOB_NAME);
}

function runLifecycleSync() {
  ensureJobRow();
  const now = new Date().toISOString();
  db.prepare(`UPDATE job_runs SET last_run = ?, status = 'running' WHERE job_name = ?`).run(now, JOB_NAME);

  try {
    // Kampagnen: scheduled -> live, wenn start_at erreicht
    db.prepare(`
      UPDATE campaigns SET status = 'live', updated_at = datetime('now')
      WHERE status = 'scheduled' AND start_at IS NOT NULL AND datetime(start_at) <= datetime('now')
    `).run();

    // Kampagnen: live -> expired, wenn end_at überschritten
    db.prepare(`
      UPDATE campaigns SET status = 'expired', updated_at = datetime('now')
      WHERE status = 'live' AND end_at IS NOT NULL AND datetime(end_at) < datetime('now')
    `).run();

    // Coupons: scheduled -> live
    db.prepare(`
      UPDATE coupons SET status = 'live'
      WHERE status = 'scheduled' AND valid_from IS NOT NULL AND datetime(valid_from) <= datetime('now')
    `).run();

    // Coupons: live -> expired
    db.prepare(`
      UPDATE coupons SET status = 'expired'
      WHERE status = 'live' AND valid_until IS NOT NULL AND datetime(valid_until) < datetime('now')
    `).run();

    db.prepare(`UPDATE job_runs SET last_success = ?, status = 'ok', retry_count = 0 WHERE job_name = ?`)
      .run(new Date().toISOString(), JOB_NAME);
    return { ok: true };
  } catch (err) {
    db.prepare(`
      UPDATE job_runs SET last_failure = ?, last_error = ?, status = 'failed', retry_count = retry_count + 1
      WHERE job_name = ?
    `).run(new Date().toISOString(), String(err && err.message || err), JOB_NAME);
    return { ok: false, error: err };
  }
}

function startScheduler(intervalMs = 60_000) {
  runLifecycleSync(); // sofortiger erster Lauf
  return setInterval(runLifecycleSync, intervalMs);
}

module.exports = { runLifecycleSync, startScheduler, JOB_NAME };
