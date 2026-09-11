// Builds ten direction artboards: each is a full token block for a new theme over
// the real markdown.css, plus one layout device. Run with plain node from anywhere.
const fs = require('fs');
const ROOT = '/Users/yorck/Projects/markdown2html';
const OUT = ROOT + '/plates/canvas';
const md = fs.readFileSync(ROOT + '/input/markdown.css', 'utf8');

const lum = h => { const [r,g,b] = [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255).map(c => c <= .03928 ? c/12.92 : ((c+.055)/1.055)**2.4); return .2126*r+.7152*g+.0722*b; };
const cr = (a,b) => { const [x,y] = [lum(a),lum(b)]; return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(1); };

const D = [
 { key:'linen', letter:'A', file:'Linen', title:'A  Linen, recto margins', source:"Curator's Linen (media.io #2). Register: Rijksmuseum catalogue, Irma Boom's generation of Amsterdam book design.",
   pal:{paper:'#F4EFE6',sunk:'#E9E1D3',ink:'#3B352F',muted:'#6A6156',faint:'#A8A093',rule:'#D8CBB8',spot:'#B5432B'}, spotName:'brick',
   fonts:'Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700', text:'"Newsreader", Georgia, serif', display:'"Newsreader", Georgia, serif', mono:'"IBM Plex Mono", ui-monospace, monospace',
   size:'1.125rem', lead:'1.6', measure:'64ch', ratio:'1.25', h:{h1:'2.441em',h2:'1.563em',h3:'1.25em'}, hw:'500', figs:'oldstyle-nums proportional-nums', layout:'recto',
   note:'Van de Graaf recto: inner margin one part, outer two. Running head at the outer top, folio at the outer foot. The page is a right-hand page, not a centred column.' },
 { key:'patina', letter:'B', file:'Patina', title:'B  Patina, marginalia', source:'Patina Frame (media.io #8). Register: a sculpture-garden catalogue; green as the one ink beside black.',
   pal:{paper:'#F3F6F4',sunk:'#E4EBE7',ink:'#1D2A24',muted:'#56705F',faint:'#8FA69A',rule:'#C7D5CC',spot:'#2F5B4A'}, spotName:'patina green',
   fonts:'Spectral:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Schibsted+Grotesk:ital,wght@0,400..900;1,400..900', text:'"Spectral", Georgia, serif', display:'"Schibsted Grotesk", Helvetica, Arial, sans-serif', mono:'"IBM Plex Mono", ui-monospace, monospace',
   size:'1.0625rem', lead:'1.62', measure:'60ch', ratio:'1.2', h:{h1:'2.2em',h2:'1.44em',h3:'1.2em'}, hw:'600', figs:'lining-nums proportional-nums', layout:'marginalia',
   note:'Marginalia: an 18-character outer column carries the notes and the attribution, so the apparatus sits beside the text instead of beneath it. Serif text, grotesk headings.' },
 { key:'archive', letter:'C', file:'Archive', title:'C  Archive, numbered catalogue', source:'Quiet Archive (media.io #9). Register: archival index cards; small type, wide margins, everything numbered.',
   pal:{paper:'#F5F1EA',sunk:'#E9E3D8',ink:'#2B2B2A',muted:'#6B655D',faint:'#A79F93',rule:'#D7D0C6',spot:'#2F3E63'}, spotName:'archival ink',
   fonts:'Source+Serif+4:ital,opsz,wght@0,8..60,300..700;1,8..60,300..700&family=IBM+Plex+Mono:wght@400;500', text:'"Source Serif 4", Georgia, serif', display:'"Source Serif 4", Georgia, serif', mono:'"IBM Plex Mono", ui-monospace, monospace',
   size:'0.96875rem', lead:'1.55', measure:'60ch', ratio:'1.2', h:{h1:'2.07em',h2:'1.44em',h3:'1.2em'}, hw:'600', figs:'lining-nums proportional-nums', layout:'catalogue',
   note:'Catalogue: every section takes a numeral in the spot, hung in the margin; the running head is set in the mono face like a card index; type is 15.5 px on a 60-character measure.' },
 { key:'maproom', letter:'D', file:'MapRoom', title:'D  Map Room, hanging heads', source:'Map Room (media.io #22). Register: a cartographic legend; teal as the one colour, figures doing the work.',
   pal:{paper:'#F6FBFB',sunk:'#E6F1F1',ink:'#1B2B2A',muted:'#4E6E70',faint:'#8DAAAC',rule:'#D0E6E6',spot:'#2F5D63'}, spotName:'teal',
   fonts:'Public+Sans:ital,wght@0,300..800;1,300..800&family=Instrument+Serif:ital@0;1', text:'"Public Sans", Helvetica, Arial, sans-serif', display:'"Instrument Serif", Georgia, serif', mono:'"IBM Plex Mono", ui-monospace, monospace',
   size:'0.9375rem', lead:'1.55', measure:'62ch', ratio:'1.25', h:{h1:'2.8em',h2:'1.7em',h3:'1.3em'}, hw:'400', figs:'lining-nums tabular-nums', layout:'hanging',
   note:'Hanging heads: h2 and h3 float into a 14-character left margin like a legend, and the text keeps one true edge. Sans text, a display serif for the headings, tabular figures throughout.' },
 { key:'sandberg', letter:'E', file:'Sandberg', title:'E  Sandberg, poster page', source:'Amsterdam, the Stedelijk lineage from Willem Sandberg to Mevis & Van Deursen: a grotesk, one loud colour, ranged hard left.',
   pal:{paper:'#FFFFFF',sunk:'#F1F1EF',ink:'#000000',muted:'#5A5A5A',faint:'#9A9A9A',rule:'#C9C9C9',spot:'#C9350F'}, spotName:'vermilion',
   fonts:'Archivo:ital,wdth,wght@0,80..125,100..900;1,80..125,100..900', text:'"Archivo", Helvetica, Arial, sans-serif', display:'"Archivo", Helvetica, Arial, sans-serif', mono:'"JetBrains Mono", ui-monospace, monospace',
   size:'0.9375rem', lead:'1.5', measure:'58ch', ratio:'1.2', h:{h1:'5.2em',h2:'1.44em',h3:'1.2em'}, hw:'700', figs:'lining-nums proportional-nums', layout:'poster',
   note:'Poster page: the title is set expanded at five times text size, lowercase, hard against a narrow left margin; the running text is small and the right margin is wide. The page is the poster.' },
 { key:'modular', letter:'F', file:'Modular', title:'F  Modular, two columns', source:'Amsterdam, the Experimental Jetset and Thonik register: modular grid, neutral grotesk, one primary.',
   pal:{paper:'#F2F2F0',sunk:'#E7E7E4',ink:'#111111',muted:'#616161',faint:'#9C9C9C',rule:'#BDBDBD',spot:'#0038B8'}, spotName:'cobalt',
   fonts:'Hanken+Grotesk:ital,wght@0,300..800;1,300..800', text:'"Hanken Grotesk", Helvetica, Arial, sans-serif', display:'"Hanken Grotesk", Helvetica, Arial, sans-serif', mono:'"JetBrains Mono", ui-monospace, monospace',
   size:'0.90625rem', lead:'1.45', measure:'74ch', ratio:'1.2', h:{h1:'2.49em',h2:'1.2em',h3:'1em'}, hw:'600', figs:'lining-nums tabular-nums', layout:'columns',
   note:'Two columns of 34 characters on a modular grid, the running head set as a ruled table row, tables spanning both columns. Headings at text size in weight, the way a catalogue does it.' },
 { key:'signal', letter:'G', file:'Signal', title:'G  Signal, centred axis', source:'Copenhagen, the Rama Studio and Playtype register: large-scale sign lettering, one bright colour, everything on a centre line.',
   pal:{paper:'#EDE9E1',sunk:'#E2DDD3',ink:'#14161A',muted:'#5C6066',faint:'#8F9298',rule:'#C9C6BE',spot:'#C8206F'}, spotName:'magenta',
   fonts:'Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800', text:'"Bricolage Grotesque", Helvetica, Arial, sans-serif', display:'"Bricolage Grotesque", Helvetica, Arial, sans-serif', mono:'"JetBrains Mono", ui-monospace, monospace',
   size:'1rem', lead:'1.5', measure:'60ch', ratio:'1.25', h:{h1:'3.6em',h2:'1.563em',h3:'1.1em'}, hw:'800', figs:'lining-nums proportional-nums', layout:'axis',
   note:'Centred axis: the title in sign capitals in the spot, headings and rules on a centre line, text ranged left beneath. Greige paper, so the magenta reads as paint on a wall, not as a web accent.' },
 { key:'programme', letter:'H', file:'Programme', title:'H  Programme, dark theatre', source:'Paris, the theatre poster culture of Apeloig and Graphéine: black, one acid colour, a display face from a Paris foundry (Syne, Bonjour Monde).',
   pal:{paper:'#141414',sunk:'#1F1F1F',ink:'#F2EFE8',muted:'#A9A49A',faint:'#6E6A63',rule:'#333333',spot:'#D5FF3A'}, spotName:'acid',
   fonts:'Syne:wght@400..800&family=Sofia+Sans:ital,wght@0,300..800;1,300..800', text:'"Sofia Sans", Helvetica, Arial, sans-serif', display:'"Syne", Helvetica, Arial, sans-serif', mono:'"JetBrains Mono", ui-monospace, monospace',
   size:'1.03125rem', lead:'1.55', measure:'62ch', ratio:'1.26', h:{h1:'4.4em',h2:'1.6em',h3:'1.26em'}, hw:'800', figs:'lining-nums tabular-nums', layout:'programme',
   note:'Programme: the title in Syne Extra Bold at four times text size, every section numbered in the spot with tabular figures, a season strip at the head. Dark as the native state.' },
 { key:'marais', letter:'I', file:'Marais', title:'I  Marais, indented text', source:'Paris, the quiet studios (Spassky Fischer, deValence): a display serif italic against a plain grotesk, generous white, one cool colour.',
   pal:{paper:'#FBFAF7',sunk:'#F0EEE8',ink:'#1C1C1C',muted:'#6B6B6B',faint:'#A3A3A3',rule:'#DDDBD5',spot:'#5B3FD0'}, spotName:'violet',
   fonts:'Instrument+Serif:ital@0;1&family=Geist:wght@300..700', text:'"Geist", Helvetica, Arial, sans-serif', display:'"Instrument Serif", Georgia, serif', mono:'"JetBrains Mono", ui-monospace, monospace',
   size:'0.96875rem', lead:'1.55', measure:'64ch', ratio:'1.25', h:{h1:'3.4em',h2:'1.9em',h3:'1.3em'}, hw:'400', figs:'lining-nums proportional-nums', layout:'indented',
   note:'Indented text: headings sit flush at the margin in the serif italic and every paragraph is indented four characters, so the headings hang without a second column. Violet on warm white.' },
 { key:'evening', letter:'J', file:'Evening', title:'J  Evening, gold on night', source:'Night at the Museum and Gold Leaf Catalog (media.io #19, #13): a museum after hours; navy paper, gold as the one ink beside white.',
   pal:{paper:'#0B0D12',sunk:'#1A2233',ink:'#F0F2F6',muted:'#9AA7B8',faint:'#5E6B7E',rule:'#2F3F5C',spot:'#E1C97A'}, spotName:'gold leaf',
   fonts:'Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=Onest:wght@300..800', text:'"Onest", Helvetica, Arial, sans-serif', display:'"Newsreader", Georgia, serif', mono:'"JetBrains Mono", ui-monospace, monospace',
   size:'1.03125rem', lead:'1.58', measure:'64ch', ratio:'1.25', h:{h1:'2.9em',h2:'1.7em',h3:'1.25em'}, hw:'400', figs:'lining-nums tabular-nums', layout:'evening',
   note:'Evening: tables and quotations sit on the sunk navy and bleed past the measure; running heads at both margins; serif display over a sans text. Gold at 12 : 1 carries every structural mark.' },
];

