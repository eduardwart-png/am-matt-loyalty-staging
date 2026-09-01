// lib/favorites.js — Lieblingsgerichte merken (Lidl-Plus-Paritaet: Merkliste/Favoriten).
const { query } = require('../db');

async function addFavorite(tenantId, customerId, menuItemId) {
  const itemCheck = await query(`SELECT id FROM menu_items WHERE id = $1 AND tenant_id = $2`, [menuItemId, tenantId]);
  if (!itemCheck.rows[0]) return { ok: false, reason: 'menu_item_not_found' };
  await query(`
    INSERT INTO customer_favorites (tenant_id, customer_id, menu_item_id)
    VALUES ($1, $2, $3) ON CONFLICT (customer_id, menu_item_id) DO NOTHING
  `, [tenantId, customerId, menuItemId]);
  return { ok: true };
}

async function removeFavorite(tenantId, customerId, menuItemId) {
  await query(`DELETE FROM customer_favorites WHERE tenant_id = $1 AND customer_id = $2 AND menu_item_id = $3`, [tenantId, customerId, menuItemId]);
  return { ok: true };
}

async function listFavorites(tenantId, customerId) {
  const { rows } = await query(`
    SELECT mi.* FROM customer_favorites cf
    JOIN menu_items mi ON mi.id = cf.menu_item_id
    WHERE cf.tenant_id = $1 AND cf.customer_id = $2
    ORDER BY cf.created_at DESC
  `, [tenantId, customerId]);
  return rows;
}

module.exports = { addFavorite, removeFavorite, listFavorites };
