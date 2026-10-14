#!/usr/bin/env python3
"""Check that a review edition carries the whole review script.

Usage: embedded-script.py <page.html> <satzspiegel-review.js>

Pandoc embeds the script as a data: URL, base64 (3.11, or any fetched file)
or percent-encoded (3.12, local files). The script is decoded the way a
browser does it: entities first, then the URL, with everything after a
literal # dropped as the fragment. Pandoc 3.12 leaves # unencoded, so a #
in the script used to cut it short and the review layer never started.
"""
import base64
import html
import re
import sys
import urllib.parse

page, source = sys.argv[1], sys.argv[2]
want = open(source, encoding="utf-8").read()
srcs = re.findall(r'<script src="(data:[^"]*)"', open(page, encoding="utf-8").read())
if not srcs:
    sys.exit(f"ERROR: {page} has no embedded review script")

url = html.unescape(srcs[-1]).split("#", 1)[0]
head, _, body = url.partition(",")
got = (base64.b64decode(body).decode("utf-8") if head.endswith(";base64")
       else urllib.parse.unquote(body))

if got.strip() != want.strip():
    sys.exit(f"ERROR: {page}: the embedded review script is {len(got)} of "
             f"{len(want)} characters; the browser would not run it")
