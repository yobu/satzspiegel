// Tests the review edition's comment layer in a browser.
// Needs `make review`, the static server on 8765 (`make serve`), and Playwright:
//   NODE_PATH=~/.claude/skills/playwright-skill/node_modules node scripts/review-test.js [name filter]
// Each test gets a fresh browser context, so nothing kept in one browser
// leaks into the next test. Fixtures with comments already in them are
// written to build/review-test/.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTTP = 'http://127.0.0.1:8765/';
const ESSAY = 'build/01-essay-review.html';
const SAMPLE = 'build/sample-review.html';
const OUT = path.join(ROOT, 'build', 'review-test');
const WIDE = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const fail = msg => { throw new Error(msg); };
const assert = (cond, msg) => { if (!cond) fail(msg); };
const eq = (got, want, msg) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${msg}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};
const near = (got, want, tolerance, msg) => {
  if (!(Math.abs(got - want) <= tolerance)) fail(`${msg}: expected ${want} ± ${tolerance}, got ${got}`);
};

/* ---------------- fixtures ---------------- */

const BLOCK = /(<script[^>]*id="satzspiegel-annotations"[^>]*>)[\s\S]*?(<\/script>)/;

function annotation({ id, phrase, text, author = 'Mara', target, created = '2026-10-20T09:12:00Z' }) {
  return {
    id: 'urn:uuid:' + id, type: 'Annotation', motivation: target ? 'replying' : 'commenting',
    creator: { type: 'Person', name: author }, created,
    body: { type: 'TextualBody', value: text, format: 'text/plain' },
    target: target ? 'urn:uuid:' + target : { source: 'test', selector: [{ type: 'TextQuoteSelector', exact: phrase }] }
  };
}

// A copy of `base` (a path under the repository) with these annotations in
// its block; returns the copy's path under the repository.
function fixture(name, base, list) {
  fs.mkdirSync(OUT, { recursive: true });
  const json = JSON.stringify({ '@context': 'http://www.w3.org/ns/anno.jsonld', type: 'AnnotationCollection', total: list.length, items: list.map(annotation) }).replace(/</g, '\\u003c');
  const html = fs.readFileSync(path.join(ROOT, base), 'utf8').replace(BLOCK, (m, open, close) => open + '\n' + json + '\n' + close);
  fs.writeFileSync(path.join(OUT, name + '.html'), html);
  return 'build/review-test/' + name + '.html';
}

const urlOf = (file, via = 'http') => via === 'file' ? 'file://' + path.join(ROOT, file) : HTTP + file;

/* ---------------- page helpers ---------------- */

let browser;
async function openPage(file, { size = WIDE, via = 'http', init } = {}) {
  const context = await browser.newContext({ viewport: size, acceptDownloads: true });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(urlOf(file, via));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  return page;
}

// Select the nth occurrence of a phrase inside the document, the way a
// pointer selection ends: the range, then pointerup.
async function select(page, phrase, nth = 0) {
  await page.evaluate(([phrase, nth]) => {
    const w = document.createTreeWalker(document.querySelector('.md'), NodeFilter.SHOW_TEXT);
    let n, seen = 0;
    while ((n = w.nextNode())) {
      if (n.parentElement.closest('.sz-review')) continue;
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'), 'g');
      let m;
      while ((m = re.exec(n.data))) {
        if (seen++ === nth) {
          const r = document.createRange();
          r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
          getSelection().removeAllRanges(); getSelection().addRange(r);
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          return;
        }
      }
    }
    throw new Error('phrase not found: ' + phrase);
  }, [phrase, nth]);
  await page.waitForTimeout(250);
}

// Scroll so that the phrase's line sits `top` pixels below the top of the window.
async function scrollPhraseTo(page, phrase, top) {
  await page.evaluate(([phrase, top]) => {
    const w = document.createTreeWalker(document.querySelector('.md'), NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const m = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).exec(n.data);
      if (!m) continue;
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      window.scrollTo(0, r.getBoundingClientRect().top + scrollY - top);
      return;
    }
  }, [phrase, top]);
  await page.waitForTimeout(150);
}

const scrollY = page => page.evaluate(() => Math.round(scrollY));
const items = page => page.evaluate(() => JSON.parse(JSON.stringify(window.satzspiegelReview.items)));
const bodyOf = a => (Array.isArray(a.body) ? a.body[0] : a.body).value;

/* ---------------- tests ---------------- */

test('save a copy keeps every comment and no interface', async () => {
  const file = fixture('round-trip', ESSAY, [
    { id: 'a1', phrase: 'the four margins around it', text: 'Which four?' },
    { id: 'a2', phrase: 'a single unit of leading', text: 'Define it.', author: 'Jonas' }
  ]);
  const page = await openPage(file);
  const html = await page.evaluate(() => window.satzspiegelReview.serialise());
  assert(html.includes('urn:uuid:a1') && html.includes('urn:uuid:a2'), 'both comments are in the saved file');
  assert(!/class="[^"]*\bsz-/.test(html), 'no element of the interface is in the saved file');
  fs.writeFileSync(path.join(OUT, 'round-trip-saved.html'), html);
  const copy = await openPage('build/review-test/round-trip-saved.html');
  const anchored = await copy.evaluate(() => [...window.satzspiegelReview.anchors.values()].filter(Boolean).length);
  eq(anchored, 2, 'comments anchored in the saved copy');
  eq(copy.errors, [], 'page errors');
});

