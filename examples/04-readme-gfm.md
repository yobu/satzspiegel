# A GitHub README

This file is GitHub-flavoured Markdown, the dialect of READMEs, issues and pull requests. Render it with the GFM defaults so that alerts, task lists and footnotes are read the way GitHub reads them:

```bash
pandoc examples/04-readme-gfm.md -d satzspiegel-gfm -o readme.html
```

GFM has no title block, so the running head stays empty and the first heading is the title. It also has no definition lists, no highlight marks and no line-number attributes; those appear only in the Pandoc Markdown examples.

## Alerts

> [!NOTE]
> Useful information that readers should know, even when skimming.

> [!TIP]
> Helpful advice for doing things better or more easily.

> [!IMPORTANT]
> Key information readers need to achieve their goal.

> [!WARNING]
> Urgent information that needs immediate attention to avoid problems.

> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.

By default all five share one forme: the label says the severity, the rule is muted, and only the note takes the spot colour. Add `md--tinted-alerts` to the `.md` element for one hue per severity.

## Installation

1. Install Pandoc.
   ```bash
   brew install pandoc
   ```
2. Clone the repository and install the template, defaults and filter.
   ```bash
   git clone https://github.com/yobu/satzspiegel.git
   cd satzspiegel && make install
   ```
3. Render a document.

Press <kbd>⌘</kbd> <kbd>Shift</kbd> <kbd>.</kbd> in the Finder to see the hidden `.local` folder the install writes to.

## Release checklist

- [x] Two themes, every text colour at least 4.5 : 1
- [x] Fonts self-hosted, with their licences
- [x] Pandoc template, defaults and filter
- [ ] Repository public, Pages enabled
- [ ] Version 1.0.0 tagged

## Compatibility

| Pipeline        | Tables | Footnotes | Alerts | Task lists | Highlighting |
|:----------------|:------:|:---------:|:------:|:----------:|:-------------|
| Pandoc Markdown |  yes   |    yes    |  yes   |    yes     | at build time |
| Pandoc GFM      |  yes   |    yes    |  yes   |    yes     | at build time |
| remark, rehype  |  yes   |    yes    | plugin |    yes     | Shiki or Prism |
| markdown-it     | plugin |  plugin   | plugin |   plugin   | highlight.js |

## Details

<details>
<summary>Why are the fonts in the repository and not on Google Fonts?</summary>

A page that loads its fonts from a third party sends every reader's address to that party. Serving the files from the same place as the stylesheet keeps the page to one host, and an embedded document to none.

</details>

<details>
<summary>Can I use it without Pandoc?</summary>

Yes. Link the stylesheet, wrap your rendered Markdown in `<div class="md-host"><main class="md">`, and emit the table wrapper from your own pipeline.

</details>

## Links and footnotes

Autolinks work: https://pandoc.org. So does ~~strikethrough~~ and a footnote.[^1] Plain HTML such as <sub>subscript</sub> and <sup>superscript</sup> passes through.

[^1]: GitHub renders footnotes at the foot of the README. Satzspiegel's Patina theme moves them into the outer margin when the window is wide enough.
