// FINALE PILOT-VERIFIKATION: kompletter Kundenweg von Null, nichts vorausgesetzt.
// Simuliert exakt das, was der Pilotkunde/Vorfuehrung erleben wird.
// Laeuft GEGEN DEN ISOLIERTEN QA-TENANT (QA_AUTOTEST), nicht gegen TENANT_001 - verhindert
// die frueher wiederholt aufgetretene Testdaten-Kontamination der echten Produktivdaten.
const { chromium } = require('C:/Users/eduar/AppData/Roaming/npm/node_modules/playwright');
const BASE = process.env.STAGING_URL || 'https://am-matt-loyalty-staging.onrender.com';
const QA_QUERY = '?tenant=QA_AUTOTEST';

(async () => {
  const browser = await chromium.launch();
  let allPass = true;
  const results = [];
  const check = (name, cond) => { results.push([name, !!cond]); if (!cond) allPass = false; };
  const testEmail = `pilot-final-${Date.now()}@am-matt.example`;

  // === 0. QA-TENANT FRISCH ZURUECKSETZEN (Admin-Login gegen TENANT_001, resettet nur QA_AUTOTEST) ===
  const adminAuth = await fetch(BASE + '/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'TENANT_001' },
    body: JSON.stringify({ username: 'admin', password: 'admin1234' }),
  }).then(r => r.json());
  await fetch(BASE + '/api/admin/qa-tenant/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'TENANT_001', Authorization: 'Bearer ' + adminAuth.sessionToken },
    body: JSON.stringify({ target_tenant_id: 'QA_AUTOTEST' }),
  });

  // === 1. STARTSEITE OHNE LOGIN ===
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  await page.goto(BASE + '/' + QA_QUERY, { waitUntil: 'networkidle', timeout: 20000 });
  check('Startseite laedt (networkidle erreicht)', true);
  check('Kein JS-Fehler beim initialen Laden', consoleErrors.length === 0);

  const heroVisible = await page.locator('.hero-title').isVisible().catch(() => false);
  check('Hero-Titel sichtbar', heroVisible);

  // Icon/Favicon erreichbar?
  const favRes = await page.request.get(BASE + '/assets/img/favicon.svg');
  check('Favicon erreichbar (200)', favRes.status() === 200);

  // === 2. REGISTRIERUNG (echter neuer Nutzer wie beim Pilotkunden) ===
  await page.click('#topbar-login-btn');
  await page.waitForTimeout(500);
  await page.click('#auth-toggle-mode');
  await page.fill('#auth-email', testEmail);
  await page.fill('#auth-password', 'pilotpass1234');
  await page.fill('#auth-name', 'Pilot Vorfuehrung');
  await page.click('#auth-submit');
  await page.waitForTimeout(1500);
  const loggedIn = await page.locator('#topbar-avatar-btn').isVisible().catch(() => false);
  check('Registrierung + sofortiger Login funktioniert', loggedIn);

  // === 3. SPEISEKARTE — alle Kategorien real durchklicken ===
  await page.click('[data-view="menu"]');
  await page.waitForTimeout(1000);
  const catNames = await page.locator('.menu-chip').allTextContents();
  check('Speisekarte hat Kategorien geladen', catNames.length >= 5);
  let allCatsWork = true;
  for (const name of catNames) {
    await page.click(`.menu-chip:has-text("${name.trim()}")`);
    await page.waitForTimeout(300);
    const visibleCount = await page.locator('.menu-category.active').count();
    if (visibleCount !== 1) allCatsWork = false;
  }
  check(`Alle ${catNames.length} Kategorien schalten korrekt um (nur 1 sichtbar)`, allCatsWork);

  // === 4. PRÄMIEN-SEITE ===
  await page.click('[data-view="rewards"]');
  await page.waitForTimeout(1000);
  const rewardsHtml = await page.locator('#rewards-list').innerHTML();
  check('Praemien-Seite laedt Inhalte', rewardsHtml.length > 50);

  // === 5. COUPONS-SEITE ===
  await page.click('[data-view="coupons"]');
  await page.waitForTimeout(1000);
  const couponsHtml = await page.locator('#coupons-list').innerHTML();
  check('Coupons-Seite laedt (auch wenn leer fuer neuen Kunden)', couponsHtml.length > 10);

  // === 6. QR-KARTE — echtes Bild + Dekodierung ===
  await page.click('[data-view="qr"]');
  await page.waitForTimeout(800);
  const qrCanvasVisible = await page.locator('#qrcode-canvas').isVisible().catch(() => false);
  check('QR-Kundenkarte wird angezeigt', qrCanvasVisible);

  const canvasDataUrl = await page.evaluate(() => document.getElementById('qrcode-canvas').toDataURL('image/png'));
  const decodedToken = await page.evaluate(async (dataUrl) => {
    const jsqrRes = await fetch('/assets/js/jsQR.js');
    const jsqrCode = await jsqrRes.text();
    (0, eval)(jsqrCode);
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = dataUrl; });
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(imageData.data, imageData.width, imageData.height);
    return code ? code.data : null;
  }, canvasDataUrl);
  check('QR-Code ist als echtes Bild dekodierbar', !!decodedToken);

  // === 7. STAFF SCANNT DEN ECHTEN NEUEN KUNDEN ===
  const staffPage = await browser.newPage();
  staffPage.on('dialog', d => d.accept());
  await staffPage.goto(BASE + '/staff' + QA_QUERY, { waitUntil: 'networkidle' });
  await staffPage.fill('#staff-username', 'personal');
  await staffPage.fill('#staff-password', 'personal1234');
  await staffPage.click('#staff-login-btn');
  await staffPage.waitForTimeout(800);
  await staffPage.fill('#manual-qr', decodedToken || 'INVALID');
  await staffPage.click('#manual-lookup-btn');
  await staffPage.waitForTimeout(800);
  const foundName = await staffPage.locator('#cf-name').textContent().catch(() => '');
  check('Staff findet den NEUEN Pilotkunden ueber den echten QR-Code', foundName.includes('Pilot Vorfuehrung'));

  await staffPage.click('button[data-pts="20"]');
  await staffPage.waitForTimeout(1000);
  const balanceText = await staffPage.locator('#cf-balance').textContent();
  check('Punkte werden live gebucht (20 Punkte sichtbar)', balanceText.includes('20'));

  // === 8. KUNDE SIEHT DIE FRISCH GEBUCHTEN PUNKTE (Realtime-Konsistenz) ===
  await page.click('[data-view="start"]');
  await page.waitForTimeout(1200);
  const pointsDisplayed = await page.locator('#start-points').textContent();
  check('Kunde sieht die vom Personal gebuchten Punkte (' + pointsDisplayed + ')', pointsDisplayed.trim() === '20');

  // === 9. IMPRESSUM/DATENSCHUTZ ERREICHBAR (rechtliche Pflicht bei Vorfuehrung) ===
  const impressumRes = await page.request.get(BASE + '/impressum');
  check('Impressum erreichbar', impressumRes.status() === 200);
  const datenschutzRes = await page.request.get(BASE + '/datenschutz');
  check('Datenschutz erreichbar', datenschutzRes.status() === 200);

  // === 10. ADMIN OPERATIONS STUDIO ===
  const adminPage = await browser.newPage();
  await adminPage.goto(BASE + '/admin' + QA_QUERY, { waitUntil: 'networkidle' });
  await adminPage.fill('#admin-username', 'admin');
  await adminPage.fill('#admin-password', 'admin1234');
  await adminPage.click('#admin-login-btn');
  await adminPage.waitForTimeout(800);
  const adminMainVisible = await adminPage.locator('#view-main').isVisible().catch(() => false);
  check('Admin Operations Studio erreichbar', adminMainVisible);

  // Ledger zeigt die soeben gebuchte Transaktion?
  await adminPage.click('.tab[data-panel="ledger"]');
  await adminPage.waitForTimeout(600);
  const ledgerHtml = await adminPage.locator('#ledger-table tbody').innerHTML();
  check('Admin sieht die soeben gebuchte Transaktion im Ledger', ledgerHtml.includes('Pilot Vorfuehrung'));

  // === 11. FINALE KONSOLEN-FEHLER-PRÜFUNG ÜBER GESAMTEN VERLAUF ===
  check('Kein JS-Fehler waehrend des GESAMTEN Kundenwegs (' + consoleErrors.length + ' Fehler)', consoleErrors.length === 0);

  await browser.close();

  console.log('\n=== FINALE PILOT-VERIFIKATION (kompletter echter Kundenweg) ===');
  for (const [name, pass] of results) {
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'} — ${name}`);
  }
  if (consoleErrors.length) {
    console.log('\nKonsolenfehler-Details:', consoleErrors);
  }
  console.log(allPass ? '\n=== GESAMT: 100% PASS — SICHER FUER VORFUEHRUNG ===' : '\n=== GESAMT: FAIL — NICHT VORFUEHRUNGSREIF ===');
  process.exit(allPass ? 0 : 1);
})();