const content = `
<p class="runhead"><span>Book design awards</span><span>2025–2026</span></p>
<h1>Book design awards, 2025–2026</h1>
<p>Everything reported here is fact from the awarding bodies or the trade press. The principles drawn from it are a derivation: no jury publishes a palette, and no citation names a typeface.</p>
<h2>Best Book Design from all over the World 2026</h2>
<p>Announced 12 March 2026 and awarded at the Leipzig Book Fair on 20 March. Around 570 books from 33 nations were reviewed in Leipzig by Sunandini Banerjee, Artur Frankowski, Fraser Muggeridge, Isabel Seiffert and Raül Vicent.<sup><a href="#fn1" data-footnote-ref>1</a></sup> Only books that have already won a national competition are eligible.</p>
<p>Fourteen prizes are awarded in a fixed structure: one Goldene Letter, one Gold, two Silver, five Bronze and five Honorary Appreciations. The Goldene Letter went to <em>Ourouboros Wings</em>, designed by Benaiah French at the Royal Academy of Art, The Hague.</p>
<h3>Bronze Medals</h3>
<div class="md-table-scroll">
<table>
<caption>The five Bronze Medals, with formats as reported by Stiftung Buchkunst.</caption>
<thead><tr><th>Work</th><th>Country</th><th align="right">Width</th><th align="right">Height</th><th align="right">Pages</th></tr></thead>
<tbody>
<tr><td><em>Heatwave</em></td><td>Switzerland</td><td align="right">165</td><td align="right">220</td><td align="right">264</td></tr>
<tr><td><em>Collapsed Mythologies</em></td><td>Netherlands</td><td align="right">142</td><td align="right">225</td><td align="right">344</td></tr>
<tr><td><em>Mountain 239</em></td><td>South Korea</td><td align="right">50</td><td align="right">68</td><td align="right">288</td></tr>
<tr><td><em>Os Ovários das Papoilas</em></td><td>Portugal</td><td align="right">145</td><td align="right">100</td><td align="right">112</td></tr>
</tbody>
</table>
</div>
<p>Read the formats column. Nine of the fourteen prizewinners are under 230 mm on the long edge, and one is 50 × 68 mm. Small format means a short measure and small type carried by generous margins.</p>
<h2>What the juries rewarded</h2>
<ul>
<li>Type area before typeface. The column and its margins are the design.</li>
<li>One spot colour, used structurally: a numeral, a rule, a reference mark.</li>
<li>Rules are hairlines and horizontal. No boxes, no fills.</li>
</ul>
<blockquote>
<p>They treat signs, typefaces and typography as cultural, social and political facts, and position graphic design as research.</p>
<cite>Jury citation, Jan Tschichold Award 2026</cite>
</blockquote>
<section class="footnotes">
<h2>Notes</h2>
<ol><li id="fn1">The jury reviewed the entries at the German National Library, 19 to 21 February 2026.</li></ol>
</section>
<p class="folio">17</p>
`;