test('typing after a selection starts a comment without scrolling', async () => {
  const page = await openPage(ESSAY);
  await scrollPhraseTo(page, 'the lead paragraph', 450);
  const before = await scrollY(page), count = (await items(page)).length;
  await select(page, 'the lead paragraph');
  await page.keyboard.type('Note');
  await page.waitForTimeout(250);
  eq(await scrollY(page), before, 'scroll position');
  const after = await items(page);
  eq(after.length, count + 1, 'comments');
  eq(bodyOf(after[after.length - 1]), 'Note', 'the comment, first letter included');
  eq(page.errors, [], 'page errors');
});

// Visual lines of a phrase, counted from the rectangles of its plain text:
// rectangles whose vertical middles are within 4 px share a line.
const linesOf = (page, phrase) => page.evaluate(phrase => {
  const w = document.createTreeWalker(document.querySelector('.md'), NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const m = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).exec(n.data);
    if (!m) continue;
    const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
    const mids = [...r.getClientRects()].filter(c => c.width > 1).map(c => (c.top + c.bottom) / 2);
    return mids.filter((m, k) => mids.findIndex(o => Math.abs(o - m) < 4) === k).length;
  }
  return 0;
}, phrase);
const marksOf = (page, id) => page.evaluate(id => [...document.querySelectorAll('.sz-mark')]
  .filter(m => m.dataset.id === 'urn:uuid:' + id)
  .map(m => ({ strong: m.classList.contains('sz-strong'), top: m.getBoundingClientRect().top, height: m.getBoundingClientRect().height })), id);

const LONG = 'Change one and the others want to move. That is why Satzspiegel sets the measure once, on the container, at text size, and lets every other space derive from a single unit of leading.';

test('marks: one dotted mark per line of a saved comment', async () => {
  const page = await openPage(fixture('marks-lines', ESSAY, [{ id: 'm1', phrase: LONG, text: 'Long one.' }]));
  const lines = await linesOf(page, LONG);
  assert(lines >= 2, 'the passage wraps (' + lines + ' lines)');
  const marks = await marksOf(page, 'm1');
  eq(marks.length, lines, 'marks, one per line');
  assert(marks.every(m => !m.strong && m.height <= 1.5), 'saved marks are 1 px and not strong');
  eq(page.errors, [], 'page errors');
});

test('marks: a footnote reference in the passage adds no mark of its own', async () => {
  const page = await openPage(fixture('marks-footnote', ESSAY, [{ id: 'f1', phrase: 'as an object.1', text: 'Note ref.' }]));
  eq((await marksOf(page, 'f1')).length, await linesOf(page, 'as an object.'), 'marks');
});

test('marks: a comment on a link stays clear of the link underline', async () => {
  const page = await openPage(fixture('marks-link', SAMPLE, [{ id: 'l1', phrase: 'Leipzig Book Fair', text: 'Link.' }]));
  const gap = await page.evaluate(() => {
    const a = [...document.querySelectorAll('.md a')].find(a => a.textContent === 'Leipzig Book Fair');
    const size = parseFloat(getComputedStyle(a).fontSize);
    // baseline of the link text: a zero-height inline-block set beside the same font
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;line-height:normal;font:' + getComputedStyle(a).font;
    const t = document.createElement('span'); t.textContent = 'Hg';
    const b = document.createElement('span'); b.style.cssText = 'display:inline-block;width:0;height:0';
    probe.append(t, b); document.body.append(probe);
    const asc = b.getBoundingClientRect().top - t.getBoundingClientRect().top;
    probe.remove();
    const range = document.createRange(); range.selectNodeContents(a);
    const baseline = range.getClientRects()[0].top + asc;
    const mark = [...document.querySelectorAll('.sz-mark')].find(m => m.dataset.id === 'urn:uuid:l1');
    if (!mark) return { below: NaN };
    return { below: (mark.getBoundingClientRect().top - baseline) / size };
  });
  assert(!isNaN(gap.below), 'the comment has a mark');
  assert(gap.below >= 0.25, 'the mark sits at least 0.25 em below the baseline, under the link underline (got ' + gap.below.toFixed(2) + ' em)');
});

test('marks: no CSS Custom Highlight API', async () => {
  const page = await openPage(fixture('marks-nohighlight', ESSAY, [{ id: 'h1', phrase: 'the four margins around it', text: 'x' }]));
  eq(await page.evaluate(() => (typeof CSS !== 'undefined' && CSS.highlights) ? CSS.highlights.size : 0), 0, 'registered highlights');
});

// The one leader, the open note's first ruled line, and the waiting line, in viewport pixels.
const geometry = page => page.evaluate(() => {
  const r = n => n && n.getBoundingClientRect();
  const leader = document.querySelector('.sz-leader');
  const open = document.querySelector('.sz-note.sz-open'), wait = document.querySelector('.sz-wait');
  return {
    leader: leader && { y: r(leader).top, left: r(leader).left, right: r(leader).right, dotted: leader.classList.contains('sz-dotted') },
    openRule: open && r(open).top + Number(open.dataset.hang),
    openRight: open && r(open).right,
    waitRule: wait && r(wait).top + Number(wait.dataset.hang),
    focused: document.activeElement && document.activeElement.tagName
  };
});
const PHRASE = 'the lead paragraph';

