// app.js — Am-Matt Customer Experience (Restaurant + Loyalty als ein Produkt)
const API_BASE = '/api/customer';
const TENANT_ID = 'TENANT_001';
const REWARD_GOAL_FALLBACK = 600;

const state = {
  token: localStorage.getItem('am_matt_session') || null,
  customer: null,
  menuCache: null,
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// --- NAVIGATION ---
const PERSONAL_VIEWS = ['coupons', 'rewards', 'qr', 'profile'];

function showView(name) {
  if (PERSONAL_VIEWS.includes(name) && !state.token) {
    openLoginSheet();
    return;
  }
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + name);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));

  const topbar = document.getElementById('topbar');
  topbar.classList.toggle('on-hero', name === 'start');
  topbar.classList.toggle('solid', name !== 'start');

  window.scrollTo(0, 0);
  if (name === 'start') loadStart();
  if (name === 'menu') loadMenu();
  if (name === 'coupons') loadCoupons();
  if (name === 'rewards') loadRewardsView();
  if (name === 'qr') loadQr();
  if (name === 'profile') loadProfile();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => showView(item.dataset.view));
});
document.querySelectorAll('[data-goto]').forEach(item => {
  item.addEventListener('click', () => showView(item.dataset.goto));
});
document.getElementById('topbar-avatar-btn').addEventListener('click', () => showView('profile'));

// --- LOGIN SHEET (bottom sheet, not a blocking full page) ---
let authMode = 'login';
function openLoginSheet() {
  document.getElementById('login-backdrop').classList.add('show');
  document.getElementById('login-sheet').style.display = 'block';
}
function closeLoginSheet() {
  document.getElementById('login-backdrop').classList.remove('show');
  document.getElementById('login-sheet').style.display = 'none';
}
document.getElementById('topbar-login-btn').addEventListener('click', openLoginSheet);
document.getElementById('login-backdrop').addEventListener('click', closeLoginSheet);
document.getElementById('login-sheet-close').addEventListener('click', closeLoginSheet);
document.getElementById('loyalty-teaser-cta').addEventListener('click', openLoginSheet);

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
    closeLoginSheet();
    showToast(authMode === 'login' ? 'Willkommen zurück!' : 'Willkommen bei Am-Matt!', 'success');
    await refreshIdentity();
    showView('start');
  } catch (err) {
    showToast(err.data && err.data.error === 'invalid_credentials' ? 'Login fehlgeschlagen' :
      err.data && err.data.error === 'email_already_registered' ? 'E-Mail bereits registriert' :
      'Etwas ist schiefgelaufen. Bitte erneut versuchen.', 'error');
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  try { await api('/logout', { method: 'POST' }); } catch (e) {}
  state.token = null;
  state.customer = null;
  localStorage.removeItem('am_matt_session');
  updateAuthUi();
  showView('start');
});

function updateAuthUi() {
  const loginBtn = document.getElementById('topbar-login-btn');
  const avatarBtn = document.getElementById('topbar-avatar-btn');
  if (state.token && state.customer) {
    loginBtn.style.display = 'none';
    avatarBtn.style.display = 'flex';
    avatarBtn.textContent = (state.customer.display_name || state.customer.email || '?').trim().charAt(0).toUpperCase();
    document.getElementById('loyalty-teaser').style.display = 'none';
    document.getElementById('loyalty-points').style.display = 'block';
  } else {
    loginBtn.style.display = 'inline-block';
    avatarBtn.style.display = 'none';
    document.getElementById('loyalty-teaser').style.display = 'block';
    document.getElementById('loyalty-points').style.display = 'none';
  }
}

async function refreshIdentity() {
  if (!state.token) { updateAuthUi(); return; }
  try {
    state.customer = await api('/me');
  } catch (e) {
    if (e.status === 401) { state.token = null; state.customer = null; localStorage.removeItem('am_matt_session'); }
  }
  updateAuthUi();
}

