# Review comment flow ("write on the line") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the review edition's selection button and comment cards with variant C: underline plus leader into the column, write on the line, saved as you type, Cancel with Undo, kept in the browser, and the docked field with its vertical line on narrow screens.

**Architecture:** Everything stays in the one embedded script `pandoc/review/satzspiegel-review.js` (one IIFE, no dependencies) and its stylesheet. The data layer (index, selectors, `resolve`, `serialise`, merge, export) is kept as is; the interface layer is rewritten around four parts: marks (drawn underlines and leaders), the column (wide), the field (narrow), and storage. A Playwright script drives it from outside, like the existing screenshot scripts.

**Tech Stack:** Vanilla JS (ES2020), CSS with the theme tokens, Playwright from the playwright-skill bundle for tests, Pandoc 3.11+ to build review editions.

**Spec:** `docs/superpowers/specs/2026-10-23-review-comment-flow-design.md`

## Global Constraints

- `satzspiegel-review.js` must never contain a literal number sign; write `#`. `make check` must pass (it decodes the embedded script).
- No dependencies; one script, one stylesheet; every new element lives inside `.sz-review` (the text index skips it, the pristine copy predates it).
- Data format unchanged: W3C Web Annotations, `<` escaping, `valid()` shape checks, replies target the parent id.
- Colours and faces only from the tokens `copyTokens()` puts on `.sz-review`; one spot colour; every text colour 4.5 : 1 or better.
- Must work from `file://` and over http, in current Chrome, Edge, Safari and Firefox; no CSS Custom Highlight API.
- Wide layout from 80rem (`@media (min-width: 80rem)`), column 22rem in the body's end padding, as today.
- Strings fixed by the spec: *Type to comment*, *or click here*, *Write a comment*, *Reply*, *Saved as you type*, *Saved*, *Cancel*, *Undo*, *passage not found in this version*, *Select a passage and start typing to comment*, *Select a passage to comment*, accessible name *Comment on the selection*, textarea label `Comment on “…”` (quote cut at 60 characters).
- Values fixed by the spec: ruled lines every 24 px, display face 0.9375rem; mark at baseline + 0.3 em; saved mark 1 px dotted muted ink; active mark 2 px solid spot; leader 1 px spot (dotted while pending); column gap 18 px; keep-in-view margin 60 px on narrow; selection settle 150 ms (pointer) / 500 ms (touch); storage write debounce 300 ms; Undo 6 s.
- Commit only when the maintainer asks (CLAUDE.md); steps below say "checkpoint" where a commit would go.

## Review Focus

1. Passages that wrap across blocks or contain inline markup (emphasis, links, footnote references): marks per line, leader from the right line, no mark on the footnote superscript's own line.
2. A document with no annotation block content and storage unavailable (Safari `file://`, private window): no errors, behaves as today.
3. Typing very fast right after a selection (first keystrokes in the same frame): no character lost, none doubled.
4. Resizing across 80rem with a comment open: the comment survives the switch between column and field with its text.
5. Merged files with the same comment twice, or a reply whose parent is missing: nothing thrown, the orphan reply ignored as today.

Each line has its test in the owning task (Tasks 2, 5, 3, 6 and 4).

---

## File Structure

- Modify `pandoc/review/satzspiegel-review.js`: keep sections "text index and selectors", "storage" (block), "model helpers"; replace "anchoring and highlights" (marks), "UI", "selection to comment"; add "persistence" and "narrow".
- Modify `pandoc/review/satzspiegel-review.css`: replace cards, fab, highlights; add marks, column notes, editor, field, guide, toast with Undo.
- Create `scripts/review-test.js`: a small runner (`test(name, fn)`, `assert`, `eq`) and the tests; run with `cd ~/.claude/skills/playwright-skill && node run.js <repo>/scripts/review-test.js` while `make serve` runs. Fixture: `build/01-essay-review.html` from `make review` (has footnotes, emphasis, a block quote); a second fixture for links is `build/sample-review.html`.
- Modify `scripts/review-shot.js` to drive the new interface; reshoot `docs/img/review.png`.
- Modify `docs/usage.md`, `README.md` (alt text), `CHANGELOG.md`, `CLAUDE.md`; rebuild `readme-review.html` with `make readme`.

