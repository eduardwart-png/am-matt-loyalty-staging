// E2E-Test: Vertical Slice 1 + 2 komplett über echten Browser (nicht nur curl)
const { chromium } = (() => {
  try { return require('playwright'); }
  catch { return require('C:/Users/eduar/AppData/Roaming/npm/node_modules/playwright'); }
})();
const BASE = process.env.STAGING_URL || 'http://localhost:4100';
const QA_QUERY = '?tenant=QA_AUTOTEST';
// Hinweis fuer kuenftige Sessions: QA_TENANT via POST /api/admin/qa-tenant/reset erneuern,
// bevor die Testsuiten hier gegen ihn laufen - siehe tests/SELECTORS.md Abschnitt "Query-Parameter".

// Root-Cause-Fix (01.09.): fixe waitForTimeout(500) war bei CI-Netzwerklatenz (Render Cold-Path)
// zu kurz fuer den asynchronen loadCampaigns()-Fetch nach Login - fuehrte zu Flaky-Fail (0 statt 2
// Kampagnen). Polling statt fixer Sleep behebt die Ursache (Timing), nicht nur das Symptom.
async function waitForRows(page, selector, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const n = await page.locator(selector).count();
    if (n > 0) return n;
    await page.waitForTimeout(200);
  }
  return page.locator(selector).count();
}

(async () => {
  const browser = await chromium.launch();
  let allPassed = true;
  const results = [];

  // --- STAFF FLOW ---
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/staff' + QA_QUERY);
    await page.fill('#staff-username', 'personal');
    await page.fill('#staff-password', 'personal1234');
    await page.click('#staff-login-btn');
    await page.waitForTimeout(500);
    const scanViewVisible = await page.locator('#view-scan').isVisible().catch(() => false);
    results.push(['Staff Login -> Scan View sichtbar', scanViewVisible]);
    if (!scanViewVisible) allPassed = false;

    // Manuelle QR-Eingabe (QA-Demo-Kunde qr_code_token)
    const meRes = await page.request.post(BASE + '/api/customer/login', {
      headers: { 'X-Tenant-Id': 'QA_AUTOTEST' },
      data: { email: 'qa-demo@am-matt.example', password: 'demo1234' },
    });
    const meJson = await meRes.json();
    const meDetail = await page.request.get(BASE + '/api/customer/me', {
      headers: { 'X-Tenant-Id': 'QA_AUTOTEST', Authorization: 'Bearer ' + meJson.sessionToken },
    });
    const customer = await meDetail.json();

    await page.fill('#manual-qr', customer.qr_code_token);
    page.on('dialog', (d) => d.accept());
    await page.click('#manual-lookup-btn');
    await page.waitForTimeout(500);
    const customerFoundVisible = await page.locator('#customer-found').isVisible().catch(() => false);
    results.push(['Staff findet Kunde via manueller QR-Eingabe', customerFoundVisible]);
    if (!customerFoundVisible) allPassed = false;

    const nameText = await page.locator('#cf-name').textContent();
    results.push(['Kundenname korrekt angezeigt (' + nameText + ')', nameText.trim().length > 0]);

    await page.close();
  }

  // --- ADMIN FLOW ---
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/admin' + QA_QUERY);
    await page.fill('#admin-username', 'admin');
    await page.fill('#admin-password', 'admin1234');
    await page.click('#admin-login-btn');
    await page.waitForTimeout(500);
    const mainVisible = await page.locator('#view-main').isVisible().catch(() => false);
    results.push(['Admin Login -> Operations Studio sichtbar', mainVisible]);
    if (!mainVisible) allPassed = false;

    // Kampagnen-Tab prüfen
    const campRows = await waitForRows(page, '#campaigns-table tbody tr');
    results.push(['Kampagnen-Tabelle zeigt Einträge (' + campRows + ')', campRows > 0]);
    if (campRows === 0) allPassed = false;

    // Coupons-Tab
    await page.click('.tab[data-panel="coupons"]');
    const couponRows = await waitForRows(page, '#coupons-table tbody tr');
    results.push(['Coupons-Tabelle zeigt Einträge (' + couponRows + ')', couponRows > 0]);

    // Menü-Tab
    await page.click('.tab[data-panel="menu"]');
    const menuRows = await waitForRows(page, '#menu-table tbody tr');
    results.push(['Speisekarte zeigt Gerichte (' + menuRows + ' Zeilen)', menuRows > 30]);

    // Ledger-Tab
    await page.click('.tab[data-panel="ledger"]');
    const ledgerRows = await waitForRows(page, '#ledger-table tbody tr');
    results.push(['Transaktions-Ledger zeigt Einträge (' + ledgerRows + ')', ledgerRows > 0]);

    // Jobs-Tab (Scheduler-Transparenz)
    await page.click('.tab[data-panel="jobs"]');
    const jobCards = await waitForRows(page, '.job-card');
    results.push(['Job-Status sichtbar (' + jobCards + ' Jobs)', jobCards > 0]);

    await page.close();
  }

  await browser.close();

  console.log('\n=== E2E TEST ERGEBNISSE (Staff + Admin, echter Browser) ===');
  for (const [name, pass] of results) {
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'} — ${name}`);
    if (!pass) allPassed = false;
  }
  console.log(allPassed ? '\n=== GESAMT: PASS ===' : '\n=== GESAMT: FAIL ===');
  process.exit(allPassed ? 0 : 1);
})();
