const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:5280/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.click('text=Workspace demo');
  await page.click('text=LEIA-ME.md');
  await page.waitForSelector('.ProseMirror h1');
  await page.waitForTimeout(500);
  for (const [text, delay] of [[' a b', 0], [' c d', 20], [' e f', 60], ['  g', 0]]) {
    await page.click('.ProseMirror h1');
    await page.keyboard.press('End');
    await page.waitForTimeout(100);
    await page.keyboard.type(text, { delay });
    await page.waitForTimeout(200);
    console.log(JSON.stringify(text), 'delay', delay, '→', JSON.stringify(await page.$eval('.ProseMirror h1', e => e.textContent)));
  }
  await browser.close();
})();