test('fast typing after a selection keeps every key', async () => {
  const page = await openPage(ESSAY);
  await scrollPhraseTo(page, PHRASE, 400);
  await select(page, PHRASE);
  const text = 'Quick brown fox jumps over the lazy dog!';
  await page.keyboard.type(text, { delay: 0 });
  await page.waitForTimeout(200);
  const list = await items(page);
  eq(bodyOf(list[list.length - 1]), text, 'the comment');
});

test('a selection shows the waiting line level with the passage, nothing over the text', async () => {
  const page = await openPage(ESSAY);
  await scrollPhraseTo(page, PHRASE, 400);
  await select(page, PHRASE);
  const g = await geometry(page);
  assert(g.waitRule != null, 'the waiting line is there');
  assert(g.leader && g.leader.dotted, 'a dotted leader');
  near(g.leader.y, g.waitRule, 1, 'leader height against the waiting line');
  eq(await page.evaluate(() => document.querySelector('.sz-wait').getAttribute('aria-label')), 'Comment on the selection', 'accessible name');
  eq(await page.evaluate(() => document.querySelectorAll('.sz-fab').length), 0, 'no button over the text');
});

test('copying a selection starts no comment', async () => {
  const page = await openPage(ESSAY);
  await select(page, PHRASE);
  await page.keyboard.press('Meta+c');
  await page.keyboard.press('Control+c');
  await page.waitForTimeout(200);
  eq((await items(page)).length, 0, 'comments');
  eq(await page.evaluate(() => getSelection().toString().replace(/\s+/g, ' ')), PHRASE, 'the selection is still there');
});

test('the leader joins the passage to the open comment', async () => {
  const page = await openPage(ESSAY);
  await scrollPhraseTo(page, PHRASE, 400);
  await select(page, PHRASE);
  await page.keyboard.type('On the line');
  const g = await geometry(page);
  assert(g.leader && !g.leader.dotted, 'a solid leader');
  near(g.leader.y, g.openRule, 1, 'leader height against the comment\'s first rule');
  near(g.leader.right, g.openRight, 1, 'leader runs to the comment\'s right edge');
  eq(g.focused, 'TEXTAREA', 'focus');
});

test('Esc keeps the comment, an empty one leaves nothing', async () => {
  const page = await openPage(ESSAY);
  await select(page, PHRASE);
  await page.keyboard.type('Kept');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  eq((await items(page)).map(bodyOf), ['Kept'], 'after Esc');
  eq(await page.evaluate(() => document.querySelectorAll('.sz-note.sz-open').length), 0, 'no comment open');
  await select(page, 'the notes in the margin');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  eq((await items(page)).length, 1, 'an empty comment was not kept');
  eq(await page.evaluate(() => document.querySelectorAll('.sz-note').length), 1, 'notes in the column');
});

test('Cancel throws a new comment away, and Undo brings it back', async () => {
  const page = await openPage(ESSAY);
  await select(page, PHRASE);
  await page.keyboard.type('Second thoughts');
  await page.click('.sz-cancel');
  await page.waitForTimeout(150);
  eq((await items(page)).length, 0, 'after Cancel');
  await page.click('.sz-toast button');
  await page.waitForTimeout(150);
  eq((await items(page)).map(bodyOf), ['Second thoughts'], 'after Undo');
  eq(await page.evaluate(() => document.querySelectorAll('.sz-mark').length > 0), true, 'the passage is marked again');
});

test('a click elsewhere closes the comment and keeps it', async () => {
  const page = await openPage(ESSAY);
  await select(page, PHRASE);
  await page.keyboard.type('Clicked away');
  await page.mouse.click(30, 300);
  await page.waitForTimeout(150);
  eq((await items(page)).map(bodyOf), ['Clicked away'], 'comments');
  eq(await page.evaluate(() => document.querySelectorAll('.sz-note.sz-open').length), 0, 'no comment open');
});

test('a comment started near the bottom edge scrolls only as far as it must', async () => {
  const page = await openPage(ESSAY);
  await scrollPhraseTo(page, 'it does a job', 870);
  const before = await scrollY(page);
  assert(before > 0, 'the page is scrolled, so the passage really is at the bottom edge');
  await select(page, 'it does a job');
  await page.keyboard.type('Low');
  await page.waitForTimeout(150);
  const box = await page.evaluate(() => document.querySelector('.sz-note.sz-open textarea').getBoundingClientRect().bottom);
  assert(box <= 900, 'the comment is in view (bottom ' + Math.round(box) + ')');
  const moved = (await scrollY(page)) - before;
  assert(moved > 0 && moved < 150, 'scrolled a little, by ' + moved);
});

test('from file:// too', async () => {
  const page = await openPage(ESSAY, { via: 'file' });
  await select(page, PHRASE);
  await page.keyboard.type('Local');
  eq((await items(page)).map(bodyOf), ['Local'], 'comments');
  eq(page.errors, [], 'page errors');
});

// Write a comment through the interface and close it; returns its id.
async function comment(page, phrase, text) {
  await select(page, phrase);
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const list = await items(page);
  return list.find(a => bodyOf(a) === text).id;
}
const noteOf = id => '.sz-note[data-id="' + id + '"]';
const noDialogs = page => page.on('dialog', d => { page.errors.push('dialog: ' + d.message()); d.dismiss(); });

