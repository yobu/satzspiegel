---
title: Code at length
subtitle: Nine languages, numbered lines, a diff and a line too long to fit
author: Satzspiegel, example 2
date: September 2026
---

Pandoc highlights code at build time, so the HTML carries no JavaScript: each token arrives as a span with a short class, and the code module maps those classes to six roles in one colour. The blocks below are long on purpose, because short snippets hide the problems that long ones expose.

## Python: a contrast checker

This script reads a Satzspiegel stylesheet, finds every theme's token block, and checks each text colour against the paper. It is the check that raised the faint ink in both palettes before release.

```python
#!/usr/bin/env python3
"""Check every text colour in a Satzspiegel theme against WCAG 2.2 (4.5 : 1)."""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

BLOCK = re.compile(r'\.md(?:\[data-md-theme="(?P<theme>\w+)"\])?\s*\{(?P<body>[^}]*)\}')
TOKEN = re.compile(r"--md-(?P<name>[a-z-]+):\s*(?P<hex>#[0-9A-Fa-f]{6})")
TEXT_ROLES = ("ink", "ink-muted", "ink-faint", "spot")
MINIMUM = 4.5


def channel(value: int) -> float:
    c = value / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_colour: str) -> float:
    r, g, b = (int(hex_colour[i : i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(a: str, b: str) -> float:
    high, low = sorted((luminance(a), luminance(b)), reverse=True)
    return (high + 0.05) / (low + 0.05)


@dataclass(frozen=True)
class Theme:
    name: str
    tokens: dict[str, str]


def themes(css: str) -> list[Theme]:
    found = []
    for match in BLOCK.finditer(css):
        tokens = {m["name"]: m["hex"] for m in TOKEN.finditer(match["body"])}
        if "paper" in tokens:
            found.append(Theme(match["theme"] or "patina", tokens))
    return found


def main(path: str = "satzspiegel.css") -> int:
    css = Path(path).read_text(encoding="utf-8")
    failed = False
    for theme in themes(css):
        for role in TEXT_ROLES:
            ratio = contrast(theme.tokens[role], theme.tokens["paper"])
            verdict = "ok  " if ratio >= MINIMUM else "FAIL"
            print(f"{verdict} {theme.name:<8} {role:<10} {ratio:5.2f} : 1")
            failed |= ratio < MINIMUM
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
```

Its output against the released stylesheet:

```text
ok   patina   ink        13.70 : 1
ok   patina   ink-muted   4.98 : 1
ok   patina   ink-faint   4.71 : 1
ok   patina   spot        7.11 : 1
ok   archive  ink        12.59 : 1
ok   archive  ink-muted   5.12 : 1
ok   archive  ink-faint   4.59 : 1
ok   archive  spot        9.37 : 1
```

## TypeScript: the same table wrapper for rehype

Pandoc users get the table wrapper from the Lua filter. A site built with remark and rehype needs the same two things, a scrolling wrapper and a label on every cell, and this plugin provides both.

```typescript
import type { Element, Root } from "hast";
import { toString as toText } from "hast-util-to-string";
import { SKIP, visit } from "unist-util-visit";

const isElement = (node: unknown, tag?: string): node is Element =>
  typeof node === "object" &&
  node !== null &&
  (node as Element).type === "element" &&
  (tag === undefined || (node as Element).tagName === tag);

/** Wrap every table in div.md-table-scroll and label its cells for .md-table--stack. */
export default function rehypeSatzspiegelTables() {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "table" || !parent || index === undefined) return;

      const head = node.children.find((child) => isElement(child, "thead"));
      const firstRow = isElement(head) ? head.children.find((c) => isElement(c, "tr")) : undefined;
      const labels = isElement(firstRow)
        ? firstRow.children.filter((c) => isElement(c)).map((cell) => toText(cell).trim())
        : [];

      for (const section of node.children) {
        if (!isElement(section, "tbody")) continue;
        for (const row of section.children) {
          if (!isElement(row, "tr")) continue;
          let column = 0;
          for (const cell of row.children) {
            if (!isElement(cell, "td")) continue;
            const label = labels[column++];
            if (label) cell.properties = { ...cell.properties, dataLabel: label };
          }
        }
      }

      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["md-table-scroll"] },
        children: [node],
      };
      return [SKIP, index + 1];
    });
  };
}
```

## Bash: render a whole folder

```bash
#!/usr/bin/env bash
# Render every Markdown file in a folder with Satzspiegel, one self-contained HTML file each.
set -euo pipefail

src="${1:-.}"
out="${2:-html}"
theme="${THEME:-patina}"

command -v pandoc >/dev/null || { echo "pandoc not found: brew install pandoc" >&2; exit 1; }
mkdir -p "$out"

shopt -s nullglob
for md in "$src"/*.md; do
  name="$(basename "${md%.md}")"
  pandoc "$md" \
    -d satzspiegel \
    -V theme="$theme" \
    --resource-path="$(dirname "$md")" \
    --embed-resources \
    -o "$out/$name.html"
  printf '%-40s %8s\n' "$out/$name.html" "$(du -h "$out/$name.html" | cut -f1)"
done
```

## SQL: how selective each competition is

```sql
-- Share of entries selected, per competition, 2025/2026 cycle
WITH cycle AS (
  SELECT award, body, entries, selected
  FROM competitions
  WHERE cycle = '2025/2026'
    AND entries IS NOT NULL
)
SELECT
  award,
  body,
  entries,
  selected,
  ROUND(100.0 * selected / entries, 1)               AS share_pct,
  RANK() OVER (ORDER BY selected::numeric / entries) AS selectivity
FROM cycle
ORDER BY selectivity, award;
```

## YAML: build the documentation site on every push

```yaml
name: pages
on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install pandoc
        run: |
          curl -sL https://github.com/jgm/pandoc/releases/download/3.11/pandoc-3.11-1-amd64.deb -o pandoc.deb
          sudo dpkg -i pandoc.deb
      - name: Build site
        run: make site
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

## JSON, CSS and a diff

```json
{
  "name": "satzspiegel",
  "version": "1.0.0",
  "description": "A Markdown stylesheet set to a book standard.",
  "style": "satzspiegel.css",
  "files": ["satzspiegel.css", "satzspiegel-code.css", "fonts.css", "fonts/"],
  "license": "MIT",
  "repository": "github:yobu/satzspiegel"
}
```

Numbered lines start where the excerpt starts in the file:

```{.css .numberLines startFrom="120"}
  .md {
    --md-paper:      #F3F6F4;
    --md-ink:        #1D2A24;
    --md-ink-muted:  #56705F;   /* 5.0 : 1 */
    --md-spot:       #2F5B4A;   /* patina green, 7.1 : 1 */
    --md-measure:    93ch;
  }
```

```diff
--- a/satzspiegel.css
+++ b/satzspiegel.css
@@ -62,5 +62,5 @@
-    --md-size: 1.0625rem;      /* 17px */
+    --md-size: 1.1875rem;      /* 19px */
     --md-leading: 1.62;
-    --md-measure: 104ch;
+    --md-measure: 93ch;
     --md-margin: 24ch;
```

## A line too long to fit

A code block never wraps by default; it scrolls inside its own column so the page does not.

```bash
pandoc examples/02-code.md -d satzspiegel-local --embed-resources --resource-path=examples -V theme=archive -V measure=72ch --metadata title="Code at length, archived" -o build/examples/02-code-archive.html
```

Inline code such as `--embed-resources` or `-V measure=72ch` stays in the text layer and keeps the text's rhythm.
