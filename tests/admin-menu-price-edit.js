// Test: Admin kann Speisekartenpreis aendern (echte UI-Interaktion + serverseitige Verifikation)
const { chromium } = require('C:/Users/eduar/AppData/Roaming/npm/node_modules/playwright');
const BASE = process.env.STAGING_URL || 'https://am-matt-loyalty-staging.onrender.com';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE + '/admin');
  await page.fill('#admin-username', 'admin');
  await page.fill('#admin-password', 'admin1234');
  await page.click('#admin-login-btn');
  await page.waitForTimeout(600);
  await page.click('.tab[data-panel="menu"]');
  await page.waitForTimeout(600);

  const firstRow = page.locator('#menu-table tbody tr').first();
  const priceInput = firstRow.locator('.menu-price-input');
  const originalPrice = await priceInput.inputValue();
  const testPrice = (parseFloat(originalPrice) + 1.11).toFixed(2);

  await priceInput.fill(testPrice);
  await firstRow.locator('.menu-save-btn').click();
  await page.waitForTimeout(1000);
  const btnText = await firstRow.locator('.menu-save-btn').textContent();

  // Reload und pruefen ob der neue Preis wirklich persistiert wurde (nicht nur UI-Optik)
  await page.reload();
  await page.waitForTimeout(800);
  const stillLoggedIn = await page.locator('#view-main').isVisible().catch(() => false);
  if (!stillLoggedIn) {
    await page.fill('#admin-username', 'admin');
    await page.fill('#admin-password', 'admin1234');
    await page.click('#admin-login-btn');
    await page.waitForTimeout(600);
  }
  await page.click('.tab[data-panel="menu"]');
  await page.waitForTimeout(600);
  const persistedPrice = await page.locator('#menu-table tbody tr').first().locator('.menu-price-input').inputValue();

  console.log('Original-Preis:', originalPrice, '-> Test-Preis gesetzt:', testPrice, '-> Button nach Speichern:', btnText.trim(), '-> Preis nach Reload:', persistedPrice);
  const pass = persistedPrice === testPrice;
  console.log(pass ? '✅ PASS — Preisaenderung wird tatsaechlich persistiert' : '❌ FAIL — Preisaenderung wurde NICHT persistiert');

  // Preis zurueksetzen (sauber hinterlassen)
  await firstRow.locator('.menu-price-input').fill(originalPrice);
  await firstRow.locator('.menu-save-btn').click();
  await page.waitForTimeout(800);

  await browser.close();
  process.exit(pass ? 0 : 1);
})();
