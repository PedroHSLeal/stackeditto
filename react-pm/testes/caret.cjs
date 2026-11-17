const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await page.goto('http://localhost:5280/', { waitUntil: 'networkidle' });
  await page.click('text=Workspace demo');
  await page.click('text=LEIA-ME.md');
  await page.waitForSelector('.ProseMirror h1');
  await page.waitForTimeout(500);
  for (const delay of [0, 50, 300]) {
    await page.click('.ProseMirror h1');
    await page.waitForTimeout(delay);
    const sel1 = await page.evaluate(() => { const s = getSelection(); return [s.anchorNode?.textContent?.slice(0,20), s.anchorOffset]; });
    await page.keyboard.press('End');
    await page.waitForTimeout(delay);
    await page.keyboard.type('AB');
    await page.waitForTimeout(100);
    console.log(`delay ${delay}: dom sel after click`, sel1, '→ h1 =', JSON.stringify(await page.$eval('.ProseMirror h1', e => e.textContent)));
  }
  // input rule test on a fresh paragraph at the end of the doc
  await page.keyboard.press('Control+End');
  await page.waitForTimeout(100);
  await page.keyboard.press('Enter');
  await page.keyboard.type('## heading', { delay: 30 });
  await page.waitForTimeout(100);
  console.log('h2s:', await page.$$eval('.ProseMirror h2', es => es.map(e => e.textContent)));
  console.log('last block:', await page.$eval('.ProseMirror', e => e.lastElementChild.outerHTML.slice(0, 200)));
  console.log('ERRORS', errors);
  await browser.close();
})();
