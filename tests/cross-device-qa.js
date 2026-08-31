// Automatisierter Cross-Device-Test mit Playwright — testet Mobile Browser App auf 3 Viewports
const { chromium } = require('C:/Users/eduar/AppData/Roaming/npm/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();
  const viewports = [
    { name: 'iPhone SE (320)', width: 320, height: 568 },
    { name: 'iPhone 12 (390)', width: 390, height: 844 },
    { name: 'Pixel Tablet (768)', width: 768, height: 1024 },
  ];

  let allPassed = true;

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('http://localhost:4100/');
    await page.waitForTimeout(500);

    // Login
    const isLoggedIn = await page.locator('#bottom-nav').isVisible().catch(() => false);
    if (!isLoggedIn) {
      await page.fill('#auth-email', 'demo@am-matt.example');
      await page.fill('#auth-password', 'demo1234');
      await page.click('#auth-submit');
      await page.waitForTimeout(800);
    }

    const navVisible = await page.locator('#bottom-nav').isVisible();
    const pointsText = await page.locator('#start-points').textContent().catch(() => 'N/A');

    // Scroll-Overflow-Check (keine horizontale Überlappung)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const hasOverflow = scrollWidth > clientWidth + 2; // 2px Toleranz

    // Alle Bottom-Nav-Tabs durchklicken
    const tabs = ['coupons', 'points', 'qr', 'profile', 'start'];
    let tabErrors = [];
    for (const tab of tabs) {
      await page.click(`.nav-item[data-view="${tab}"]`);
      await page.waitForTimeout(400);
      const viewVisible = await page.locator(`#view-${tab}`).isVisible().catch(() => false);
      if (!viewVisible) tabErrors.push(tab);
    }

    const status = navVisible && !hasOverflow && tabErrors.length === 0 && errors.length === 0 ? 'PASS' : 'FAIL';
    if (status === 'FAIL') allPassed = false;

    console.log(`[${vp.name}] ${status} | nav=${navVisible} points=${pointsText} overflow=${hasOverflow} (scrollW=${scrollWidth} clientW=${clientWidth}) tabErrors=[${tabErrors}] jsErrors=${errors.length}`);
    if (errors.length) console.log('  JS Errors:', errors.slice(0, 3));

    await context.close();
  }

  await browser.close();
  console.log(allPassed ? '\n=== ALLE VIEWPORTS: PASS ===' : '\n=== MINDESTENS EIN VIEWPORT: FAIL ===');
  process.exit(allPassed ? 0 : 1);
})();
