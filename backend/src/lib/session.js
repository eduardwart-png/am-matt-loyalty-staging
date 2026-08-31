// lib/session.js — Sessions DB-gestuetzt (nicht nur In-Memory).
// Grund: Render Free-Tier schlaeft nach Inaktivitaet und kann jederzeit neu deployen/neu starten —
// eine reine In-Memory-Map wuerde dabei alle eingeloggten Kunden/Staff/Admin unbemerkt ausloggen.
// In-Memory bleibt als synchroner Hot-Cache fuer schnelle Lese-Pruefungen bestehen, wird aber bei
// Miss aus der DB nachgeladen und ist niemals die einzige Quelle der Wahrheit.
const { randomToken } = require('./crypto');
const { query } = require('../db');

const sessionCache = new Map(); // token -> { tenantId, subjectType, subjectId, expiresAt } (Hot-Cache)
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 Tage (Kundenkarte soll lange gueltig bleiben)

function createSession(tenantId, subjectType, subjectId) {
  const token = randomToken(32);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessionCache.set(token, { tenantId, subjectType, subjectId, expiresAt });
  // Fire-and-forget in die DB schreiben, aber Fehler NIE silent verschlucken (Direktive §40) — nur geloggt,
  // da der In-Memory-Cache den aktuellen Request trotzdem sofort bedienen kann.
  query(
    `INSERT INTO sessions (token, tenant_id, subject_type, subject_id, expires_at) VALUES ($1,$2,$3,$4,to_timestamp($5/1000.0))`,
    [token, tenantId, subjectType, subjectId, expiresAt]
  ).catch((err) => console.error('[session] DB-Persistenz fehlgeschlagen (Session bleibt bis Neustart im Cache):', err.message));
  return token;
}

async function getSession(token) {
  const cached = sessionCache.get(token);
  if (cached) {
    if (cached.expiresAt < Date.now()) { sessionCache.delete(token); return null; }
    return cached;
  }
  // Cache-Miss (z.B. nach Server-Neustart) — aus DB nachladen statt den Nutzer auszuloggen.
  try {
    const { rows } = await query(
      `SELECT tenant_id, subject_type, subject_id, EXTRACT(EPOCH FROM expires_at) * 1000 AS expires_at_ms
       FROM sessions WHERE token = $1`,
      [token]
    );
    const row = rows[0];
    if (!row) return null;
    const expiresAt = Number(row.expires_at_ms);
    if (expiresAt < Date.now()) {
      query(`DELETE FROM sessions WHERE token = $1`, [token]).catch(() => {});
      return null;
    }
    const session = { tenantId: row.tenant_id, subjectType: row.subject_type, subjectId: row.subject_id, expiresAt };
    sessionCache.set(token, session);
    return session;
  } catch (err) {
    console.error('[session] DB-Lookup fehlgeschlagen:', err.message);
    return null;
  }
}

function destroySession(token) {
  sessionCache.delete(token);
  query(`DELETE FROM sessions WHERE token = $1`, [token]).catch((err) =>
    console.error('[session] Logout-Persistenz fehlgeschlagen:', err.message));
}

function authMiddleware(requiredType) {
  return async (req, res, next) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const session = await getSession(token);
    if (!session || (requiredType && session.subjectType !== requiredType)) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    req.session = session;
    next();
  };
}

module.exports = { createSession, getSession, destroySession, authMiddleware };
