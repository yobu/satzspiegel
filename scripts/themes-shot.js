// Shoots docs/img/themes.png: docs/showcase.md in Patina and Archive, side by
// side. Needs `make showcase` first, the static server on 8765, and Playwright
// (the playwright-skill bundle has it):
//   cd ~/.claude/skills/playwright-skill && node run.js /path/to/scripts/themes-shot.js
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, '..', 'docs', 'img', 'themes.png');
const W = 640, H = 1000, GAP = 24;
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: W * 2 + GAP * 3, height: H + GAP * 2 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>body{margin:0;background:#DAD9D4;display:flex;gap:${GAP}px;padding:${GAP}px}iframe{border:0;width:${W}px;height:${H}px;box-shadow:0 1px 2px rgba(0,0,0,.12),0 12px 36px rgba(0,0,0,.08)}</style>
    <iframe style="background:#F3F6F4" src="http://127.0.0.1:8765/build/showcase/patina.html"></iframe><iframe style="background:#F5F1EA" src="http://127.0.0.1:8765/build/showcase/archive.html"></iframe>`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  for (const f of page.frames().slice(1)) await f.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT });
  console.log('wrote', OUT);
  await browser.close();
})();
