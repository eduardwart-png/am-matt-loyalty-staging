// admin.js — Operations Studio Logic
const API_BASE = '/api/admin';
const TENANT_ID = 'TENANT_001';
const state = { token: localStorage.getItem('am_matt_admin_session') || null };

function api(path, opts = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json', 'X-Tenant-Id': TENANT_ID }, opts.headers || {});
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  return fetch(API_BASE + path, Object.assign({}, opts, { headers })).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'request_failed'), { data, status: res.status });
    return data;
  });
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function fmtDate(iso) { if (!iso) return '—'; return new Date(iso).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }); }

document.getElementById('admin-login-btn').addEventListener('click', async () => {
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;
  try {
    const data = await api('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    state.token = data.sessionToken;
    localStorage.setItem('am_matt_admin_session', state.token);
    enterApp();
  } catch (err) {
    alert('Login fehlgeschlagen');
  }
});

function enterApp() {
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('view-main').classList.remove('hidden');
  loadCampaigns();
}

// --- TABS ---
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
    if (tab.dataset.panel === 'campaigns') loadCampaigns();
    if (tab.dataset.panel === 'coupons') loadCoupons();
    if (tab.dataset.panel === 'menu') loadMenu();
    if (tab.dataset.panel === 'ledger') loadLedger();
    if (tab.dataset.panel === 'jobs') loadJobs();
  });
});

// --- KAMPAGNEN ---
async function loadCampaigns() {
  try {
    const rows = await api('/campaigns');
    const tbody = document.querySelector('#campaigns-table tbody');
    tbody.innerHTML = rows.map(c => `
      <tr>
        <td>${esc(c.title)}</td>
        <td>${esc(c.campaign_type)}</td>
        <td><span class="status-badge status-${c.status}">${statusLabel(c.status)}</span></td>
        <td>${fmtDate(c.start_at)}</td>
        <td>${fmtDate(c.end_at)}</td>
      </tr>
    `).join('') || '<tr><td colspan="5">Noch keine Kampagnen</td></tr>';
  } catch (err) { if (err.status === 401) return exitApp(); }
}

function statusLabel(s) {
  return { draft: 'Entwurf', review: 'Prüfung', scheduled: 'Terminiert', live: 'Live', expired: 'Beendet', archived: 'Archiviert' }[s] || s;
}

document.getElementById('camp-create-btn').addEventListener('click', async () => {
  const title = document.getElementById('camp-title').value.trim();
  if (!title) return alert('Titel erforderlich');
  const body = {
    title,
    description: document.getElementById('camp-desc').value.trim(),
    campaign_type: document.getElementById('camp-type').value,
    status: document.getElementById('camp-status').value,
    start_at: document.getElementById('camp-start').value ? new Date(document.getElementById('camp-start').value).toISOString() : null,
    end_at: document.getElementById('camp-end').value ? new Date(document.getElementById('camp-end').value).toISOString() : null,
    visibility: 'app',
  };
  try {
    await api('/campaigns', { method: 'POST', body: JSON.stringify(body) });
    document.getElementById('camp-title').value = '';
    document.getElementById('camp-desc').value = '';
    loadCampaigns();
  } catch (err) { alert('Fehler beim Anlegen der Kampagne'); }
});

// --- COUPONS ---
async function loadCoupons() {
  try {
    const rows = await api('/coupons');
    const tbody = document.querySelector('#coupons-table tbody');
    tbody.innerHTML = rows.map(c => `
      <tr>
        <td><code>${esc(c.code)}</code></td>
        <td>${esc(c.title)}</td>
        <td>${c.discount_type === 'percent' ? c.discount_value + '%' : c.discount_value + ' €'}</td>
        <td><span class="status-badge status-${c.status}">${statusLabel(c.status)}</span></td>
        <td>${c.max_uses_per_customer ?? '∞'}</td>
      </tr>
    `).join('') || '<tr><td colspan="5">Noch keine Coupons</td></tr>';
  } catch (err) { if (err.status === 401) return exitApp(); }
}

