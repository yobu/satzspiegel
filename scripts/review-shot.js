// Shoots docs/img/review.png: the showcase document as a review edition in
// Patina, with comments and a reply written in the browser the way a
// reviewer writes them: select a passage, type, Esc.
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
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  }, [selector, from, to]);
  await page.waitForSelector('.sz-wait');
}
async function name(page, who) {
  await page.fill('.sz-name input', who); await page.press('.sz-name input', 'Tab');
}
async function comment(page, selector, from, to, text) {
  await select(page, selector, from, to);
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.sz-note.sz-open'));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:8765/build/showcase/patina-review.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await name(page, 'Mara');
  await comment(page, '.md > p:not(.runhead)', 0, 51, 'Keep this as the opening line, it carries the whole argument.');
  await comment(page, '.md table caption', 0, 39, 'Add the year to the caption.');
  await name(page, 'Jonas');
  const first = '.sz-note >> nth=0';
  await page.hover(first);
  await page.click(first + ' >> .sz-actions button:has-text("Reply")');
  await page.keyboard.type('Agreed. The Leipzig numbers should follow it directly.');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  // The pointer rests on the first thread, so its passage, leader and actions show.
  await page.hover(first + ' >> .sz-text >> nth=0');
  await page.waitForTimeout(400);
  require('fs').writeFileSync(OUT, await page.screenshot({ type: 'png' }));
  console.log('wrote', OUT);
  await browser.close();
})();
