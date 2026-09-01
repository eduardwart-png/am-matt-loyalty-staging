// app.js — Am-Matt Customer Experience v4 (editorial, Restaurant+Loyalty als ein Produkt)
const API_BASE = '/api/customer';
const TENANT_ID = 'TENANT_001';
const REWARD_GOAL_FALLBACK = 600;

const state = {
  token: localStorage.getItem('am_matt_session') || null,
  customer: null,
  menuCache: null,
};
let menuScrollSpyFn = null;
let menuSpyTicking = false;
window.addEventListener('scroll', () => { if (menuScrollSpyFn) menuScrollSpyFn(); }, { passive: true });

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
function money(v) { return v != null ? Number(v).toFixed(2).replace('.', ',') + ' €' : ''; }

// --- NAVIGATION ---
const PERSONAL_VIEWS = ['coupons', 'rewards', 'qr', 'profile', 'favorites', 'receipts', 'referral'];

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
  if (name === 'favorites') loadFavoritesView();
  if (name === 'receipts') loadReceiptsView();
  if (name === 'referral') loadReferralView();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => showView(item.dataset.view));
});
document.querySelectorAll('[data-goto]').forEach(item => {
  item.addEventListener('click', () => showView(item.dataset.goto));
});
document.getElementById('topbar-avatar-btn').addEventListener('click', () => showView('profile'));

// --- LOGIN SHEET ---
let authMode = 'login';
function openLoginSheet() {
  document.getElementById('login-backdrop').classList.add('show');
  const sheet = document.getElementById('login-sheet');
  sheet.style.display = 'block';
  requestAnimationFrame(() => sheet.classList.add('show'));
}
function closeLoginSheet() {
  document.getElementById('login-backdrop').classList.remove('show');
  const sheet = document.getElementById('login-sheet');
  sheet.classList.remove('show');
  setTimeout(() => { sheet.style.display = 'none'; }, 300);
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
  document.getElementById('auth-referral-field').style.display = authMode === 'register' ? 'block' : 'none';
  document.getElementById('auth-toggle-mode').textContent = authMode === 'login' ? 'Jetzt registrieren' : 'Zum Login';
});

