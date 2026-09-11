// Deep dive on directions B (Patina) and C (Archive): the full Markdown object set
// plus three typographic variations each. Needs the static server on 8765 and Playwright:
//   cd ~/.claude/skills/playwright-skill && node run.js /path/to/plates/canvas/build-deepdive.js
const { chromium } = require('playwright');
const fs = require('fs');
const ROOT = '/Users/yorck/Projects/markdown2html';
const OUT = ROOT + '/plates/canvas';
const md = fs.readFileSync(ROOT + '/input/markdown.css', 'utf8');
const mdcode = fs.readFileSync(ROOT + '/input/markdown-code.css', 'utf8');

const CANDIDATES = `
  /* candidate rules adopted for this page: numbering that survives tokens,
     comments as text, single-forme alerts, full-row diff */
  .md pre.md-code--numbered > code { display: block; }
  .md pre.md-code--numbered .md-line { display: block; }
  .md pre.md-code--numbered .md-line::before { display: inline-block; inline-size: var(--md-code-gutter); margin-inline-end: 1.5ch; }
  .md pre:not(.md-code--numbered) .md-line { display: block; }
  .md { --md-syn-comment: var(--md-ink-muted); --md-syn-keyword: var(--md-ink); --md-syn-string: var(--md-ink-muted); --md-syn-number: var(--md-ink-muted); --md-syn-name: var(--md-spot); }
  .md .md-alert { --md-alert-tone: var(--md-ink-muted); }
  .md .md-alert--note { --md-alert-tone: var(--md-spot); }
  .md .md-alert-title { color: var(--md-ink); }
  .md pre .md-line--add { background: color-mix(in oklab, var(--md-spot) 12%, transparent); }
  .md pre .md-line--del { background: var(--md-paper-sunk); color: var(--md-ink-faint); text-decoration: line-through; }
`;

const themes = {
  patina: { pal:{paper:'#F3F6F4',sunk:'#E4EBE7',ink:'#1D2A24',muted:'#56705F',faint:'#8FA69A',rule:'#C7D5CC',spot:'#2F5B4A'}, spotName:'patina green', layout:'marginalia' },
  archive: { pal:{paper:'#F5F1EA',sunk:'#E9E3D8',ink:'#2B2B2A',muted:'#6B655D',faint:'#A79F93',rule:'#D7D0C6',spot:'#2F3E63'}, spotName:'archival ink', layout:'catalogue' },
};

