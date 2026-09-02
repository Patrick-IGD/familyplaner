// Screenshot-Verifikation des Zettelkasten-Designs in 3 Zielformaten.
// Läuft mit dem Playwright aus dem Spike 001 (Dev-Dependency dort).
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = require(join(here, '..', 'spikes', '001-runtime-resources', 'node_modules', 'playwright', 'index.js'));

const base = 'http://localhost:3555';
const viewports = [
  { name: '169', width: 1920, height: 1080 },
  { name: '43', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 }
];

const browser = await chromium.launch();
const out = [];
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Horizontales Scrollen = Bruch am Wanddisplay
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  const shot = `shots/board-${vp.name}.png`;
  await page.screenshot({ path: shot, fullPage: false });
  out.push({ vp: vp.name, overflow, shot });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
