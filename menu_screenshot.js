const { chromium } = require('C:/Users/eduar/AppData/Roaming/npm/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('https://am-matt-loyalty-staging.onrender.com/');
  await page.waitForTimeout(1000);
  await page.click('[data-view="menu"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'menu_check.png' });
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'menu_check_scroll.png' });
  await browser.close();
  console.log('OK');
})();
