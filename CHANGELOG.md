# Changelog

## 1.1.0

17 September 2026.

- Diagrams at render time. A fenced `mermaid` block is drawn by mermaid-cli through the Pandoc project's diagram filter (pandoc-ext/diagram 1.2.0, shipped unmodified as `pandoc/filters/satzspiegel-diagram.lua`, MIT, checksum verified in `make check`) and written into the page as an SVG data URI inside `figure.md-diagram`. No script is added to the page, a linked page needs no extra file, and a review edition keeps the diagram's labels out of its text index. The diagram takes the theme's paper, ink, rule and spot, with system faces. Without `mmdc` the block stays a code block and Pandoc says once how to install it. Results are cached in `~/.cache/pandoc-diagram-filter`. A diagram keeps its drawn size and scrolls inside its figure when wider than the column, so labels are never shrunk below reading size.
- Figures take the block spacing every other block has; `.md figure { margin-block: 0 }` sat in a later cascade layer and had been cancelling it.
- The `repo` variable puts a link to a GitHub repository and GitHub's star button into the running head; meant for web pages, not for documents you send, because the button loads a script from `buttons.github.io`.
- Pages rendered by the Makefile link their stylesheets with a content hash in the query, so a fresh page never pairs with a cached older stylesheet.
- The README is shorter and in the first person, shows the review edition in a screenshot, and carries the install commands for macOS, Linux and Windows.
- The Pages workflow grants permissions per job; the build, which installs npm packages, cannot deploy.

## 1.0.0

First public release. Two themes, Patina (default) and Archive, over one component layer, with self-hosted OFL typefaces and Pandoc integration (template, defaults files, Lua filter).

The review edition (`pandoc -d satzspiegel-review`): a self-contained file whose readers can comment on passages, reply, save a copy with the comments inside as W3C Web Annotations, and merge returned copies. `scripts/annotations.mjs` reads the comments back on the command line.

Decisions adopted from the design plates:

- Numbered code lines are blocks with an inline-block counter, so a line may hold any number of syntax tokens.
- Comments in code are muted ink, not faint ink; every text colour is at least 4.5 : 1.
- Syntax highlighting is one forme: keyword in ink by weight, string and number in muted ink, name in the spot.
- Code blocks sit between two rules; no four-sided box.
- Diff lines tint the full row; added lines take the spot.
- Alerts are single-forme by default; the five tones are opt-in with `md--tinted-alerts`.
- Compact tables fit their content and stay on the text edge instead of stretching short columns across the page.
- Legal numbering counters are right-aligned so the period stays in one column past nine.
- `.md--indent` offers the book paragraph model (first-line indent, no space) as an opt-in class.
- The section pause is a short centred hairline in Patina and a full hairline in Archive; neither text face carries an ornament glyph, and a fallback dingbat is worse than a rule.
- Faint ink was raised in both palettes so list markers pass contrast.
- Class maps cover Pandoc (skylighting), Prism, highlight.js and Shiki's css-variables theme.
- GitHub Pages is built by a workflow from `make site`; the template links the typefaces only when told where they are.
- Hardening: the annotation payload escapes every `<`; merged items are validated; the font fetcher verifies host, status and WOFF2 signature and writes `fonts/SHA256SUMS`; `make check` and `make verify-fonts`; CI pins its action by commit and Pandoc by checksum; `make uninstall` refuses to run with empty paths; `install.ps1` for Windows.
- The README is written as a landing page, problem first, with the review loop as a diagram; the reference material moved to `docs/usage.md`. `readme-review.html` ships as the README's own review edition.
- `fonts.css` is linked by the template rather than imported by the stylesheet, so `-V nofonts` (or the `satzspiegel-review-light` defaults) produces a self-contained file of about 90 KB in system fonts instead of 1.1 MB.
- Every page ends with a faint colophon linking to the repository; `-V nocolophon` removes it.
- IBM Plex Mono is served as `Satzspiegel Mono`, because a subset is a Modified Version under the OFL and may not carry the Reserved Font Name "Plex".
