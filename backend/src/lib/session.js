// lib/session.js — einfache, sichere Session-Verwaltung (In-Memory, ausreichend für MVP)
// Für Production später auf DB-gestützte Sessions (mit Ablauf/Revoke) erweitern.
const { randomToken } = require('./crypto');

const sessions = new Map(); // token -> { tenantId, subjectType: 'customer'|'staff', subjectId, expiresAt }
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 Tage (Kundenkarte soll lange gültig bleiben)

function createSession(tenantId, subjectType, subjectId) {
  const token = randomToken(32);
  sessions.set(token, { tenantId, subjectType, subjectId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return s;
}

function destroySession(token) {
  sessions.delete(token);
}

function authMiddleware(requiredType) {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const session = getSession(token);
    if (!session || (requiredType && session.subjectType !== requiredType)) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    req.session = session;
    next();
  };
}

module.exports = { createSession, getSession, destroySession, authMiddleware };