test('your own comment opens for editing on a click, Cancel restores it', async () => {
  const page = await openPage(ESSAY);
  const id = await comment(page, PHRASE, 'First words');
  await page.click(noteOf(id) + ' .sz-text');
  eq(await page.evaluate(() => document.activeElement.value), 'First words', 'the editor holds the text');
  await page.keyboard.type(' and more');
  await page.click('.sz-cancel');
  await page.waitForTimeout(150);
  eq((await items(page)).map(bodyOf), ['First words'], 'after Cancel');
  await page.click('.sz-toast button');
  await page.waitForTimeout(150);
  eq((await items(page)).map(bodyOf), ['First words and more'], 'after Undo');
});

test("a colleague's comment does not change on a click and a key", async () => {
  const page = await openPage(fixture('colleague', ESSAY, [{ id: 'c1', phrase: 'the four margins around it', text: 'Which four?' }]));
  await page.click(noteOf('urn:uuid:c1') + ' .sz-text');
  await page.keyboard.type('x');
  await page.waitForTimeout(150);
  eq((await items(page)).map(bodyOf), ['Which four?'], 'comments');
  const labels = await page.evaluate(id => [...document.querySelectorAll('.sz-note[data-id="' + id + '"] .sz-actions button')].map(b => b.textContent), 'urn:uuid:c1');
  assert(labels.includes('Edit') && labels.includes('Reply') && labels.includes('Delete'), 'actions: ' + labels.join(', '));
  await page.click(noteOf('urn:uuid:c1') + ' .sz-actions button:has-text("Edit")');
  await page.keyboard.press('End');
  await page.keyboard.type(' The outer ones?');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const a = (await items(page))[0];
  eq(bodyOf(a), 'Which four? The outer ones?', 'after Edit');
  assert(a.modified, 'marked as modified');
});

test('a reply is saved as you type', async () => {
  const page = await openPage(fixture('reply', ESSAY, [{ id: 'r1', phrase: 'the four margins around it', text: 'Which four?' }]));
  await page.click(noteOf('urn:uuid:r1') + ' .sz-text');
  await page.click(noteOf('urn:uuid:r1') + ' .sz-actions button:has-text("Reply")');
  eq(await page.evaluate(() => document.activeElement.placeholder), 'Reply', 'placeholder');
  await page.keyboard.type('All of them.');
  const reply = (await items(page)).find(a => a.target === 'urn:uuid:r1');
  assert(reply, 'a reply to the comment');
  eq(bodyOf(reply), 'All of them.', 'its text');
});

test('Delete on a reply takes only the reply; on a comment, the thread, with Undo', async () => {
  const page = await openPage(fixture('delete', ESSAY, [
    { id: 'd1', phrase: 'the four margins around it', text: 'Which four?' },
    { id: 'd2', target: 'd1', text: 'All of them.', author: 'Jonas' },
    { id: 'd3', target: 'd1', text: 'Agreed.', author: 'Ines' }
  ]));
  noDialogs(page);
  await page.click('.sz-reply[data-id="urn:uuid:d2"] .sz-text');
  await page.click(noteOf('urn:uuid:d1') + ' .sz-actions button:has-text("Delete")');
  await page.waitForTimeout(150);
  eq((await items(page)).map(a => a.id).sort(), ['urn:uuid:d1', 'urn:uuid:d3'], 'after deleting a reply');
  await page.click(noteOf('urn:uuid:d1') + ' > .sz-entry:not(.sz-reply) .sz-text');
  await page.click(noteOf('urn:uuid:d1') + ' .sz-actions button:has-text("Delete")');
  await page.waitForTimeout(150);
  eq((await items(page)).length, 0, 'after deleting the comment');
  await page.click('.sz-toast button');
  await page.waitForTimeout(150);
  eq((await items(page)).map(a => a.id).sort(), ['urn:uuid:d1', 'urn:uuid:d3'], 'after Undo');
  eq(page.errors, [], 'no dialogs, no errors');
});

test('an emptied comment is deleted on closing, with Undo', async () => {
  const page = await openPage(ESSAY);
  const id = await comment(page, PHRASE, 'Short lived');
  await page.click(noteOf(id) + ' .sz-text');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  eq((await items(page)).length, 0, 'after closing it empty');
  await page.click('.sz-toast button');
  await page.waitForTimeout(150);
  eq((await items(page)).map(bodyOf), ['Short lived'], 'after Undo');
});

test('hover shows the leader only for a comment level with its passage; a click pins', async () => {
  const page = await openPage(fixture('pinning', ESSAY, [
    { id: 'p1', phrase: 'the four margins around it', text: 'One. A long comment that takes several lines in the column, so that the next one has to move down.' },
    { id: 'p2', phrase: 'before it reads a word', text: 'Two, on the same line, pushed down.', author: 'Jonas' }
  ]));
  await page.hover(noteOf('urn:uuid:p1') + ' .sz-text');
  assert((await geometry(page)).leader, 'leader for the comment on its line');
  await page.hover(noteOf('urn:uuid:p2') + ' .sz-text');
  eq((await geometry(page)).leader, null, 'no leader for the pushed comment');
  assert((await marksOf(page, 'p2')).every(m => m.strong), 'its passage is marked strong');
  await page.click(noteOf('urn:uuid:p2') + ' .sz-text');
  await page.waitForTimeout(300);
  const g = await geometry(page);
  assert(g.leader, 'a leader once pinned');
  const rule = await page.evaluate(id => { const n = document.querySelector('.sz-note[data-id="' + id + '"]'); return n.getBoundingClientRect().top + Number(n.dataset.hang); }, 'urn:uuid:p2');
  near(g.leader.y, rule, 1, 'the pinned comment is level with its passage');
});