const V = [
 { theme:'patina', file:'PatinaFull', title:'B1  Patina, Spectral with Schibsted heads', full:true,
   fonts:'Spectral:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Schibsted+Grotesk:ital,wght@0,400..900;1,400..900', text:'"Spectral", Georgia, serif', display:'"Schibsted Grotesk", Helvetica, Arial, sans-serif', mono:'"IBM Plex Mono", ui-monospace, monospace',
   size:17, lead:1.62, measure:60, h:{h1:'2.2em',h2:'1.44em',h3:'1.2em'}, hw:'600', figs:'lining-nums proportional-nums',
   note:'The proposed pairing. Serif text at 17 px with a grotesk for every heading level, so hierarchy comes from a change of voice rather than a change of size.' },
 { theme:'patina', file:'PatinaSerif', title:'B2  Patina, Spectral alone, italic heads',
   fonts:'Spectral:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500', text:'"Spectral", Georgia, serif', display:'"Spectral", Georgia, serif', mono:'"IBM Plex Mono", ui-monospace, monospace',
   size:18, lead:1.6, measure:62, h:{h1:'2.44em',h2:'1.563em',h3:'1.25em'}, hw:'500', figs:'oldstyle-nums proportional-nums', headStyle:'italic',
   note:'One family. Headings in Spectral italic at weight 500, old-style figures in text, 18 px on 62 characters. The bookish reading of the same palette.' },
 { theme:'patina', file:'PatinaGrotesk', title:'B3  Patina, Schibsted Grotesk alone',
   fonts:'Schibsted+Grotesk:ital,wght@0,400..900;1,400..900', text:'"Schibsted Grotesk", Helvetica, Arial, sans-serif', display:'"Schibsted Grotesk", Helvetica, Arial, sans-serif', mono:'"JetBrains Mono", ui-monospace, monospace',
   size:15.5, lead:1.5, measure:58, h:{h1:'2.49em',h2:'1.44em',h3:'1.2em'}, hw:'700', figs:'lining-nums proportional-nums',
   note:'All grotesk, 15.5 px on 58 characters, headings by weight. The catalogue reading: closest to what the Amsterdam studios would ship for a museum.' },
 { theme:'patina', file:'PatinaCaslon', title:'B4  Patina, Libre Caslon text and display',
   fonts:'Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Libre+Caslon+Display', text:'"Libre Caslon Text", Georgia, serif', display:'"Libre Caslon Display", Georgia, serif', mono:'"IBM Plex Mono", ui-monospace, monospace',
   size:16.5, lead:1.6, measure:60, h:{h1:'2.9em',h2:'1.78em',h3:'1.33em'}, hw:'400', figs:'lining-nums proportional-nums',
   note:'A true text and display pair at ratio 1.333. The display cut carries the headings at weight 400, so scale, not weight, makes the hierarchy. Formal; a catalogue raisonné.' },
 { theme:'archive', file:'ArchiveFull', title:'C1  Archive, Source Serif with Plex Mono apparatus', full:true,
   fonts:'Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..700', text:'"Source Serif 4", Georgia, serif', display:'"Source Serif 4", Georgia, serif', mono:'"IBM Plex Mono", ui-monospace, monospace',
   size:15.5, lead:1.55, measure:60, h:{h1:'2.07em',h2:'1.44em',h3:'1.2em'}, hw:'600', figs:'lining-nums proportional-nums',
   note:'The proposed pairing. Serif text at 15.5 px, with the apparatus (running head, section numerals, captions, table heads) in the mono, like the labels on an index card.' },
 { theme:'archive', file:'ArchivePlex', title:'C2  Archive, IBM Plex Sans and Mono',
   fonts:'IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400', text:'"IBM Plex Sans", Helvetica, Arial, sans-serif', display:'"IBM Plex Sans", Helvetica, Arial, sans-serif', mono:'"IBM Plex Mono", ui-monospace, monospace',
   size:15, lead:1.55, measure:60, h:{h1:'2.07em',h2:'1.44em',h3:'1.2em'}, hw:'600', figs:'lining-nums tabular-nums',
   note:'One superfamily. Plex Sans for text, Plex Mono for apparatus, sharing metrics, so the running head and the text sit on one baseline grid. The institutional reading.' },
 { theme:'archive', file:'ArchiveGaramond', title:'C3  Archive, EB Garamond with Plex Mono',
   fonts:'EB+Garamond:ital,wght@0,400..800;1,400..800', text:'"EB Garamond", Georgia, serif', display:'"EB Garamond", Georgia, serif', mono:'"IBM Plex Mono", ui-monospace, monospace',
   size:17.5, lead:1.5, measure:62, h:{h1:'2.2em',h2:'1.44em',h3:'1.2em'}, hw:'500', figs:'oldstyle-nums proportional-nums', headStyle:'italic',
   note:'An old-face Garamond at 17.5 px against the mono apparatus: the archive as it was, with the index as it is now. Old-style figures in text, lining tabular in every table.' },
 { theme:'archive', file:'ArchiveTypescript', title:'C4  Archive, Courier Prime typescript',
   fonts:'Courier+Prime:ital,wght@0,400;0,700;1,400', text:'"Courier Prime", "Courier New", monospace', display:'"Courier Prime", "Courier New", monospace', mono:'"Courier Prime", "Courier New", monospace',
   size:15, lead:1.45, measure:64, h:{h1:'1.6em',h2:'1.2em',h3:'1em'}, hw:'700', figs:'lining-nums tabular-nums', headStyle:'normal',
   note:'The risk in the set: everything in a typewriter face, headings by weight and underline, three sizes collapsed to nearly one. A finding aid, not a catalogue. It either lands or it does not.' },
];

