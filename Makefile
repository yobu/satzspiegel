# Satzspiegel — a Markdown stylesheet set to a book standard
# `make` or `make help` lists the targets.

SHELL       := /bin/sh
.SHELLFLAGS := -ec
.DELETE_ON_ERROR:
.DEFAULT_GOAL := help

HOSTED      := https://yobu.github.io/satzspiegel/
PANDOC_DATA := $(shell pandoc --version 2>/dev/null | sed -n 's/^User data directory: //p')
LOCAL       := $(if $(HOME),$(HOME)/.local/share/satzspiegel,)

READER_MD   := markdown+footnotes+definition_lists+task_lists+pipe_tables+fenced_divs+implicit_figures+smart+alerts+mark
READER_GFM  := gfm+alerts
# The settings of pandoc/defaults/satzspiegel.yaml, everything taken from the
# working tree. Stylesheets are linked relatively; $(2) in the recipes below is
# the path from the output file back to the repository root.
RENDER      := pandoc --data-dir=pandoc -s --template=satzspiegel -L satzspiegel.lua -t html --math-method=mathml
# A self-contained review edition. Every resource local, so it never depends on
# `make install` or on GitHub Pages being live.
REVIEW      := $(RENDER) --embed-resources -V review -V review-css=pandoc/review/satzspiegel-review.css -V review-js=pandoc/review/satzspiegel-review.js -V fonts-css=fonts.css -c satzspiegel.css -c satzspiegel-code.css
# \# because a bare # would start a make comment.
LINKS       := perl -pi -e 's/href="(?![a-z]+:)([^"\#]+)\.md(\#[^"]*)?"/href="$$1.html$$2"/g'

# Fails if an embedded file still references hosted resources or carries no script.
define assert-embedded
@if grep -q '$(HOSTED)[^"]*\.\(css\|js\)"' $(1); then echo "ERROR: $(1) still links hosted resources; nothing was embedded"; exit 1; fi
@if ! grep -q 'src="data:text/javascript' $(1); then echo "ERROR: $(1) has no embedded review script"; exit 1; fi
endef