test('a comment whose passage is gone shows its quote', async () => {
  const page = await openPage(fixture('orphan', ESSAY, [{ id: 'o1', phrase: 'a sentence that is not in the essay', text: 'Gone.' }]));
  const quote = await page.evaluate(() => document.querySelector('.sz-note.sz-orphan .sz-quote').textContent);
  assert(quote.includes('a sentence that is not in the essay') && quote.includes('passage not found in this version'), quote);
});

test('merging a file twice adds nothing the second time; a reply without parent is ignored', async () => {
  const file = fixture('merge-source', ESSAY, [
    { id: 'g1', phrase: 'the four margins around it', text: 'From Mara.' },
    { id: 'g2', target: 'missing', text: 'Lost reply.', author: 'Jonas' }
  ]);
  const page = await openPage(ESSAY);
  const input = '.sz-bar input[type=file]';
  await page.setInputFiles(input, path.join(ROOT, file));
  await page.waitForTimeout(300);
  await page.setInputFiles(input, path.join(ROOT, file));
  await page.waitForTimeout(300);
  eq((await items(page)).length, 2, 'items after two merges');
  eq(await page.evaluate(() => document.querySelectorAll('.sz-note').length), 1, 'notes in the column');
  eq(page.errors, [], 'page errors');
});

const reload = async page => { await page.waitForTimeout(400); await page.reload(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250); };
const barText = page => page.evaluate(() => document.querySelector('.sz-count').textContent);

test('a reload keeps the comments, edits and deletions of the session', async () => {
  const page = await openPage(fixture('keep', ESSAY, []));
  const a = await comment(page, PHRASE, 'Alpha');
  const b = await comment(page, 'the notes in the margin', 'Beta');
  await page.click(noteOf(a) + ' .sz-text');
  await page.keyboard.type(' two');
  await page.keyboard.press('Escape');
  await page.click(noteOf(b) + ' .sz-text');
  await page.click(noteOf(b) + ' .sz-actions button:has-text("Delete")');
  await reload(page);
  eq((await items(page)).map(bodyOf), ['Alpha two'], 'after reload');
  await page.click(noteOf(a) + ' .sz-text');
  eq(await page.evaluate(() => document.activeElement.tagName), 'TEXTAREA', 'still yours: it opens for editing');
  assert((await barText(page)).includes('kept in this browser'), 'the bar says where: ' + await barText(page));
});

test('a fresh render of the file does not bring back what was kept', async () => {
  const file = fixture('render', ESSAY, []);
  const page = await openPage(file);
  await comment(page, PHRASE, 'Kept');
  await page.waitForTimeout(400);
  const full = path.join(ROOT, file);
  fs.writeFileSync(full, fs.readFileSync(full, 'utf8').replace(/September 2026/g, 'October 2026'));
  await reload(page);
  eq((await items(page)).length, 0, 'comments after a new render');
});

test('an annotated copy starts from its own comments', async () => {
  const page = await openPage(fixture('original', ESSAY, []));
  await comment(page, PHRASE, 'Mine');
  fs.writeFileSync(path.join(OUT, 'annotated.html'), await page.evaluate(() => window.satzspiegelReview.serialise()));
  await page.goto(urlOf('build/review-test/annotated.html'));
  await page.waitForTimeout(300);
  eq((await items(page)).map(bodyOf), ['Mine'], 'the copy holds its own block, once');
  await comment(page, 'the notes in the margin', 'Only in the copy');
  await page.goto(urlOf('build/review-test/original.html'));
  await page.waitForTimeout(500);
  eq((await items(page)).map(bodyOf), ['Mine'], 'the original keeps its own');
});

test('without storage the layer still works and says nothing', async () => {
  const page = await openPage(ESSAY, { init: () => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }) });
  eq(page.errors, [], 'page errors');
  await select(page, PHRASE);
  await page.keyboard.type('No storage');
  eq((await items(page)).map(bodyOf), ['No storage'], 'comments');
  eq(await page.evaluate(() => window.satzspiegelReview.storageKey), '', 'no key');
});

test('a name entered later goes to your anonymous comments only', async () => {
  const page = await openPage(fixture('names', ESSAY, [{ id: 'n1', phrase: 'the four margins around it', text: 'Theirs.', author: 'Anonymous' }]));
  await comment(page, PHRASE, 'Ours.');
  await page.fill('.sz-name input', 'Kim');
  await page.press('.sz-name input', 'Tab');
  await page.waitForTimeout(150);
  const byText = Object.fromEntries((await items(page)).map(a => [bodyOf(a), a.creator.name]));
  eq(byText, { 'Theirs.': 'Anonymous', 'Ours.': 'Kim' }, 'authors');
});

test('the first anonymous comment brings a hint about the name, without taking the focus', async () => {
  const page = await openPage(ESSAY);
  assert((await barText(page)).startsWith('Select a passage and start typing to comment'), 'empty state: ' + await barText(page));
  await comment(page, PHRASE, 'Who am I?');
  const hint = await page.evaluate(() => document.querySelector('.sz-toast').textContent);
  assert(/name/i.test(hint), 'hint: ' + hint);
  assert(await page.evaluate(() => !document.activeElement.closest('.sz-name')), 'the name field did not take the focus');
});

