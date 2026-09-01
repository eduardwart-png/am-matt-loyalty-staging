// staff.js — Staff Mode: QR SCANNEN -> Kunde erkannt -> Punkte buchen / Coupon prüfen -> bestätigen -> fertig
const API_BASE = '/api/staff';
// Tenant per URL-Query ueberschreibbar (?tenant=QA_TENANT) - siehe app.js fuer Begruendung.
const TENANT_ID = new URLSearchParams(location.search).get('tenant') || 'TENANT_001';
const state = { token: localStorage.getItem('am_matt_staff_session') || null, currentCustomer: null };

function api(path, opts = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json', 'X-Tenant-Id': TENANT_ID }, opts.headers || {});
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  return fetch(API_BASE + path, Object.assign({}, opts, { headers })).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { data, status: res.status });
    return data;
  });
}

function notify(msg) { alert(msg); } // einfache, robuste Rückmeldung für Personal-Kontext

document.getElementById('staff-login-btn').addEventListener('click', async () => {
  const username = document.getElementById('staff-username').value.trim();
  const password = document.getElementById('staff-password').value;
  try {
    const data = await api('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    state.token = data.sessionToken;
    localStorage.setItem('am_matt_staff_session', state.token);
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-scan').classList.remove('hidden');
    startCamera();
  } catch (err) {
    notify('Login fehlgeschlagen');
  }
});

// --- Kamera-Scan mit jsQR, mit manuellem Fallback (robust, kein Single-Point-of-Failure) ---
let scanning = false;
async function startCamera() {
  const video = document.getElementById('scanner');
  const canvas = document.getElementById('scan-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    await video.play();
    scanning = true;
    requestAnimationFrame(tick);
  } catch (err) {
    console.warn('Kamera nicht verfügbar, nutze manuelle Eingabe:', err.message);
  }

  function tick() {
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR ? window.jsQR(imageData.data, imageData.width, imageData.height) : null;
      if (code && code.data) {
        scanning = false;
        video.srcObject.getTracks().forEach(t => t.stop());
        lookupCustomer(code.data);
        return;
      }
    }
    requestAnimationFrame(tick);
  }
}

document.getElementById('manual-lookup-btn').addEventListener('click', () => {
  const val = document.getElementById('manual-qr').value.trim();
  if (val) lookupCustomer(val);
});

async function lookupCustomer(qrToken) {
  try {
    const customer = await api('/customer/by-qr/' + encodeURIComponent(qrToken));
    state.currentCustomer = customer;
    document.getElementById('cf-name').textContent = customer.display_name || customer.email;
    document.getElementById('cf-email').textContent = customer.email;
    document.getElementById('cf-balance').textContent = customer.points_balance + ' Punkte';
    document.getElementById('customer-found').classList.remove('hidden');
  } catch (err) {
    notify('Kunde nicht gefunden. Code prüfen.');
  }
}

document.querySelectorAll('.quick-points button').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (!state.currentCustomer) return;
    const pts = parseInt(btn.dataset.pts, 10);
    try {
      const result = await api(`/customer/${state.currentCustomer.id}/add-points`, {
        method: 'POST', body: JSON.stringify({ value: pts, reason: 'purchase' })
      });
      state.currentCustomer.points_balance = result.newBalance;
      document.getElementById('cf-balance').textContent = result.newBalance + ' Punkte';
      notify(`✅ ${pts} Punkte gebucht. Neuer Stand: ${result.newBalance}`);
    } catch (err) {
      notify('Fehler beim Buchen der Punkte.');
    }
  });
});

document.getElementById('redeem-coupon-btn').addEventListener('click', async () => {
  if (!state.currentCustomer) return;
  const code = document.getElementById('coupon-code-input').value.trim();
  if (!code) return;
  try {
    const coupon = await api('/coupon/by-code/' + encodeURIComponent(code));
    const check = await api(`/coupon/${coupon.id}/check/${state.currentCustomer.id}`);
    if (!check.ok) {
      const reasons = {
        already_redeemed: 'Coupon wurde von diesem Kunden bereits eingelöst.',
        not_live: 'Coupon ist nicht aktiv.',
        expired: 'Coupon ist abgelaufen.',
        not_started: 'Coupon ist noch nicht gültig.',
        wrong_weekday: 'Coupon gilt heute nicht.',
        wrong_time: 'Coupon gilt jetzt nicht.',
        limit_reached: 'Nutzungslimit erreicht.',
      };
      notify('❌ ' + (reasons[check.reason] || 'Coupon ungültig: ' + check.reason));
      return;
    }
    const result = await api(`/coupon/${coupon.id}/redeem/${state.currentCustomer.id}`, { method: 'POST' });
    if (result.ok) {
      notify(`✅ Coupon "${coupon.title}" eingelöst.`);
      document.getElementById('coupon-code-input').value = '';
    }
  } catch (err) {
    if (err.status === 404) notify('Coupon-Code nicht gefunden.');
    else notify('Fehler bei Coupon-Einlösung.');
  }
});

document.getElementById('new-scan-btn').addEventListener('click', () => {
  document.getElementById('customer-found').classList.add('hidden');
  document.getElementById('manual-qr').value = '';
  startCamera();
});

// Auto-Login-Check
if (state.token) {
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('view-scan').classList.remove('hidden');
  startCamera();
}
