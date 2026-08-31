// lib/ledger.js — Loyalty Ledger: jede Punktebuchung ist eine Transaktion, Balance wird daraus abgeleitet.
const { query } = require('../db');

async function getBalance(tenantId, customerId) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(value), 0) as balance FROM loyalty_ledger
     WHERE tenant_id = $1 AND customer_id = $2 AND status = 'confirmed'`,
    [tenantId, customerId]
  );
  return Number(rows[0].balance);
}

async function addTransaction(tenantId, customerId, value, reason, source, actor, reference = null) {
  const insert = await query(
    `INSERT INTO loyalty_ledger (tenant_id, customer_id, value, reason, source, actor, reference)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [tenantId, customerId, value, reason, source, actor, reference]
  );
  const newBalance = await getBalance(tenantId, customerId);
  await query(`UPDATE customers SET points_balance = $1, updated_at = NOW() WHERE id = $2`, [newBalance, customerId]);
  return { ledgerId: insert.rows[0].id, newBalance };
}

async function listTransactions(tenantId, customerId, limit = 50) {
  const { rows } = await query(
    `SELECT * FROM loyalty_ledger WHERE tenant_id = $1 AND customer_id = $2
     ORDER BY id DESC LIMIT $3`,
    [tenantId, customerId, limit]
  );
  return rows;
}

module.exports = { getBalance, addTransaction, listTransactions };