### Test API exposed by the layer

`window.satzspiegelReview` keeps `items`, `anchors`, `serialise`, `resolveAll` and gains:
- `storageKey: string` (the key in use, or `''` without storage)
- `mine: Set<string>` (ids created in this browser)
- `open(): null | { id: string, isNew: boolean }`

DOM contract the tests use: `.sz-marks > .sz-mark` (`.sz-strong` when active), `.sz-leader` (`.sz-dotted` while pending), `.sz-wait` (waiting line button), `.sz-notes > .sz-note[data-id]` (`.sz-open`, `.sz-active`, `.sz-orphan`), `.sz-entry` (`.sz-reply`) with `.sz-by` and `.sz-text`, `.sz-editor textarea.sz-ruled`, `.sz-cancel`, `.sz-status`, `.sz-actions button` (labels Reply, Edit, Delete), `.sz-field` (narrow; `.sz-open`, `.sz-writing`), `.sz-guide > .sz-guide-h, .sz-guide-v`, `.sz-toast button` (Undo).

---

### Task 1: Test harness and the round trip that must survive

**Files:** Create `scripts/review-test.js`.

**Interfaces:** Produces helpers used by every later task: `openPage(url, {width, height})`, `select(page, phrase, nth = 0)` (Range over the nth occurrence inside `.md`, dispatches `pointerup` after `addRange`), `scrollY(page)`, `items(page)`, `fileUrl(path)`.

- [ ] Step 1: write `test('save a copy keeps every comment and no interface', …)`: seed two annotations by evaluating `satzspiegelReview.items.push(...)` built with the layer's own selectors via `resolveAll()`, call `serialise()`, assert the string contains both ids, contains no `sz-review`, and that re-opening it (via `page.setContent`) anchors both.
- [ ] Step 2: run it against today's layer; expected PASS (it guards behaviour that must not change).
- [ ] Step 3: write the first failing test for the new flow, `test('typing after a selection starts a comment without scrolling')`: scroll so the second paragraph is 450 px down, `select('the lead paragraph')` (essay: use a phrase from its second paragraph), wait 300 ms, `keyboard.type('Note')`, assert `scrollY` unchanged, `items.length` grew by 1, the new item's body is `Note`.
- [ ] Step 4: run; expected FAIL (no type-to-start).
- [ ] Checkpoint.

### Task 2: Marks and leaders instead of highlights

**Files:** Modify `satzspiegel-review.js` (replace `paint()` and the Highlight code), `satzspiegel-review.css`.

