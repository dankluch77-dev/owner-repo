// Renders the logo variants and the profile mockup into blog/brand/.
// Usage: npm install && npm run render
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const SRC = __dirname;
const OUT = path.join(__dirname, '..');
const LOGOS = { 1: 'logo-1-viewfinder.png', 2: 'logo-2-monogram.png', 3: 'logo-3-film-frame.png' };

(async () => {
  const browser = await playwright.chromium.launch();

  const logos = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  await logos.goto('file://' + path.join(SRC, 'logos.html'));
  await logos.evaluate(() => document.fonts.ready);
  for (const [v, file] of Object.entries(LOGOS)) {
    await logos.evaluate((v) => { document.body.dataset.v = v; }, v);
    await logos.locator('#v' + v).screenshot({ path: path.join(OUT, file) });
  }

  const profile = await browser.newPage({ viewport: { width: 390, height: 400 }, deviceScaleFactor: 3 });
  await profile.goto('file://' + path.join(SRC, 'profile.html'));
  await profile.evaluate(() => document.fonts.ready);
  for (const mode of ['dark', 'light']) {
    await profile.evaluate((m) => { document.body.className = m; }, mode);
    await profile.locator('.wrap').screenshot({ path: path.join(OUT, `preview-profile-${mode}.png`) });
  }

  await browser.close();
})();
