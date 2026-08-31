// app.js — Customer Mobile Browser App Logic
const API_BASE = '/api/customer';
const TENANT_ID = 'TENANT_001';
const REWARD_GOAL_FALLBACK = 600; // falls keine Prämie geladen werden kann

const state = {
  token: localStorage.getItem('am_matt_session') || null,
  customer: null,
  previewMode: false,
  previewData: null,
};

function api(path, opts = {}) {
  const headers = Object.assign({
    'Content-Type': 'application/json',
    'X-Tenant-Id': TENANT_ID,
  }, opts.headers || {});
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  return fetch(API_BASE + path, Object.assign({}, opts, { headers }))
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { data, status: res.status });
      return data;
    });
}

function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  setTimeout(() => { el.className = 'toast'; }, 2600);
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + name);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  if (name === 'start') loadStart();
  if (name === 'coupons') loadCoupons();
  if (name === 'points') loadPointsView();
  if (name === 'qr') loadQr();
  if (name === 'profile') loadProfile();
}

function enterApp() {
  document.getElementById('bottom-nav').style.display = 'flex';
  showView('start');
}

function exitApp() {
  state.token = null;
  state.previewMode = false;
  state.previewData = null;
  localStorage.removeItem('am_matt_session');
  document.getElementById('bottom-nav').style.display = 'none';
  document.getElementById('preview-badge').classList.remove('show');
  document.getElementById('demo-pill').style.display = 'none';
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-auth').classList.add('active');
}

// --- VORSCHAU OHNE LOGIN (echte Demo-Daten, schreibgeschützt) ---
document.getElementById('btn-preview-mode').addEventListener('click', async () => {
  try {
    const data = await api('/preview');
    state.previewMode = true;
    state.previewData = data;
    document.getElementById('preview-badge').classList.add('show');
    document.getElementById('demo-pill').style.display = 'inline-block';
    document.getElementById('bottom-nav').querySelectorAll('.nav-item').forEach(n => {
      if (n.dataset.view === 'profile') n.style.display = 'none';
    });
    showToast('Vorschau mit Beispieldaten aktiv', 'success');
    enterApp();
  } catch (err) {
    showToast('Vorschau aktuell nicht verfügbar', 'error');
  }
});

// --- AUTH ---
let authMode = 'login';
document.getElementById('auth-toggle-mode').addEventListener('click', (e) => {
  e.preventDefault();
  authMode = authMode === 'login' ? 'register' : 'login';
  document.getElementById('auth-title').textContent = authMode === 'login' ? 'Anmelden' : 'Konto erstellen';
  document.getElementById('auth-submit').textContent = authMode === 'login' ? 'Anmelden' : 'Registrieren';
  document.getElementById('auth-name-field').style.display = authMode === 'register' ? 'block' : 'none';
  document.getElementById('auth-toggle-mode').textContent = authMode === 'login' ? 'Jetzt registrieren' : 'Zum Login';
});

document.getElementById('auth-submit').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const displayName = document.getElementById('auth-name').value.trim();
  if (!email || !password) return showToast('Bitte E-Mail und Passwort eingeben', 'error');

  try {
    const path = authMode === 'login' ? '/login' : '/register';
    const body = authMode === 'login' ? { email, password } : { email, password, displayName };
    const data = await api(path, { method: 'POST', body: JSON.stringify(body) });
    state.token = data.sessionToken;
    localStorage.setItem('am_matt_session', state.token);
    showToast(authMode === 'login' ? 'Willkommen zurück!' : 'Konto erstellt!', 'success');
    enterApp();
  } catch (err) {
    showToast(err.data && err.data.error === 'invalid_credentials' ? 'Login fehlgeschlagen' :
      err.data && err.data.error === 'email_already_registered' ? 'E-Mail bereits registriert' :
      'Fehler: ' + (err.message || 'unbekannt'), 'error');
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  if (!state.previewMode) { try { await api('/logout', { method: 'POST' }); } catch (e) {} }
  exitApp();
});

// --- NAV ---
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => showView(item.dataset.view));
});

