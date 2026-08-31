// E2E-Test: Vertical Slice 1 + 2 komplett über echten Browser (nicht nur curl)
const { chromium } = require('C:/Users/eduar/AppData/Roaming/npm/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  let allPassed = true;
  const results = [];

  // --- STAFF FLOW ---
  {
    const page = await browser.newPage();
    await page.goto('http://localhost:4100/staff');
    await page.fill('#staff-username', 'personal');
    await page.fill('#staff-password', 'personal1234');
    await page.click('#staff-login-btn');
    await page.waitForTimeout(500);
    const scanViewVisible = await page.locator('#view-scan').isVisible().catch(() => false);
    results.push(['Staff Login -> Scan View sichtbar', scanViewVisible]);
    if (!scanViewVisible) allPassed = false;

    // Manuelle QR-Eingabe (Demo-Kunde qr_code_token)
    const meRes = await page.request.post('http://localhost:4100/api/customer/login', {
      headers: { 'X-Tenant-Id': 'TENANT_001' },
      data: { email: 'demo@am-matt.example', password: 'demo1234' },
    });
    const meJson = await meRes.json();
    const meDetail = await page.request.get('http://localhost:4100/api/customer/me', {
      headers: { 'X-Tenant-Id': 'TENANT_001', Authorization: 'Bearer ' + meJson.sessionToken },
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
    results.push(['Kundenname korrekt angezeigt (' + nameText + ')', nameText.includes('Demo')]);

    await page.close();
  }

  // --- ADMIN FLOW ---
  {
    const page = await browser.newPage();
    await page.goto('http://localhost:4100/admin');
    await page.fill('#admin-username', 'admin');
    await page.fill('#admin-password', 'admin1234');
    await page.click('#admin-login-btn');
    await page.waitForTimeout(500);
    const mainVisible = await page.locator('#view-main').isVisible().catch(() => false);
    results.push(['Admin Login -> Operations Studio sichtbar', mainVisible]);
    if (!mainVisible) allPassed = false;

    // Kampagnen-Tab prüfen
    const campRows = await page.locator('#campaigns-table tbody tr').count();
    results.push(['Kampagnen-Tabelle zeigt Einträge (' + campRows + ')', campRows > 0]);
    if (campRows === 0) allPassed = false;

    // Coupons-Tab
    await page.click('.tab[data-panel="coupons"]');
    await page.waitForTimeout(400);
    const couponRows = await page.locator('#coupons-table tbody tr').count();
    results.push(['Coupons-Tabelle zeigt Einträge (' + couponRows + ')', couponRows > 0]);

    // Menü-Tab
    await page.click('.tab[data-panel="menu"]');
    await page.waitForTimeout(400);
    const menuRows = await page.locator('#menu-table tbody tr').count();
    results.push(['Speisekarte zeigt Gerichte (' + menuRows + ' Zeilen)', menuRows > 30]);

    // Ledger-Tab
    await page.click('.tab[data-panel="ledger"]');
    await page.waitForTimeout(400);
    const ledgerRows = await page.locator('#ledger-table tbody tr').count();
    results.push(['Transaktions-Ledger zeigt Einträge (' + ledgerRows + ')', ledgerRows > 0]);

    // Jobs-Tab (Scheduler-Transparenz)
    await page.click('.tab[data-panel="jobs"]');
    await page.waitForTimeout(400);
    const jobCards = await page.locator('.job-card').count();
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
