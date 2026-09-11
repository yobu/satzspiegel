#!/usr/bin/env node
// Read the W3C Web Annotations out of returned review-edition files and print
// them as Markdown (default), JSON-LD (--json), or merged into a fresh copy of
// the document (--merge-into file.html, written next to it as *.merged.html).
//
//   node scripts/annotations.mjs review/*.annotated.html > comments.md
//   node scripts/annotations.mjs --json a.annotated.html b.annotated.html > all.json
//   node scripts/annotations.mjs --merge-into doc.html a.annotated.html b.annotated.html
import { readFileSync, writeFileSync } from 'node:fs';

const BLOCK = /<script[^>]*id="satzspiegel-annotations"[^>]*>([\s\S]*?)<\/script>/;
const args = process.argv.slice(2);
const json = args.includes('--json');
const mergeAt = args.indexOf('--merge-into');
const mergeInto = mergeAt >= 0 ? args[mergeAt + 1] : null;
const files = args.filter((a, i) => !a.startsWith('--') && (mergeAt < 0 || i !== mergeAt + 1));
if (!files.length) { console.error('usage: annotations.mjs [--json | --merge-into doc.html] file.annotated.html …'); process.exit(1); }

const read = f => {
  const m = readFileSync(f, 'utf8').match(BLOCK);
  if (!m) return [];
  try { const d = JSON.parse(m[1]); return Array.isArray(d.items) ? d.items.filter(valid) : []; } catch { return []; }
};
const valid = a => a && typeof a === 'object' && typeof a.id === 'string' && a.id.length < 200 && a.type === 'Annotation';
const seen = new Set(), items = [];
for (const f of files) for (const a of read(f)) if (a && a.id && !seen.has(a.id)) { seen.add(a.id); items.push(a); }

const body = a => { const b = Array.isArray(a.body) ? a.body[0] : a.body; return (b && b.value) || ''; };
const who = a => (a.creator && a.creator.name) || 'Anonymous';
const when = a => (a.modified || a.created || '').slice(0, 16).replace('T', ' ');
const quote = a => ([].concat(a.target && a.target.selector || []).find(s => s.type === 'TextQuoteSelector') || {}).exact;
const pos = a => (([].concat(a.target && a.target.selector || []).find(s => s.type === 'TextPositionSelector') || {}).start) ?? 1e12;
const isReply = a => typeof a.target === 'string';

if (mergeInto) {
  const html = readFileSync(mergeInto, 'utf8');
  if (!BLOCK.test(html)) { console.error(mergeInto + ' is not a review edition (no annotation block)'); process.exit(1); }
  const payload = JSON.stringify({ '@context': 'http://www.w3.org/ns/anno.jsonld', type: 'AnnotationCollection', total: items.length, items }, null, 1).replace(/</g, '\\u003c');
  const out = html.replace(BLOCK, (m, _) => m.replace(_, '\n' + payload + '\n'));
  const target = mergeInto.replace(/\.html?$/i, '') + '.merged.html';
  writeFileSync(target, out);
  console.error(`${items.length} comments from ${files.length} file(s) written into ${target}`);
} else if (json) {
  process.stdout.write(JSON.stringify({ '@context': 'http://www.w3.org/ns/anno.jsonld', type: 'AnnotationCollection', total: items.length, items }, null, 2) + '\n');
} else {
  const top = items.filter(a => !isReply(a)).sort((x, y) => pos(x) - pos(y));
  const lines = [`# Review comments (${top.length}, from ${files.length} file${files.length === 1 ? '' : 's'})`, ''];
  for (const a of top) {
    lines.push('> ' + (quote(a) || '(no passage)'), '', `**${who(a)}**, ${when(a)}: ${body(a)}`, '');
    const rs = items.filter(r => r.target === a.id);
    for (const r of rs) lines.push(`- **${who(r)}**, ${when(r)}: ${body(r)}`);
    if (rs.length) lines.push('');
  }
  process.stdout.write(lines.join('\n'));
}