// --- START VIEW ---
async function loadStart() {
  if (state.previewMode) return renderStartPreview();
  try {
    const me = await api('/me');
    state.customer = me;
    document.getElementById('start-points').textContent = me.points_balance;

    let goal = REWARD_GOAL_FALLBACK;
    try {
      const rewards = await api('/rewards');
      if (rewards.length) goal = Math.min(...rewards.map(r => r.points_cost).filter(c => c > me.points_balance)) || rewards[0].points_cost;
    } catch (e) {}
    const pct = Math.min(100, Math.round((me.points_balance / goal) * 100));
    document.getElementById('start-progress').style.width = pct + '%';
    const remaining = Math.max(0, goal - me.points_balance);
    document.getElementById('start-progress-note').textContent = remaining > 0
      ? `Noch ${remaining} Punkte bis zur nächsten Prämie`
      : 'Prämie bereits erreicht — jetzt einlösen!';
  } catch (err) {
    if (err.status === 401) return exitApp();
  }

  try {
    const campaigns = await api('/campaigns/live');
    renderCampaign(campaigns);
  } catch (e) {}
}

function renderCampaign(campaigns) {
  const el = document.getElementById('start-campaign');
  if (campaigns.length) {
    const c = campaigns[0];
    el.innerHTML = `<div class="icon"><img src="/assets/img/dish-schnitzel.jpg" alt=""></div><div><div class="title">${escapeHtml(c.title)}</div><div class="desc">${escapeHtml(c.description || '')}</div></div>`;
  } else {
    el.innerHTML = `<div class="icon"><img src="/assets/img/dish-schnitzel.jpg" alt=""></div><div><div class="title">Aktuell keine aktive Aktion</div><div class="desc">Schauen Sie bald wieder vorbei</div></div>`;
  }
}

function renderStartPreview() {
  const d = state.previewData;
  document.getElementById('start-points').textContent = d.customer.points_balance;
  let goal = REWARD_GOAL_FALLBACK;
  if (d.rewards.length) goal = Math.min(...d.rewards.map(r => r.points_cost).filter(c => c > d.customer.points_balance)) || d.rewards[0].points_cost;
  const pct = Math.min(100, Math.round((d.customer.points_balance / goal) * 100));
  document.getElementById('start-progress').style.width = pct + '%';
  const remaining = Math.max(0, goal - d.customer.points_balance);
  document.getElementById('start-progress-note').textContent = remaining > 0
    ? `Noch ${remaining} Punkte bis zur nächsten Prämie`
    : 'Prämie bereits erreicht — jetzt einlösen!';
  renderCampaign(d.campaigns);
}

// --- COUPONS ---
async function loadCoupons() {
  const list = document.getElementById('coupons-list');
  if (state.previewMode) return renderCoupons(list, state.previewData.coupons);
  try {
    const coupons = await api('/coupons');
    renderCoupons(list, coupons);
  } catch (err) {
    if (err.status === 401) return exitApp();
    list.innerHTML = `<div class="empty-state">Fehler beim Laden der Coupons</div>`;
  }
}
function renderCoupons(list, coupons) {
  if (!coupons.length) {
    list.innerHTML = `<div class="empty-state">🎟️<br>Aktuell keine gültigen Coupons</div>`;
    return;
  }
  list.innerHTML = coupons.map(c => `
    <div class="card coupon-card">
      <div class="badge">Gültig</div>
      <div class="title" style="font-weight:700;font-size:15px">${escapeHtml(c.title)}</div>
      <div class="desc" style="font-size:12.5px;color:var(--am-matt-text-muted);margin-top:4px">${escapeHtml(c.description || '')}</div>
      <div class="code">${escapeHtml(c.code)}</div>
    </div>
  `).join('');
}

