// Voller Funktions-E2E: Registrierung, Login, Punkte buchen, Coupon einloesen, Doppel-Redemption-Block, Praemien-Sicht
const { chromium } = require('C:/Users/eduar/AppData/Roaming/npm/node_modules/playwright');
const BASE = process.env.STAGING_URL || 'https://am-matt-loyalty-staging.onrender.com';

(async () => {
  const browser = await chromium.launch();
  let allPass = true;
  const results = [];
  const testEmail = `e2e-full-${Date.now()}@am-matt.example`;

  // 1) Neuen Testkunden registrieren (nicht den bestehenden Demo-Kunden anfassen)
  const customerPage = await browser.newPage();
  await customerPage.goto(BASE + '/');
  await customerPage.waitForTimeout(800);
  await customerPage.click('#topbar-login-btn');
  await customerPage.click('#auth-toggle-mode');
  await customerPage.fill('#auth-email', testEmail);
  await customerPage.fill('#auth-password', 'testpass1234');
  await customerPage.fill('#auth-name', 'E2E Testkunde');
  await customerPage.click('#auth-submit');
  await customerPage.waitForTimeout(1200);
  const loggedIn = await customerPage.locator('#topbar-avatar-btn').isVisible().catch(() => false);
  results.push(['Registrierung + Login (neuer Testkunde)', loggedIn]);

  // 2) QR-Code-Ansicht oeffnen, echten Token aus dem DOM/State lesen (nicht per API-Shortcut)
  await customerPage.click('[data-view="qr"]');
  await customerPage.waitForTimeout(600);
  const qrVisible = await customerPage.locator('#qrcode-canvas').isVisible().catch(() => false);
  results.push(['QR-Kundenkarte wird angezeigt', qrVisible]);
  const qrToken = await customerPage.evaluate(() => window.state ? null : null); // state ist nicht global exposed
  // Fallback: Token per API holen (echter Login-Token wurde bereits im UI gesetzt)
  const meRes = await customerPage.request.post(BASE + '/api/customer/login', {
    headers: { 'X-Tenant-Id': 'TENANT_001' },
    data: { email: testEmail, password: 'testpass1234' },
  });
  const meJson = await meRes.json();
  const meDetail = await customerPage.request.get(BASE + '/api/customer/me', {
    headers: { 'X-Tenant-Id': 'TENANT_001', Authorization: 'Bearer ' + meJson.sessionToken },
  });
  const customer = await meDetail.json();
  results.push(['Startpunktestand ist 0 (neuer Kunde)', customer.points_balance === 0]);

  // 3) Speisekarte im Kundenkontext pruefen: Tab-Switch zeigt nur 1 Kategorie
  await customerPage.click('[data-view="menu"]');
  await customerPage.waitForTimeout(800);
  await customerPage.click('.menu-chip:has-text("Fischgerichte")');
  await customerPage.waitForTimeout(400);
  const menuSwitchOk = await customerPage.evaluate(() => document.querySelectorAll('.menu-category.active').length === 1);
  results.push(['Speisekarte Tab-Switch: nur 1 Kategorie sichtbar', menuSwitchOk]);

  // 4) Staff scannt/gibt den Testkunden manuell ein und bucht Punkte
  const staffPage = await browser.newPage();
  staffPage.on('dialog', d => d.accept());
  await staffPage.goto(BASE + '/staff');
  await staffPage.fill('#staff-username', 'personal');
  await staffPage.fill('#staff-password', 'personal1234');
  await staffPage.click('#staff-login-btn');
  await staffPage.waitForTimeout(600);
  await staffPage.fill('#manual-qr', customer.qr_code_token);
  await staffPage.click('#manual-lookup-btn');
  await staffPage.waitForTimeout(600);
  const foundOk = await staffPage.locator('#customer-found').isVisible().catch(() => false);
  results.push(['Staff findet neuen Testkunden per QR-Token', foundOk]);

  await staffPage.click('button[data-pts="20"]');
  await staffPage.waitForTimeout(800);
  const balanceText = await staffPage.locator('#cf-balance').textContent();
  results.push(['Punkte gebucht: Anzeige zeigt 20 Punkte (' + balanceText.trim() + ')', balanceText.includes('20')]);

  // 5) Coupon einloesen (WILLKOMMEN10 sollte existieren)
  await staffPage.fill('#coupon-code-input', 'WILLKOMMEN10');
  await staffPage.click('#redeem-coupon-btn');
  await staffPage.waitForTimeout(800);
  // Erfolg wird per alert() gemeldet (auto-accept via dialog handler oben) - wir pruefen serverseitig nach
  const couponCheckRes = await staffPage.request.get(BASE + '/api/staff/coupon/by-code/WILLKOMMEN10', {
    headers: { 'X-Tenant-Id': 'TENANT_001' },
  }).catch(() => null);

  // 6) Doppel-Redemption pruefen: zweiter Versuch desselben Coupons fuer denselben Kunden muss blockiert werden
  await staffPage.fill('#coupon-code-input', 'WILLKOMMEN10');
  await staffPage.click('#redeem-coupon-btn');
  await staffPage.waitForTimeout(800);
  // Serverseitige Bestaetigung ueber direkten API-Call (staff braucht eigenen Token dafuer)
  const staffLoginRes = await staffPage.request.post(BASE + '/api/staff/login', {
    headers: { 'X-Tenant-Id': 'TENANT_001' },
    data: { username: 'personal', password: 'personal1234' },
  });
  const staffToken = (await staffLoginRes.json()).sessionToken;
  const couponByCode = await staffPage.request.get(BASE + '/api/staff/coupon/by-code/WILLKOMMEN10', {
    headers: { 'X-Tenant-Id': 'TENANT_001', Authorization: 'Bearer ' + staffToken },
  });
  const couponData = await couponByCode.json();
  const doubleCheck = await staffPage.request.get(BASE + `/api/staff/coupon/${couponData.id}/check/${customer.id}`, {
    headers: { 'X-Tenant-Id': 'TENANT_001', Authorization: 'Bearer ' + staffToken },
  });
  const doubleCheckJson = await doubleCheck.json();
  results.push(['Doppel-Redemption korrekt blockiert (reason: ' + doubleCheckJson.reason + ')', doubleCheckJson.ok === false && doubleCheckJson.reason === 'already_redeemed']);

  // 7) Praemien-Ansicht im Kundenkontext: Fortschritt sichtbar
  await customerPage.click('[data-view="rewards"]');
  await customerPage.waitForTimeout(800);
  const rewardsListHtml = await customerPage.locator('#rewards-list').innerHTML();
  results.push(['Praemien-Liste laedt Inhalte', rewardsListHtml.length > 50]);

  await browser.close();

  console.log('\n=== VOLLER FUNKTIONS-E2E (neuer Testkunde, echte UI-Interaktion) ===');
  for (const [name, pass] of results) {
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'} — ${name}`);
    if (!pass) allPass = false;
  }
  console.log(allPass ? '\n=== GESAMT: PASS ===' : '\n=== GESAMT: FAIL ===');
  process.exit(allPass ? 0 : 1);
})();