document.getElementById('auth-submit').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const displayName = document.getElementById('auth-name').value.trim();
  const referralCode = document.getElementById('auth-referral').value.trim();
  if (!email || !password) return showToast('Bitte E-Mail und Passwort eingeben', 'error');

  try {
    const path = authMode === 'login' ? '/login' : '/register';
    const body = authMode === 'login' ? { email, password } : { email, password, displayName, referralCode: referralCode || undefined };
    const data = await api(path, { method: 'POST', body: JSON.stringify(body) });
    state.token = data.sessionToken;
    localStorage.setItem('am_matt_session', state.token);
    closeLoginSheet();
    if (data.referral && data.referral.applied) {
      showToast(`Willkommen bei Am-Matt! +${data.referral.bonusPoints} Punkte für deine Empfehlung`, 'success');
    } else {
      showToast(authMode === 'login' ? 'Willkommen zurück!' : 'Willkommen bei Am-Matt!', 'success');
    }
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
    document.getElementById('loyalty-points').style.display = 'flex';
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
  if (state.token) {
    try { state.customer = await api('/me'); } catch (e) { if (e.status === 401) { state.token = null; state.customer = null; localStorage.removeItem('am_matt_session'); updateAuthUi(); } }
  }
  if (state.token && state.customer) {
    const first = (state.customer.display_name || '').split(' ')[0];
    document.getElementById('greeting-name').textContent = first ? `Schön, dass du da bist, ${escapeHtml(first)}.` : 'Schön, dass du da bist.';
    document.getElementById('start-points').textContent = state.customer.points_balance;
    let goal = REWARD_GOAL_FALLBACK;
    try {
      const rewards = await api('/rewards');
      const higher = rewards.map(r => r.points_cost).filter(c => c > state.customer.points_balance);
      if (higher.length) goal = Math.min(...higher);
      else if (rewards.length) goal = rewards[0].points_cost;
    } catch (e) {}
    const pct = Math.min(100, Math.round((state.customer.points_balance / goal) * 100));
    document.getElementById('start-progress').style.height = pct + '%';
    const remaining = Math.max(0, goal - state.customer.points_balance);
    document.getElementById('start-progress-note').textContent = remaining > 0
      ? `Noch ${remaining} Punkte bis zu deiner nächsten Prämie.`
      : 'Prämie bereits erreicht — jetzt einlösen!';
  }

  try {
    const campaigns = await api('/campaigns/live');
    renderCampaignFeature(campaigns);
    renderSeasonalFeature(campaigns);
  } catch (e) {}

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
        <div class="photo dim"><img src="/assets/img/dish-schnitzel.jpg" alt=""></div>
        <div class="coupon-tile-content">
          <div class="coupon-tile-kicker">Für Stammgäste</div>
          <div class="coupon-tile-title">Melde dich an</div>
          <div class="coupon-tile-desc">Aktuelle Coupons und Rabatte warten auf dich.</div>
          <button class="editorial-cta" style="margin-top:12px;border:0" onclick="document.getElementById('topbar-login-btn').click()">Jetzt anmelden</button>
        </div>
      </div>`;
  }

  try {
    const categories = await getMenu();
    renderKitchenGrid(categories);
  } catch (e) {}
}

function renderCampaignFeature(campaigns) {
  const el = document.getElementById('campaign-card');
  const weekly = campaigns.filter(c => c.campaign_type !== 'seasonal');
  if (!weekly.length) {
    el.innerHTML = `<div class="editorial-feature"><div class="photo dim"><img src="/assets/img/dish-schnitzel.jpg" alt=""></div><div class="editorial-feature-content"><div class="editorial-kicker">Diese Woche</div><div class="editorial-title">Schau bald wieder vorbei</div><div class="editorial-desc">Neue Angebote folgen in Kürze.</div></div></div>`;
    return;
  }
  const c = weekly[0];
  el.innerHTML = `
    <div class="editorial-feature">
      <div class="photo dim"><img src="${escapeHtml(c.image_url || '/assets/img/dish-schnitzel.jpg')}" alt=""></div>
      <div class="editorial-feature-content">
        <div class="editorial-kicker">Diese Woche</div>
        <div class="editorial-title">${escapeHtml(c.title)}</div>
        <div class="editorial-desc">${escapeHtml(c.description || '')}</div>
      </div>
    </div>`;
}

function renderSeasonalFeature(campaigns) {
  const seasonalSection = document.getElementById('section-seasonal');
  const seasonal = campaigns.find(c => c.campaign_type === 'seasonal');
  if (!seasonal) { seasonalSection.style.display = 'none'; return; }
  seasonalSection.style.display = 'block';
  document.getElementById('seasonal-card').innerHTML = `
    <div class="editorial-feature">
      <div class="photo dim"><img src="${escapeHtml(seasonal.image_url || '/assets/img/dish-spargel.jpg')}" alt=""></div>
      <div class="editorial-feature-content">
        <div class="editorial-kicker">Nur solange die Saison reicht</div>
        <div class="editorial-title">${escapeHtml(seasonal.title)}</div>
        <div class="editorial-desc">${escapeHtml(seasonal.description || '')}</div>
      </div>
    </div>`;
}

function renderCouponScroll(container, coupons) {
  container.innerHTML = coupons.map(c => `
    <div class="coupon-tile">
      <div class="photo dim"><img src="${escapeHtml(c.image_url || '/assets/img/dish-schnitzel.jpg')}" alt=""></div>
      <div class="coupon-tile-content">
        <div class="coupon-tile-kicker">Verfügbar</div>
        <div class="coupon-tile-title">${escapeHtml(c.title)}</div>
        <div class="coupon-tile-desc">${escapeHtml(c.description || '')}</div>
        <div class="coupon-tile-meta">1× einlösbar · beim Personal zeigen</div>
      </div>
    </div>
  `).join('');
}

function renderKitchenGrid(categories) {
  const withImages = [];
  categories.forEach(cat => cat.items.forEach(i => { if (i.image_url) withImages.push(i); }));
  const el = document.getElementById('kitchen-grid');
  const picks = withImages.length ? withImages.slice(0, 3) : categories.flatMap(c => c.items).slice(0, 3);
  if (!picks.length) { el.innerHTML = ''; return; }
  const [big, ...rest] = picks;
  el.innerHTML = `
    <div class="kitchen-grid">
      <div class="kitchen-tile tall">
        <div class="photo dim"><img src="${escapeHtml(big.image_url || '/assets/img/dish-schnitzel.jpg')}" alt=""></div>
        <div class="kitchen-tile-content"><div class="kitchen-tile-name">${escapeHtml(big.name)}</div><div class="kitchen-tile-price">${money(big.price)}</div></div>
      </div>
      <div class="kitchen-col">
        ${rest.map(i => `
          <div class="kitchen-tile short">
            <div class="photo dim"><img src="${escapeHtml(i.image_url || '/assets/img/dish-schnitzel.jpg')}" alt=""></div>
            <div class="kitchen-tile-content"><div class="kitchen-tile-name" style="font-size:15px">${escapeHtml(i.name)}</div><div class="kitchen-tile-price">${money(i.price)}</div></div>
          </div>
        `).join('')}
      </div>
    </div>`;
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
    catEl.innerHTML = categories.map((c, i) => {
      const withImg = c.items.filter(i => i.image_url);
      const highlights = withImg.slice(0, 2);
      const rest = c.items.filter(i => !highlights.includes(i));
      return `
      <div class="menu-category ${i === 0 ? 'active' : ''}" id="menu-cat-${c.id}">
        ${highlights.length ? `<div class="menu-highlight-row ${highlights.length > 1 ? 'two' : ''}">${highlights.map(h => `
          <div class="menu-highlight">
            <div class="photo dim strong"><img src="${escapeHtml(h.image_url)}" alt=""></div>
            <div class="menu-highlight-content">
              <div class="menu-highlight-name">${escapeHtml(h.name)}</div>
              <div class="menu-highlight-price">${money(h.price)}</div>
            </div>
          </div>`).join('')}</div>` : ''}
        ${rest.map(i => `
          <div class="menu-row-wrap">
            <div class="menu-row">
              ${i.image_url ? `<div class="menu-row-thumb"><img src="${escapeHtml(i.image_url)}" alt=""></div>` : ''}
              <span class="menu-row-name">${escapeHtml(i.name)}${i.vegetarian ? ' 🌱' : ''}</span>
              <span class="menu-row-leader"></span>
              <span class="menu-row-price">${money(i.price)}</span>
              <button class="fav-btn ${state.favoriteIds && state.favoriteIds.has(i.id) ? 'on' : ''}" data-fav-id="${i.id}" aria-label="Favorit" title="Als Favorit merken">♥</button>
            </div>
            ${i.description ? `<span class="menu-row-desc">${escapeHtml(i.description)}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;
    }).join('');

    // Echtes Tab-Switching: Klick zeigt NUR die gewaehlte Kategorie, alle anderen werden ausgeblendet.
    // Kein Scroll-Sprung durch eine lange Gesamtliste mehr (Eddy-Korrektur 31.08.: "nicht untereinander,
    // sondern anwaehlen -> nur diese Kategorie darunter sichtbar").
    function selectCategory(catId) {
      tabs.querySelectorAll('.menu-chip').forEach(c => c.classList.toggle('active', c.dataset.cat === catId));
      catEl.querySelectorAll('.menu-category').forEach(sec => sec.classList.toggle('active', sec.id === 'menu-cat-' + catId));
      const activeChip = tabs.querySelector('.menu-chip.active');
      if (activeChip) {
        const chipLeft = activeChip.offsetLeft;
        const chipRight = chipLeft + activeChip.offsetWidth;
        const visibleLeft = tabs.scrollLeft;
        const visibleRight = visibleLeft + tabs.clientWidth;
        if (chipLeft < visibleLeft || chipRight > visibleRight) {
          tabs.scrollTo({ left: chipLeft - tabs.clientWidth / 2 + activeChip.offsetWidth / 2, behavior: 'smooth' });
        }
      }
      document.getElementById('menu-categories').scrollIntoView({ behavior: 'instant', block: 'start' });
      // Sichtbarer Bereich beginnt direkt unter der fixen Tab-Leiste, nicht ganz oben am Fensterrand.
      window.scrollBy(0, -(tabs.offsetHeight + 66));
    }

    tabs.querySelectorAll('.menu-chip').forEach(chip => {
      chip.addEventListener('click', () => selectCategory(chip.dataset.cat));
    });

    // Favoriten-Herz: Klick merkt/entfernt sofort (optimistisch), synct mit Backend.
    if (state.token && !state.favoriteIds) {
      try {
        const favs = await api('/favorites');
        state.favoriteIds = new Set(favs.map(f => f.id));
        catEl.querySelectorAll('.fav-btn').forEach(btn => {
          btn.classList.toggle('on', state.favoriteIds.has(Number(btn.dataset.favId)));
        });
      } catch (e) { state.favoriteIds = new Set(); }
    }
    catEl.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!state.token) { openLoginSheet(); return; }
        const id = Number(btn.dataset.favId);
        const isOn = btn.classList.contains('on');
        btn.classList.toggle('on', !isOn);
        try {
          if (isOn) { await api('/favorites/' + id, { method: 'DELETE' }); state.favoriteIds.delete(id); }
          else { await api('/favorites/' + id, { method: 'POST' }); state.favoriteIds.add(id); }
        } catch (err) { btn.classList.toggle('on', isOn); showToast('Favorit konnte nicht gespeichert werden', 'error'); }
      });
    });

    // Scroll-Pfeil: nur zeigen, solange die Tab-Leiste noch weiter nach rechts scrollbar ist
    const tabsWrap = document.querySelector('.menu-tabs-wrap');
    function updateTabsEndState() {
      const atEnd = tabs.scrollWidth - tabs.scrollLeft - tabs.clientWidth < 8;
      tabsWrap.classList.toggle('at-end', atEnd);
    }
    updateTabsEndState();
    tabs.addEventListener('scroll', updateTabsEndState, { passive: true });
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
      list.innerHTML = `<div class="empty-state">Aktuell keine verfügbaren Coupons — schau bald wieder vorbei.</div>`;
      return;
    }
    list.innerHTML = coupons.map(c => `
      <div class="editorial-feature" style="margin:0 0 var(--space-5)">
        <div class="photo dim"><img src="${escapeHtml(c.image_url || '/assets/img/dish-schnitzel.jpg')}" alt=""></div>
        <div class="editorial-feature-content">
          <div class="editorial-kicker">Verfügbar</div>
          <div class="editorial-title">${escapeHtml(c.title)}</div>
          <div class="editorial-desc">${escapeHtml(c.description || '')}</div>
          <div class="editorial-cta">Beim Personal zeigen</div>
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
  document.getElementById('rewards-sub').textContent = state.customer ? `${state.customer.points_balance} Punkte · 1 € = 1 Punkt` : '1 € = 1 Punkt · sammeln und einlösen';
  try {
    const rewards = await api('/rewards');
    const balance = state.customer ? state.customer.points_balance : 0;
    document.getElementById('rewards-list').innerHTML = rewards.length ? rewards.map(r => {
      const locked = r.points_cost > balance;
      const pct = Math.min(100, Math.round((balance / r.points_cost) * 100));
      return `
      <div class="reward-tile ${locked ? 'locked' : ''}">
        ${r.image_url ? `<div class="photo"><img src="${escapeHtml(r.image_url)}" alt=""></div>` : ''}
        <div style="flex:1;min-width:0">
          <div class="reward-name">${escapeHtml(r.title)}</div>
          <div class="reward-desc">${escapeHtml(r.description || '')}</div>
          ${locked ? `<div class="reward-progress-row"><div class="reward-progress-track"><div class="reward-progress-fill" style="width:${pct}%"></div></div></div>` : ''}
        </div>
        <div class="reward-cost">${r.points_cost}<small>${locked ? `noch ${r.points_cost - balance}` : 'Punkte'}</small></div>
      </div>
    `; }).join('') : `<div class="empty-state">Noch keine Prämien verfügbar</div>`;

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
    referral_bonus_referrer: 'Bonus für Empfehlung',
    referral_bonus_new_customer: 'Willkommensbonus (Empfehlung)',
  };
  return map[reason] || 'Punktebuchung';
}

// --- FAVORITEN (personal view) ---
async function loadFavoritesView() {
  const list = document.getElementById('favorites-list');
  try {
    const favs = await api('/favorites');
    state.favoriteIds = new Set(favs.map(f => f.id));
    list.innerHTML = favs.length ? favs.map(i => `
      <div class="menu-row-wrap">
        <div class="menu-row">
          ${i.image_url ? `<div class="menu-row-thumb"><img src="${escapeHtml(i.image_url)}" alt=""></div>` : ''}
          <span class="menu-row-name">${escapeHtml(i.name)}${i.vegetarian ? ' 🌱' : ''}</span>
          <span class="menu-row-leader"></span>
          <span class="menu-row-price">${money(i.price)}</span>
          <button class="fav-btn on" data-fav-id="${i.id}" aria-label="Favorit entfernen">♥</button>
        </div>
      </div>
    `).join('') : `<div class="empty-state">Noch keine Favoriten — merke dir Gerichte in der Speisekarte mit ♥.</div>`;
    list.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.favId);
        try { await api('/favorites/' + id, { method: 'DELETE' }); state.favoriteIds.delete(id); loadFavoritesView(); }
        catch (e) { showToast('Konnte nicht entfernt werden', 'error'); }
      });
    });
  } catch (err) {
    if (err.status === 401) return showView('start');
    list.innerHTML = `<div class="empty-state">Favoriten konnten nicht geladen werden.</div>`;
  }
}

// --- KASSENBON / VERLAUF (personal view) ---
async function loadReceiptsView() {
  const list = document.getElementById('receipts-list');
  try {
    const { receipts } = await api('/receipts?limit=100');
    list.innerHTML = receipts.length ? receipts.map(t => `
      <div class="txn-row">
        <span>${formatReason(t.reason)}<br><small style="opacity:.6">${new Date(t.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></span>
        <span class="txn-value ${t.value >= 0 ? 'positive' : 'negative'}">${t.value >= 0 ? '+' : ''}${t.value}</span>
      </div>
    `).join('') : `<div class="empty-state">Noch keine Aktivitäten.</div>`;
  } catch (err) {
    if (err.status === 401) return showView('start');
    list.innerHTML = `<div class="empty-state">Kassenbon konnte nicht geladen werden.</div>`;
  }
}

// --- FREUNDE WERBEN (personal view) ---
async function loadReferralView() {
  try {
    const { code, referrals } = await api('/referrals');
    document.getElementById('referral-code-display').textContent = code || '—';
    const list = document.getElementById('referral-list');
    list.innerHTML = referrals.length ? referrals.map(r => `
      <div class="txn-row">
        <span>${escapeHtml(r.referred_name || 'Neuer Gast')}</span>
        <span class="txn-value ${r.status === 'redeemed' ? 'positive' : ''}">${r.status === 'redeemed' ? 'Bonus erhalten' : 'Ausstehend'}</span>
      </div>
    `).join('') : `<div class="empty-state">Noch keine Empfehlungen — teile deinen Code!</div>`;
  } catch (err) {
    if (err.status === 401) return showView('start');
  }
}
document.getElementById('referral-copy-btn').addEventListener('click', () => {
  const code = document.getElementById('referral-code-display').textContent;
  if (!code || code === '—') return;
  navigator.clipboard.writeText(code).then(() => showToast('Code kopiert!', 'success')).catch(() => showToast('Kopieren nicht möglich', 'error'));
});

// --- WEB PUSH (echte Browser-Benachrichtigung) ---
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('Push wird von diesem Browser nicht unterstützt', 'error');
    return false;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { showToast('Benachrichtigungen wurden nicht erlaubt', 'error'); return false; }
    const reg = await navigator.serviceWorker.register('/sw.js');
    const tenantInfo = await fetch(API_BASE + '/tenant-info', { headers: { 'X-Tenant-Id': TENANT_ID } }).then(r => r.json()).catch(() => ({}));
    const pubKey = tenantInfo.vapid_public_key;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: pubKey ? urlBase64ToUint8Array(pubKey) : undefined,
    });
    await api('/push/subscribe', { method: 'POST', body: JSON.stringify(sub.toJSON()) });
    return true;
  } catch (e) {
    console.error('[push] Aktivierung fehlgeschlagen:', e.message);
    showToast('Push konnte nicht aktiviert werden', 'error');
    return false;
  }
}

async function disablePush() {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) { await api('/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
      }
    }
  } catch (e) { console.error('[push] Deaktivierung fehlgeschlagen:', e.message); }
}

// --- QR / KUNDENKARTE ---
function loadQr() {
  if (!state.customer) return;
  document.getElementById('qr-name').textContent = state.customer.display_name || state.customer.email;
  const canvas = document.getElementById('qrcode-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 240; canvas.height = 240;
  ctx.clearRect(0, 0, 240, 240);
  try {
    const qr = qrcode(0, 'M');
    qr.addData(state.customer.qr_code_token);
    qr.make();
    const cellSize = Math.floor(240 / qr.getModuleCount());
    const offset = (240 - cellSize * qr.getModuleCount()) / 2;
    ctx.fillStyle = '#20211F';
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
document.getElementById('toggle-push').addEventListener('click', async function () {
  const willEnable = !this.classList.contains('on');
  if (willEnable) {
    const ok = await enablePush();
    if (!ok) return;
    this.classList.add('on');
    showToast('Push-Benachrichtigungen aktiv', 'success');
  } else {
    await disablePush();
    this.classList.remove('on');
    showToast('Push-Benachrichtigungen deaktiviert', 'success');
  }
});

// --- INIT ---
(async function init() {
  await refreshIdentity();
  showView('start');
})();

// Punktestand automatisch aktualisieren, wenn der Nutzer in die App zurueckkehrt
// (z.B. nach dem Zeigen der QR-Karte beim Bezahlen) - sonst sieht der Kunde live
// gebuchte Punkte erst nach manuellem Reload (Root-Cause-Fix Pilot-Verifikation).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.token) {
    const startView = document.getElementById('view-start');
    if (startView && startView.classList.contains('active')) loadStart();
  }
});
