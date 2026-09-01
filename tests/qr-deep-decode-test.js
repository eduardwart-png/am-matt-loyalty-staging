// Finaler Tiefentest: QR-Code wird als echtes Canvas-Bild gerendert, per jsQR aus dem Pixel-Bild
// dekodiert (nicht nur der rohe Token aus der API gelesen) - simuliert einen echten Kamera-Scan.
const { chromium } = require('C:/Users/eduar/AppData/Roaming/npm/node_modules/playwright');
const BASE = process.env.STAGING_URL || 'https://am-matt-loyalty-staging.onrender.com';

(async () => {
  const browser = await chromium.launch();
  let allPass = true;
  const results = [];
  const testEmail = `qr-deep-${Date.now()}@am-matt.example`;

  const customerPage = await browser.newPage();
  await customerPage.goto(BASE + '/');
  await customerPage.waitForTimeout(800);
  await customerPage.click('#topbar-login-btn');
  await customerPage.click('#auth-toggle-mode');
  await customerPage.fill('#auth-email', testEmail);
  await customerPage.fill('#auth-password', 'testpass1234');
  await customerPage.fill('#auth-name', 'QR Tiefentest');
  await customerPage.click('#auth-submit');
  await customerPage.waitForTimeout(1000);

  await customerPage.click('[data-view="qr"]');
  await customerPage.waitForTimeout(800);

  // Canvas als PNG exportieren und mit jsQR (gleiche Lib wie Staff-Scanner) zurueckdekodieren
  const canvasDataUrl = await customerPage.evaluate(() => {
    const canvas = document.getElementById('qrcode-canvas');
    return canvas.toDataURL('image/png');
  });
  results.push(['QR-Canvas liefert gueltiges PNG', canvasDataUrl.startsWith('data:image/png')]);

  // Dekodieren mit jsQR im Browser-Kontext (jsQR ist bereits auf /staff geladen, wir laden es separat)
  const decodedToken = await customerPage.evaluate(async (dataUrl) => {
    const jsqrRes = await fetch('/assets/js/jsQR.js');
    const jsqrCode = await jsqrRes.text();
    // eslint-disable-next-line no-eval
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
  results.push(['QR-Bild ist per jsQR (Scanner-Lib) korrekt dekodierbar', !!decodedToken]);

  // Token mit dem echten API-Token vergleichen (muss identisch sein - kein Rendering-Fehler)
  const meRes = await customerPage.request.post(BASE + '/api/customer/login', {
    headers: { 'X-Tenant-Id': 'TENANT_001' },
    data: { email: testEmail, password: 'testpass1234' },
  });
  const meJson = await meRes.json();
  const meDetail = await customerPage.request.get(BASE + '/api/customer/me', {
    headers: { 'X-Tenant-Id': 'TENANT_001', Authorization: 'Bearer ' + meJson.sessionToken },
  });
  const customer = await meDetail.json();
  results.push(['Dekodierter QR-Token stimmt exakt mit API-Token ueberein', decodedToken === customer.qr_code_token]);

  // Jetzt den EXAKT dekodierten Wert (nicht die API-Antwort direkt) beim Staff eingeben -
  // das ist der wahrheitsgetreueste Kamera-Scan-Test moeglich ohne echte Hardware.
  const staffPage = await browser.newPage();
  staffPage.on('dialog', d => d.accept());
  await staffPage.goto(BASE + '/staff');
  await staffPage.fill('#staff-username', 'personal');
  await staffPage.fill('#staff-password', 'personal1234');
  await staffPage.click('#staff-login-btn');
  await staffPage.waitForTimeout(600);
  await staffPage.fill('#manual-qr', decodedToken || '');
  await staffPage.click('#manual-lookup-btn');
  await staffPage.waitForTimeout(700);
  const foundName = await staffPage.locator('#cf-name').textContent().catch(() => '');
  results.push(['Staff erkennt Kunden ueber den DEKODIERTEN QR-Wert', foundName.includes('QR Tiefentest')]);

  await browser.close();

  console.log('\n=== FINALER QR-TIEFENTEST (echtes Bild-Rendering + Dekodierung) ===');
  for (const [name, pass] of results) {
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'} — ${name}`);
    if (!pass) allPass = false;
  }
  console.log(allPass ? '\n=== GESAMT: PASS ===' : '\n=== GESAMT: FAIL ===');
  process.exit(allPass ? 0 : 1);
})();
