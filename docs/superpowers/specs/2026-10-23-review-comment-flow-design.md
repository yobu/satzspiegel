# Review edition: commenting by writing on the line

23 October 2026. Direction approved by the maintainer on 22 and 23 October after three clickable variants; this document describes variant C, "Write on the line", for wide screens and its phone form. The throwaway prototype is `build/review-ux/index.html` (git-ignored; served by `make serve` at `http://127.0.0.1:8765/build/review-ux/`, `?iphone#C` shows the phone). Where this document and the prototype differ, this document wins.

## Why

Commenting in the review edition (`pandoc/review/satzspiegel-review.js`, `satzspiegel-review.css`) has four faults the maintainer named:

1. Selecting text shows a small **Comment** button that sits over the next line and covers words.
2. Clicking it opens a card in a column at the far right with nothing tying it to the passage but its height.
3. Writing needs a second commit, **Save comment**.
4. Typing straight after selecting makes the page jump (measured in the prototype: 260 to 330 px). The cause, in the current code as in the first prototype: the comment's textarea is focused before it is positioned, so the browser scrolls to where it momentarily sits at the top of the column.

A fifth fault was raised on the way: a comment lives only in the open page until **Save a copy**; closing the tab loses it.

## Decided by the maintainer

- No button and no overlay over the text. The passage is underlined, and the underline carries on at the same height to the comments column, where the comment is written on that line, level with the passage.
- Comments are saved with every keystroke. There is no **Save comment**. **Cancel** stays and throws away everything written.
- Typing straight after a selection starts the comment and must not move the page.
- On a phone the comment field is docked at the foot of the screen, and a line runs from the passage to the edge of the text and **down** to the field. The keyboard appears only when the reader taps into the field, sliding up from the bottom. The page scrolls only if the passage would end up hidden, and only as far as needed.

## Goals

- Commenting is: select, type. On a touch screen: select, tap the field, type.
- The eye never has to search for where a comment went: a line always joins the open comment to its passage.
- Nothing written is lost by closing the tab, crashing, or a slip of the finger on Cancel.
- The page never moves on its own, except the one scroll on a phone that keeps the passage above the keyboard.

## Non-goals

- No change to the data: W3C Web Annotations in the annotation block, TextQuoteSelector anchoring with a TextPositionSelector hint, replies as annotations whose target is the parent's id, `serialise()` rewriting only the block of the pristine copy, **Save a copy**, **Merge files…**, **Export**, `scripts/annotations.mjs`. Files written by 1.x stay readable and vice versa.
- Variants A and B of the prototype are not built.
- No live collaboration or sync between tabs or people.
- The wide breakpoint stays at 80rem (my call; moving it changes the layout of existing review editions and is a separate decision).

## Anti-goals: failures even if it works

- The page jumps while someone selects or types.
- Any of the new interface ends up in a saved file or in the text index that anchoring reads.
- A comment disappears without a way back.
- The layer works over http but not from `file://`, which is how reviewers open the file.
- `satzspiegel-review.js` gains a literal number sign (Pandoc 3.12 truncates the embedded script at it; write `#`).

## Constraints from the codebase

- `satzspiegel-review.js` has no dependencies and is embedded by Pandoc; `make check` decodes the embedded script as a browser does (`scripts/embedded-script.py`) and fails unless it is complete.
- The pristine copy of the page is taken before the script adds anything; saving rewrites only the annotation block in it. Every `<` in the payload is escaped as `<`; merged items are shape-validated (`valid()`), in the layer and in `scripts/annotations.mjs`.
- The text index (`buildIndex`) rejects text inside `.sz-review`; every new element must live inside the `.sz-review` container or carry that class.
- Colours and faces come from the theme tokens copied onto `.sz-review` (`copyTokens()`), so the layer follows Patina and Archive. One spot colour; hairlines; every text colour at least 4.5 : 1 on its paper.
- The README promises current Chrome, Edge, Safari and Firefox.
- `scripts/review-shot.js` drives the current interface to shoot `docs/img/review.png`; `readme-review.html` embeds the script and is rebuilt by `make readme`.

## Wide screens: 80rem and wider

The comments column keeps its place and size (`body { padding-inline-end: 22rem }`, the column in that padding), outside the document's container, so it never collides with Patina's footnote column.

### Marks

Passages are marked with underlines drawn as positioned elements inside `.sz-review`, from the rectangles of each line of the anchor range. They replace the CSS Custom Highlight API tint (`sz-note`, `sz-note-active`), so the layer no longer needs that API. The reason is the leader: it has to meet the underline at exactly the same height, which the browser's own text decoration does not report.