// The docked field, the line down to it, and the passage's last marked line, in viewport pixels.
const phone = page => page.evaluate(() => {
  const r = n => n && n.getBoundingClientRect();
  const f = document.querySelector('.sz-field'), v = document.querySelector('.sz-guide-v'), h = document.querySelector('.sz-guide-h');
  const strong = [...document.querySelectorAll('.sz-mark.sz-strong')];
  const last = strong.length ? Math.max(...strong.map(m => r(m).top + 1)) : null;
  return {
    field: f && !f.hidden ? { top: r(f).top, open: f.classList.contains('sz-open'), text: f.textContent, waiting: f.classList.contains('sz-waiting') } : null,
    v: v && { top: r(v).top, bottom: r(v).bottom, left: r(v).left, dotted: v.classList.contains('sz-dotted') },
    h: h && { y: r(h).top, left: r(h).left, right: r(h).right },
    last, focused: document.activeElement.tagName
  };
});
const settle = page => page.waitForTimeout(650);

test('phone: a selection brings the field and the line down to it, without the keyboard', async () => {
  const page = await openPage(ESSAY, { size: PHONE });
  await scrollPhraseTo(page, PHRASE, 300);
  await select(page, PHRASE);
  await settle(page);
  const g = await phone(page);
  assert(g.field && g.field.waiting, 'the field waits at the foot of the screen');
  eq(g.focused, 'BODY', 'nothing has the focus, so no keyboard');
  assert(g.v && g.v.dotted && g.h, 'a dotted line, across and down');
  near(g.h.y, g.last, 1.5, 'it starts level with the passage\'s last line');
  near(g.v.top, g.last, 1.5, 'the vertical part starts there');
  near(g.v.bottom, g.field.top, 1.5, 'and ends on the field');
  near(g.v.left, g.h.right - 1, 1.5, 'the two parts meet');
});

test('phone: a tap into the field starts the comment; a tap in the text closes it where it is', async () => {
  const page = await openPage(ESSAY, { size: PHONE });
  await scrollPhraseTo(page, PHRASE, 300);
  await select(page, PHRASE);
  await settle(page);
  await page.click('.sz-field textarea');
  eq(await page.evaluate(() => window.satzspiegelReview.open()?.isNew), true, 'a new comment');
  await page.keyboard.type('Phone note');
  eq((await items(page)).map(bodyOf), ['Phone note'], 'saved as you type');
  const g = await phone(page);
  assert(g.v && !g.v.dotted, 'the line is solid while writing');
  const before = await scrollY(page);
  await page.mouse.click(40, 120);
  await settle(page);
  eq((await phone(page)).field, null, 'the field is gone');
  eq(await scrollY(page), before, 'the page did not move');
  eq((await items(page)).map(bodyOf), ['Phone note'], 'the comment stays');
});

test('phone: the field never covers the passage', async () => {
  const page = await openPage(ESSAY, { size: PHONE });
  await scrollPhraseTo(page, 'it does a job', 820);
  const before = await scrollY(page);
  await select(page, 'it does a job');
  await settle(page);
  const g = await phone(page);
  assert(g.last <= g.field.top - 8, 'passage at ' + Math.round(g.last) + ', field from ' + Math.round(g.field.top));
  const moved = (await scrollY(page)) - before;
  assert(moved > 0 && moved < 200, 'scrolled just enough: ' + moved);
});

test('phone: a tap on an underlined passage opens its thread to read', async () => {
  const page = await openPage(fixture('phone-read', ESSAY, [
    { id: 'q1', phrase: 'the four margins around it', text: 'Which four?' },
    { id: 'q2', target: 'q1', text: 'All of them.', author: 'Jonas' }
  ]), { size: PHONE });
  const box = await page.evaluate(() => { const m = document.querySelector('.sz-mark[data-id="urn:uuid:q1"]').getBoundingClientRect(); return { x: m.left + m.width / 2, y: m.top - 8 }; });
  await page.mouse.click(box.x, box.y);
  await settle(page);
  const g = await phone(page);
  assert(g.field && g.field.open, 'the field shows the thread');
  assert(g.field.text.includes('Which four?') && g.field.text.includes('All of them.'), 'comment and reply: ' + g.field.text);
  eq(g.focused, 'BODY', 'no keyboard to read');
  const labels = await page.evaluate(() => [...document.querySelectorAll('.sz-field .sz-actions button')].map(b => b.textContent));
  assert(labels.includes('Reply') && labels.includes('Delete'), 'actions: ' + labels.join(', '));
});

test('phone: the list of comments stays at the end of the document', async () => {
  const page = await openPage(fixture('phone-list', ESSAY, [{ id: 'k1', phrase: 'the four margins around it', text: 'Which four?' }]), { size: PHONE });
  const list = await page.evaluate(() => { const n = document.querySelector('.sz-notes'); return { shown: getComputedStyle(n).display !== 'none', below: n.getBoundingClientRect().top > document.querySelector('.md').getBoundingClientRect().bottom - 1, text: n.textContent }; });
  assert(list.shown && list.below && list.text.includes('Which four?'), JSON.stringify(list));
});

test('phone: with a keyboard, typing after a selection writes in the field', async () => {
  const page = await openPage(ESSAY, { size: PHONE });
  await select(page, PHRASE);
  await settle(page);
  await page.keyboard.type('Typed');
  eq((await items(page)).map(bodyOf), ['Typed'], 'comments');
  eq(await page.evaluate(() => document.activeElement.closest('.sz-field') !== null), true, 'writing in the field');
});

