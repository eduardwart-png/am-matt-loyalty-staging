// lib/ledger.js — Loyalty Ledger: jede Punktebuchung ist eine Transaktion, Balance wird daraus abgeleitet.
const { db } = require('../db');

function getBalance(tenantId, customerId) {
  const row = db.prepare(
    `SELECT COALESCE(SUM(value), 0) as balance FROM loyalty_ledger
     WHERE tenant_id = ? AND customer_id = ? AND status = 'confirmed'`
  ).get(tenantId, customerId);
  return row.balance;
}

function addTransaction(tenantId, customerId, value, reason, source, actor, reference = null) {
  const insert = db.prepare(
    `INSERT INTO loyalty_ledger (tenant_id, customer_id, value, reason, source, actor, reference)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const info = insert.run(tenantId, customerId, value, reason, source, actor, reference);
  const newBalance = getBalance(tenantId, customerId);
  db.prepare(`UPDATE customers SET points_balance = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(newBalance, customerId);
  return { ledgerId: info.lastInsertRowid, newBalance };
}

function listTransactions(tenantId, customerId, limit = 50) {
  return db.prepare(
    `SELECT * FROM loyalty_ledger WHERE tenant_id = ? AND customer_id = ?
     ORDER BY id DESC LIMIT ?`
  ).all(tenantId, customerId, limit);
}

module.exports = { getBalance, addTransaction, listTransactions };