- The mark sits below the descenders, at baseline + 0.3 em of the passage's own font, like a pencil line under a printed word. A link's own underline sits at about 0.16 em, so the two never overlap. The baseline is measured once per font (a zero-height inline-block next to a text run gives it) and cached; the cache is cleared when fonts finish loading.
- Saved comments: a 1 px **dotted** line in muted ink. Links are solid lines in the spot colour; a comment must not look like a link (my call, after the review).
- The selection waiting to become a comment, the open comment, and a comment under the pointer or with focus: a 2 px solid line in the full spot colour.
- Marks and leaders are redrawn when the window is resized, when fonts load, and when the document's size changes (a `ResizeObserver` on the `.md` element, which catches images loading late).

### The leader

A 1 px line in the spot colour from the right end of the passage's **first** line, at the underline's height, across to the right edge of the comments column. The comment's first ruled line is that line, so the comment's first line of text sits level with the passage. Dotted while it is only a selection, solid once there is a comment. Drawn for the selection, the open comment, and the comment under the pointer or with focus; never for all comments at once.

A leader is drawn only when the comment sits level with its passage; it never bends or slants. A saved comment that has been pushed off its line shows its connection differently under the pointer: its passage's mark turns to the 2 px spot line and its own first rule turns spot, with no leader. A click or focus pins it: the column lays out again with that comment on its line (moving the others with a short transition), and the leader appears. The column does not move under a mere hover. Where Patina's notes column stands between the text and the comments, the leader crosses it; it is drawn only for one comment at a time (my calls).

### Selecting

When a selection inside the document settles (pointer released, or 150 ms after the last keyboard change), the column shows a ruled line level with the passage that reads *Type to comment*, with a faint *or click here* at its right end. It is a button whose accessible name is "Comment on the selection". The underline and the dotted leader join the passage to it. Nothing appears over the text. The waiting line goes when the selection goes.

- A printable key (no Ctrl, ⌘ or Alt; not the space bar) or a dead key, pressed while the selection is in the document and no field has the focus, starts the comment. The comment's textarea is focused during that `keydown` without cancelling the event, so the browser types the key there itself: the first letter is kept, and accents, dead keys and input methods work.
- Enter, or a click on the waiting line, starts an empty comment.
- ⌘C and Ctrl+C keep copying. Esc clears the selection.

### Writing

- The comment is a textarea with ruled lines every 24 px, in the display face at 0.9375 rem, three lines visible from the start, growing with its text.
- The comment is created, rendered and positioned **before** it is focused, and it is focused with `preventScroll: true`. The page does not move.
- One rule for keeping things in view, at every width and on touch screens too: when a comment starts, when it grows, and when the keyboard of a touch device takes part of the screen, the page scrolls only if the comment's text box (or, on a phone, the passage above the field) would be outside the visible area, and only by as much as it takes. The visible area is measured with `visualViewport`, so an iPad's on-screen keyboard counts. A selection whose first line is above the top of the window therefore brings that line, where the comment lives, into view; a passage near the bottom edge scrolls up just enough to show three lines of the comment.
- Saved as you type: the first character that is not a space puts the annotation into the list (its `created` is that moment) and every later keystroke updates its body. A new comment that is emptied again leaves the list. Under the textarea, a status reads *Saved as you type* until there is text, then *Saved*.
- **Cancel** under the textarea. On a new comment it throws away everything written. On an edit it puts back the text as it was when the edit began.
- **Esc**, ⌘ Enter or Ctrl+Enter, or a click anywhere else closes the comment and keeps it. A new comment left empty disappears without a trace. An existing comment or reply emptied and then closed is deleted as **Delete** would (a comment with its replies), with Undo.
- Because nothing asks "are you sure?", Cancel and Delete show a note at the foot of the window for six seconds with **Undo**, which restores exactly what was there (my call).

### The column

The open comment, and the waiting line, sit exactly on their line. The other comments are pushed up or down to make room, 18 px apart, so the leader stays straight. Comments pushed upward may rise above the column's top padding as far as the top of the page, keeping their order; if they still do not fit, the pinned comment moves down as little as possible and its leader is not drawn. Comments whose passage is not found in this version go to the end of the column.

### Saved comments

