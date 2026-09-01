// Automatisierter Cross-Device-Test mit Playwright — testet Mobile Browser App auf 4 Viewports
const { chromium } = (() => {
  try { return require('playwright'); }
  catch { return require('C:/Users/eduar/AppData/Roaming/npm/node_modules/playwright'); }
})();
const QA_QUERY = '?tenant=QA_AUTOTEST';

(async () => {
  const browser = await chromium.launch();
  const viewports = [
    { name: 'iPhone SE (320)', width: 320, height: 568 },
    { name: 'iPhone 12 (390)', width: 390, height: 844 },
    { name: 'iPhone Pro Max (430)', width: 430, height: 932 },
    { name: 'Tablet (768)', width: 768, height: 1024 },
  ];

  let allPassed = true;

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto((process.env.STAGING_URL || 'http://localhost:4100/') + QA_QUERY);
    await page.waitForTimeout(600);

    // 1. Öffentlicher Bereich muss OHNE Login sichtbar sein
    const navVisiblePublic = await page.locator('#bottom-nav').isVisible().catch(() => false);
    const heroVisible = await page.locator('.hero-title').isVisible().catch(() => false);
    const loginBtnVisible = await page.locator('#topbar-login-btn').isVisible().catch(() => false);

    // 2. Speisekarte öffentlich erreichbar
    await page.click('.nav-item[data-view="menu"]');
    await page.waitForTimeout(600);
    const menuItemsCount = await page.locator('.menu-row, .menu-highlight').count().catch(() => 0);

    // 3. Zurück zu Start, dann Login über Sheet
    await page.click('.nav-item[data-view="start"]');
    await page.waitForTimeout(300);
    await page.click('#topbar-login-btn');
    await page.waitForTimeout(300);
    await page.fill('#auth-email', 'qa-demo@am-matt.example');
    await page.fill('#auth-password', 'demo1234');
    await page.click('#auth-submit');
    await page.waitForTimeout(800);

    const avatarVisible = await page.locator('#topbar-avatar-btn').isVisible().catch(() => false);
    const pointsText = await page.locator('#start-points').textContent().catch(() => 'N/A');

    // Scroll-Overflow-Check (keine horizontale Überlappung)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const hasOverflow = scrollWidth > clientWidth + 2;

    // 4. Alle Bottom-Nav-Tabs durchklicken (jetzt inkl. menu, personal views)
    const tabs = ['menu', 'coupons', 'rewards', 'qr', 'start'];
    let tabErrors = [];
    for (const tab of tabs) {
      await page.click(`.nav-item[data-view="${tab}"]`);
      await page.waitForTimeout(400);
      const viewVisible = await page.locator(`#view-${tab}`).isVisible().catch(() => false);
      if (!viewVisible) tabErrors.push(tab);
    }

    // 5. Keine "Demo"-Sprache im sichtbaren Customer-Bild
    const bodyText = await page.evaluate(() => document.body.innerText);
    const forbiddenWords = ['Demo', 'Beispieldaten', 'Vorschau', 'keine echten Daten', 'Fake', 'Entwurf'];
    const foundForbidden = forbiddenWords.filter(w => bodyText.includes(w));

    const status = navVisiblePublic && heroVisible && loginBtnVisible && menuItemsCount > 0
      && avatarVisible && !hasOverflow && tabErrors.length === 0 && errors.length === 0
      && foundForbidden.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'FAIL') allPassed = false;

    console.log(`[${vp.name}] ${status} | publicNav=${navVisiblePublic} hero=${heroVisible} menuItems=${menuItemsCount} points=${pointsText} overflow=${hasOverflow} (scrollW=${scrollWidth} clientW=${clientWidth}) tabErrors=[${tabErrors}] forbiddenWords=[${foundForbidden}] jsErrors=${errors.length}`);
    if (errors.length) console.log('  JS Errors:', errors.slice(0, 3));

    await context.close();
  }

  await browser.close();
  console.log(allPassed ? '\n=== ALLE VIEWPORTS: PASS ===' : '\n=== MINDESTENS EIN VIEWPORT: FAIL ===');
  process.exit(allPassed ? 0 : 1);
})();
