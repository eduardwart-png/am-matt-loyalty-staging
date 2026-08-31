// db/index.js — zentrale DB-Verbindung (PostgreSQL via pg, Railway-Staging-fähig)
// Grund für Wechsel von node:sqlite: Railways Dateisystem ist nicht persistent über
// Deploys/Neustarts hinweg — eine SQLite-Datei würde bei jedem Deploy verloren gehen.
const path = require('node:path');
const fs = require('node:fs');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL fehlt. Lokal: eigene Postgres-Instanz starten und DATABASE_URL setzen. ' +
    'Auf Railway: Postgres-Plugin mit dem Service verlinken (setzt DATABASE_URL automatisch).'
  );
}

// Railway-Postgres benötigt i.d.R. SSL ohne strikte Zertifikatsprüfung; lokal (localhost) nicht.
const useSsl = !/localhost|127\.0\.0\.1/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

pool.on('error', (err) => {
  console.error('[db] Unerwarteter Fehler im Postgres-Pool:', err.message);
});

function query(text, params = []) {
  return pool.query(text, params);
}

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  // Additive Spalten-Migrationen (idempotent) — für bereits existierende Tabellen aus früheren Deploys,
  // da CREATE TABLE IF NOT EXISTS keine Spalten zu bestehenden Tabellen hinzufügt.
  await pool.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await pool.query(`ALTER TABLE rewards ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await pool.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS image_url TEXT`);
}

module.exports = { pool, query, migrate };
