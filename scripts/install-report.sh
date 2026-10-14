#!/bin/sh
# install-report.sh <pandoc data dir> <satzspiegel dir>
# Called by `make install` after the copies. Says where everything went,
# which Pandoc will run it, and renders one review edition with the
# installed files to prove they work. Exits 1 if that render fails.

data=$1 share=$2
tilde() { printf '%s' "$1" | sed "s#^$HOME#~#"; }
ok()   { printf '  \342\234\223 %-14s %s\n' "$1" "$2"; }   # works
warn() { printf '  ! %-14s %s\n' "$1" "$2"; }              # works, with a limit
bad()  { printf '  \342\234\227 %-14s %s\n' "$1" "$2"; }   # broken; make stops
note() { printf '    %-14s %s\n' '' "$1"; }

version=$(sed -n 's/^## \([0-9][0-9.]*\)$/\1/p' CHANGELOG.md | head -1)
printf '\nSatzspiegel %s\n\n' "${version:-}"

# --- where it went
n=$(ls "$data"/defaults/satzspiegel*.yaml 2>/dev/null | wc -l | tr -d ' ')
ok "Pandoc files" "$(tilde "$data")  (template, $n defaults files, filters)"
ok "Stylesheets" "$(tilde "$share")  (CSS, fonts, review layer)"

# --- which Pandoc, and can it fetch the hosted stylesheet
pandoc=$(command -v pandoc)
pver=$(pandoc --version | sed -n '1s/^pandoc //p')
probe=$(echo x | pandoc -s --embed-resources -c http://127.0.0.1:9/probe.css -t html 2>&1 >/dev/null)
case $probe in
  *"without HTTP support"*)
    warn "Pandoc" "$pver at $(tilde "$pandoc"), built without HTTP support"
    note "The hosted defaults cannot fetch the stylesheet; use the -local ones,"
    note "or install Pandoc from https://pandoc.org/installing.html"
    nohttp=1 ;;
  *) ok "Pandoc" "$pver at $(tilde "$pandoc")" ;;
esac
others=$(which -a pandoc 2>/dev/null | grep -vx "$pandoc" | sort -u)
for o in $others; do note "also on PATH, not used: $(tilde "$o")"; done

# --- diagrams
mmdc=${MERMAID_BIN:-$(command -v mmdc)}
if [ -n "$mmdc" ]; then
  mver=$("$mmdc" --version 2>/dev/null | tail -1)
else
  warn "Diagrams" "mmdc not found; mermaid blocks stay code blocks"
  note "npm install -g @mermaid-js/mermaid-cli"
fi

# --- one real render with what was just installed
tmp=$(mktemp -d "${TMPDIR:-/tmp}/satzspiegel-install.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/check.md" <<'MD'
---
title: Install check
---

A sentence a reviewer could comment on.

```mermaid
graph LR
  A[plan.md] --> B[plan.html]
```
MD
if ! (cd "$tmp" && pandoc check.md -d satzspiegel-review-local -o check.html 2> err); then
  bad "Test render" "pandoc -d satzspiegel-review-local failed:"
  sed 's/^/      /' "$tmp/err" | head -8
  exit 1
fi
if command -v python3 >/dev/null 2>&1; then
  why=$(python3 scripts/embedded-script.py "$tmp/check.html" pandoc/review/satzspiegel-review.js 2>&1)
else
  grep -q 'src="data:[a-z]*/javascript' "$tmp/check.html" || why="no review script in the file"
fi
if [ -n "$why" ]; then
  bad "Test render" "the review edition has no working comment layer"
  note "$(printf '%s' "$why" | sed 's#^ERROR: [^:]*: ##')"
  exit 1
fi
size=$(( $(wc -c < "$tmp/check.html") / 1024 ))
ok "Test render" "review edition, fonts and comment layer inside, $size KB"
if [ -n "$mmdc" ]; then
  if grep -q '<figure class="md-diagram">' "$tmp/check.html"; then
    ok "Diagrams" "mmdc $mver draws mermaid blocks"
  else
    warn "Diagrams" "mmdc $mver is installed but did not draw the test diagram"
    note "$(grep -m1 'Error' "$tmp/err" | sed -e 's/^.*Error: *//' -e 's/ This can occur.*//' | cut -c1-90)"
    fix=$(grep -o 'npx puppeteer browsers install [a-z-]*' "$tmp/err" | head -1)
    [ -n "$fix" ] && note "$fix"
  fi
fi

# --- what to type
if [ -n "${nohttp:-}" ]; then sfx=-local; else sfx=; fi
printf '\nTry it\n\n'
printf '  pandoc doc.md -d satzspiegel%s -o doc.html           a page to read\n' "$sfx"
printf '  pandoc doc.md -d satzspiegel-review%s -o doc.html    one file to send for comments\n' "$sfx"
if [ -z "${nohttp:-}" ]; then
  printf '\n  Add -local to any of them to work offline, e.g. -d satzspiegel-review-local.\n'
fi
printf '  More: https://yobu.github.io/satzspiegel/docs/usage.html\n\n'