const layouts = {
 recto: `
  .md { padding-inline: 11% 24%; }
  .md > .runhead { display: flex; justify-content: space-between; font-size: 0.72em; font-variant-caps: all-small-caps; letter-spacing: 0.08em; color: var(--md-ink-muted); padding-block-end: 0.5em; border-block-end: var(--md-hairline) solid var(--md-rule); margin-block-end: calc(var(--md-rhythm) * 2); }
  .md > .folio { text-align: end; font-size: 0.8em; color: var(--md-ink-muted); font-variant-numeric: lining-nums tabular-nums; margin-block-start: calc(var(--md-rhythm) * 2.5); }
  .md h2 { font-style: italic; font-weight: 500; }
  .md > h1 + p { font-style: italic; }`,
 marginalia: `
  .md { display: grid; grid-template-columns: minmax(0, 1fr) 18ch; column-gap: 3ch; padding-inline: 8% 7%; }
  .md > * { grid-column: 1; }
  .md > .footnotes { grid-column: 2; grid-row: 2 / span 30; align-self: start; margin: 0; padding: 0; border: 0; font-size: 0.78em; line-height: 1.45; }
  .md > .footnotes ol { padding-inline-start: 1.6ch; }
  .md > .runhead { grid-column: 1 / -1; display: flex; justify-content: space-between; font-family: var(--md-face-display); font-size: 0.72em; font-weight: 600; color: var(--md-ink-muted); padding-block-end: 0.5em; border-block-end: var(--md-hairline) solid var(--md-spot); margin-block-end: calc(var(--md-rhythm) * 2); }
  .md > .folio { display: none; }
  .md blockquote cite { color: var(--md-spot); }
  .md > .md-table-scroll { margin-inline: 0; }`,
 catalogue: `
  .md { padding-inline: 14% 16%; counter-reset: sec; }
  .md > .runhead { display: flex; justify-content: space-between; font-family: var(--md-face-mono); font-size: 0.72em; color: var(--md-ink-muted); padding-block-end: 0.5em; border-block-end: var(--md-hairline) solid var(--md-rule); margin-block-end: calc(var(--md-rhythm) * 2); }
  .md > h2:not(.footnotes h2) { position: relative; counter-increment: sec; }
  .md > h2::before { content: counter(sec, decimal-leading-zero); position: absolute; inset-inline-end: 100%; margin-inline-end: 2ch; color: var(--md-spot); font-family: var(--md-face-mono); font-size: 0.7em; font-weight: 500; line-height: inherit; top: 0.35em; }
  .md caption, .md thead th { font-family: var(--md-face-mono); font-size: 0.78em; letter-spacing: 0.02em; }
  .md > .folio { font-family: var(--md-face-mono); font-size: 0.72em; color: var(--md-ink-muted); margin-block-start: calc(var(--md-rhythm) * 2.5); }
  .md table { font-size: 0.9em; }`,
 hanging: `
  .md { padding-inline: 20% 10%; }
  .md > h2, .md > h3 { float: inline-start; clear: both; inline-size: 12ch; margin-inline-start: -15ch; margin-block: 0; font-family: var(--md-face-display); font-weight: 400; line-height: 1.1; text-wrap: balance; }
  .md > h2 { margin-block-start: var(--md-space-section); } .md > h2 + * { margin-block-start: var(--md-space-section); }
  .md > h3 { margin-block-start: calc(var(--md-rhythm) * 1.5); color: var(--md-spot); } .md > h3 + * { margin-block-start: calc(var(--md-rhythm) * 1.5); }
  .md > h2 + *, .md > h3 + * { clear: none; }
  .md > .runhead { display: flex; justify-content: space-between; font-size: 0.72em; color: var(--md-ink-muted); font-variant-numeric: tabular-nums; padding-block-end: 0.5em; border-block-end: var(--md-hairline) solid var(--md-ink); margin-block-end: calc(var(--md-rhythm) * 2); }
  .md > .folio { display: none; }
  .md > .md-table-scroll { margin-inline: -15ch 0; }
  .md td, .md th { font-variant-numeric: lining-nums tabular-nums; }
  .md > h1 { font-family: var(--md-face-display); }`,
 poster: `
  .md { padding-inline: 6% 28%; }
  .md > h1 { font-stretch: 125%; font-weight: 800; letter-spacing: -0.03em; line-height: 0.9; text-transform: lowercase; margin-inline-start: -0.04em; text-wrap: balance; }
  .md > h1 + * { margin-block-start: calc(var(--md-rhythm) * 3); }
  .md > h2 { border-block-start: var(--md-hairline) solid var(--md-ink); padding-block-start: calc(var(--md-rhythm) * 0.4); }
  .md > .runhead { display: none; }
  .md > .folio { display: none; }
  .md li::marker, .md ol > li::marker { color: var(--md-spot); }
  .md sup a[data-footnote-ref] { color: var(--md-spot); }`,
 columns: `
  .md { padding-inline: 7%; }
  .md > .runhead { display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 0.78em; font-weight: 600; color: var(--md-ink); border-block: var(--md-hairline) solid var(--md-ink); padding-block: 0.4em; margin-block-end: calc(var(--md-rhythm) * 2); }
  .md > .runhead span:last-child { text-align: end; grid-column: 3; color: var(--md-spot); }
  .md > .cols { columns: 2; column-gap: 4ch; }
  .md > .cols > * + * { margin-block-start: var(--md-space-block); }
  .md > .cols > h2 { break-after: avoid; margin-block-start: var(--md-space-section); color: var(--md-spot); }
  .md > .cols > h2:first-child { margin-block-start: 0; }
  .md > .cols > h3 { break-after: avoid; }
  .md > .cols > .md-table-scroll { column-span: all; margin-block: var(--md-space-section); }
  .md > .cols > .footnotes { column-span: all; }
  .md > .folio { display: none; }
  .md > h1 { letter-spacing: -0.02em; }`,
 axis: `
  .md { padding-inline: 12%; text-align: start; }
  .md > .runhead { display: flex; justify-content: center; gap: 3ch; font-size: 0.78em; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--md-ink-muted); margin-block-end: calc(var(--md-rhythm) * 2); }
  .md > h1 { text-align: center; text-transform: uppercase; letter-spacing: 0.02em; font-stretch: 85%; color: var(--md-spot); line-height: 0.95; }
  .md > h1 + p { text-align: center; font-size: 1.05em; }
  .md > h2 { text-align: center; padding-block-start: calc(var(--md-rhythm) * 0.6); border-block-start: var(--md-hairline) solid var(--md-ink); }
  .md > h3 { text-align: center; font-variant-caps: all-small-caps; letter-spacing: 0.08em; font-weight: 600; }
  .md hr { border-block-start: var(--md-hairline) solid var(--md-ink); }
  .md > .folio { text-align: center; font-size: 0.8em; color: var(--md-ink-muted); margin-block-start: calc(var(--md-rhythm) * 2.5); }
  .md > .md-table-scroll { margin-inline: 0; }`,
 programme: `
  .md { padding-inline: 9% 14%; counter-reset: sec; }
  .md > .runhead { display: flex; justify-content: space-between; font-family: var(--md-face-display); font-size: 0.8em; font-weight: 700; color: var(--md-spot); border-block-end: var(--md-hairline) solid var(--md-rule); padding-block-end: 0.5em; margin-block-end: calc(var(--md-rhythm) * 2); }
  .md > h1 { font-weight: 800; letter-spacing: -0.02em; line-height: 0.92; text-wrap: balance; }
  .md > h2 { counter-increment: sec; font-weight: 700; }
  .md > h2::before { content: counter(sec, decimal-leading-zero) "  "; color: var(--md-spot); font-variant-numeric: lining-nums tabular-nums; white-space: pre; }
  .md thead th { border-color: var(--md-ink-muted); } .md tbody tr:last-child :is(th, td) { border-color: var(--md-ink-muted); }
  .md blockquote { border-inline-start: 2px solid var(--md-spot); }
  .md > .folio { display: none; }
  .md sup a[data-footnote-ref] { color: var(--md-spot); }`,
 indented: `
  .md { padding-inline: 12% 16%; }
  .md > p:not(.runhead):not(.folio), .md > ul, .md > blockquote, .md > .md-table-scroll { margin-inline-start: 4ch; }
  .md > h1 + p { margin-inline-start: 0; }
  .md :is(h1, h2, h3) { font-family: var(--md-face-display); font-style: italic; font-weight: 400; letter-spacing: 0; }
  .md > h3 { color: var(--md-spot); }
  .md > .runhead { display: flex; justify-content: space-between; font-size: 0.72em; color: var(--md-ink-muted); margin-block-end: calc(var(--md-rhythm) * 2.5); }
  .md > .runhead span:last-child { color: var(--md-spot); }
  .md > .folio { display: none; }
  .md blockquote { padding-inline-start: 0; border: 0; font-family: var(--md-face-display); font-style: italic; font-size: 1.25em; line-height: 1.3; }
  .md blockquote cite { font-family: var(--md-face-text); font-style: normal; font-size: 0.72em; }
  .md > .md-table-scroll { margin-inline-end: 0; }`,
 evening: `
  .md { padding-inline: 12%; }
  .md > .runhead { display: flex; justify-content: space-between; font-family: var(--md-face-display); font-style: italic; font-size: 0.9em; color: var(--md-spot); margin-block-end: calc(var(--md-rhythm) * 2.5); }
  .md :is(h1, h2, h3) { font-family: var(--md-face-display); font-weight: 400; letter-spacing: 0; }
  .md > h2 { border-block-start: var(--md-hairline) solid var(--md-rule); padding-block-start: calc(var(--md-rhythm) * 0.5); }
  .md > .md-table-scroll, .md > blockquote { background: var(--md-paper-sunk); padding: calc(var(--md-rhythm) * 0.8) 3ch; margin-inline: -3ch; border: 0; }
  .md thead th, .md tbody tr:last-child :is(th, td) { border-color: var(--md-spot); }
  .md blockquote cite { color: var(--md-spot); }
  .md sup a[data-footnote-ref] { color: var(--md-spot); }
  .md > .folio { text-align: center; font-family: var(--md-face-display); font-style: italic; color: var(--md-spot); margin-block-start: calc(var(--md-rhythm) * 2.5); }`,
};

