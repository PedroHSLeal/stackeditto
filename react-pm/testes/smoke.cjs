const { chromium } = require('playwright');
const OUT = __dirname;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await page.goto('http://localhost:5280/', { waitUntil: 'networkidle' });
  await page.click('text=Workspace demo');
  await page.waitForSelector('text=LEIA-ME.md');
  await page.click('text=LEIA-ME.md');
  await page.waitForSelector('.ProseMirror');
  await page.waitForTimeout(500);
  const pmClass = await page.$eval('.ProseMirror', el => [el.className, el.getAttribute('contenteditable'), el.tagName]);
  console.log('pm element', pmClass);
  // type at the end of first paragraph
  await page.click('.ProseMirror h1');
  await page.keyboard.press('End');
  await page.keyboard.type(' editado');
  console.log('h1 after typing:', await page.$eval('.ProseMirror h1', e => e.textContent));
  // input rule: new line "## " → heading
  await page.keyboard.press('Enter');
  await page.keyboard.type('## titulo via input rule');
  console.log('h2 count:', await page.$$eval('.ProseMirror h2', es => es.map(e => e.textContent)));
  await page.screenshot({ path: OUT + '/leia-me.png' });
  // html block
  await page.click('text=bloco-html.md');
  await page.waitForSelector('demo-callout', { timeout: 5000 }).catch(() => {});
  console.log('callout:', await page.$$eval('demo-callout', es => es.map(e => e.textContent)));
  // back to LEIA-ME: unsaved content must survive
  await page.click('text=LEIA-ME.md');
  await page.waitForTimeout(500);
  console.log('h1 after switch back:', await page.$eval('.ProseMirror h1', e => e.textContent));
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(800);
  console.log('tree dirty markers:', await page.$$eval('aside span', es => es.map(e => e.textContent).filter(t => t.includes('●'))));
  // code block highlighting
  await page.click('text=blocos-de-codigo.md');
  await page.waitForTimeout(1500);
  console.log('shiki spans in first pre:', await page.$eval('.ProseMirror pre', e => e.querySelectorAll('span[style]').length).catch(e => 'ERR ' + e.message));
  await page.screenshot({ path: OUT + '/codigo.png' });
  // tables
  await page.click('text=tabelas.md');
  await page.waitForTimeout(500);
  console.log('tables:', await page.$$eval('.ProseMirror table', es => es.length));
  // top menu: H2 button
  await page.click('.ProseMirror p');
  await page.click('button:has-text("H2")');
  await page.waitForTimeout(200);
  // big file
  await page.click('text=huge-file-x8.md');
  await page.waitForSelector('text=huge-file-x8.md');
  await page.waitForTimeout(4000);
  console.log('status:', await page.$eval('footer', e => e.textContent));
  await page.click('.ProseMirror p');
  for (let i = 0; i < 10; i++) await page.keyboard.press('x');
  await page.waitForTimeout(500);
  console.log('status after typing:', await page.$eval('footer', e => e.textContent));
  await page.screenshot({ path: OUT + '/huge.png' });
  const pmviews = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).filter(n => /prosemirror[-_]view/.test(n)));
  console.log('prosemirror-view resources:', pmviews);
  console.log('ERRORS:', errors.slice(0, 15));
  await browser.close();
})();
