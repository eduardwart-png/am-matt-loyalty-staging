// server.js — Express-App, dient Backend-API + Mobile-Browser-Frontend statisch aus.
const path = require('node:path');
const express = require('express');
const { migrate } = require('./db');
const { startScheduler } = require('./lib/scheduler');

migrate();
startScheduler(30_000); // alle 30s Kampagnen/Coupon-Lifecycle prüfen

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

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Statisches Frontend (Mobile Browser App, Staff Mode, Operations Studio)
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

app.get('/staff', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'staff', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'admin', 'index.html')));
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'customer', 'index.html')));

const PORT = process.env.PORT || 4100;
app.listen(PORT, () => {
  console.log(`[am-matt-loyalty] Server läuft auf http://localhost:${PORT}`);
});

module.exports = app;