const jsCode = `const unit = "rhythm";
const rhythm = (leading, size) => leading * size;
// every vertical space is a multiple of one unit
export const space = {
  item: rhythm(1.55, 15.5) * 0.25,
  block: rhythm(1.55, 15.5),
  section: rhythm(1.55, 15.5) * 2,
};`;
const cssCode = `/* one measure, resolved once, at body size */
.md {
  padding-inline: max(0px, calc((100% - var(--md-measure)) / 2));
}

@media (min-width: 62rem) {
  .md > figure,
  .md > pre { margin-inline: calc(var(--md-bleed) * -1); }
}`;

function content(full, hl) {
  const head = `
<p class="runhead"><span>Book design awards</span><span>2025–2026</span></p>
<h1>Book design awards, 2025–2026</h1>
<p>Everything reported here is fact from the awarding bodies or the trade press. The principles drawn from it are a derivation: no jury publishes a palette, and no citation names a typeface.</p>
<h2>Best Book Design from all over the World 2026</h2>
<p>Announced 12 March 2026 and awarded at the <a href="#">Leipzig Book Fair</a> on 20 March. Around 570 books from 33 nations were reviewed by Sunandini Banerjee, Artur Frankowski, Fraser Muggeridge, Isabel Seiffert and Raül Vicent.<sup><a href="#fn1" data-footnote-ref>1</a></sup> Only books that have <strong>already won a national competition</strong> are eligible, which makes this the <em>single highest-signal</em> book design award. The measure is set once, as <code>--md-measure</code>, and <abbr title="Type Directors Club">TDC</abbr> medals are counted in <del>four</del> <ins>three</ins> disciplines. Press <kbd>⌘</kbd><kbd>K</kbd> to search; the <mark>Goldene Letter</mark> is the top prize.</p>
<h3>Goldene Letter</h3>
<p><em>Ourouboros Wings</em>, designed by Benaiah French at the Royal Academy of Art, The Hague. 207 × 294 mm, 160 pages, 200 copies, self-published.</p>
<h4>Formats</h4>
<p>Nine of the fourteen prizewinners are under 230 mm on the long edge, and one is 50 × 68 mm.</p>
<h5>Read the formats column</h5>
<p>Small format means a short measure and small type carried by generous margins.</p>
<h6>Jury</h6>
<p>Banerjee, Frankowski, Muggeridge, Seiffert, Vicent.</p>
<h3>Bronze Medals</h3>
<div class="md-table-scroll">
<table>
<caption>The five Bronze Medals, with formats as reported by Stiftung Buchkunst.</caption>
<thead><tr><th>Work</th><th>Design</th><th>Country</th><th align="right">Width</th><th align="right">Height</th><th align="right">Pages</th></tr></thead>
<tbody>
<tr><td><em>Heatwave</em></td><td>Bänziger, Florio, Kasper</td><td>Switzerland</td><td align="right">165</td><td align="right">220</td><td align="right">264</td></tr>
<tr><td><em>Collapsed Mythologies</em></td><td>Dayna Casey</td><td>Netherlands</td><td align="right">142</td><td align="right">225</td><td align="right">344</td></tr>
<tr><td><em>Anthology for Listening, Vol. II</em></td><td>Linn Henrichson</td><td>Denmark</td><td align="right">270</td><td align="right">163</td><td align="right">400</td></tr>
<tr><td><em>Mountain 239</em></td><td>Shin Sohyun</td><td>South Korea</td><td align="right">50</td><td align="right">68</td><td align="right">288</td></tr>
<tr><td><em>Os Ovários das Papoilas</em></td><td>Macedo Cannatà</td><td>Portugal</td><td align="right">145</td><td align="right">100</td><td align="right">112</td></tr>
</tbody>
<tfoot><tr><td colspan="6">Dimensions in millimetres, width before height.</td></tr></tfoot>
</table>
</div>`;
  const rest = `
<h2>What the juries rewarded</h2>
<ol start="7">
<li>Legibility under load. Both of the year's top prizes reward type that has to work.</li>
<li>Small is the professional register.</li>
<li>Nine. Here is where alignment usually breaks.</li>
<li>Ten. The periods share a column and the figures stack.</li>
<li>Variable fonts with optical sizing are the new baseline. The TDC type categories are now organised by axis count:
  <ol><li>single style</li><li>single axis</li><li>multiple axis, itself nested:<ol><li>superfamily</li></ol></li></ol>
</li>
</ol>
<ul>
<li>Type area before typeface. The column and its margins are the design.
  <ul><li>One spot colour, used structurally: a numeral, a rule, a reference mark.
    <ul><li>Rules are hairlines and horizontal.</li></ul>
  </li></ul>
</li>
<li>Depth by style, not by size.</li>
</ul>
<ul>
<li><input type="checkbox" checked="" disabled="">Type area settled</li>
<li><input type="checkbox" checked="" disabled="">Spot colour chosen</li>
<li><input type="checkbox" disabled="">Face licensed</li>
</ul>
<dl class="md-dl-columns">
<dt>Satzspiegel</dt><dd>The type area: the block of set text on the page, and its relationship to the four margins.</dd>
<dt>Measure</dt><dd>Line length, counted in characters.</dd>
<dt>Optical size</dt><dd>A variable-font axis that adjusts contrast and spacing for the size at which type is set.</dd>
</dl>
<div class="md-table-scroll">
<table class="md-table--compact">
<caption>TDC72 Type-High medals.</caption>
<thead><tr><th>Tier</th><th align="right">Awarded</th><th align="right">Share</th></tr></thead>
<tbody>
<tr><td>Gold</td><td align="right">13</td><td align="right">8.2%</td></tr>
<tr><td>Silver</td><td align="right">26</td><td align="right">16.4%</td></tr>
<tr><td>Bronze</td><td align="right">28</td><td align="right">17.6%</td></tr>
<tr><td>Certificate</td><td align="right">92</td><td align="right">57.9%</td></tr>
</tbody>
</table>
</div>
<blockquote>
<p>They treat signs, typefaces and typography as cultural, social and political facts, and position graphic design as research and as the mediation of forms.</p>
<cite>Jury citation, Jan Tschichold Award 2026</cite>
</blockquote>
<blockquote class="md-pull">
<p>Innovative design and subtle print techniques let the boundary between content and form blur.</p>
</blockquote>
<hr>
<h2>Principle one as CSS</h2>
<p>The column is made by padding the container, not by capping each child.</p>
<div class="md-code">
<div class="md-code-head"><span>markdown.css</span><span class="md-code-lang">css</span></div>
<pre class="md-code--numbered"><code>${hl.cssLines}</code></pre>
</div>
<p>Rhythm as a function. Every vertical space in the set is a multiple of its return value.</p>
<pre><code class="language-javascript">${hl.js}</code></pre>
<pre><code><span class="md-line md-line--del">.md &gt; * { max-width: 68ch; }</span>
<span class="md-line md-line--add">.md { padding-inline: max(0px, calc((100% - 68ch) / 2)); }</span></code></pre>
<div class="md-alert md-alert--note"><p class="md-alert-title">Note</p><p>The alert tone is one custom property per severity, so a project can add its own without touching the component.</p></div>
<div class="md-alert md-alert--warning"><p class="md-alert-title">Warning</p><p>Justified setting is off by default; enable it only where hyphenation is active.</p></div>
<figure>
<svg viewBox="0 0 640 200" role="img" aria-label="Diagram comparing three type scales" style="width:100%;height:auto;background:var(--md-paper-sunk)">
  <g fill="currentColor" font-family="inherit"><text x="24" y="52" font-size="34">Aa</text><text x="24" y="96" font-size="22">Aa</text><text x="24" y="132" font-size="17">Aa</text><text x="24" y="164" font-size="14">Aa</text></g>
  <g stroke="currentColor" stroke-width="1" opacity="0.28"><line x1="24" y1="176" x2="616" y2="176"></line><line x1="24" y1="24" x2="24" y2="176"></line></g>
  <g fill="currentColor" opacity="0.6" font-size="12" font-family="monospace"><text x="120" y="52">h1</text><text x="120" y="96">h2</text><text x="120" y="132">h3</text><text x="120" y="164">body</text></g>
</svg>
<figcaption><span class="md-fig-num">Fig. 1</span>&nbsp; Three size steps; below the third, depth is carried by weight, slope and small caps.</figcaption>
</figure>
<section class="footnotes">
<h2>Notes</h2>
<ol>
<li id="fn1">The jury reviewed the entries at the German National Library, 19 to 21 February 2026. <a href="#" data-footnote-backref>↩</a></li>
</ol>
</section>
<p class="folio">17</p>`;
  const shortRest = `
<h2>What the juries rewarded</h2>
<ol start="7">
<li>Legibility under load. Both of the year's top prizes reward type that has to work.</li>
<li>Small is the professional register.</li>
<li>Nine. Here is where alignment usually breaks.</li>
<li>Ten. The periods share a column and the figures stack.</li>
</ol>
<blockquote>
<p>They treat signs, typefaces and typography as cultural, social and political facts.</p>
<cite>Jury citation, Jan Tschichold Award 2026</cite>
</blockquote>
<pre><code class="language-javascript">${hl.js}</code></pre>
<section class="footnotes">
<h2>Notes</h2>
<ol><li id="fn1">The jury reviewed the entries at the German National Library, 19 to 21 February 2026.</li></ol>
</section>
<p class="folio">17</p>`;
  return head + (full ? rest : shortRest);
}

