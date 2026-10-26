/* satzspiegel-review.js — the review edition of a Satzspiegel page.
   Reviewers select text and comment; comments are stored inside the file as
   W3C Web Annotations (JSON-LD in a script element, as the W3C note
   "Embedding Web Annotations in HTML" prescribes); "Save a copy" downloads
   the document with the annotations inside it. No server, no network.

   Anchoring: TextQuoteSelector (exact, prefix, suffix) with a
   TextPositionSelector hint, resolved against the whitespace-normalised text
   of the .md element. Commented passages are marked with lines drawn in a
   layer of their own from the rectangles of each anchor range, so the
   document's DOM is never modified and the anchors stay stable.
   No dependencies. */
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
  // else in a merged file is ignored rather than rendered. Kept comments come
  // back on every visit, so a malformed one must never get in.
  const isStr = v => typeof v === 'string', obj = v => v && typeof v === 'object';
  const strings = (o, keys) => keys.every(k => o[k] === undefined || isStr(o[k]));
  const valid = a => obj(a) && isStr(a.id) && a.id.length < 200 && a.type === 'Annotation'
    && strings(a, ['created', 'modified']) && (a.creator === undefined || (obj(a.creator) && strings(a.creator, ['name'])))
    && (a.body === undefined || [].concat(a.body).every(b => obj(b) && strings(b, ['value'])))
    && (isStr(a.target) || (obj(a.target) && (a.target.selector === undefined
      || [].concat(a.target.selector).every(x => obj(x) && strings(x, ['type', 'exact', 'prefix', 'suffix'])))));

  let items = readBlock(block);
  const blockText = block.textContent;
  // localStorage, or null where the browser refuses it (a private window,
  // blocked site data, some browsers on file://).
  const store = (() => { try { const s = window.localStorage, k = 'satzspiegel-review-probe'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (e) { return null; } })();
  let author = (store && store.getItem('satzspiegel-review-author')) || '';
  let active = null;              // id of the comment joined to its passage by the leader
  let index = null;               // text index of .md
  const anchors = new Map();      // id -> Range or null (orphan)

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
    // \u0023 is the heading mark. A literal one would end this script early
    // where Pandoc 3.12 embeds it as a data: URL without encoding the mark.
    const lines = ['\u0023 Review comments: ' + source, ''];
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
      anchorAll(); render(); persist.now();
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

  /* ---------------- anchoring and marks ---------------- */

  function anchorAll() {
    index = buildIndex(md);
    anchors.clear();
    for (const a of items) {
      if (isReply(a)) continue;
      try { anchors.set(a.id, resolve(index, a.target)); } catch (e) { anchors.set(a.id, null); }
    }
    drawMarks();
  }

  // Distance from the top of a run of text to its baseline, per font: a
  // zero-height inline-block set beside the text sits on the baseline.
  const metricCache = new Map();
  function metrics(node) {
    const cs = getComputedStyle(node);
    const key = [cs.fontStyle, cs.fontWeight, cs.fontSize, cs.fontFamily].join('|');
    let m = metricCache.get(key);
    if (m) return m;
    const probe = el('div', 'sz-probe');
    Object.assign(probe.style, { fontStyle: cs.fontStyle, fontWeight: cs.fontWeight, fontSize: cs.fontSize, fontFamily: cs.fontFamily });
    const text = el('span', null, 'Hg'), base = el('span');
    base.style.cssText = 'display:inline-block;width:0;height:0';
    probe.append(text, base); ui.appendChild(probe);
    m = { asc: base.getBoundingClientRect().top - text.getBoundingClientRect().top, size: parseFloat(cs.fontSize) };
    probe.remove(); metricCache.set(key, m);
    return m;
  }

  // One box per visual line of a range, in viewport coordinates: its left
  // and right edge, and y, where the mark goes: 0.3 em below the baseline of
  // the line's own text, under the descenders and clear of a link's
  // underline. A superscript joins the line it stands on.
  function lineBoxes(range) {
    const parts = [], clips = new Map();
    let root = range.commonAncestorContainer;
    if (root.nodeType === 3) root = root.parentNode;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!range.intersectsNode(n) || n.parentElement.closest('.sz-review')) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      if (n === range.startContainer) r.setStart(n, range.startOffset);
      if (n === range.endContainer) r.setEnd(n, range.endOffset);
      if (!r.toString().trim()) continue;
      const m = metrics(n.parentElement), clip = clipOf(n.parentElement, clips);
      for (const c of r.getClientRects()) {
        // Inside a block that scrolls sideways (code, a wide table), only
        // what shows in the block gets a mark.
        const left = clip ? Math.max(c.left, clip.left) : c.left, right = clip ? Math.min(c.right, clip.right) : c.right;
        if (right - left < 0.5) continue;
        parts.push({ left, right, top: c.top, bottom: c.bottom, y: Math.round(c.top + m.asc + 0.3 * m.size) });
      }
    }
    parts.sort((a, b) => a.top - b.top);
    const lines = [];
    for (const p of parts) {
      const l = lines.find(l => Math.min(l.bottom, p.bottom) - Math.max(l.top, p.top) > 0.4 * Math.min(l.bottom - l.top, p.bottom - p.top));
      if (!l) { lines.push({ ...p }); continue; }
      l.left = Math.min(l.left, p.left); l.right = Math.max(l.right, p.right);
      l.top = Math.min(l.top, p.top); l.bottom = Math.max(l.bottom, p.bottom); l.y = Math.max(l.y, p.y);
    }
    return lines.sort((a, b) => a.y - b.y);
  }

  // The visible width of the nearest ancestor inside the document that does
  // not let its content show beyond its edges, or null.
  function clipOf(node, cache) {
    if (cache.has(node)) return cache.get(node);
    let clip = null;
    for (let e = node; e && e !== md; e = e.parentElement) {
      if (getComputedStyle(e).overflowX === 'visible') continue;
      const r = e.getBoundingClientRect();
      clip = { left: r.left + e.clientLeft, right: r.left + e.clientLeft + e.clientWidth };
      break;
    }
    cache.set(node, clip);
    return clip;
  }

  function drawMarks() {
    // Saved comments: a dotted line in muted ink. The active comment and the
    // selection waiting to become one: a solid line in the spot colour. Then
    // the one leader, from the passage's first line across to the comment or
    // the waiting line, drawn only when the two are level.
    marks.replaceChildren();
    const o = marks.getBoundingClientRect();
    const line = (cls, id, left, right, y) => {
      const m = el('div', cls);
      if (id) m.dataset.id = id;
      Object.assign(m.style, { left: (left - o.left) + 'px', width: Math.max(0, right - left) + 'px', top: (y - o.top) + 'px' });
      marks.appendChild(m);
    };
    for (const [id, r] of anchors) {
      if (!r) continue;
      const strong = id === active || id === hover;
      for (const l of lineBoxes(r)) line('sz-mark' + (strong ? ' sz-strong' : ''), id, l.left, l.right, l.y - (strong ? 1 : 0));
    }
    if (pending) for (const l of lineBoxes(pending)) line('sz-mark sz-strong sz-pending', null, l.left, l.right, l.y - 1);
    if (!wide()) return;
    const id = active || hover;
    const lead = pending ? notes.querySelector('.sz-wait') : id ? [...notes.children].find(n => n.dataset.id === id) : null;
    const range = pending || (id && anchors.get(id));
    if (!lead || !range) return;
    const first = lineBoxes(range)[0];
    const level = notes.getBoundingClientRect().top + parseFloat(lead.style.top || 0) + Number(lead.dataset.hang);
    if (first && Math.abs(level - first.y) < 1.5) line('sz-leader' + (pending ? ' sz-dotted' : ''), null, first.right, lead.getBoundingClientRect().right, first.y);
  }

  /* ---------------- UI ---------------- */

  const wide = () => matchMedia('(min-width: 80rem)').matches;
  // From the top of a comment, or of the waiting line, to its ruled line.
  const HANG = { note: 23, wait: 43 };

  // Re-run the layout whenever a comment changes size: an editor opening or
  // growing, a reply added. Position changes do not fire it, so there is no
  // feedback loop.
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { layout(); drawMarks(); }) : null;

  const ui = el('div', 'sz-review');
  const bar = el('div', 'sz-bar');
  const notes = el('aside', 'sz-notes');
  notes.setAttribute('aria-label', 'Comments');
  const marks = el('div', 'sz-marks');
  marks.setAttribute('aria-hidden', 'true');
  const toastBox = el('div', 'sz-toast');
  toastBox.setAttribute('role', 'status');
  // Narrow screens: one comment field docked at the foot of the screen, and
  // the line that runs from the passage to the edge of the text and down to it.
  const field = el('div', 'sz-field');
  field.hidden = true;
  const fieldThread = el('div', 'sz-field-thread');
  const fieldTa = el('textarea', 'sz-ruled');
  fieldTa.rows = 1; fieldTa.placeholder = 'Write a comment';
  fieldTa.setAttribute('aria-label', 'Comment on the selection');
  const fieldStatus = el('span', 'sz-status');
  fieldStatus.setAttribute('aria-live', 'polite');
  const fieldFoot = el('p', 'sz-foot');
  const fieldActs = el('p', 'sz-actions');
  field.append(fieldThread, fieldTa, fieldFoot, fieldActs);
  const guide = el('div', 'sz-guide');
  guide.setAttribute('aria-hidden', 'true');
  ui.append(bar, notes, marks, field, guide, toastBox);
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
    input.addEventListener('change', () => setAuthor(input.value.trim()));
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
    const n = topLevel().length, o = topLevel().filter(a => !anchors.get(a.id)).length;
    if (n === 0) return matchMedia('(hover: none)').matches ? 'Select a passage to comment' : 'Select a passage and start typing to comment';
    return n + ' comment' + (n === 1 ? '' : 's') + (o ? ', ' + o + ' not found in this version' : '') +
      (storageKey && !keepFailed ? ', kept in this browser until you save a copy' : '');
  }

  function button(label, fn, cls) { const b = el('button', 'sz-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.addEventListener('click', fn); return b; }

  function render() {
    stale = false;
    // Focus goes to the comment when it has just been opened, or back to it
    // when it had the focus before this render; never otherwise, so a
    // lowered phone keyboard stays down.
    const f = document.activeElement;
    const refocus = open && (open.fresh || (f && f.closest && f.closest('.sz-editor')));
    renderBar();
    notes.replaceChildren();
    const list = topLevel();
    if (open && open.kind === 'comment' && !list.includes(open.a)) list.push(open.a);
    list.sort((x, y) => posOf(x) - posOf(y));
    for (const a of list) notes.appendChild(note(a));
    notes.classList.toggle('sz-empty', !list.length && !(pending && wide()));
    if (ro) { ro.disconnect(); for (const n of notes.children) ro.observe(n); }
    const ta = wide() ? notes.querySelector('.sz-editor textarea') : open && fieldTa;
    if (ta) autosize(ta);
    showPending();
    // Placed first, then focused without scrolling: a comment focused before
    // it is placed sits at the top of the column, and the browser would
    // scroll the page up to it.
    if (ta && refocus && document.activeElement !== ta) {
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
    if (open) open.fresh = false;
    if (wide()) { if (ta) keepInView(ta); }
    else if (fieldOn) keepAbove(open && document.activeElement === fieldTa ? 60 : 8);
  }

  let hover = null;              // id of the comment under the pointer or with focus
  const mine = new Set();        // ids of the comments and replies written in this browser
  const isMine = a => mine.has(a.id) || (!!author && who(a) === author);
  const byId = id => items.find(x => x.id === id) || (open && open.a.id === id ? open.a : null);

  function note(a) {
    const thread = open && threadOf(open) === a.id;
    const n = el('article', 'sz-note' + (a.id === active ? ' sz-active' : '') + (thread ? ' sz-open' : '') + (thread && open.isNew ? ' sz-drafting' : '') + (anchors.get(a.id) ? '' : ' sz-orphan'));
    n.dataset.id = a.id; n.dataset.hang = HANG.note;
    // The quote shows in the list at the end of a narrow page, in print, and
    // for a comment whose passage is gone; beside its passage it is hidden.
    const q = quoteOf(a), quote = el('p', 'sz-quote', q ? q.exact : '');
    if (!anchors.get(a.id)) quote.append(el('span', 'sz-orphan-note', ' — passage not found in this version'));
    n.appendChild(quote);
    // On a narrow screen the writing happens in the field; the list only reads.
    n.appendChild(open && open.a === a && wide() ? editor(open) : entry(a));
    for (const r of replies(a.id)) n.appendChild(open && open.a === r && wide() ? editor(open) : entry(r));
    if (thread && wide() && open.kind === 'reply' && !items.includes(open.a)) n.appendChild(editor(open));
    n.appendChild(el('p', 'sz-actions'));
    showActions(n, thread && open.kind === 'edit' ? open.a : a);
    n.addEventListener('mouseenter', () => { hover = a.id; drawMarks(); });
    n.addEventListener('mouseleave', () => { hover = null; drawMarks(); });
    n.addEventListener('focusin', () => { hover = a.id; if (wide() && active !== a.id) activate(a.id); else drawMarks(); });
    n.addEventListener('focusout', e => { if (!n.contains(e.relatedTarget) && hover === a.id) { hover = null; drawMarks(); } });
    n.addEventListener('click', e => {
      if (e.target.closest('.sz-editor, button')) return;
      if (!wide()) {
        // In the list at the end: go to the passage, and read it in the field.
        active = a.id; render();
        const r = anchors.get(a.id);
        if (r) window.scrollTo({ top: r.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3, behavior: 'smooth' });
        return;
      }
      // Your own words open for editing; anyone else's only come forward,
      // so a stray key never changes a colleague's comment.
      const en = e.target.closest('.sz-entry'), x = (en && byId(en.dataset.id)) || a;
      if (isMine(x)) { edit(x); return; }
      activate(a.id);
      showActions(n, x);
    });
    return n;
  }

  function entry(a) {
    const p = el('p', 'sz-entry' + (isReply(a) ? ' sz-reply' : ''));
    p.dataset.id = a.id;
    p.append(el('span', 'sz-by', who(a)), el('span', 'sz-text', bodyText(a)));
    return p;
  }

  function showActions(n, x) {
    // The quiet line under a thread: the time of the comment or reply last
    // clicked, and what can be done with it. It sits in the gap below the
    // thread, so showing it never moves the column.
    const acts = n.querySelector(':scope > .sz-actions');
    const thread = isReply(x) ? x.target : x.id;
    acts.replaceChildren(el('span', 'sz-when', when(x) || 'now'), button('Reply', () => startReply(thread)));
    acts.append(button('Edit', () => edit(x)));
    acts.append(button('Delete', () => removeEntry(x)));
    for (const e of n.querySelectorAll('.sz-entry')) e.classList.toggle('sz-target', e.dataset.id === x.id);
  }

  function editor(o) {
    const box = el('div', 'sz-editor');
    const ta = el('textarea', 'sz-ruled');
    ta.rows = 1; ta.value = bodyText(o.a); ta.placeholder = o.kind === 'reply' ? 'Reply' : 'Type to comment';
    const q = quoteOf(isReply(o.a) ? byId(o.a.target) || {} : o.a);
    ta.setAttribute('aria-label', q ? 'Comment on “' + (q.exact.length > 60 ? q.exact.slice(0, 59) + '…' : q.exact) + '”' : 'Comment');
    const status = el('span', 'sz-status', ta.value.trim() ? 'Saved' : 'Saved as you type');
    status.setAttribute('aria-live', 'polite');
    ta.addEventListener('input', () => edited(ta, status));
    const foot = el('p', 'sz-foot');
    foot.append(button('Cancel', cancelEditor, 'sz-cancel'), status, el('span', 'sz-hint', 'Esc to close'));
    box.append(ta, foot);
    return box;
  }

  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

  function activate(id) {
    active = id;
    if (!wide()) { render(); return; }
    for (const n of notes.querySelectorAll('.sz-note')) n.classList.toggle('sz-active', n.dataset.id === id);
    layout(); drawMarks();
  }

  function layout() {
    // The waiting line, or the active comment, sits exactly on its line; the
    // others are pushed up or down to make room, 18 px apart. Comments whose
    // passage is gone go to the end. Only in the wide layout.
    if (!wide()) { for (const n of notes.children) n.style.top = ''; notes.style.minHeight = ''; return; }
    const top0 = notes.getBoundingClientRect().top, gap = 18;
    const placed = [], lost = [];
    for (const node of notes.children) {
      const range = node.classList.contains('sz-wait') ? pending : anchors.get(node.dataset.id);
      const first = range && lineBoxes(range)[0];
      const it = { node, h: node.offsetHeight, pin: node.classList.contains('sz-wait') || node.dataset.id === active };
      if (first) { it.want = first.y - top0 - Number(node.dataset.hang); placed.push(it); } else lost.push(it);
    }
    placed.sort((x, y) => x.want - y.want);
    let p = placed.findIndex(x => x.node.classList.contains('sz-wait'));
    if (p < 0) p = placed.findIndex(x => x.pin);
    const stack = from => { for (let k = from; k < placed.length; k++) placed[k].top = k ? Math.max(placed[k].want, placed[k - 1].top + placed[k - 1].h + gap) : Math.max(placed[k].want, min); };
    const min = -(top0 + window.scrollY);   // the top of the page
    if (p < 0) stack(0);
    else {
      placed[p].top = placed[p].want;
      stack(p + 1);
      for (let k = p - 1; k >= 0; k--) placed[k].top = Math.min(placed[k].want, placed[k + 1].top - gap - placed[k].h);
      if (placed.length && placed[0].top < min) stack(0);   // no room above: the pinned one moves down
    }
    let y = 0;
    for (const it of placed) { it.node.style.top = it.top + 'px'; y = Math.max(y, it.top + it.h + gap); }
    for (const it of lost) { it.node.style.top = y + 'px'; y += it.h + gap; }
    notes.style.minHeight = y + 'px';
  }

  function keepInView(node) {
    // Scroll only if the node is outside what can be seen, and only by as
    // much as it takes. The visual viewport leaves out a touch keyboard.
    const vv = window.visualViewport, margin = 12;
    const head = getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect().bottom : 0;
    const top = Math.max(head, vv ? vv.offsetTop : 0), bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const r = node.getBoundingClientRect();
    let dy = 0;
    if (r.bottom > bottom - margin) dy = r.bottom - (bottom - margin);
    if (r.top - dy < top + margin) dy = r.top - (top + margin);
    if (Math.abs(dy) >= 1) window.scrollBy(0, dy);
  }

  function toast(msg, undo) {
    toastBox.replaceChildren(msg);
    if (undo) toastBox.append(' ', button('Undo', () => { toastBox.classList.remove('sz-show'); undo(); }));
    toastBox.classList.add('sz-show');
    clearTimeout(toast.t); toast.t = setTimeout(() => toastBox.classList.remove('sz-show'), 6000);
  }

  /* ---------------- writing ---------------- */

  // What is being written: { kind: 'comment' | 'reply' | 'edit', a, parent, isNew, before }.
  let open = null;
  const setBody = (a, text) => { a.body = { type: 'TextualBody', value: text, format: 'text/plain' }; };
  const threadOf = o => o.kind === 'reply' ? o.parent : isReply(o.a) ? o.a.target : o.a.id;

  function edit(x) {
    if (open && open.a === x) return;
    closeEditor(true);
    open = { kind: 'edit', a: x, isNew: false, before: bodyText(x), fresh: true };
    active = isReply(x) ? x.target : x.id;
    render();
  }

  function startReply(id) {
    closeEditor(true);
    open = { kind: 'reply', a: newReply(id, ''), parent: id, isNew: true, before: '', fresh: true };
    active = id;
    render();
  }

  function removeEntry(x, before) {
    // A comment goes with its replies, a reply alone; Undo puts them back.
    if (open && (open.a === x || (!isReply(x) && threadOf(open) === x.id))) open = null;
    const gone = isReply(x) ? [x] : [x, ...replies(x.id)];
    items = items.filter(i => !gone.includes(i));
    if (active === x.id) active = null;
    anchorAll(); render(); persist.now();
    toast(isReply(x) ? 'Reply deleted' : 'Comment deleted', () => {
      if (before != null) setBody(x, before);
      items.push(...gone); anchorAll(); render(); persist.now();
    });
  }

  function startComment(range) {
    closeEditor(true);
    const start = pointToIndex(index, range.startContainer, range.startOffset), end = pointToIndex(index, range.endContainer, range.endOffset);
    if (start < 0 || end <= start) return;
    const draft = newAnnotation(start, end, '');
    anchors.set(draft.id, indexToRange(index, start, end));
    pending = null; held = null;
    document.getSelection().removeAllRanges();
    open = { kind: 'comment', a: draft, isNew: true, before: '', fresh: true };
    active = draft.id;
    render();
  }

  function edited(ta, status) {
    // Saved with every keystroke: the first character that is not a space
    // puts a new comment into the list, an emptied new comment leaves it.
    const o = open, text = ta.value;
    setBody(o.a, text);
    if (o.isNew) {
      const listed = items.includes(o.a);
      if (text.trim() && !listed) {
        o.a.created = new Date().toISOString();
        o.a.creator = { type: 'Person', name: author || 'Anonymous' };
        items.push(o.a); mine.add(o.a.id);
      } else if (!text.trim() && listed) items.splice(items.indexOf(o.a), 1);
    }
    const said = text.trim() ? 'Saved' : 'Saved as you type';
    if (status.textContent !== said) status.textContent = said;
    bar.querySelector('.sz-count').textContent = countText();
    autosize(ta); layout(); drawMarks();
    if (wide()) keepInView(ta); else { drawGuide(); keepAbove(60); }
    persist();
  }

  function closeEditor(quiet) {
    if (!open) return;
    const o = open;
    open = null; active = null;
    if (!bodyText(o.a).trim()) {
      if (o.isNew) { if (o.kind === 'comment') anchors.delete(o.a.id); }
      else { removeEntry(o.a, o.before); return; }
    } else if (!o.isNew && bodyText(o.a) !== o.before) o.a.modified = new Date().toISOString();
    persist.now();
    if (o.isNew && bodyText(o.a).trim() && !author && !closeEditor.hinted) {
      closeEditor.hinted = true;
      toast('Add your name in the bar, so others can see who commented.');
    }
    if (!quiet) render();
  }

  function cancelEditor() {
    const o = open, text = bodyText(o.a);
    open = null; active = null;
    if (o.isNew) {
      const range = anchors.get(o.a.id);
      items = items.filter(x => x !== o.a);
      if (o.kind === 'comment') anchors.delete(o.a.id);
      render(); persist.now();
      if (text.trim()) toast(o.kind === 'reply' ? 'Reply discarded' : 'Comment discarded', () => { items.push(o.a); if (range) anchors.set(o.a.id, range); render(); persist.now(); });
    } else {
      setBody(o.a, o.before);
      render(); persist.now();
      if (text !== o.before) toast('Changes discarded', () => { setBody(o.a, text); render(); persist.now(); });
    }
  }

  /* ---------------- selection to comment ---------------- */

  let pending = null;       // the selection waiting to become a comment
  let held = null;          // the selection as it was when a pointer went down on the waiting line
  let pointerDown = false;

  function currentSelection() {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0).cloneRange();
    if (!md.contains(r.commonAncestorContainer) || ui.contains(r.commonAncestorContainer) || !r.toString().trim()) return null;
    // Trim spaces at both ends, so the marks cover the words only.
    const s = r.startContainer, e = r.endContainer;
    if (s.nodeType === 3) { let i = r.startOffset; while (i < s.length && /\s/.test(s.data[i])) i++; if (!(s === e && i >= r.endOffset)) r.setStart(s, i); }
    if (e.nodeType === 3) { let i = r.endOffset; while (i > 0 && /\s/.test(e.data[i - 1])) i--; if (!(s === e && i <= r.startOffset)) r.setEnd(e, i); }
    return r;
  }

  function settle() {
    const f = document.activeElement;
    if (f && ui.contains(f) && /^(TEXTAREA|INPUT)$/.test(f.tagName)) return;
    const r = currentSelection();
    if (!r && !pending) return;
    pending = r;
    if (r) active = null;
    render();
  }

  function showPending() {
    for (const w of notes.querySelectorAll('.sz-wait')) w.remove();
    if (pending && wide()) {
      const w = el('button', 'sz-wait');
      w.type = 'button'; w.dataset.hang = HANG.wait;
      w.setAttribute('aria-label', 'Comment on the selection');
      w.append(el('span', null, 'Type to comment'), el('small', null, 'or click here'));
      w.addEventListener('mousedown', e => e.preventDefault());
      w.addEventListener('click', () => { const r = held || currentSelection() || pending; held = null; if (r) startComment(r); });
      notes.appendChild(w);
      notes.classList.remove('sz-empty');
    }
    syncField();
    layout(); drawMarks(); drawGuide();
  }

  const typing = t => t && (/^(TEXTAREA|INPUT|SELECT)$/.test(t.tagName) || t.isContentEditable);

  // A finger keeps adjusting a selection by its handles after it lifts, and
  // iOS keeps reporting the changes; wait longer before acting on a touch.
  let pointerType = 'mouse', cancelled = false, downInside = false, stale = false;
  const quiet = () => pointerType === 'touch' ? 500 : 150;

  // A press outside the open comment closes it, quietly: the page is drawn
  // again only after the click that follows, so the click still reaches
  // the comment or button that was under the pointer.
  function closeOutside() {
    if (downInside) return;
    if (open) { closeEditor(true); stale = true; }
    else if (active && !wide()) { active = null; stale = true; }
  }
  document.addEventListener('pointerdown', e => {
    pointerDown = true; cancelled = false; pointerType = e.pointerType || 'mouse';
    const t = e.target;
    if (t.closest && t.closest('.sz-wait, .sz-field')) held = currentSelection() || pending;
    downInside = !!(t.closest && t.closest('.sz-note.sz-open, .sz-field, .sz-toast, .sz-bar'));
    // A touch may turn into a scroll; it closes nothing until it lifts as a tap.
    if (pointerType !== 'touch') closeOutside();
  }, true);
  document.addEventListener('pointerup', () => {
    pointerDown = false;
    if (pointerType === 'touch' && !cancelled) closeOutside();
    clearTimeout(settle.t); settle.t = setTimeout(settle, pointerType === 'touch' ? 500 : 10);
    if (stale) setTimeout(() => { if (stale) render(); });
  });
  // A touch that became a scroll never sends pointerup.
  document.addEventListener('pointercancel', () => {
    pointerDown = false; cancelled = true;
    clearTimeout(settle.t); settle.t = setTimeout(settle, quiet());
  });
  document.addEventListener('selectionchange', () => {
    if (pointerDown) return;
    clearTimeout(settle.t); settle.t = setTimeout(settle, quiet());
  });

  document.addEventListener('keydown', e => {
    const t = e.target;
    if (open && t.closest && (t.closest('.sz-editor') || t === fieldTa)) {
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); closeEditor(); }
      return;
    }
    const r = currentSelection() || pending;
    if (!r || typing(t) || e.metaKey || e.ctrlKey || e.altKey) return;
    // Keys meant for a link, a button or the bar stay theirs.
    if (t.closest && (t.closest('a, button, summary, [role="button"]') || ui.contains(t))) return;
    if (e.key === 'Escape') { document.getSelection().removeAllRanges(); return; }
    if (e.key === 'Enter') { e.preventDefault(); startComment(r); return; }
    // A printable key starts the comment. Focus moves to it during keydown
    // and the event is left alone, so the browser types the key there
    // itself: the first letter is kept, and accents, dead keys and input
    // methods work. The space bar keeps scrolling the page.
    if ((e.key.length === 1 && e.key !== ' ') || e.key === 'Dead') startComment(r);
  });

  md.addEventListener('click', e => {
    if (!document.getSelection().isCollapsed) return;
    let pos = null;
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(e.clientX, e.clientY); if (p) pos = { node: p.offsetNode, offset: p.offset }; }
    else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(e.clientX, e.clientY); if (r) pos = { node: r.startContainer, offset: r.startOffset }; }
    if (!pos) return;
    for (const [id, r] of anchors) {
      if (!r) continue;
      try {
        if (r.comparePoint(pos.node, pos.offset) !== 0) continue;
        // On a narrow screen a passage opens its comment to read first.
        const a = byId(id);
        if (a && isMine(a) && wide()) edit(a); else activate(id);
        return;
      } catch (err) { /* point outside range's tree */ }
    }
  });

  let wasWide = wide();
  window.addEventListener('resize', () => {
    clearTimeout(layout.t);
    layout.t = setTimeout(() => {
      if (wide() !== wasWide) { wasWide = wide(); render(); } else { layout(); drawMarks(); drawGuide(); }
    }, 100);
  });
  // The document reflows when an image arrives late or the column changes;
  // the marks follow.
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { clearTimeout(drawMarks.t); drawMarks.t = setTimeout(() => { layout(); drawMarks(); }, 60); }).observe(md);
  // A code block or wide table scrolled sideways moves the marks inside it.
  document.addEventListener('scroll', e => {
    if (e.target === document || !md.contains(e.target)) return;
    clearTimeout(drawMarks.s); drawMarks.s = setTimeout(() => { drawMarks(); drawGuide(); }, 30);
  }, { capture: true, passive: true });
  window.addEventListener('beforeprint', () => ui.classList.add('sz-printing'));
  window.addEventListener('afterprint', () => ui.classList.remove('sz-printing'));

  /* ---------------- narrow screens: the field ---------------- */

  let fieldOn = false;

  function syncField() {
    // Waiting while a passage is selected, writing while a comment is open,
    // reading while a comment is chosen; gone otherwise, and on wide screens.
    const thread = open ? byId(threadOf(open)) : active ? byId(active) : null;
    const on = !wide() && !!(open || pending || thread);
    if (!on) {
      if (fieldOn) {
        fieldOn = false;
        if (document.activeElement === fieldTa) fieldTa.blur();
        field.classList.remove('sz-writing');
        slide(false);
      }
      return;
    }
    fieldThread.replaceChildren();
    if (thread && items.includes(thread)) for (const x of [thread, ...replies(thread.id)]) if (!open || open.a !== x) fieldThread.appendChild(entry(x));
    const reading = !open && !!thread;
    field.classList.toggle('sz-open', !!open || reading);
    field.classList.toggle('sz-waiting', !open && !thread);
    fieldTa.hidden = reading;
    if (document.activeElement !== fieldTa) fieldTa.value = open ? bodyText(open.a) : '';
    fieldTa.placeholder = open && open.kind === 'reply' ? 'Reply' : 'Write a comment';
    const q = pending ? pending.toString() : thread && quoteOf(thread) ? quoteOf(thread).exact : '';
    fieldTa.setAttribute('aria-label', q ? 'Comment on “' + (q.length > 60 ? q.slice(0, 59) + '…' : q).replace(/\s+/g, ' ') + '”' : 'Comment');
    fieldStatus.textContent = open && bodyText(open.a).trim() ? 'Saved' : 'Saved as you type';
    if (!fieldFoot.firstChild) fieldFoot.append(button('Cancel', () => cancelEditor(), 'sz-cancel'), fieldStatus);
    // Reading, or editing something already there: what can be done with it.
    fieldActs.hidden = !(reading || (open && open.kind === 'edit'));
    if (!fieldActs.hidden) showActions(field, reading ? thread : open.a);
    if (!fieldOn) { fieldOn = true; slide(true); }
    autosize(fieldTa);
  }

  function slide(inn) {
    const t = slide.t = (slide.t || 0) + 1;
    if (inn) field.hidden = false;
    const done = () => { if (slide.t !== t) return; if (!inn) field.hidden = true; drawGuide(); };
    if (!field.animate) { done(); return; }
    field.animate(inn ? [{ transform: 'translateY(100%)' }, { transform: 'none' }] : [{ transform: 'none' }, { transform: 'translateY(100%)' }],
      { duration: inn ? 240 : 200, easing: 'cubic-bezier(.2, .8, .2, 1)', composite: 'add' }).onfinish = done;
  }

  // The bottom of what can be seen: above a touch keyboard where there is one.
  const visibleBottom = () => window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight;

  function drawGuide() {
    // From the end of the passage's last line to the edge of the text, then
    // straight down the margin to the field. Dotted while it is a selection.
    guide.replaceChildren();
    if (wide() || !fieldOn) return;
    const id = open ? threadOf(open) : active;
    const range = pending || (id && anchors.get(id));
    const L = range ? lineBoxes(range) : [];
    if (!L.length) return;
    const l = L[L.length - 1];
    const cs = getComputedStyle(md), pad = parseFloat(cs.paddingRight) || 0;
    const x = Math.round(md.getBoundingClientRect().right - pad + Math.min(8, pad / 2));
    const bottom = field.getBoundingClientRect().top;
    if (l.y > bottom - 4) return;
    const dotted = pending ? ' sz-dotted' : '';
    const seg = (cls, css) => { const d = el('div', cls + dotted); Object.assign(d.style, css); guide.appendChild(d); };
    if (l.y >= 0) seg('sz-guide-h', { left: l.right + 'px', width: Math.max(0, x + 1 - l.right) + 'px', top: l.y + 'px' });
    const top = Math.max(l.y, 0);
    seg('sz-guide-v', { left: x + 'px', top: top + 'px', height: Math.max(0, bottom - top) + 'px' });
  }

  function keepAbove(margin) {
    // Scroll only if the passage would be under the field (and the keyboard),
    // and only as far as it must: `margin` pixels of air above the field.
    const id = open ? threadOf(open) : active;
    const range = pending || (id && anchors.get(id));
    const L = range && !field.hidden ? lineBoxes(range) : [];
    if (!L.length) return;
    const fieldTop = visibleBottom() - field.offsetHeight, top = window.visualViewport ? window.visualViewport.offsetTop : 0;
    const last = L[L.length - 1].y, first = L[0].top;
    let dy = last > fieldTop - margin ? last - (fieldTop - margin) : 0;
    if (first - dy < top + 8) dy = first - top - 8;
    if (dy > 1) window.scrollBy({ top: dy, behavior: 'smooth' });
  }

  fieldTa.addEventListener('pointerdown', () => { if (!open) held = currentSelection() || pending; });
  fieldTa.addEventListener('focus', () => {
    if (!open) {
      // The comment begins when the reader taps into the field, not before.
      const r = held || currentSelection() || pending;
      held = null;
      if (!r) return;
      startComment(r);
    }
    field.classList.add('sz-writing');
    drawGuide();
  });
  fieldTa.addEventListener('blur', () => setTimeout(() => {
    // The keyboard went down: the comment stays open, Cancel waits for the next tap.
    if (document.activeElement !== fieldTa) { field.classList.remove('sz-writing'); drawGuide(); }
  }));
  fieldTa.addEventListener('input', () => edited(fieldTa, fieldStatus));
  field.addEventListener('click', e => {
    const en = e.target.closest('.sz-entry'), x = en && byId(en.dataset.id);
    if (x) { if (isMine(x)) edit(x); else showActions(field, x); return; }
    // The whole field is the place to tap, not only its one ruled line.
    if (!e.target.closest('button, textarea') && !fieldTa.hidden) fieldTa.focus({ preventScroll: true });
  });

  // A touch keyboard takes the lower part of the screen from the visual
  // viewport but not from the layout viewport the field is fixed to: lift
  // the field onto the keyboard, and once it settles keep the passage in view.
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const follow = () => {
      const lift = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      field.style.transform = lift > 1 ? 'translateY(' + (-lift) + 'px)' : '';
      drawGuide();
      clearTimeout(follow.t);
      follow.t = setTimeout(() => { if (document.activeElement === fieldTa) keepAbove(60); }, 150);
    };
    vv.addEventListener('resize', follow);
    vv.addEventListener('scroll', follow);
  }
  window.addEventListener('scroll', () => { if (fieldOn) drawGuide(); }, { passive: true });

  /* ---------------- kept in this browser ---------------- */

  // Every change is also written to localStorage, so a closed tab or a crash
  // loses nothing and the comments are there when the file is opened again.
  // The key is the address plus a fingerprint of the file as it came: its
  // text, its title and its own annotation block. An annotated or merged
  // copy, or a new render, is another file and starts from what it holds.
  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  const storageKey = store ? 'satzspiegel-review:' + location.href.split(/[?\u0023]/)[0] + ':' + hash(buildIndex(md).text + '\n' + document.title + '\n' + blockText) : '';

  function restore() {
    if (!storageKey) return;
    try {
      const kept = JSON.parse(store.getItem(storageKey) || 'null');
      if (!kept || !Array.isArray(kept.items)) return;
      // The kept set was made from this very file, so it replaces the
      // block's: deletions hold without anything to remember them by.
      items = kept.items.filter(valid);
      for (const id of kept.mine || []) mine.add(id);
    } catch (e) { /* unreadable: start from the file */ }
  }

  // Written only after a change: opening a file to read keeps nothing. A
  // set back to just what the file holds is removed, not kept.
  const canon = list => JSON.stringify(list.slice().sort((x, y) => x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  const fromFile = canon(items);
  let dirty = false, keepFailed = false;
  function persist() { dirty = true; clearTimeout(persist.t); persist.t = setTimeout(flush, 300); }
  persist.now = () => { dirty = true; flush(); };
  function flush() {
    clearTimeout(persist.t);
    if (!storageKey || !dirty) return;
    dirty = false;
    try {
      if (canon(items) === fromFile) store.removeItem(storageKey);
      else store.setItem(storageKey, JSON.stringify({ items, mine: [...mine], saved: new Date().toISOString() }));
      keepFailed = false;
    } catch (e) { keepFailed = true; /* full or refused: the page still holds them */ }
  }
  window.addEventListener('pagehide', flush);

  function setAuthor(name) {
    // A name entered later goes to the comments written in this browser
    // that still say Anonymous; nobody else's.
    author = name;
    try { if (store) store.setItem('satzspiegel-review-author', author); } catch (e) { /* not kept */ }
    if (author) for (const a of items) if (mine.has(a.id) && who(a) === 'Anonymous') a.creator = { type: 'Person', name: author };
    render(); persist.now();
  }

  /* ---------------- start ---------------- */

  restore();

  if (document.fonts) {
    document.fonts.ready.then(() => { metricCache.clear(); anchorAll(); render(); });
    document.fonts.addEventListener('loadingdone', () => { metricCache.clear(); layout(); drawMarks(); });
  }
  anchorAll(); render();

  window.satzspiegelReview = {
    get items() { return items; }, anchors, serialise, resolveAll: anchorAll, storageKey, mine,
    open: () => open && { id: open.a.id, isNew: open.isNew }
  };
})();