test('resizing across 80rem keeps the open comment and its text', async () => {
  const page = await openPage(ESSAY);
  await select(page, PHRASE);
  await page.keyboard.type('Across');
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(400);
  eq(await page.evaluate(() => document.querySelector('.sz-field textarea').value), 'Across', 'the field holds the text');
  await page.click('.sz-field textarea');
  await page.keyboard.press('End');
  await page.keyboard.type(' the line');
  await page.setViewportSize(WIDE);
  await page.waitForTimeout(400);
  eq(await page.evaluate(() => document.querySelector('.sz-note.sz-open textarea').value), 'Across the line', 'the column holds it again');
  eq((await items(page)).map(bodyOf), ['Across the line'], 'comments');
});

/* ---------------- after the final review ---------------- */

// A selection made the way a touch does it: the range only, no pointerup.
const selectOnly = (page, phrase) => page.evaluate(phrase => {
  const w = document.createTreeWalker(document.querySelector('.md'), NodeFilter.SHOW_TEXT);
  const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'));
  let n;
  while ((n = w.nextNode())) {
    const m = re.exec(n.data);
    if (!m) continue;
    const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
    getSelection().removeAllRanges(); getSelection().addRange(r);
    return;
  }
}, phrase);
// A touch that turns into a scroll: down, then cancelled, never up.
const touchScroll = page => page.evaluate(() => {
  const p = document.querySelector('.md p');
  p.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true }));
  p.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerType: 'touch', isPrimary: true }));
});

test('phone: a touch scroll does not stop later selections from settling', async () => {
  const page = await openPage(ESSAY, { size: PHONE });
  await touchScroll(page);
  await selectOnly(page, PHRASE);
  await settle(page);
  assert((await phone(page)).field, 'the field came up for the selection');
});

test('phone: a touch scroll keeps the open comment; a tap in the text closes it', async () => {
  const page = await openPage(ESSAY, { size: PHONE });
  await scrollPhraseTo(page, PHRASE, 300);
  await select(page, PHRASE);
  await settle(page);
  await page.click('.sz-field textarea');
  await page.keyboard.type('Scrolling');
  await touchScroll(page);
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => window.satzspiegelReview.open()), 'still open after the scroll');
  await page.evaluate(() => {
    const p = document.querySelector('.md p');
    for (const type of ['pointerdown', 'pointerup']) p.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', isPrimary: true }));
    p.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  eq(await page.evaluate(() => window.satzspiegelReview.open()), null, 'closed by the tap');
});

test('a click on another comment while one is open opens that one', async () => {
  const page = await openPage(ESSAY);
  const a = await comment(page, PHRASE, 'Comment A');
  const b = await comment(page, 'a single unit of leading', 'Comment B');
  await page.click(noteOf(a) + ' .sz-text');
  await page.click(noteOf(b) + ' .sz-text');
  eq(await page.evaluate(() => window.satzspiegelReview.open()?.id), b, 'the comment now open');
});

test('phone: a comment in a scrolling code block stays inside it, and the page does not widen', async () => {
  const page = await openPage(fixture('code-mark', SAMPLE, [{ id: 'x1', phrase: 'var(--md-measure)', text: 'Inside the code.' }]), { size: PHONE });
  const g = await page.evaluate(() => {
    const pre = [...document.querySelectorAll('.md pre')].find(p => p.textContent.includes('var(--md-measure)')).getBoundingClientRect();
    const marks = [...document.querySelectorAll('.sz-mark[data-id="urn:uuid:x1"]')].map(m => m.getBoundingClientRect());
    return { wide: document.documentElement.scrollWidth, view: document.documentElement.clientWidth, outside: marks.filter(m => m.right > pre.right + 1 || m.left < pre.left - 1).length };
  });
  eq(g.wide, g.view, 'page width');
  eq(g.outside, 0, 'marks outside the code block');
});

test('the end list and the printout show each comment with its quote; the column does not', async () => {
  const file = fixture('quotes', ESSAY, [{ id: 'y1', phrase: 'the four margins around it', text: 'Which four?' }]);
  const narrow = await openPage(file, { size: PHONE });
  assert((await narrow.evaluate(() => document.querySelector('.sz-notes .sz-quote')?.textContent || '')).includes('the four margins around it'), 'quote in the list');
  const wideView = await openPage(file);
  eq(await wideView.evaluate(() => getComputedStyle(document.querySelector('.sz-notes .sz-quote')).display), 'none', 'no quote beside the passage itself');
  await wideView.emulateMedia({ media: 'print' });
  assert(await wideView.evaluate(() => getComputedStyle(document.querySelector('.sz-notes .sz-quote')).display !== 'none'), 'quote in print');
});

test('a malformed merged comment is ignored and does not break the next visit', async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const bad = { '@context': 'http://www.w3.org/ns/anno.jsonld', type: 'AnnotationCollection', items: [
    { id: 'urn:uuid:bad1', type: 'Annotation', body: { value: 'Bad' }, target: { selector: [{ type: 'TextQuoteSelector', exact: 5 }] } },
    { id: 'urn:uuid:bad2', type: 'Annotation', body: { value: 7 }, target: { selector: 'x' } }
  ] };
  fs.writeFileSync(path.join(OUT, 'bad.html'), fs.readFileSync(path.join(ROOT, ESSAY), 'utf8').replace(BLOCK, (m, o, c) => o + '\n' + JSON.stringify(bad) + '\n' + c));
  const page = await openPage(fixture('host', ESSAY, []));
  await page.setInputFiles('.sz-bar input[type=file]', path.join(OUT, 'bad.html'));
  await page.waitForTimeout(300);
  await reload(page);
  assert(await page.evaluate(() => !!document.querySelector('.sz-count')), 'the bar is there');
  eq(page.errors, [], 'page errors');
});