// --- START ---
async function loadStart() {
  if (state.token && state.customer) {
    const first = (state.customer.display_name || '').split(' ')[0];
    document.getElementById('greeting-name').textContent = first ? `Hallo ${escapeHtml(first)}` : 'Willkommen zurück!';
    document.getElementById('start-points').textContent = state.customer.points_balance;
    let goal = REWARD_GOAL_FALLBACK;
    try {
      const rewards = await api('/rewards');
      const higher = rewards.map(r => r.points_cost).filter(c => c > state.customer.points_balance);
      if (higher.length) goal = Math.min(...higher);
      else if (rewards.length) goal = rewards[0].points_cost;
    } catch (e) {}
    const pct = Math.min(100, Math.round((state.customer.points_balance / goal) * 100));
    document.getElementById('start-progress').style.width = pct + '%';
    const remaining = Math.max(0, goal - state.customer.points_balance);
    document.getElementById('start-progress-note').textContent = remaining > 0
      ? `Noch ${remaining} Punkte bis zur nächsten Prämie`
      : 'Prämie bereits erreicht — jetzt einlösen!';
  }

  // Aktuelle Kampagne (öffentlich)
  try {
    const campaigns = await api('/campaigns/live');
    renderCampaignCards(campaigns);
  } catch (e) {}

  // Coupons (nur mit Login personalisiert; sonst Login-Einladung)
  const couponsScroll = document.getElementById('coupons-scroll');
  const couponsSection = document.getElementById('section-coupons');
  if (state.token) {
    try {
      const coupons = await api('/coupons');
      if (!coupons.length) { couponsSection.style.display = 'none'; }
      else { couponsSection.style.display = 'block'; renderCouponScroll(couponsScroll, coupons); }
    } catch (e) { couponsSection.style.display = 'none'; }
  } else {
    couponsSection.style.display = 'block';
    couponsScroll.innerHTML = `
      <div class="coupon-tile" style="flex:0 0 100%">
        <div class="coupon-tile-body" style="text-align:center;padding:var(--space-5) var(--space-4)">
          <div style="font-size:32px">🎟️</div>
          <div class="coupon-tile-title" style="margin-top:8px">Melde dich an für deine Vorteile</div>
          <div class="coupon-tile-desc">Aktuelle Coupons und Rabatte warten auf dich.</div>
          <button class="btn btn-primary btn-full" style="margin-top:14px" onclick="document.getElementById('topbar-login-btn').click()">Jetzt anmelden</button>
        </div>
      </div>`;
  }

  // Empfehlungen aus der Küche (öffentlich, aus Speisekarte)
  try {
    const categories = await getMenu();
    renderFoodScroll(categories);
    renderSeasonalCard(categories);
  } catch (e) {}
}

function renderCampaignCards(campaigns) {
  const el = document.getElementById('campaign-card');
  const weekly = campaigns.filter(c => c.campaign_type !== 'seasonal');
  if (!weekly.length) {
    el.innerHTML = `<div class="feature-card"><div class="photo"><img src="/assets/img/dish-schnitzel.jpg" alt=""></div><div class="feature-body"><div class="feature-eyebrow">Diese Woche</div><div class="feature-title">Schauen Sie bald wieder vorbei</div><div class="feature-desc">Neue Angebote folgen in Kürze.</div></div></div>`;
    return;
  }
  el.innerHTML = weekly.map(c => `
    <div class="feature-card">
      <div class="photo"><img src="${escapeHtml(c.image_url || '/assets/img/dish-schnitzel.jpg')}" alt=""></div>
      <div class="feature-body">
        <div class="feature-eyebrow">Diese Woche</div>
        <div class="feature-title">${escapeHtml(c.title)}</div>
        <div class="feature-desc">${escapeHtml(c.description || '')}</div>
      </div>
    </div>
  `).join('');
}

function renderSeasonalCard(categories) {
  const seasonalSection = document.getElementById('section-seasonal');
  api('/campaigns/live').then(campaigns => {
    const seasonal = campaigns.find(c => c.campaign_type === 'seasonal');
    if (!seasonal) { seasonalSection.style.display = 'none'; return; }
    seasonalSection.style.display = 'block';
    document.getElementById('seasonal-card').innerHTML = `
      <div class="feature-card">
        <div class="photo"><img src="${escapeHtml(seasonal.image_url || '/assets/img/dish-spargel.jpg')}" alt=""></div>
        <div class="feature-body">
          <div class="feature-eyebrow">Saison</div>
          <div class="feature-title">${escapeHtml(seasonal.title)}</div>
          <div class="feature-desc">${escapeHtml(seasonal.description || '')}</div>
        </div>
      </div>`;
  }).catch(() => { seasonalSection.style.display = 'none'; });
}