# $(call render-examples,<output dir>,<path from output dir to the repository root>)
define render-examples
mkdir -p $(1)
for f in examples/*.md; do \
  n=$$(basename "$$f" .md); from="$(READER_MD)"; meta=""; \
  case $$n in *gfm*) from="$(READER_GFM)"; meta="-M pagetitle=$$n";; esac; \
  $(RENDER) -f "$$from" $$meta --resource-path=examples -V fonts-css=$(2)fonts.css -c $(2)satzspiegel.css -c $(2)satzspiegel-code.css "$$f" -o "$(1)/$$n.html"; \
  $(RENDER) -f "$$from" $$meta --resource-path=examples -V theme=archive -V fonts-css=$(2)fonts.css -c $(2)satzspiegel.css -c $(2)satzspiegel-code.css "$$f" -o "$(1)/$$n-archive.html"; \
done
endef

.PHONY: help install uninstall check verify-fonts fonts sample review examples readme showcase site serve clean

help: ## list the targets
	@awk 'BEGIN{FS=":.*## "} /^[a-z-]+:.*## /{printf "  make %-14s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Pandoc template, defaults and filter into Pandoc's data dir; CSS and fonts into ~/.local/share/satzspiegel
	@test -n "$(PANDOC_DATA)" || { echo "pandoc not found: brew install pandoc"; exit 1; }
	@test -n "$(LOCAL)" || { echo "HOME is not set"; exit 1; }
	mkdir -p "$(PANDOC_DATA)/templates" "$(PANDOC_DATA)/defaults" "$(PANDOC_DATA)/filters" "$(LOCAL)/pandoc/review"
	cp pandoc/templates/satzspiegel.html "$(PANDOC_DATA)/templates/"
	cp pandoc/defaults/satzspiegel.yaml pandoc/defaults/satzspiegel-gfm.yaml pandoc/defaults/satzspiegel-review.yaml pandoc/defaults/satzspiegel-review-light.yaml "$(PANDOC_DATA)/defaults/"
	cp pandoc/filters/satzspiegel.lua "$(PANDOC_DATA)/filters/"
	cp satzspiegel.css satzspiegel-code.css fonts.css "$(LOCAL)/"
	cp pandoc/review/satzspiegel-review.js pandoc/review/satzspiegel-review.css "$(LOCAL)/pandoc/review/"
	rm -rf "$(LOCAL)/fonts" && cp -R fonts "$(LOCAL)/fonts"
	for d in satzspiegel satzspiegel-review satzspiegel-review-light; do \
	  sed -e 's#$(HOSTED)#$(LOCAL)/#' "pandoc/defaults/$$d.yaml" > "$(PANDOC_DATA)/defaults/$$d-local.yaml"; \
	done
	@echo "installed: pandoc -d satzspiegel | -gfm | -review | -review-light, and -local variants of each for offline use"

uninstall: ## remove what install put in place
	@test -n "$(PANDOC_DATA)" || { echo "pandoc not found; nothing to remove from its data directory"; exit 1; }
	@test -n "$(LOCAL)" || { echo "HOME is not set"; exit 1; }
	rm -f "$(PANDOC_DATA)/templates/satzspiegel.html" "$(PANDOC_DATA)/filters/satzspiegel.lua"
	rm -f "$(PANDOC_DATA)"/defaults/satzspiegel*.yaml
	rm -rf "$(LOCAL)"

check: verify-fonts ## contrast, a render of every kind, the review round trip on the command line
	python3 scripts/contrast.py satzspiegel.css
	mkdir -p build/check
	$(RENDER) -f $(READER_MD) -V fonts-css=../../fonts.css -c ../../satzspiegel.css -c ../../satzspiegel-code.css sample.md -o build/check/patina.html
	$(RENDER) -f $(READER_MD) -V theme=archive -V fonts-css=../../fonts.css -c ../../satzspiegel.css -c ../../satzspiegel-code.css sample.md -o build/check/archive.html
	$(RENDER) -f $(READER_GFM) -V fonts-css=../../fonts.css -c ../../satzspiegel.css -c ../../satzspiegel-code.css sample.md -o build/check/gfm.html
	$(REVIEW) -f $(READER_MD) sample.md -o build/check/review.html
	$(REVIEW) -f $(READER_MD) -V nofonts sample.md -o build/check/review-light.html
	$(call assert-embedded,build/check/review.html)
	$(call assert-embedded,build/check/review-light.html)
	@grep -q 'class="md-table-scroll"' build/check/patina.html
	@grep -q 'data-md-theme="archive"' build/check/archive.html
	@grep -q 'id="satzspiegel-annotations"' build/check/review.html
	@! grep -q 'font/woff2' build/check/review-light.html
	node scripts/annotations.mjs build/check/review.html | grep -q 'Review comments (0'
	@echo "check: ok"

verify-fonts: ## the font files match fonts/SHA256SUMS
	@cd fonts && shasum -a 256 -c SHA256SUMS --quiet && echo "fonts: $$(wc -l < SHA256SUMS | tr -d ' ') files verified"

fonts: ## re-fetch the WOFF2 subsets and licences, rewrite fonts.css and SHA256SUMS
	node scripts/fetch-fonts.mjs

sample: ## sample.md into build/: patina, archive, gfm, embedded, embedded without fonts
	mkdir -p build/docs && cp docs/scale.svg build/docs/
	$(RENDER) -f $(READER_MD) -V fonts-css=../fonts.css -c ../satzspiegel.css -c ../satzspiegel-code.css sample.md -o build/sample-patina.html
	$(RENDER) -f $(READER_MD) -V theme=archive -V fonts-css=../fonts.css -c ../satzspiegel.css -c ../satzspiegel-code.css sample.md -o build/sample-archive.html
	$(RENDER) -f $(READER_GFM) -V fonts-css=../fonts.css -c ../satzspiegel.css -c ../satzspiegel-code.css sample.md -o build/sample-gfm.html
	$(RENDER) -f $(READER_MD) -V fonts-css=fonts.css -c satzspiegel.css -c satzspiegel-code.css --embed-resources sample.md -o build/sample-embedded.html
	$(RENDER) -f $(READER_MD) -V nofonts -c satzspiegel.css -c satzspiegel-code.css --embed-resources sample.md -o build/sample-embedded-light.html
	@ls -l build/*.html

review: ## review editions of sample.md and the essay into build/
	mkdir -p build
	$(REVIEW) -f $(READER_MD) sample.md -o build/sample-review.html
	$(REVIEW) -f $(READER_MD) -V theme=archive sample.md -o build/sample-review-archive.html
	$(REVIEW) -f $(READER_MD) -V nofonts sample.md -o build/sample-review-light.html
	$(REVIEW) -f $(READER_MD) --resource-path=examples examples/01-essay.md -o build/01-essay-review.html
	$(call assert-embedded,build/sample-review.html)
	@ls -l build/*review*.html

examples: ## examples/*.md in both themes into build/examples
	mkdir -p build/docs && cp docs/scale.svg build/docs/
	$(call render-examples,build/examples,../../)
	@ls build/examples

readme: ## README.md as index.html (the home page) and readme-review.html (its review edition)
	$(RENDER) -f $(READER_GFM) -M pagetitle=Satzspiegel -V fonts-css=fonts.css -c satzspiegel.css -c satzspiegel-code.css README.md -o index.html
	$(REVIEW) -f $(READER_GFM) -M pagetitle="Satzspiegel, review edition" -V nofonts README.md -o readme-review.html
	$(LINKS) index.html readme-review.html
	$(call assert-embedded,readme-review.html)
	@echo "index.html and readme-review.html rendered from README.md"

showcase: ## docs/showcase.md in both themes, the source of docs/img/themes.png
	mkdir -p build/showcase
	$(RENDER) -f $(READER_MD) -V fonts-css=../../fonts.css -V nocolophon -c ../../satzspiegel.css -c ../../satzspiegel-code.css docs/showcase.md -o build/showcase/patina.html
	$(RENDER) -f $(READER_MD) -V theme=archive -V fonts-css=../../fonts.css -V nocolophon -c ../../satzspiegel.css -c ../../satzspiegel-code.css docs/showcase.md -o build/showcase/archive.html
	@echo "rendered build/showcase/{patina,archive}.html; shoot docs/img/themes.png with scripts/themes-shot.js"

site: readme ## the GitHub Pages site into _site/
	rm -rf _site
	mkdir -p _site/docs _site/plates _site/input _site/pandoc/review _site/examples
	cp satzspiegel.css satzspiegel-code.css fonts.css index.html readme-review.html specimen.html _site/
	cp -R fonts _site/fonts
	cp -R pandoc/templates pandoc/defaults pandoc/filters _site/pandoc/
	cp pandoc/review/satzspiegel-review.js pandoc/review/satzspiegel-review.css _site/pandoc/review/
	cp docs/scale.svg _site/docs/ && cp -R docs/img _site/docs/img
	cp plates/plates.html plates/plates.css _site/plates/
	cp input/markdown.css input/markdown-code.css _site/input/
	$(RENDER) -f $(READER_MD) -M pagetitle="Awards and component set" -V theme=archive -V fonts-css=../fonts.css -c ../satzspiegel.css -c ../satzspiegel-code.css docs/rationale.md -o _site/docs/rationale.html
	$(RENDER) -f $(READER_MD) -V fonts-css=../fonts.css -c ../satzspiegel.css -c ../satzspiegel-code.css docs/usage.md -o _site/docs/usage.html
	$(REVIEW) -f $(READER_MD) sample.md -o _site/examples/sample-review.html
	$(call assert-embedded,_site/examples/sample-review.html)
	$(call render-examples,_site/examples,../)
	$(LINKS) _site/docs/*.html
	@find _site -name '*.html' | sort

serve: ## static server on http://127.0.0.1:8765
	python3 -m http.server 8765 --bind 127.0.0.1

clean: ## remove build/ and _site/
	rm -rf build _site