test('viewing a file keeps nothing in the browser; neither does deleting back to what it holds', async () => {
  const page = await openPage(fixture('viewed', ESSAY, [{ id: 'v1', phrase: 'the four margins around it', text: 'A colleague.' }]));
  await page.goto(urlOf(fixture('viewed-empty', ESSAY, [])));
  await page.waitForTimeout(300);
  const id = await comment(page, PHRASE, 'Gone again');
  await page.click(noteOf(id) + ' .sz-text');
  await page.click(noteOf(id) + ' .sz-actions button:has-text("Delete")');
  await page.goto(urlOf(ESSAY));
  await page.waitForTimeout(300);
  eq(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('satzspiegel-review:')).length), 0, 'kept entries');
});

test('your own comment can be edited from the keyboard; focus pins a comment', async () => {
  const page = await openPage(ESSAY);
  const id = await comment(page, PHRASE, 'Mine');
  const labels = await page.evaluate(id => [...document.querySelectorAll('.sz-note[data-id="' + id + '"] .sz-actions button')].map(b => b.textContent), id);
  assert(labels.includes('Edit'), 'actions: ' + labels.join(', '));
  await page.focus(noteOf(id) + ' .sz-actions button');
  await page.waitForTimeout(100);
  assert(await page.evaluate(id => document.querySelector('.sz-note[data-id="' + id + '"]').classList.contains('sz-active'), id), 'pinned by focus');
});

test('Enter on a bar button with text still selected does not start a comment', async () => {
  const page = await openPage(ESSAY);
  await select(page, PHRASE);
  await page.focus('.sz-bar .sz-primary');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  eq(await page.evaluate(() => window.satzspiegelReview.open()), null, 'no comment opened');
});

test('an id with quotes in a merged file breaks neither hover nor click', async () => {
  const page = await openPage(fixture('quoted-id', ESSAY, [{ id: 'x"y', phrase: 'the four margins around it', text: 'Odd id.' }]));
  await page.hover('.sz-note .sz-text');
  await page.click('.sz-note .sz-text');
  await page.waitForTimeout(150);
  eq(page.errors, [], 'page errors');
});

test('a selection extended just before typing anchors the comment to the extended passage', async () => {
  const page = await openPage(ESSAY);
  await select(page, 'the lead');
  await selectOnly(page, PHRASE);
  await page.keyboard.type('X');
  const a = (await items(page))[0];
  eq(a.target.selector[0].exact, PHRASE, 'the passage');
});

test('phone: the whole field takes the tap, and its label names the passage', async () => {
  const page = await openPage(ESSAY, { size: PHONE });
  await select(page, PHRASE);
  await settle(page);
  const box = await page.evaluate(() => { const r = document.querySelector('.sz-field').getBoundingClientRect(); return { x: r.right - 6, y: r.top + 4 }; });
  await page.mouse.click(box.x, box.y);
  eq(await page.evaluate(() => document.activeElement.tagName), 'TEXTAREA', 'the tap reached the text box');
  assert((await page.evaluate(() => document.querySelector('.sz-field textarea').getAttribute('aria-label'))).includes(PHRASE), 'label');
});

test('the status changes at most once per comment', async () => {
  const page = await openPage(ESSAY);
  await select(page, PHRASE);
  await page.keyboard.press('Enter');
  await page.evaluate(() => {
    window.statusChanges = 0;
    new MutationObserver(() => window.statusChanges++).observe(document.querySelector('.sz-note.sz-open .sz-status'), { childList: true, characterData: true, subtree: true });
  });
  await page.keyboard.type('Hello');
  await page.waitForTimeout(100);
  assert(await page.evaluate(() => window.statusChanges) <= 1, 'changes: ' + await page.evaluate(() => window.statusChanges));
});

test('phone: once lowered, the keyboard does not come back on its own', async () => {
  const page = await openPage(ESSAY, { size: PHONE });
  await select(page, PHRASE);
  await settle(page);
  await page.click('.sz-field textarea');
  await page.keyboard.type('Hi');
  await page.evaluate(() => document.activeElement.blur());
  await page.evaluate(() => { const i = document.querySelector('.sz-name input'); i.value = 'Kim'; i.dispatchEvent(new Event('change')); });
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => document.activeElement.tagName !== 'TEXTAREA'), 'no field took the focus');
});

/* ---------------- runner ---------------- */

(async () => {
  const filter = process.argv[2] || '';
  browser = await chromium.launch();
  let passed = 0, run = 0;
  for (const t of tests.filter(t => t.name.includes(filter))) {
    run++;
    try { await t.fn(); passed++; console.log('ok    ' + t.name); }
    catch (e) { console.log('FAIL  ' + t.name + '\n      ' + String(e.message).split('\n')[0]); }
    for (const c of browser.contexts()) await c.close();
  }
  await browser.close();
  console.log(`${passed}/${run} passed`);
  process.exit(passed === run ? 0 : 1);
})();
