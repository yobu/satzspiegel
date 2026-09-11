// Builds one Claude Design artboard per plate from the rendered plates page.
// Needs the static server on port 8765 and Playwright (the playwright-skill bundle has it):
//   cd ~/.claude/skills/playwright-skill && node run.js /path/to/plates/canvas/build-canvas.js
// Outputs *.dc.html and canvas.json beside this file. Re-run after editing plates.html or the stylesheets.

const { chromium } = require('playwright');
const fs = require('fs');
const ROOT = '/Users/yorck/Projects/markdown2html';
const OUT = ROOT + '/plates/canvas';
const css = ['input/markdown.css','input/markdown-code.css','plates/plates.css'].map(f => fs.readFileSync(ROOT+'/'+f,'utf8')).join('\n');
const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,300..700;1,7..72,300..700&family=Archivo:ital,wdth,wght@0,80..125,100..900;1,80..125,100..900&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=JetBrains+Mono:ital,wght@0,400..700;1,400..700&family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&display=swap">';
const plates = [
  ['p1','Main','Plate 1 Letter','page-1'],['p2','Grid','Plate 2 Grid','page-1'],['p3','Screen','Plate 3 Screen','page-1'],
  ['p4','Table','Plate 4 Table','page-2'],['p5','List','Plate 5 List','page-2'],['p6','Headings','Plate 6 Heading ladder','page-2'],['p7','Alerts','Plate 7 Alerts','page-2'],['p12','Code','Plate 12 Code','page-2'],
  ['p8','Paragraphs','Plate 8 Paragraphs in Letter','page-3'],['p9','DarkPalette','Plate 9 Screen dark palette','page-3'],['p10','SectionRule','Plate 10 Section rule in Grid','page-3'],['p11','Pause','Plate 11 Pause in Letter','page-3'],['p13','SyntaxPalette','Plate 13 Syntax palette','page-3'],
];
// tweaks per specimen: [article attribute string to find, replacement, data-props, renderVals body]
const tweaks = {
  Main: { find: '<article class="md" data-md-theme="letter">', repl: '<article class="{{mdClass}}" data-md-theme="letter" style="--md-spot: {{spot}}">',
    props: '{"spot":{"editor":"color","default":"#A8261B","section":"Theme"},"indent":{"editor":"boolean","default":false,"section":"Decision 1"}}',
    vals: "return { spot: p.spot ?? '#A8261B', mdClass: 'md' + (p.indent ? ' md--indent' : '') };" },
  Grid: { find: '<article class="md" data-md-theme="grid">', repl: '<article class="{{mdClass}}" data-md-theme="grid" style="--md-spot: {{spot}}">',
    props: '{"spot":{"editor":"color","default":"#1B1BE8","section":"Theme"},"sectionRule":{"editor":"enum","options":["ink","none","rule colour"],"default":"ink","section":"Decision 3"}}',
    vals: "const r = p.sectionRule ?? 'ink'; return { spot: p.spot ?? '#1B1BE8', mdClass: 'md' + (r === 'none' ? ' cand-noline' : r === 'rule colour' ? ' cand-ruleline' : '') };" },
  Screen: { find: '<article class="md" data-md-theme="screen">', repl: '<article class="{{mdClass}}" data-md-theme="screen" style="--md-spot: {{spot}}">',
    props: '{"spot":{"editor":"color","default":"#8FA0FF","section":"Theme"},"underline":{"editor":"enum","options":["55 %","85 %"],"default":"55 %","section":"Decision 2"}}',
    vals: "return { spot: p.spot ?? '#8FA0FF', mdClass: 'md' + ((p.underline ?? '55 %') === '85 %' ? ' cand-underline' : '') };" },
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://127.0.0.1:8765/plates/plates.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const boards = [];
  for (const [id, name, title, pg] of plates) {
    const { html, w, h } = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return { html: el.outerHTML, w: Math.round(r.width), h: Math.round(r.height) };
    }, id);
    let body = html.replace(/ id="p\d+"/, '');
    const t = tweaks[name];
    let script = '';
    if (t) {
      if (!body.includes(t.find)) throw new Error('tweak anchor missing in ' + name);
      body = body.replace(t.find, t.repl); // first occurrence only: the specimen article
      script = `<script data-dc-script data-props='${t.props}'>\nclass Component extends DCLogic {\n  renderVals() { const p = this.props; ${t.vals} }\n}\n</script>`;
    }
    const W = w, H = Math.round((h + 112) * 1.05);
    const doc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  ${FONTS}
  <style>
${css}
    body { background: #DAD9D4; }
    .plate { margin: 3.5rem auto; }
  </style>
</helmet>
<div style="width: ${W}px; min-height: ${H}px; background: #DAD9D4; padding: 1px 0;">
${body}
</div>
</x-dc>
${script}
</body>
</html>
`;
    fs.writeFileSync(`${OUT}/${name}.dc.html`, doc);
    boards.push({ file: `${name}.dc.html`, title, page: pg, w: W, h: H });
    console.log(name, W, H);
  }
  // layout: rows per page, 3 per row
  const perPage = {};
  for (const b of boards) (perPage[b.page] ??= []).push(b);
  const artboards = [];
  for (const pg of Object.keys(perPage)) {
    let x = 0, y = 0, rowH = 0, col = 0;
    for (const b of perPage[pg]) {
      if (col === 3) { col = 0; x = 0; y += rowH + 160; rowH = 0; }
      artboards.push({ file: b.file, title: b.title, page: pg, x, y, w: b.w, h: b.h });
      x += b.w + 120; rowH = Math.max(rowH, b.h); col++;
    }
  }
  const canvas = {
    pages: [{ id: 'page-1', name: 'Specimens' }, { id: 'page-2', name: 'Anatomy' }, { id: 'page-3', name: 'Decisions' }],
    artboards,
    annotations: [
      { id: 'read-me', page: 'page-1', x: 0, y: -260, w: 520, text: 'Three themes over one component layer, rendered by the real markdown.css. Tweak chips above each specimen: the theme spot colour, and the open decision that belongs to that theme (paragraph model, section rule, underline weight). Text edits in place; the type, measure and rhythm live in the stylesheet at the top of each artboard.' },
      { id: 'decisions-note', page: 'page-3', x: 0, y: -200, w: 520, text: 'Each decision plate shows every option side by side with the verdict below. Candidate rules are at the end of the stylesheet, written as they would be added to markdown.css.' },
    ],
    launch: { view: 'canvas', page: 'page-1' },
  };
  fs.writeFileSync(`${OUT}/canvas.json`, JSON.stringify(canvas, null, 2));
  await browser.close();
})();