function renderCouponScroll(container, coupons) {
  container.innerHTML = coupons.map(c => `
    <div class="coupon-tile">
      <div class="photo"><img src="${escapeHtml(c.image_url || '/assets/img/dish-schnitzel.jpg')}" alt=""></div>
      <div class="coupon-tile-body">
        <div class="badge">Verfügbar</div>
        <div class="coupon-tile-title">${escapeHtml(c.title)}</div>
        <div class="coupon-tile-desc">${escapeHtml(c.description || '')}</div>
        <div class="coupon-tile-meta"><span>1× einlösbar</span><span>Beim Personal zeigen</span></div>
      </div>
    </div>
  `).join('');
}

function renderFoodScroll(categories) {
  const withImages = [];
  categories.forEach(cat => cat.items.forEach(i => { if (i.image_url) withImages.push(i); }));
  const el = document.getElementById('food-scroll');
  const picks = withImages.length ? withImages : categories.flatMap(c => c.items).slice(0, 6);
  el.innerHTML = picks.slice(0, 8).map(i => `
    <div class="food-tile">
      <div class="photo"><img src="${escapeHtml(i.image_url || '/assets/img/dish-schnitzel.jpg')}" alt=""></div>
      <div class="food-tile-body">
        <div class="food-tile-title">${escapeHtml(i.name)}</div>
        <div class="food-tile-price">${i.price != null ? i.price.toFixed(2).replace('.', ',') + ' €' : ''}</div>
      </div>
    </div>
  `).join('');
}

// --- SPEISEKARTE ---
function getMenu() {
  if (state.menuCache) return Promise.resolve(state.menuCache);
  return api('/menu').then(categories => { state.menuCache = categories; return categories; });
}