- Read form: the author's name (weight 650, muted ink, a little smaller) and then the text, its first line sitting on a hairline rule in the rule colour. Replies follow beneath, each opening with its author's name.
- On hover, focus or click, a quiet line under the thread shows the time and the actions (my call: the time and actions only when needed keep the column quiet).
- **Your own** comments and replies open for editing in place when their text is clicked, in the same ruled textarea; so does a click on the underlined passage of your own comment. Yours means created in this browser (their ids are kept with the stored comments) or carrying the name in the bar. Anyone else's comment is only activated by a click; its actions include **Edit**, so a colleague's words are never changed by a stray keystroke (my call).
- **Reply** opens a ruled textarea under the thread with the placeholder *Reply*. It saves as you type and creates a reply annotation with the first character; Cancel throws it away.
- **Delete** on a comment removes it and its replies; on a reply, just that reply. Both at once, with Undo (replacing today's `confirm()`; my call).
- Not found: the comment shows its quote, set in the text face, italic, with *passage not found in this version*, and its first rule is dashed.

## Narrow screens: below 80rem

Phones, tablets and narrow windows. There is no column to write in.

### Selecting

The passage gets the 2 px underline. Once the selection has settled (no finger down and no change of the selection for 500 ms; iOS keeps firing `selectionchange` while a handle is dragged), the comment field slides up into view, docked at the foot of the visible screen, its top edge a dashed rule while it waits. While it waits it is compact, a single ruled line, so it covers as little as possible. If even the compact field would cover the passage's last line, the page scrolls up by just that much at this moment, by the same rule as below. A dotted line runs from the right end of the passage's **last** line to the right edge of the text, then straight down the right-hand margin to the field's top rule. The keyboard does not appear: the field is not focused. This vertical line is the one vertical rule anywhere in Satzspiegel, and it exists only while a comment is selected or open (the maintainer asked for it).

The field holds a ruled textarea with the placeholder *Write a comment*. On a touch screen the reader's tap into the field may clear the selection before the field has the focus; the selection is remembered on `pointerdown` so the comment still knows its passage.

### Tapping into the field

- The comment begins (as a new, empty draft) and the field shows **Cancel** and the status.
- The phone's keyboard comes up. The field rides on top of it: it is `position: fixed` at the bottom, and while a field has the focus it is moved up by the height the keyboard takes from the layout viewport, computed from `visualViewport` (`innerHeight − visualViewport.height − visualViewport.offsetTop`) on its `resize` and `scroll` events.
- Scrolling: once the keyboard has settled, if the passage's last line is lower than 60 px above the field's top (one line of the following text should stay visible), the page scrolls down by exactly the difference, smoothly. It never scrolls in any other case and never scrolls back when the keyboard goes. The passage's first line is never pushed under the top edge.
- The line from the passage follows the field as the keyboard and the page move.

### Writing and leaving

- Saved as you type, as on wide screens. The field grows to about five lines and then scrolls inside itself.
- With a hardware keyboard (a narrow desktop window, a tablet with a keyboard), typing after a selection focuses the field and types there, as on wide screens.
- Lowering the keyboard (the keyboard's own **Done** or hide key) keeps the comment open in the field; Cancel and the status hide until the reader taps in again.
- A tap anywhere in the text closes the comment: the field slides away, the line goes, the passage keeps its quiet underline, and the page stays where it is.

### Reading

- A tap on an underlined passage opens its thread in the field to read: names, text, replies, and **Reply** and **Delete**. No keyboard. A tap into the text edits it.
- The list of all comments stays at the end of the document, as today, in the read form above with each comment's quote; a tap on one scrolls to its passage and opens it in the field.

## Saved means kept in this browser

My recommendation, put to the maintainer on 22 October without objection: every change is also written to `localStorage`, so a closed tab or a crash loses nothing and the comments are there when the same file is opened again. **Save a copy** still makes the file one sends back.

- Key: `satzspiegel-review:` + the page's address without query and fragment + `:` + a short hash of the whole file as loaded (the pristine copy). Value: `{ items, mine, saved }`, where `mine` lists the ids of comments and replies created in this browser.
- "The same file" therefore means the same bytes at the same address. On load, if the key exists, its items replace the block's items; they were derived from that very file, so deletions hold without tombstones. Anything else starts from what the file holds: an annotated or merged copy, and any new render, even of unchanged Markdown with a new date (my call after the review: a reviewer who saved v2 over v1 must not see v1's comments again).
- No separate "forget" command: deleting comments is enough (my call).
- Written 300 ms after the last keystroke, at once after close, Cancel, Delete, Undo, a reply and a merge, and on `pagehide`.
- Every access is wrapped in `try`/`catch`. Without storage (a private window, blocked site data) the layer behaves as today and says nothing.
- The bar's count says where the comments are, for example *3 comments, kept in this browser until you save a copy* (wording left to the builder).
- Two tabs on the same file: the last one written wins. Acceptable; say so in the usage guide.

## Smaller decisions

- Name: a comment takes the name in the bar when its first character is typed; without one it is by "Anonymous". After the first anonymous comment closes, a note suggests adding a name in the bar. It never takes the focus (today's code moves the focus to the name field, which would interrupt someone typing). When a name is entered later, the comments and replies created in this browser that still say "Anonymous" take it; nobody else's change (my call).
- Width alone chooses the layout: the column from 80rem, the docked field below. A wide touch screen (an iPad Pro in landscape) gets the column; the keep-in-view rule above, which measures `visualViewport`, keeps the comment above its on-screen keyboard, and the selection is remembered on `pointerdown` at every width.
- The textarea's accessible name includes the passage: `Comment on “…”`, the quote cut at 60 characters. The status is a polite live region and changes at most once per comment. Underlines, leaders and the vertical line are `aria-hidden`.
- The waiting line in the column and the field on a phone have a hit area of at least 44 px in height.
- Print: underlines, leaders, the waiting line, the field and the vertical line are hidden; the comments print as a list after the document with their quotes, as today.
- The bar's empty state reads *Select a passage and start typing to comment* on wide screens and *Select a passage to comment* on touch screens.

## Browser support

Current Chrome, Edge, Safari and Firefox, as the README says. Dropping the Custom Highlight API removes the strictest requirement (Chrome 105, Safari 17.2, Firefox 140) and the toast that apologised for it. The layer needs `Range.getClientRects`, `focus({ preventScroll })`, `visualViewport` and `ResizeObserver`; `Element.animate` only for the field's slide, which may simply not animate where it is missing.

## Files

- `pandoc/review/satzspiegel-review.js` and `satzspiegel-review.css`: the interface, marks, persistence.
- `scripts/review-shot.js`: drives the new interface; reshoot `docs/img/review.png`.
- A new `scripts/review-test.js`, run like `review-shot.js` through Playwright against the static server and against `file://`, covering the acceptance checks below that a desktop browser can reach (my call; the repository has no package manager, so it stays out of CI like the screenshot scripts).
- `docs/usage.md` (the review edition section: how to comment, where comments are kept, the browser note), `README.md` (the screenshot's alt text), `CHANGELOG.md` (Unreleased), `CLAUDE.md` (the review edition paragraph and how to test it), `readme-review.html` (rebuilt with `make readme`).

## Acceptance checks

1. Wide, Patina and Archive, over http and from `file://`: select a passage low on the page, type a sentence. The page's scroll position is unchanged, the first letter is in the comment, the count rises with the first letter, the leader joins the passage to the comment's first line.
2. Esc keeps the comment; a new comment left empty leaves nothing; Cancel on a new comment removes it and Undo brings it back; Cancel on an edit restores the old text.
3. Reply and Delete work; Delete with Undo restores the comment and its replies.
4. Reload the page: every comment, edit and deletion of the session is still there. Open the file in a private window: the file's own comments, nothing else, no errors.
5. Save a copy, open the copy: same comments, anchored; `node scripts/annotations.mjs` lists them; the copy contains no element of the interface; `make check` passes.
6. Narrow (390 × 844 in Chromium): selecting shows the field and the line to it with no focus; clicking into the field starts a comment; a passage that would be covered scrolls up just enough; a click in the text closes without scrolling.
7. On a real iPhone in Safari, and on an Android phone in Chrome: the keyboard appears only on tapping the field; the field sits on the keyboard; the passage stays visible; Done keeps the comment; nothing jumps. This check cannot be done in the desktop browser and is required before release.
8. A merged file, an annotated copy and a fresh render of the same Markdown each open with their own comments, not the ones kept for the original file.
9. A colleague's merged comment does not change when it is clicked and a key is pressed; your own does open for editing on a click.
10. A comment on a link: the link's underline and the dotted comment mark are both visible and apart.

## Risks

- iOS Safari and fixed elements with the keyboard open: Safari scrolls the page itself when a field gains focus, and its own scroll may fight the layer's. If `visualViewport` tracking proves unreliable on a device, the fallback is to stop the layer's own scrolling on iOS and let Safari bring the field into view, keeping the line drawn from the passage. Decide on the device (check 7).
- `localStorage` from `file://` is shared by every local file in Chrome; the key's full path keeps files apart. Safari may refuse storage for `file://`; the layer must then behave as today.
- Long passages across several blocks: the wide leader starts at the first line, the narrow line at the last; both are the lines nearest the comment.

## Left to the builder

Code structure, exact wording beyond the strings quoted here, timings and curves (the prototype uses 380 ms and `cubic-bezier(.2, .8, .2, 1)`), spacing beyond what is given, and how the tests are organised.
