// Shoots docs/img/review.png: the showcase document as a review edition in
// Patina and Archive, with comments and a reply added in the browser, stacked.
// Needs `make showcase`, the static server on 8765, and Playwright:
//   cd ~/.claude/skills/playwright-skill && node run.js /path/to/scripts/review-shot.js
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', 'docs', 'img', 'review.png');
const W = 1280, H = 720;

async function select(page, selector, from, to) {
  await page.evaluate(([sel, a, b]) => {
    const el = document.querySelector(sel);
    const t = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode();
    const r = document.createRange(); r.setStart(t, a); r.setEnd(t, Math.min(b, t.data.length));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }, [selector, from, to]);
  await page.waitForSelector('.sz-fab:not([hidden])');
}
async function comment(page, who, selector, from, to, text) {
  await page.fill('.sz-name input', who); await page.press('.sz-name input', 'Tab');
  await select(page, selector, from, to);
  await page.click('.sz-fab');
  await page.fill('.sz-new textarea', text);
  await page.click('.sz-new .sz-editor .sz-primary');
  await page.waitForFunction(() => !document.querySelector('.sz-new'));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const shots = [];
  for (const theme of ['patina', 'archive']) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:8765/build/showcase/${theme}-review.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await comment(page, 'Mara', '.md > p:not(.runhead)', 0, 51, 'Keep this as the opening line, it carries the whole argument.');
    await comment(page, 'Mara', '.md table caption', 0, 39, 'Add the year to the caption.');
    await page.fill('.sz-name input', 'Jonas'); await page.press('.sz-name input', 'Tab');
    await page.hover('.sz-card'); await page.click('.sz-card >> nth=0 >> button:has-text("Reply")');
    await page.fill('.sz-card >> nth=0 >> textarea', 'Agreed. The Leipzig numbers should follow it directly.');
    await page.click('.sz-card >> nth=0 >> .sz-editor .sz-primary');
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getSelection().removeAllRanges());
    await page.click('.sz-card >> nth=0'); await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
    shots.push(await page.screenshot({ type: 'png' }));
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: W, height: H * 2 + 16 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>body{margin:0;background:#DAD9D4;display:flex;flex-direction:column;gap:16px}img{display:block;width:${W}px;height:${H}px}</style>` +
    shots.map(b => `<img src="data:image/png;base64,${b.toString('base64')}">`).join(''));
  await page.screenshot({ path: OUT });
  console.log('wrote', OUT);
  await browser.close();
})();