document.getElementById('coupon-create-btn').addEventListener('click', async () => {
  const code = document.getElementById('coupon-code').value.trim().toUpperCase();
  const title = document.getElementById('coupon-title').value.trim();
  if (!code || !title) return alert('Code und Titel erforderlich');
  const body = {
    code, title,
    discount_type: document.getElementById('coupon-disc-type').value,
    discount_value: parseFloat(document.getElementById('coupon-disc-value').value) || 0,
    max_uses_per_customer: parseInt(document.getElementById('coupon-max-per-customer').value, 10) || 1,
    status: document.getElementById('coupon-status').value,
  };
  try {
    await api('/coupons', { method: 'POST', body: JSON.stringify(body) });
    document.getElementById('coupon-code').value = '';
    document.getElementById('coupon-title').value = '';
    loadCoupons();
  } catch (err) {
    alert(err.data && err.data.error === 'UNIQUE constraint failed: coupons.tenant_id, coupons.code' ?
      'Code bereits vergeben' : 'Fehler beim Anlegen des Coupons');
  }
});

// --- MENÜ (Preis inline editierbar, config-over-code — §15-21) ---
async function loadMenu() {
  try {
    const { categories, items } = await api('/menu');
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
    const tbody = document.querySelector('#menu-table tbody');
    tbody.innerHTML = items.map(i => `
      <tr data-id="${i.id}">
        <td>${esc(catMap[i.category_id] || '—')}</td>
        <td>${esc(i.name)}</td>
        <td><input type="number" step="0.10" class="menu-price-input" data-id="${i.id}" value="${i.price != null ? i.price.toFixed(2) : ''}" style="width:80px;padding:5px 7px;border-radius:6px;border:1.5px solid var(--am-matt-border)"></td>
        <td><span class="status-badge ${i.status === 'verified' ? 'status-live' : 'status-scheduled'}">${i.status === 'verified' ? 'Verifiziert' : 'Ungeprüft'}</span></td>
        <td><button class="btn btn-outline menu-save-btn" data-id="${i.id}" style="padding:6px 12px;font-size:12px">Speichern</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.menu-save-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const input = tbody.querySelector(`.menu-price-input[data-id="${id}"]`);
        const price = parseFloat(input.value);
        if (isNaN(price) || price < 0) return alert('Ungültiger Preis');
        try {
          await api(`/menu/items/${id}`, { method: 'PATCH', body: JSON.stringify({ price }) });
          btn.textContent = '✓ Gespeichert';
          setTimeout(() => { btn.textContent = 'Speichern'; }, 1500);
        } catch (err) { alert('Fehler beim Speichern des Preises'); }
      });
    });
  } catch (err) { if (err.status === 401) return exitApp(); }
}

// --- LEDGER ---
async function loadLedger() {
  try {
    const rows = await api('/ledger');
    const tbody = document.querySelector('#ledger-table tbody');
    tbody.innerHTML = rows.map(t => `
      <tr>
        <td>${esc(t.display_name || t.email)}</td>
        <td style="color:${t.value >= 0 ? 'var(--am-matt-success)' : 'var(--am-matt-danger)'};font-weight:700">${t.value >= 0 ? '+' : ''}${t.value}</td>
        <td>${esc(t.reason)}</td>
        <td>${esc(t.source)}</td>
        <td>${fmtDate(t.created_at)}</td>
      </tr>
    `).join('') || '<tr><td colspan="5">Noch keine Transaktionen</td></tr>';
  } catch (err) { if (err.status === 401) return exitApp(); }
}

// --- JOBS (Scheduler-Transparenz) ---
async function loadJobs() {
  try {
    const rows = await api('/jobs/status');
    const container = document.getElementById('jobs-container');
    container.innerHTML = rows.map(j => `
      <div class="job-card">
        <div style="font-weight:700">${esc(j.job_name)}</div>
        <div style="font-size:12.5px;margin-top:6px">Status: <span class="status-badge ${j.status === 'ok' ? 'status-live' : j.status === 'failed' ? 'status-expired' : 'status-scheduled'}">${j.status}</span></div>
        <div style="font-size:12px;color:var(--am-matt-text-muted);margin-top:4px">Letzter Lauf: ${fmtDate(j.last_run)}</div>
        <div style="font-size:12px;color:var(--am-matt-text-muted)">Letzter Erfolg: ${fmtDate(j.last_success)}</div>
        ${j.last_failure ? `<div style="font-size:12px;color:var(--am-matt-danger)">Letzter Fehler: ${fmtDate(j.last_failure)} — ${esc(j.last_error)}</div>` : ''}
      </div>
    `).join('') || '<div>Noch keine Job-Läufe erfasst</div>';
  } catch (err) { if (err.status === 401) return exitApp(); }
}

function exitApp() {
  state.token = null;
  localStorage.removeItem('am_matt_admin_session');
  document.getElementById('view-main').classList.add('hidden');
  document.getElementById('view-login').classList.remove('hidden');
}

if (state.token) enterApp();
