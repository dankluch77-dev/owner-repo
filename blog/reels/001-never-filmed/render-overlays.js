// Renders the text overlays for this reel to 1080x1920 PNGs (transparent, except the end card).
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const DIR = __dirname;
const OUT = path.join(DIR, 'build');

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.join(DIR, 'overlays.html'));
  await page.evaluate(() => document.fonts.ready);

  const shots = async (name, setup) => {
    await page.evaluate(setup);
    const id = name.startsWith('shot') ? '#shot' : '#' + name;
    await page.locator(id).screenshot({ path: path.join(OUT, name + '.png'), omitBackground: true });
  };

  await shots('hook', () => { document.body.dataset.o = 'hook'; });
  for (const n of ['01', '02', '03', '04']) {
    await shots('shot' + n, new Function(`document.body.dataset.o = 'shot'; document.getElementById('n').textContent = '${n}';`));
  }
  await shots('end', () => { document.body.dataset.o = 'end'; });
  await browser.close();
})();