// --- PUNKTE / PRÄMIEN ---
async function loadPointsView() {
  if (state.previewMode) return renderPointsPreview();
  try {
    const rewards = await api('/rewards');
    renderRewards(rewards, state.customer ? state.customer.points_balance : 0);
    const { transactions } = await api('/points');
    renderTransactions(transactions);
  } catch (err) {
    if (err.status === 401) return exitApp();
  }
}
function renderPointsPreview() {
  const d = state.previewData;
  renderRewards(d.rewards, d.customer.points_balance);
  renderTransactions(d.transactions);
}
function renderRewards(rewards, balance) {
  const rewardsList = document.getElementById('rewards-list');
  rewardsList.innerHTML = rewards.length ? rewards.map(r => `
    <div class="card reward-card ${r.points_cost > balance ? 'locked' : ''}">
      <div><div style="font-weight:700;font-size:14px">${escapeHtml(r.title)}</div>
      <div style="font-size:12px;color:var(--am-matt-text-muted)">${escapeHtml(r.description || '')}</div></div>
      <div class="cost">${r.points_cost} P</div>
    </div>
  `).join('') : `<div class="empty-state">Noch keine Prämien verfügbar</div>`;
}
function renderTransactions(transactions) {
  const txnList = document.getElementById('txn-list');
  txnList.innerHTML = transactions.length ? transactions.map(t => `
    <div class="txn-row">
      <span>${formatReason(t.reason)}</span>
      <span class="txn-value ${t.value >= 0 ? 'positive' : 'negative'}">${t.value >= 0 ? '+' : ''}${t.value}</span>
    </div>
  `).join('') : `<div class="empty-state">Noch keine Aktivitäten</div>`;
}

function formatReason(reason) {
  const map = {
    purchase: 'Einkauf',
    demo_seed_purchase_history: 'Willkommensbonus (Demo)',
    birthday_bonus: 'Geburtstagsbonus',
    manual_adjustment: 'Manuelle Anpassung',
  };
  return map[reason] || reason;
}

// --- QR / KUNDENKARTE ---
function loadQr() {
  const customer = state.previewMode ? state.previewData.customer : state.customer;
  if (!customer) return;
  document.getElementById('qr-name').textContent = customer.display_name || customer.email;
  const canvas = document.getElementById('qrcode-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 220; canvas.height = 220;
  ctx.clearRect(0, 0, 220, 220);
  try {
    const qr = qrcode(0, 'M');
    qr.addData(customer.qr_code_token);
    qr.make();
    const cellSize = Math.floor(220 / qr.getModuleCount());
    const offset = (220 - cellSize * qr.getModuleCount()) / 2;
    ctx.fillStyle = '#2B2320';
    for (let row = 0; row < qr.getModuleCount(); row++) {
      for (let col = 0; col < qr.getModuleCount(); col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
        }
      }
    }
  } catch (e) {
    ctx.font = '12px sans-serif';
    ctx.fillText('QR-Code: ' + customer.qr_code_token, 10, 110);
  }
}

// --- PROFIL ---
async function loadProfile() {
  if (state.previewMode) {
    showView('start');
    showToast('Profil ist in der Vorschau nicht verfügbar — bitte registrieren', '');
    return;
  }
  if (!state.customer) {
    try { state.customer = await api('/me'); } catch (e) { if (e.status === 401) return exitApp(); }
  }
  document.getElementById('profile-name').textContent = state.customer.display_name || '—';
  document.getElementById('profile-email').textContent = state.customer.email;
  document.getElementById('toggle-marketing').classList.toggle('on', !!state.customer.marketing_consent);
  document.getElementById('toggle-push').classList.toggle('on', !!state.customer.push_consent);
}

document.getElementById('toggle-marketing').addEventListener('click', function () {
  this.classList.toggle('on');
  showToast('Einstellung gespeichert (Demo)', 'success');
});
document.getElementById('toggle-push').addEventListener('click', function () {
  this.classList.toggle('on');
  showToast('Einstellung gespeichert (Demo)', 'success');
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// --- INIT ---
(function init() {
  if (state.token) {
    api('/me').then((me) => {
      state.customer = me;
      enterApp();
    }).catch(() => {
      exitApp();
    });
  }
  // Direktlink ?preview=1 öffnet sofort die Vorschau ohne Login
  if (new URLSearchParams(location.search).get('preview') === '1') {
    document.getElementById('btn-preview-mode').click();
  }
})();
