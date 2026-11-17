const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const [label, waitAfterEnd, first] of [["no wait, first", 0, true], ["no wait, again", 0, false], ["wait 30", 30, false], ["no wait, letters", 0, false]]) {
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5280/', { waitUntil: 'networkidle' });
  await page.click('text=Workspace demo');
  await page.click('text=LEIA-ME.md');
  await page.waitForSelector('.ProseMirror h1');
  await page.waitForTimeout(500);
  for (const [text, wait] of [[' editado', 0], [' de novo', 0], ['XY', 0], [' com espera', 30], [' outra', 0]]) {
    await page.click('.ProseMirror h1');
    await page.keyboard.press('End');
    if (wait) await page.waitForTimeout(wait);
    await page.keyboard.type(text);
    await page.waitForTimeout(200);
    console.log(JSON.stringify(text), 'wait', wait, '→', JSON.stringify(await page.$eval('.ProseMirror h1', e => e.textContent)));
  }
  await browser.close();
})();
