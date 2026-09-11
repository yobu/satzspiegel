#!/usr/bin/env python3
"""Check every text colour in each Satzspiegel theme against its paper (WCAG 4.5:1).

    python3 scripts/contrast.py               # reads satzspiegel.css
    python3 scripts/contrast.py other.css

Exit status 1 if any text colour falls short. No dependencies."""

from __future__ import annotations

import re
import sys
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


def themes(css: str) -> list[tuple[str, dict[str, str]]]:
    found = []
    for match in BLOCK.finditer(css):
        tokens = {m["name"]: m["hex"] for m in TOKEN.finditer(match["body"])}
        if "paper" in tokens:
            found.append((match["theme"] or "patina", tokens))
    return found


def main(path: str = "satzspiegel.css") -> int:
    css = Path(path).read_text(encoding="utf-8")
    failed = False
    for theme, tokens in themes(css):
        for role in TEXT_ROLES:
            if role not in tokens:
                continue
            ratio = contrast(tokens[role], tokens["paper"])
            ok = ratio >= MINIMUM
            failed |= not ok
            print(f"{'ok  ' if ok else 'FAIL'} {theme:<8} {role:<10} {ratio:5.2f} : 1")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
