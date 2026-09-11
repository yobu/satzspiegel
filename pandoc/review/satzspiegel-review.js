/* satzspiegel-review.js — the review edition of a Satzspiegel page.
   Reviewers select text and comment; comments are stored inside the file as
   W3C Web Annotations (JSON-LD in a script element, as the W3C note
   "Embedding Web Annotations in HTML" prescribes); "Save a copy" downloads
   the document with the annotations inside it. No server, no network.

   Anchoring: TextQuoteSelector (exact, prefix, suffix) with a
   TextPositionSelector hint, resolved against the whitespace-normalised text
   of the .md element. Highlights use the CSS Custom Highlight API, so the
   document's DOM is never modified and the anchors stay stable.
   Requires: Chrome/Edge 105, Safari 17.2, Firefox 140 for highlights; older
   browsers still list the comments and their quotes. No dependencies. */
(function () {
  'use strict';

  const CONTEXT = 'http://www.w3.org/ns/anno.jsonld';
  const BLOCK_ID = 'satzspiegel-annotations';
  const CONTEXT_CHARS = 32;

  const md = document.querySelector('main.md, .md');
  const block = document.getElementById(BLOCK_ID);
  if (!md || !block) return;

  /* The document as it was loaded, before this script adds any UI. Saving
     rewrites only the annotation block inside this string. */
  const pristine = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;

  const source = document.title || location.pathname.split('/').pop() || 'document';
  // An annotation is kept only if it has the shape the layer writes; anything
  // else in a merged file is ignored rather than rendered.
  const valid = a => a && typeof a === 'object' && typeof a.id === 'string' && a.id.length < 200 && a.type === 'Annotation'
    && (typeof a.target === 'string' || (a.target && typeof a.target === 'object'));

  let items = readBlock(block);
  let author = localStorage.getItem('satzspiegel-review-author') || '';
  let active = null;              // id of the highlighted card
  let index = null;               // text index of .md
  const anchors = new Map();      // id -> Range or null (orphan)
  const supportsHighlights = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight === 'function';

  /* ---------------- text index and selectors ---------------- */

  function buildIndex(root) {
    // Concatenate every text node under root, collapsing runs of whitespace
    // to a single space, and remember which node and offset each emitted
    // character came from, so an index position maps back to a DOM point.
    const nodes = [], offsets = [];
    let text = '';
    let lastSpace = true;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || p.closest('script, style, .sz-review')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodeMaps = new Map(); // node -> Int32Array: char offset -> index (or -1)
    let n;
    while ((n = walker.nextNode())) {
      const s = n.data;
      const map = new Int32Array(s.length + 1);
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (/\s/.test(c)) {
          if (lastSpace) { map[i] = -1; continue; }
          text += ' '; nodes.push(n); offsets.push(i); map[i] = text.length - 1; lastSpace = true;
        } else {
          text += c; nodes.push(n); offsets.push(i); map[i] = text.length - 1; lastSpace = false;
        }
      }
      map[s.length] = text.length; // end-of-node points at the next index
      nodeMaps.set(n, map);
    }
    return { text, nodes, offsets, nodeMaps };
  }

  function pointToIndex(idx, node, offset) {
    // Map a DOM point to an index position. Element points resolve to the
    // first text node at or after the offset.
    if (node.nodeType === Node.TEXT_NODE) {
      const map = idx.nodeMaps.get(node);
      if (!map) return -1;
      for (let i = offset; i <= node.data.length; i++) if (map[i] >= 0) return map[i];
      return -1;
    }
    const child = node.childNodes[offset];
    const walker = document.createTreeWalker(md, NodeFilter.SHOW_TEXT);
    if (child) { walker.currentNode = child; const t = child.nodeType === 3 ? child : walker.nextNode(); return t ? pointToIndex(idx, t, 0) : idx.text.length; }
    // offset at end of element: first text node after it
    const after = document.createTreeWalker(md, NodeFilter.SHOW_TEXT);
    after.currentNode = node;
    let t; while ((t = after.nextNode())) if (!node.contains(t)) return pointToIndex(idx, t, 0);
    return idx.text.length;
  }

  function indexToRange(idx, start, end) {
    if (start < 0 || end > idx.text.length || start >= end) return null;
    const r = document.createRange();
    r.setStart(idx.nodes[start], idx.offsets[start]);
    r.setEnd(idx.nodes[end - 1], idx.offsets[end - 1] + 1);
    return r;
  }

  function describe(idx, start, end) {
    return {
      quote: { type: 'TextQuoteSelector', exact: idx.text.slice(start, end),
               prefix: idx.text.slice(Math.max(0, start - CONTEXT_CHARS), start),
               suffix: idx.text.slice(end, end + CONTEXT_CHARS) },
      position: { type: 'TextPositionSelector', start, end }
    };
  }

  function resolve(idx, target) {
    // Find the passage a target describes. All occurrences of the exact
    // quote are scored by how much of the prefix and suffix match, then by
    // closeness to the stored position.
    const sels = [].concat(target && target.selector || []);
    const quote = sels.find(s => s.type === 'TextQuoteSelector');
    const pos = sels.find(s => s.type === 'TextPositionSelector');
    if (!quote || !quote.exact) return null;
    const exact = quote.exact.replace(/\s+/g, ' ');
    const hits = [];
    for (let i = idx.text.indexOf(exact); i >= 0; i = idx.text.indexOf(exact, i + 1)) hits.push(i);
    if (!hits.length) return null;
    const tail = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++; return n; };
    const head = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n++; return n; };
    let best = null, bestScore = -1;
    for (const h of hits) {
      const p = idx.text.slice(Math.max(0, h - CONTEXT_CHARS), h), s = idx.text.slice(h + exact.length, h + exact.length + CONTEXT_CHARS);
      let score = tail(p, (quote.prefix || '').replace(/\s+/g, ' ')) + head(s, (quote.suffix || '').replace(/\s+/g, ' '));
      if (pos) score -= Math.min(20, Math.abs(h - pos.start) / 1000);
      if (score > bestScore) { bestScore = score; best = h; }
    }
    return indexToRange(idx, best, best + exact.length);
  }

  /* ---------------- storage ---------------- */

  function readBlock(el) {
    try {
      const data = JSON.parse(el.textContent || '{}');
      return (Array.isArray(data.items) ? data.items : (data.type === 'Annotation' ? [data] : [])).filter(valid);
    } catch (e) { console.warn('satzspiegel-review: annotation block unreadable', e); return []; }
  }

  function collection() {
    return { '@context': CONTEXT, type: 'AnnotationCollection', total: items.length, items };
  }

  function serialise() {
    // Every '<' becomes \u003c: JSON stays valid and nothing inside the payload
    // can close the script element or open a comment.
    const json = JSON.stringify(collection(), null, 1).replace(/</g, '\\u003c');
    const re = new RegExp('(<script[^>]*id="' + BLOCK_ID + '"[^>]*>)[\\s\\S]*?(</script>)');
    if (!re.test(pristine)) throw new Error('annotation block not found in document');
    return pristine.replace(re, (m, open, close) => open + '\n' + json + '\n' + close);
  }

  function extractFromHtml(html) {
    const m = html.match(new RegExp('<script[^>]*id="' + BLOCK_ID + '"[^>]*>([\\s\\S]*?)</script>'));
    if (!m) return [];
    try { const d = JSON.parse(m[1]); return Array.isArray(d.items) ? d.items.filter(valid) : []; } catch (e) { return []; }
  }

  async function saveCopy() {
    const html = serialise();
    const base = (location.pathname.split('/').pop() || 'document').replace(/\.html?$/i, '').replace(/\.annotated$/, '');
    const name = base + '.annotated.html';
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'HTML', accept: { 'text/html': ['.html'] } }] });
        const w = await handle.createWritable(); await w.write(html); await w.close();
        toast('Saved ' + handle.name); return;
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    download(html, name, 'text/html');
    toast('Saved a copy as ' + name + ' in your downloads folder');
  }

  function download(content, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function exportJson() { download(JSON.stringify(collection(), null, 2), source.replace(/\W+/g, '-') + '.annotations.json', 'application/ld+json'); }

  function exportMarkdown() {
    const lines = ['# Review comments: ' + source, ''];
    for (const a of topLevel()) {
      const q = quoteOf(a);
      lines.push('> ' + (q ? q.exact : '(no passage)'), '', '**' + who(a) + '**, ' + when(a) + ': ' + bodyText(a), '');
      for (const r of replies(a.id)) lines.push('- **' + who(r) + '**, ' + when(r) + ': ' + bodyText(r));
      if (replies(a.id).length) lines.push('');
    }
    download(lines.join('\n'), source.replace(/\W+/g, '-') + '.comments.md', 'text/markdown');
  }

  function mergeFiles(files) {
    let added = 0;
    Promise.all([...files].map(f => f.text())).then(texts => {
      for (const t of texts) for (const a of extractFromHtml(t)) if (!items.some(x => x.id === a.id)) { items.push(a); added++; }
      anchorAll(); render();
      toast(added + ' comment' + (added === 1 ? '' : 's') + ' merged from ' + texts.length + ' file' + (texts.length === 1 ? '' : 's'));
    });
  }

  /* ---------------- model helpers ---------------- */

  const bodyText = a => { const b = Array.isArray(a.body) ? a.body[0] : a.body; return b && (b.value || '') || ''; };
  const who = a => (a.creator && a.creator.name) || 'Anonymous';
  const when = a => { const d = new Date(a.modified || a.created); return isNaN(d) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); };
  const quoteOf = a => { const sels = [].concat(a.target && a.target.selector || []); return sels.find(s => s.type === 'TextQuoteSelector'); };
  const isReply = a => typeof a.target === 'string' && a.target.startsWith('urn:uuid:');
  const topLevel = () => items.filter(a => !isReply(a)).sort((x, y) => (posOf(x) - posOf(y)));
  const replies = id => items.filter(a => a.target === id).sort((x, y) => (x.created || '').localeCompare(y.created || ''));
  const posOf = a => { const r = anchors.get(a.id); if (r) { const p = r.getBoundingClientRect(); return p.top + window.scrollY; } return 1e12; };
  const uuid = () => 'urn:uuid:' + (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

  function newAnnotation(start, end, text) {
    const sel = describe(index, start, end);
    return {
      id: uuid(), type: 'Annotation', motivation: 'commenting',
      creator: { type: 'Person', name: author || 'Anonymous' },
      created: new Date().toISOString(),
      body: { type: 'TextualBody', value: text, format: 'text/plain' },
      target: { source, selector: [sel.quote, sel.position] }
    };
  }

  function newReply(parentId, text) {
    return {
      id: uuid(), type: 'Annotation', motivation: 'replying',
      creator: { type: 'Person', name: author || 'Anonymous' },
      created: new Date().toISOString(),
      body: { type: 'TextualBody', value: text, format: 'text/plain' },
      target: parentId
    };
  }

  /* ---------------- anchoring and highlights ---------------- */

  function anchorAll() {
    index = buildIndex(md);
    anchors.clear();
    for (const a of items) if (!isReply(a)) anchors.set(a.id, resolve(index, a.target));
    paint();
  }

  function paint() {
    if (!supportsHighlights) return;
    const all = [], act = [];
    for (const [id, r] of anchors) if (r) (id === active ? act : all).push(r);
    CSS.highlights.set('sz-note', new Highlight(...all));
    CSS.highlights.set('sz-note-active', new Highlight(...act));
  }

  /* ---------------- UI ---------------- */

  // Re-run the layout whenever a card changes size: an editor opening or
  // closing, a textarea being resized, a quote expanding. Position changes
  // do not fire it, so there is no feedback loop.
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;

  const ui = el('div', 'sz-review');
  const bar = el('div', 'sz-bar');
  const notes = el('aside', 'sz-notes');
  const fab = el('button', 'sz-fab', 'Comment');
  fab.type = 'button'; fab.hidden = true;
  ui.append(bar, notes, fab);
  document.body.appendChild(ui);
  copyTokens();

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function copyTokens() {
    const cs = getComputedStyle(md);
    for (const t of ['paper', 'paper-sunk', 'ink', 'ink-muted', 'ink-faint', 'rule', 'spot', 'face-text', 'face-display', 'face-mono']) {
      ui.style.setProperty('--md-' + t, cs.getPropertyValue('--md-' + t));
    }
  }

  function renderBar() {
    bar.replaceChildren();
    const name = el('label', 'sz-name');
    name.append('Your name ');
    const input = el('input'); input.type = 'text'; input.value = author; input.placeholder = 'shown on your comments';
    input.addEventListener('change', () => { author = input.value.trim(); localStorage.setItem('satzspiegel-review-author', author); });
    name.appendChild(input);
    const count = el('span', 'sz-count', countText());
    const save = button('Save a copy', saveCopy, 'sz-primary');
    const merge = button('Merge files…', () => fileInput.click());
    const fileInput = el('input'); fileInput.type = 'file'; fileInput.accept = '.html,.htm'; fileInput.multiple = true; fileInput.hidden = true;
    fileInput.addEventListener('change', () => { if (fileInput.files.length) mergeFiles(fileInput.files); fileInput.value = ''; });
    const more = el('details', 'sz-more'); const sum = el('summary', null, 'Export'); const menu = el('div', 'sz-menu');
    menu.append(button('Comments as JSON-LD', exportJson), button('Comments as Markdown', exportMarkdown));
    more.append(sum, menu);
    more.addEventListener('click', e => { if (e.target.closest('.sz-menu button')) more.removeAttribute('open'); });
    bar.append(name, count, save, merge, more, fileInput);
  }

  function countText() {
    const n = topLevel().length, o = [...anchors.values()].filter(r => !r).length;
    return n === 0 ? 'No comments yet. Select text to comment.' : n + ' comment' + (n === 1 ? '' : 's') + (o ? ', ' + o + ' not found in this version' : '');
  }

  function button(label, fn, cls) { const b = el('button', 'sz-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.addEventListener('click', fn); return b; }

  function render() {
    renderBar();
    notes.replaceChildren();
    const list = topLevel();
    if (!list.length) { notes.classList.add('sz-empty'); return; }
    notes.classList.remove('sz-empty');
    for (const a of list) notes.appendChild(card(a));
    if (ro) { ro.disconnect(); notes.querySelectorAll('.sz-card').forEach(c => ro.observe(c)); }
    layout();
  }

  function card(a) {
    const c = el('article', 'sz-card' + (a.id === active ? ' sz-active' : '') + (anchors.get(a.id) ? '' : ' sz-orphan'));
    c.dataset.id = a.id;
    const q = quoteOf(a);
    const quote = el('p', 'sz-quote', q ? q.exact : '');
    if (!anchors.get(a.id)) quote.append(el('span', 'sz-orphan-note', ' — passage not found in this version'));
    const meta = el('p', 'sz-meta'); meta.append(el('b', null, who(a)), ' ' + when(a));
    const text = el('p', 'sz-text', bodyText(a));
    c.append(quote, meta, text);
    for (const r of replies(a.id)) {
      const rc = el('div', 'sz-reply');
      const rm = el('p', 'sz-meta'); rm.append(el('b', null, who(r)), ' ' + when(r));
      rc.append(rm, el('p', 'sz-text', bodyText(r)));
      c.appendChild(rc);
    }
    const actions = el('p', 'sz-actions');
    actions.append(button('Reply', () => editor(c, '', t => { items.push(newReply(a.id, t)); render(); })));
    actions.append(button('Edit', () => editor(c, bodyText(a), t => { a.body = { type: 'TextualBody', value: t, format: 'text/plain' }; a.modified = new Date().toISOString(); render(); })));
    actions.append(button('Delete', () => { if (confirm('Delete this comment' + (replies(a.id).length ? ' and its replies' : '') + '?')) { items = items.filter(x => x.id !== a.id && x.target !== a.id); anchorAll(); render(); } }));
    c.appendChild(actions);
    c.addEventListener('click', e => { if (e.target.closest('button, textarea')) return; activate(a.id, true); });
    return c;
  }

  function editor(container, initial, onSave) {
    const old = container.querySelector('.sz-editor'); if (old) old.remove();
    const f = el('form', 'sz-editor');
    const ta = el('textarea'); ta.value = initial; ta.rows = 3; ta.placeholder = 'Your comment';
    const ok = button('Save comment', () => { const t = ta.value.trim(); if (!t) return; f.remove(); onSave(t); if (!author) { toast('Add your name in the bar so colleagues can see who commented.'); bar.querySelector('input[type=text]').focus(); } }, 'sz-primary');
    const cancel = button('Cancel', () => { f.remove(); if (container.classList.contains('sz-new')) { container.remove(); layout(); } });
    f.addEventListener('submit', e => { e.preventDefault(); ok.click(); });
    ta.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') ok.click(); if (e.key === 'Escape') cancel.click(); });
    f.append(ta, el('div', 'sz-actions', ''), ok, cancel);
    container.appendChild(f); layout(); ta.focus();
    return f;
  }

  function activate(id, scroll) {
    active = id; paint();
    notes.querySelectorAll('.sz-card').forEach(c => c.classList.toggle('sz-active', c.dataset.id === id));
    if (scroll) { const r = anchors.get(id); if (r) { const top = r.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3; window.scrollTo({ top, behavior: 'smooth' }); } }
    layout();
  }

  function layout() {
    // Cards sit beside the passage they comment on, pushed down when they
    // would overlap; orphans go to the end. Only in the wide layout.
    const wide = getComputedStyle(notes).position === 'absolute';
    const cards = [...notes.querySelectorAll('.sz-card')];
    if (!wide) { cards.forEach(c => { c.style.top = ''; }); notes.style.height = ''; return; }
    const noteTop = notes.getBoundingClientRect().top + window.scrollY;
    let y = 0;
    const placed = cards.map(c => {
      const r = anchors.get(c.dataset.id);
      const want = r ? r.getBoundingClientRect().top + window.scrollY - noteTop : Infinity;
      return { c, want };
    }).sort((a, b) => a.want - b.want);
    for (const p of placed) {
      const top = Math.max(y, isFinite(p.want) ? p.want : y);
      p.c.style.top = top + 'px';
      y = top + p.c.offsetHeight + 12;
    }
    notes.style.height = y + 'px';
  }

  /* ---------------- selection to comment ---------------- */

  let pending = null; // { start, end } of the current selection in index space

  function onSelectionChange() {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { fab.hidden = true; pending = null; return; }
    const r = sel.getRangeAt(0);
    if (!md.contains(r.commonAncestorContainer) || ui.contains(r.commonAncestorContainer)) { fab.hidden = true; pending = null; return; }
    const start = pointToIndex(index, r.startContainer, r.startOffset), end = pointToIndex(index, r.endContainer, r.endOffset);
    if (start < 0 || end <= start) { fab.hidden = true; pending = null; return; }
    pending = { start, end };
    const rect = r.getBoundingClientRect();
    fab.style.left = Math.max(8, rect.right + window.scrollX - fab.offsetWidth) + 'px';
    fab.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    fab.hidden = false;
  }

  fab.addEventListener('mousedown', e => e.preventDefault());
  fab.addEventListener('click', () => {
    if (!pending) return;
    const { start, end } = pending;
    fab.hidden = true; document.getSelection().removeAllRanges();
    const draft = newAnnotation(start, end, '');
    anchors.set(draft.id, indexToRange(index, start, end));
    active = draft.id; paint();
    const c = el('article', 'sz-card sz-active sz-new'); c.dataset.id = draft.id;
    c.append(el('p', 'sz-quote', quoteOf(draft).exact));
    notes.classList.remove('sz-empty'); notes.appendChild(c); if (ro) ro.observe(c); layout();
    editor(c, '', t => { draft.body.value = t; items.push(draft); render(); activate(draft.id, false); });
    c.querySelector('.sz-editor button.sz-btn:last-child').addEventListener('click', () => { anchors.delete(draft.id); active = null; paint(); });
  });

  md.addEventListener('click', e => {
    if (!document.getSelection().isCollapsed) return;
    let pos = null;
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(e.clientX, e.clientY); if (p) pos = { node: p.offsetNode, offset: p.offset }; }
    else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(e.clientX, e.clientY); if (r) pos = { node: r.startContainer, offset: r.startOffset }; }
    if (!pos) return;
    for (const [id, r] of anchors) {
      if (!r) continue;
      try { if (r.comparePoint(pos.node, pos.offset) === 0) { activate(id, false); return; } } catch (err) { /* point outside range's tree */ }
    }
  });

  document.addEventListener('selectionchange', () => { clearTimeout(onSelectionChange.t); onSelectionChange.t = setTimeout(onSelectionChange, 120); });
  window.addEventListener('resize', () => { clearTimeout(layout.t); layout.t = setTimeout(layout, 100); });
  window.addEventListener('beforeprint', () => ui.classList.add('sz-printing'));
  window.addEventListener('afterprint', () => ui.classList.remove('sz-printing'));

  function toast(msg) {
    let t = ui.querySelector('.sz-toast'); if (!t) { t = el('div', 'sz-toast'); ui.appendChild(t); }
    t.textContent = msg; t.classList.add('sz-show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('sz-show'), 4000);
  }

  /* ---------------- start ---------------- */

  document.fonts && document.fonts.ready.then(() => { anchorAll(); render(); });
  anchorAll(); render();
  if (!supportsHighlights) toast('This browser cannot show highlights; comments are listed with their quoted passages.');

  window.satzspiegelReview = { get items() { return items; }, anchors, serialise, resolveAll: anchorAll };
})();