const layouts = {
 marginalia: `
  .md { display: grid; grid-template-columns: minmax(0, 1fr) 18ch; column-gap: 3ch; padding-inline: 8% 7%; }
  .md > * { grid-column: 1; }
  .md > .footnotes { grid-column: 2; grid-row: 2 / span 60; align-self: start; margin: 0; padding: 0; border: 0; font-size: 0.78em; line-height: 1.45; }
  .md > .footnotes ol { padding-inline-start: 1.6ch; }
  .md > .runhead { grid-column: 1 / -1; display: flex; justify-content: space-between; font-family: var(--md-face-display); font-size: 0.72em; font-weight: 600; color: var(--md-ink-muted); padding-block-end: 0.5em; border-block-end: var(--md-hairline) solid var(--md-spot); margin-block-end: calc(var(--md-rhythm) * 2); }
  .md > .folio { display: none; }
  .md blockquote cite { color: var(--md-spot); }
  .md > .md-table-scroll, .md > figure, .md > pre, .md > .md-code { margin-inline: 0; }
  .md blockquote.md-pull { grid-column: 1 / -1; }`,
 catalogue: `
  .md { padding-inline: 14% 16%; counter-reset: sec; }
  .md > .runhead { display: flex; justify-content: space-between; font-family: var(--md-face-mono); font-size: 0.72em; color: var(--md-ink-muted); padding-block-end: 0.5em; border-block-end: var(--md-hairline) solid var(--md-rule); margin-block-end: calc(var(--md-rhythm) * 2); }
  .md > h2 { position: relative; counter-increment: sec; }
  .md > h2::before { content: counter(sec, decimal-leading-zero); position: absolute; inset-inline-end: 100%; margin-inline-end: 2ch; color: var(--md-spot); font-family: var(--md-face-mono); font-size: 0.7em; font-weight: 500; line-height: inherit; top: 0.35em; }
  .md caption, .md thead th, .md figcaption, .md .md-code-head, .md .md-alert-title { font-family: var(--md-face-mono); font-size: 0.78em; letter-spacing: 0.02em; }
  .md > .folio { font-family: var(--md-face-mono); font-size: 0.72em; color: var(--md-ink-muted); margin-block-start: calc(var(--md-rhythm) * 2.5); }
  .md table { font-size: 0.9em; }
  .md > .md-table-scroll, .md > figure, .md > pre, .md > .md-code { margin-inline: -6ch 0; }`,
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.setContent('<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js" data-manual></script>');
  await page.waitForFunction(() => window.Prism);
  const hl = await page.evaluate(([js, css]) => {
    const j = Prism.highlight(js, Prism.languages.javascript, 'javascript');
    const c = Prism.highlight(css, Prism.languages.css, 'css');
    // wrap each css line; comments here are single-line, so a per-line split is safe
    const lines = c.split('\n').map(l => `<span class="md-line">${l}</span>`).join('');
    return { js: j, cssLines: lines };
  }, [jsCode, cssCode]);

  const boards = [];
  for (const v of V) {
    const t = themes[v.theme]; const p = t.pal;
    const tokens = `
  .md[data-md-theme="${v.theme}"] {
    --md-paper: ${p.paper}; --md-paper-sunk: ${p.sunk};
    --md-ink: ${p.ink}; --md-ink-muted: ${p.muted}; --md-ink-faint: ${p.faint};
    --md-rule: ${p.rule}; --md-spot: ${p.spot};
    --md-face-text: ${v.text}; --md-face-display: ${v.display}; --md-face-mono: ${v.mono};
    --md-size: ${v.size / 16}rem; --md-leading: ${v.lead}; --md-measure: ${v.measure}ch; --md-ratio: 1.2;
    --md-h1: ${v.h.h1}; --md-h2: ${v.h.h2}; --md-h3: ${v.h.h3}; --md-h4: 1em; --md-h5: 1em; --md-h6: 0.9em;
    --md-h-weight: ${v.hw}; --md-h-tracking: -0.01em; --md-h-leading: 1.12;
    --md-figures-text: ${v.figs}; --md-figures-data: lining-nums tabular-nums;
    --md-list-indent: 1.8em; --md-quote-indent: 1.5em; --md-radius: 0;
  }
  ${v.headStyle ? `.md :is(h1, h2, h3) { font-style: ${v.headStyle}; }` : ''}
  ${v.file === 'ArchiveTypescript' ? `.md h2 { text-decoration: underline; text-underline-offset: 0.2em; text-decoration-thickness: 1px; } .md h5 { font-style: normal; text-decoration: underline; text-underline-offset: 0.2em; } .md :not(pre) > code { background: none; padding: 0; font-weight: 700; }` : ''}`;
    const body = content(v.full, hl);
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${v.fonts}&family=IBM+Plex+Mono:wght@400;500&family=JetBrains+Mono:wght@400..700&display=swap">
  <style>
${md}
${mdcode}
${CANDIDATES}
${tokens}
  body { margin: 0; background: #DAD9D4; font-family: "Archivo", Helvetica, Arial, sans-serif; }
  .label { padding: 18px 24px 12px; font-size: 13px; line-height: 1.4; color: #5C5A63; display: grid; grid-template-columns: 1fr auto; gap: 24px; }
  .label b { color: #16151A; font-weight: 600; }
  .label .sw { display: flex; gap: 6px; align-items: center; }
  .label .sw i { display: block; width: 18px; height: 18px; border: 1px solid rgba(0,0,0,.12); }
  .md { padding-block: 64px 56px; box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 12px 36px rgba(0,0,0,.08); }
  .md > .runhead { margin-block-start: 0; } .md > .runhead + h1 { margin-block-start: 0; }
  .note { padding: 14px 24px 22px; font-size: 13px; line-height: 1.45; color: #3B352F; max-width: 74ch; }
  .note b { font-weight: 600; }
  a { color: inherit; } a:hover { color: var(--md-spot, inherit); }
${layouts[t.layout]}
  </style>
</helmet>
<div style="width: 1100px; background: #DAD9D4; display: flex; flex-direction: column;">
  <div class="label">
    <div><b>${v.title}</b><br>${v.size} px on ${v.measure} ch, leading ${v.lead}</div>
    <div class="sw"><i style="background: ${p.paper}"></i><i style="background: ${p.sunk}"></i><i style="background: ${p.rule}"></i><i style="background: ${p.muted}"></i><i style="background: ${p.ink}"></i><i style="background: ${p.spot}; margin-left: 8px"></i><span>${t.spotName} ${p.spot}</span></div>
  </div>
  <div style="padding: 0 24px;">
    <article class="md" data-md-theme="${v.theme}" style="--md-spot: {{spot}}; --md-size: {{sizeRem}}; --md-measure: {{measureCh}}; --md-leading: {{leading}}">
${body}
    </article>
  </div>
  <p class="note"><b>Type.</b> ${v.note}</p>
</div>
</x-dc>
<script data-dc-script data-props='{"spot":{"editor":"color","default":"${p.spot}","section":"Theme"},"size":{"editor":"float","default":${v.size},"min":13,"max":22,"step":0.5,"unit":"px","section":"Type"},"measure":{"editor":"int","default":${v.measure},"min":45,"max":80,"unit":"ch","section":"Type"},"leading":{"editor":"float","default":${v.lead},"min":1.3,"max":1.8,"step":0.02,"section":"Type"}}'>
class Component extends DCLogic {
  renderVals() {
    const p = this.props;
    return { spot: p.spot ?? '${p.spot}', sizeRem: ((p.size ?? ${v.size}) / 16) + 'rem', measureCh: (p.measure ?? ${v.measure}) + 'ch', leading: String(p.leading ?? ${v.lead}) };
  }
}
</script>
</body>
</html>
`;
    fs.writeFileSync(`${OUT}/${v.file}.dc.html`, html);
    // measure height: render without the runtime, holes fall back to the token block
    await page.setContent(html.replace('<script src="./support.js"></script>', '').replace(/<script data-dc-script[\s\S]*?<\/script>/, ''), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const h = await page.evaluate(() => document.body.scrollHeight);
    boards.push({ file: `${v.file}.dc.html`, title: v.title, h: Math.round(h * (v.full ? 1.45 : 1.25)) + 40 });
    console.log(v.file, Math.round(h));
  }
  await browser.close();

  const canvas = JSON.parse(fs.readFileSync(`${OUT}/canvas.json`, 'utf8'));
  canvas.pages = canvas.pages.filter(p => p.id !== 'page-5');
  canvas.pages.push({ id: 'page-5', name: 'Patina & Archive' });
  canvas.artboards = canvas.artboards.filter(a => a.page !== 'page-5');
  canvas.annotations = (canvas.annotations || []).filter(a => a.page !== 'page-5');
  const W = 1100;
  let y = 0;
  for (const theme of ['patina', 'archive']) {
    const row = boards.filter((b, i) => V[i].theme === theme);
    let x = 0, rowH = 0;
    for (const b of row) { canvas.artboards.push({ file: b.file, title: b.title, page: 'page-5', x, y, w: W, h: b.h }); x += W + 100; rowH = Math.max(rowH, b.h); }
    y += rowH + 200;
  }
  canvas.annotations.push({ id: 'deepdive-note', page: 'page-5', x: 0, y: -560, w: 620,
    text: 'Patina (B) above, Archive (C) below. The first board in each row carries every object a Markdown pipeline emits: six heading levels, inline marks, ordered, unordered, task and definition lists, two tables, quotation and pull quote, rule, highlighted code with filename and line numbers, a diff, alerts, a figure and footnotes. The three boards beside it are typographic variations on the same palette and layout. Tweaks on every board: spot colour, size, measure, leading.' });
  canvas.launch = { view: 'canvas', page: 'page-5' };
  fs.writeFileSync(`${OUT}/canvas.json`, JSON.stringify(canvas, null, 2));
  console.log('canvas.json updated:', canvas.artboards.length, 'artboards');
})();
