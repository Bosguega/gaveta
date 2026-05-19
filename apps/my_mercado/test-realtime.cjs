const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  console.log('Opening page 1...');
  page1.on('console', msg => console.log('[Page 1]', msg.text()));
  await page1.goto('http://localhost:5173/s/K8XL97');

  console.log('Opening page 2...');
  page2.on('console', msg => console.log('[Page 2]', msg.text()));
  await page2.goto('http://localhost:5173/s/K8XL97');

  // Wait for item "Abacaxi" to appear
  await page1.waitForSelector('text=Abacaxi');
  await page2.waitForSelector('text=Abacaxi');

  console.log('Toggling Abacaxi on Page 1...');
  // Find the checkbox near "Abacaxi" and click it
  const label = page1.locator('label:has-text("Abacaxi")');
  await label.locator('input[type="checkbox"]').click({ force: true });

  console.log('Waiting 5 seconds to observe Realtime logs...');
  await new Promise(r => setTimeout(r, 5000));

  await browser.close();
  console.log('Done.');
})();