**Interfaces:** Produces `lineBoxes(range) -> Array<{left, right, base, y}>` (page coordinates, one per visual line, `y` = baseline + 0.3 em of that line's font, rounded) and `drawMarks()` (redraws every mark and the one leader; reads `active`, `pending`, layout positions). `metrics(element) -> {asc, size}` cached per font, cache cleared on `document.fonts` `loadingdone`.

- [ ] Step 1: tests: `marks: one dotted mark per line of a saved comment` (seed a comment spanning two lines; expect 2 `.sz-mark` not `.sz-strong`); `marks: a comment on a link stays apart from the link underline` (sample fixture, comment on a link's text; mark top − link text baseline ≥ 0.25 em in px); `marks: footnote reference` (comment ending just before a footnote ref in the essay; marks equal the passage's visual lines); `marks: no CSS highlights` (`CSS.highlights?.size` is 0 or undefined).
- [ ] Step 2: run; FAIL.
- [ ] Step 3: implement `metrics`, `lineBoxes`, `drawMarks` into a `.sz-marks` layer (`position: absolute`, page coordinates, `pointer-events: none`, `aria-hidden`); dotted mark via a repeating gradient 1 px high in `--md-ink-muted`; strong mark 2 px `--md-spot`. Redraw on `resize`, `document.fonts` `loadingdone`, and a `ResizeObserver` on `md`. Remove `supportsHighlights` and its toast. In print, `.sz-marks`, leaders, the waiting line, the field and the guide are hidden.
- [ ] Step 4: run; PASS. `make check` passes.
- [ ] Checkpoint.

### Task 3: Wide flow: waiting line, type to start, autosave, close, Cancel, Undo

**Files:** Modify `satzspiegel-review.js` (selection handling, editor, layout), `satzspiegel-review.css`.

**Interfaces:** Consumes `lineBoxes`, `drawMarks`. Produces `startComment(range, {focus = true})`, `closeEditor()`, `cancelEditor()`, `toast(message, undo?)`, `layout()` (pins the open comment or the waiting line to its line, others 18 px apart, orphans last), and the state `pending: Range|null`, `open: {kind: 'comment'|'reply'|'edit', id, isNew, before}|null`.

- [ ] Step 1: tests (fixture essay, 1440 × 900, over http and `file://`): the Task 1 test; `first key kept` (type `Quick` with 0 ms delay → body `Quick`); `waiting line on selection` (`.sz-wait` exists, level with the passage's first line ±1 px, `.sz-leader.sz-dotted` present, nothing new inside `.md`'s box overlapping text); `copy untouched` (Meta+C or Control+C with a selection creates no item); `Esc keeps, empty disappears`; `Cancel on new + Undo` (item gone, Undo returns it with its text); `Cancel on edit restores`; `leader joins open comment` (leader y equals the open note's first rule y ±1); `click elsewhere closes`; `fast typing` (type 40 characters at 0 ms delay → body equals them exactly).
- [ ] Step 2: run; FAIL.
- [ ] Step 3: implement. Selection settles on `pointerup` (+10 ms) or 150 ms after the last `selectionchange` with no pointer down; trim whitespace at both ends. `keydown` on document with a pending selection and no field focused: printable (length 1, not space) or `Dead` without Ctrl/Meta/Alt → `startComment` synchronously and do **not** `preventDefault`; Enter → `preventDefault` + `startComment`; Esc → clear selection. `startComment` builds the note, runs `layout()`, then `textarea.focus({ preventScroll: true })`, then `keepInView(textarea)`. Autosave in the `input` handler: first non-space character pushes the annotation (`created` now, `creator.name` from the bar or `Anonymous`), later inputs update `body.value` and, for existing ones, `modified`. Toast with Undo for 6 s. The textarea's `aria-label` is `Comment on “…”` (quote cut at 60 characters); `.sz-status` is `aria-live="polite"`.
- [ ] Step 4: implement `keepInView(element)`: if the element's bottom is below `visualViewport.height + visualViewport.offsetTop − 12` or its top above `offsetTop + 12`, `scrollBy` exactly the difference; nothing otherwise.
- [ ] Step 5: run; PASS.
- [ ] Checkpoint.

### Task 4: Saved comments: read form, own and others, Reply, Edit, Delete, orphans

**Files:** Modify `satzspiegel-review.js` (`note(a)` replaces `card(a)`), `satzspiegel-review.css`.

**Interfaces:** Consumes Task 3. Produces `isMine(a) -> boolean` (id in `mine`, or `creator.name` equals the bar's name), `remove(ids) -> {restore()}`.

- [ ] Step 1: tests: `own comment edits on click` (click `.sz-text` → textarea with the text); `colleague's comment does not edit on click` (seed author `Mara`, bar name `You`, click text, press `x` → body unchanged, `.sz-actions` shows Edit); `reply saves as you type` (Reply, type `Yes` → an item with `target` = parent id, body `Yes`); `delete reply only`; `delete thread + Undo restores comment and replies`; `emptied comment closes into delete with Undo`; `hover on pushed comment draws no leader` (two comments on one line → the second is pushed; hover it → `.sz-leader` absent, its passage mark `.sz-strong`); `click pins` (click the pushed one → it moves level, leader present); `orphan shows quote and note`; `reply without parent is ignored` and `duplicate ids merged once` (Review Focus 5).
- [ ] Step 2: run; FAIL.
- [ ] Step 3: implement read form, actions row (time, Reply, Edit for others, Delete) shown on hover, focus or active; pinning by `activate(id)` + `layout()` with a 180 ms `top` transition; delete without `confirm()`.
- [ ] Step 4: run; PASS.
- [ ] Checkpoint.

### Task 5: Kept in this browser

**Files:** Modify `satzspiegel-review.js` (new section "persistence"), bar text.

**Interfaces:** Produces `hash(string) -> string` (cyrb53, base 36), `persist()` (debounced 300 ms; `persist.now()` immediate), `restore()` called before the first `anchorAll()`, `storageKey`.

- [ ] Step 1: tests: `reload keeps comments, edits and deletions`; `fresh render does not inherit` (re-render the essay with `-M date=…` changed into another file at the same path between loads → no kept comments); `annotated copy starts from its own block`; `storage blocked` (context with `localStorage` throwing via `addInitScript` → no page errors, commenting works, `storageKey` is `''`); `name added later re-attributes mine only` (one own anonymous comment, one merged anonymous from Mara's file → enter name → only the own one changes); count text mentions the browser.
- [ ] Step 2: run; FAIL.
- [ ] Step 3: implement: key `'satzspiegel-review:' + location.href without query and fragment + ':' + hash(pristine)`; value `{items, mine: [...], saved}`; write on the events the spec lists and on `pagehide`; all access in `try`/`catch`. The bar: empty state *Select a passage and start typing to comment* (or *Select a passage to comment* when `(hover: none)`), otherwise the count and where the comments are kept; after the first anonymous comment closes, a toast suggests a name without taking the focus.
- [ ] Step 4: run; PASS.
- [ ] Checkpoint.

### Task 6: Narrow flow: docked field and the line down to it

**Files:** Modify `satzspiegel-review.js` (new section "narrow"), `satzspiegel-review.css`.

**Interfaces:** Consumes Tasks 2 to 5. Produces `field` (one persistent element, built once), `syncField()`, `drawGuide()`, `followViewport()` (moves the field by `innerHeight − vv.height − vv.offsetTop` on `visualViewport` `resize`/`scroll`).

- [ ] Step 1: tests at 390 × 844: `selection shows compact field and guide, no focus` (`.sz-field` visible, `document.activeElement` is body, `.sz-guide-v.sz-dotted` from the passage's last line to the field top); `tap into field starts comment` (click textarea → `open().isNew`, typing saves); `field never covers the selection` (passage in the bottom 80 px → after settle, the passage's last line is above the field top − 60); `click in text closes without scrolling`; `tap on underlined passage opens thread to read` (field `.sz-open`, no focus, actions present); `end list present below 80rem`; `resize across 80rem keeps the open comment and its text` (Review Focus 4).
- [ ] Step 2: run; FAIL.
- [ ] Step 3: implement per spec (settle 500 ms after the last `selectionchange` with no touch down; selection remembered on `pointerdown` everywhere; compact one-line field while waiting; `keepInView` for the passage when the keyboard settles; hardware keyboard type-to-start focuses the field).
- [ ] Step 4: run; PASS. Manual on devices: spec check 7 (iPhone Safari, Android Chrome) before release.
- [ ] Checkpoint.

### Task 7: Screenshots, docs, release notes

**Files:** Modify `scripts/review-shot.js`, `docs/img/review.png`, `docs/usage.md` (review section), `README.md` (screenshot alt text), `CHANGELOG.md` (Unreleased), `CLAUDE.md` (review edition paragraph, test command), `readme-review.html` (`make readme`).

- [ ] Step 1: update `review-shot.js` to select, type, reply via the new interface; run it; look at `docs/img/review.png`.
- [ ] Step 2: rewrite the usage section: how to comment (select and type; tap the field on a phone), saved as you type and kept in this browser (two tabs: last one wins), Cancel and Undo, own versus others' comments, browser support without the Highlight API.
- [ ] Step 3: `make readme`, `make check`, the whole `review-test.js` over http and `file://`; all pass.
- [ ] Checkpoint; ask the maintainer whether to commit.
