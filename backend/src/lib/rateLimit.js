// lib/rateLimit.js — leichtgewichtiger In-Memory-Rate-Limiter fuer Login-Endpunkte (Brute-Force-Schutz).
// Bewusst ohne externes Paket/Redis - fuer den aktuellen Free-Tier-Betrieb ausreichend (Single-Instance).
// Bei mehreren Server-Instanzen (Skalierung) muesste dies auf einen geteilten Store (Redis) umziehen.
const attempts = new Map(); // key (ip+tenant) -> { count, windowStart }
const WINDOW_MS = 10 * 60 * 1000; // 10 Minuten
const MAX_ATTEMPTS = 10;

function loginRateLimit(req, res, next) {
  const key = `${req.ip}:${req.headers['x-tenant-id'] || 'default'}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return next();
  }
  entry.count++;
  if (entry.count > MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: 'too_many_attempts', retry_after_seconds: retryAfterSec });
  }
  next();
}

// Periodische Bereinigung alter Eintraege, damit die Map nicht unbegrenzt waechst.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts.entries()) {
    if (now - entry.windowStart > WINDOW_MS) attempts.delete(key);
  }
}, WINDOW_MS).unref();

module.exports = { loginRateLimit };
