// Layout-Verifikation: Geometrie statt Screenshot (kein Vision-Modell).
// Prüft pro Viewport: Spaltenanzahl, Kollisionen, Sichtbarkeit, Schriftgrößen.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = require(join(here, '..', 'spikes', '001-runtime-resources', 'node_modules', 'playwright', 'index.js'));

const base = 'http://localhost:3555';
const viewports = [
  { name: '169', width: 1920, height: 1080 },
  { name: '1610', width: 1920, height: 1200 },
  { name: '43', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 }
];

const browser = await chromium.launch();
const results = [];
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const data = await page.evaluate(() => {
    const cols = document.querySelectorAll('.columns .column');
    const colRects = [...cols].map((c) => {
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, title: c.querySelector('.col-title')?.textContent?.trim() };
    });
    // Spaltenanzahl: eindeutige x-Positionen
    const uniqueX = new Set(colRects.map((r) => Math.round(r.x)));
    const zettel = [...document.querySelectorAll('.zettel')];
    const titles = [...document.querySelectorAll('.z-title')].map((t) => {
      const cs = getComputedStyle(t);
      return { text: t.textContent?.trim(), fontSize: cs.fontSize, visible: t.getBoundingClientRect().width > 0 };
    });
    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    return {
      colCount: uniqueX.size,
      colTitles: colRects.map((c) => c.title),
      zettelCount: zettel.length,
      allTitlesVisible: titles.every((t) => t.visible),
      titleFontSizes: [...new Set(titles.map((t) => t.fontSize))],
      overflowX
    };
  });
  results.push({ vp: vp.name, ...data });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
