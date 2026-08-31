// server.js — Express-App, dient Backend-API + Mobile-Browser-Frontend statisch aus.
const path = require('node:path');
const express = require('express');
const { migrate } = require('./db');
const { startScheduler } = require('./lib/scheduler');
const seed = require('./db/seed');

const app = express();
app.use(express.json());

// CORS für lokale Entwicklung (Frontend evtl. anderer Port) — Production: einschränken.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-Id');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api/customer', require('./routes/customer'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', async (req, res) => {
  try {
    const { pool } = require('./db');
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected', ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'disconnected', error: err.message, ts: new Date().toISOString() });
  }
});

// Statisches Frontend (Mobile Browser App, Staff Mode, Operations Studio)
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

app.get('/staff', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'staff', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'admin', 'index.html')));
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'customer', 'index.html')));

// Zentrales Error-Handling, damit DB-/Async-Fehler nie silent bleiben (Direktive §40 sinngemäß auf API-Ebene)
app.use((err, req, res, next) => {
  console.error('[api-error]', req.method, req.originalUrl, '-', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'internal_server_error' });
});

const PORT = process.env.PORT || 4100;

async function start() {
  try {
    await migrate();
    console.log('[am-matt-loyalty] DB-Migration erfolgreich.');
    await seed.main(false); // Pool offen lassen — Server braucht ihn weiter
    console.log('[am-matt-loyalty] Seed erfolgreich (idempotent).');
  } catch (err) {
    console.error('[am-matt-loyalty] DB-Migration/Seed fehlgeschlagen:', err.message);
    process.exit(1);
  }
  startScheduler(30_000);
  app.listen(PORT, () => {
    console.log(`[am-matt-loyalty] Server läuft auf http://localhost:${PORT}`);
  });
}

start();

module.exports = app;