async function loadMenu() {
  try {
    const categories = await getMenu();
    const tabs = document.getElementById('menu-tabs');
    tabs.innerHTML = categories.map((c, i) => `<button class="menu-chip ${i === 0 ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c.name)}</button>`).join('');
    const catEl = document.getElementById('menu-categories');
    catEl.innerHTML = categories.map(c => `
      <div class="menu-category" id="menu-cat-${c.id}">
        <h2>${escapeHtml(c.name)}</h2>
        ${c.items.map(i => `
          <div class="menu-item">
            ${i.image_url ? `<div class="photo"><img src="${escapeHtml(i.image_url)}" alt=""></div>` : `<div class="menu-item-noimg"></div>`}
            <div class="menu-item-body">
              <div class="menu-item-name">${escapeHtml(i.name)}${i.vegetarian ? ' 🌱' : ''}</div>
              ${i.description ? `<div class="menu-item-desc">${escapeHtml(i.description)}</div>` : ''}
            </div>
            <div class="menu-item-price">${i.price != null ? Number(i.price).toFixed(2).replace('.', ',') + ' €' : ''}</div>
          </div>
        `).join('')}
      </div>
    `).join('');

    tabs.querySelectorAll('.menu-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        tabs.querySelectorAll('.menu-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const target = document.getElementById('menu-cat-' + chip.dataset.cat);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  } catch (e) {
    document.getElementById('menu-categories').innerHTML = `<div class="empty-state">Speisekarte konnte nicht geladen werden.</div>`;
  }
}

// --- COUPONS (personal view) ---
async function loadCoupons() {
  const list = document.getElementById('coupons-list');
  try {
    const coupons = await api('/coupons');
    if (!coupons.length) {
      list.innerHTML = `<div class="empty-state">🎟️<br>Aktuell keine verfügbaren Coupons — schau bald wieder vorbei.</div>`;
      return;
    }
    list.innerHTML = coupons.map(c => `
      <div class="feature-card">
        <div class="photo"><img src="${escapeHtml(c.image_url || '/assets/img/dish-schnitzel.jpg')}" alt=""></div>
        <div class="feature-body">
          <div class="feature-eyebrow">Verfügbar</div>
          <div class="feature-title">${escapeHtml(c.title)}</div>
          <div class="feature-desc">${escapeHtml(c.description || '')}</div>
          <div class="feature-meta"><span class="tag">1× einlösbar</span><span class="tag">Beim Personal zeigen</span></div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    if (err.status === 401) return showView('start');
    list.innerHTML = `<div class="empty-state">Coupons konnten nicht geladen werden.</div>`;
  }
}

// --- PRÄMIEN (personal view) ---
async function loadRewardsView() {
  document.getElementById('rewards-sub').textContent = state.customer ? `${state.customer.points_balance} Punkte verfügbar` : '';
  try {
    const rewards = await api('/rewards');
    const balance = state.customer ? state.customer.points_balance : 0;
    document.getElementById('rewards-list').innerHTML = rewards.length ? rewards.map(r => `
      <div class="card reward-card ${r.points_cost > balance ? 'locked' : ''}">
        ${r.image_url ? `<div class="photo"><img src="${escapeHtml(r.image_url)}" alt=""></div>` : ''}
        <div><div class="r-title">${escapeHtml(r.title)}</div>
        <div class="r-desc">${escapeHtml(r.description || '')}</div></div>
        <div class="cost">${r.points_cost} P</div>
      </div>
    `).join('') : `<div class="empty-state">Noch keine Prämien verfügbar</div>`;

    const { transactions } = await api('/points');
    document.getElementById('txn-list').innerHTML = transactions.length ? transactions.map(t => `
      <div class="txn-row">
        <span>${formatReason(t.reason)}</span>
        <span class="txn-value ${t.value >= 0 ? 'positive' : 'negative'}">${t.value >= 0 ? '+' : ''}${t.value}</span>
      </div>
    `).join('') : `<div class="empty-state">Noch keine Aktivitäten</div>`;
  } catch (err) {
    if (err.status === 401) return showView('start');
  }
}

function formatReason(reason) {
  const map = {
    purchase: 'Einkauf',
    demo_seed_purchase_history: 'Willkommensbonus',
    birthday_bonus: 'Geburtstagsbonus',
    manual_adjustment: 'Gutschrift',
    e2e_test: 'Besuch bestätigt',
  };
  return map[reason] || 'Punktebuchung';
}

// --- QR / KUNDENKARTE ---
function loadQr() {
  if (!state.customer) return;
  document.getElementById('qr-name').textContent = state.customer.display_name || state.customer.email;
  const canvas = document.getElementById('qrcode-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 220; canvas.height = 220;
  ctx.clearRect(0, 0, 220, 220);
  try {
    const qr = qrcode(0, 'M');
    qr.addData(state.customer.qr_code_token);
    qr.make();
    const cellSize = Math.floor(220 / qr.getModuleCount());
    const offset = (220 - cellSize * qr.getModuleCount()) / 2;
    ctx.fillStyle = '#2B2320';
    for (let row = 0; row < qr.getModuleCount(); row++) {
      for (let col = 0; col < qr.getModuleCount(); col++) {
        if (qr.isDark(row, col)) ctx.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
      }
    }
  } catch (e) {
    ctx.font = '12px sans-serif';
    ctx.fillText('Code: ' + state.customer.qr_code_token, 10, 110);
  }
}

// --- PROFIL ---
async function loadProfile() {
  if (!state.customer) {
    try { state.customer = await api('/me'); } catch (e) { if (e.status === 401) return showView('start'); }
  }
  document.getElementById('profile-name').textContent = state.customer.display_name || '—';
  document.getElementById('profile-email').textContent = state.customer.email;
  document.getElementById('toggle-marketing').classList.toggle('on', !!state.customer.marketing_consent);
  document.getElementById('toggle-push').classList.toggle('on', !!state.customer.push_consent);
}
document.getElementById('toggle-marketing').addEventListener('click', function () {
  this.classList.toggle('on');
  showToast('Einstellung gespeichert', 'success');
});
document.getElementById('toggle-push').addEventListener('click', function () {
  this.classList.toggle('on');
  showToast('Einstellung gespeichert', 'success');
});

// --- INIT ---
(async function init() {
  await refreshIdentity();
  showView('start');
})();