const W = 1100;
const boards = [];
for (const d of D) {
  const p = d.pal;
  const tokens = `
  .md[data-md-theme="${d.key}"] {
    --md-paper: ${p.paper}; --md-paper-sunk: ${p.sunk};
    --md-ink: ${p.ink}; --md-ink-muted: ${p.muted}; --md-ink-faint: ${p.faint};
    --md-rule: ${p.rule}; --md-spot: ${p.spot};
    --md-face-text: ${d.text}; --md-face-display: ${d.display}; --md-face-mono: ${d.mono};
    --md-size: ${d.size}; --md-leading: ${d.lead}; --md-measure: ${d.measure}; --md-ratio: ${d.ratio};
    --md-h1: ${d.h.h1}; --md-h2: ${d.h.h2}; --md-h3: ${d.h.h3}; --md-h4: 1em; --md-h5: 1em; --md-h6: 0.9em;
    --md-h-weight: ${d.hw}; --md-h-tracking: -0.01em; --md-h-leading: 1.12;
    --md-figures-text: ${d.figs}; --md-figures-data: lining-nums tabular-nums;
    --md-list-indent: 1.8em; --md-quote-indent: 1.5em; --md-radius: 0;
  }`;
  let body = content;
  if (d.layout === 'columns') {
    // wrap everything after the h1 lead into the two-column flow
    const i = body.indexOf('<h2>');
    const j = body.indexOf('<p class="folio">');
    body = body.slice(0, i) + '<div class="cols">' + body.slice(i, j) + '</div>' + body.slice(j);
  }
  const contrast = `${cr(p.spot, p.paper)} : 1 spot on paper, ${cr(p.ink, p.paper)} : 1 ink, ${cr(p.muted, p.paper)} : 1 muted`;
  const doc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${d.fonts}&family=IBM+Plex+Mono:wght@400;500&family=JetBrains+Mono:wght@400..700&display=swap">
  <style>
${md}
${tokens}
  body { margin: 0; background: #DAD9D4; font-family: "Archivo", Helvetica, Arial, sans-serif; }
  .label { padding: 18px 24px 12px; font-size: 13px; line-height: 1.4; color: #5C5A63; display: grid; grid-template-columns: 1fr auto; gap: 24px; }
  .label b { color: #16151A; font-weight: 600; }
  .label .sw { display: flex; gap: 6px; align-items: center; }
  .label .sw i { display: block; width: 18px; height: 18px; border: 1px solid rgba(0,0,0,.12); }
  .md { padding-block: 64px 56px; box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 12px 36px rgba(0,0,0,.08); }
  .md > .runhead, .md > .folio { margin-block-start: 0; }
  .md > .runhead { margin-block-start: 0; }
  .md > .runhead + h1 { margin-block-start: 0; }
  .note { padding: 14px 24px 22px; font-size: 13px; line-height: 1.45; color: #3B352F; max-width: 74ch; }
  .note b { font-weight: 600; }
  a { color: inherit; } a:hover { color: var(--md-spot, inherit); }
${layouts[d.layout]}
  </style>
</helmet>
<div style="width: ${W}px; background: #DAD9D4; display: flex; flex-direction: column;">
  <div class="label">
    <div><b>${d.title}</b><br>${d.source}</div>
    <div class="sw"><i style="background: ${p.paper}"></i><i style="background: ${p.sunk}"></i><i style="background: ${p.rule}"></i><i style="background: ${p.muted}"></i><i style="background: ${p.ink}"></i><i style="background: ${p.spot}; margin-left: 8px"></i><span>${d.spotName} ${p.spot}</span></div>
  </div>
  <div style="padding: 0 24px;">
    <article class="md" data-md-theme="${d.key}" style="--md-spot: {{spot}}">
${body}
    </article>
  </div>
  <p class="note"><b>Layout.</b> ${d.note} <b>Contrast:</b> ${contrast}.</p>
</div>
</x-dc>
<script data-dc-script data-props='{"spot":{"editor":"color","default":"${p.spot}","section":"Theme"}}'>
class Component extends DCLogic {
  renderVals() { return { spot: this.props.spot ?? '${p.spot}' }; }
}
</script>
</body>
</html>
`;
  fs.writeFileSync(`${OUT}/${d.file}.dc.html`, doc);
  boards.push({ file: `${d.file}.dc.html`, title: d.title });
  console.log(d.file, contrast);
}

// merge into canvas.json as page-4
const canvas = JSON.parse(fs.readFileSync(`${OUT}/canvas.json`, 'utf8'));
canvas.pages = canvas.pages.filter(p => p.id !== 'page-4');
canvas.pages.push({ id: 'page-4', name: 'Directions' });
canvas.artboards = canvas.artboards.filter(a => a.page !== 'page-4');
canvas.annotations = (canvas.annotations || []).filter(a => a.page !== 'page-4');
const H = 1700;
boards.forEach((b, i) => {
  const col = i % 4, row = Math.floor(i / 4);
  canvas.artboards.push({ file: b.file, title: b.title, page: 'page-4', x: col * (W + 100), y: row * (H + 180), w: W, h: H });
});
canvas.annotations.push({ id: 'directions-note', page: 'page-4', x: 0, y: -560, w: 620,
  text: "Ten directions, A to J. Each is a complete theme token block over the real markdown.css plus one layout device, so a pick is a paste. A to D take the four museum palettes you named; E and F are the Amsterdam grotesk lineage; G is Copenhagen sign lettering; H and I are Paris, theatre and bookish; J is the museum after hours. The spot colour is a tweak on every one. Pick one, or name the palette from one and the layout from another." });
canvas.launch = { view: 'canvas', page: 'page-4' };
fs.writeFileSync(`${OUT}/canvas.json`, JSON.stringify(canvas, null, 2));
console.log('canvas.json updated:', canvas.artboards.length, 'artboards');
