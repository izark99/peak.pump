// Dev helper: capture prototype screenshots with the preinstalled Chromium.
// usage: node scripts/shot.mjs <baseUrl> <outDir> [exercise:fraction:view ...]
import { chromium } from '@playwright/test';
const [base, out, ...specs] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text()); });
page.on('pageerror', (e) => console.log('page error:', e.message));
for (const spec of specs) {
  const [ex, frac = '0', view = 'reset', theme = 'light', quality = 'medium', mode = 'final', name] = spec.split(':');
  await page.goto(`${base}/prototype-3d.html?exercise=${ex}&theme=${theme}&quality=${quality}&mode=${mode}`);
  await page.waitForFunction(() => window.__viewer?.state?.ready, null, { timeout: 120000 });
  await page.waitForTimeout(300);
  await page.evaluate(([f, v]) => {
    const w = window.__viewer; w.pause();
    if (v.startsWith('cam')) { const [, x, y, z, d, az, el] = v.split(','); w.setCamera([+x, +y, +z], +d, +az, +el); } else w.setView(v);
    w.seek(Number(f)); w.renderNow();
  }, [frac, view]);
  await page.waitForTimeout(200);
  const file = name ? `${out}/${name}.png` : `${out}/${ex}_${frac}_${view.replace(/[^a-z0-9.]/gi, '')}_${theme}_${mode}.png`;
  await page.locator('[data-testid=viewer]').screenshot({ path: file });
  const contacts = await page.evaluate(() => window.__viewer.lastContacts);
  console.log(file, JSON.stringify(contacts.map((c) => [c.name, +c.error.toFixed(4)])));
}
await browser.close();
