# Satzspiegel

I exchange Markdown with my team all the time: plans, specs, research notes, a good part of it drafted with Claude. The files were fine for me and hard on everyone else. Designers and strategists do not edit Markdown, GitHub wants an account, the Word export is too heavy, and the feedback came back in meetings, Slack and mail threads, and honestly, little of it made it back into the source.

So I built Satzspiegel. It turns a Markdown file into a page set like a book, and the same page can carry your readers' comments back to you.

![The same document in the two themes: Patina on the left, Archive on the right](docs/img/themes.png)

## One command

Install [Pandoc](https://pandoc.org/installing.html). On a Mac:

```bash
brew install pandoc
```

Then, on Mac or Linux:

```bash
git clone https://github.com/yobu/satzspiegel.git && cd satzspiegel && make install
```

On Windows, in PowerShell, with [Git for Windows](https://git-scm.com/download/win) or the repository unpacked from a zip:

```powershell
git clone https://github.com/yobu/satzspiegel.git; cd satzspiegel; powershell -ExecutionPolicy Bypass -File install.ps1
```

Then, anywhere:

```bash
pandoc plan.md -d satzspiegel -o plan.html
```

## Send it, get it back with comments

```bash
pandoc plan.md -d satzspiegel-review -o plan.html
```

One file, about 1.1 MB, nothing to install on the other side. This is what a reviewer sees after two comments and a reply:

![The review edition: highlighted passages, comment cards beside them, a reply, and the bar with Save a copy, Merge files and Export](docs/img/review.png)

```
  you                                              your reviewer
  ───                                              ─────────────
  pandoc plan.md -d satzspiegel-review
        │
        │  plan.html, one file
        ├──── mail, chat or a shared drive ──────▶  opens it, even offline
        │                                           selects a passage, writes a comment
        │                                           replies, edits, deletes
        │                                           Save a copy  →  plan.annotated.html
        ◀──────────── sends it back ────────────────────┘
        │
  opens plan.annotated.html
  the comments sit beside the passages they belong to
  Merge files…  adds the copies from other reviewers
  Export        gives the comments as a Markdown list to work from
```

The comments live inside the file as [W3C Web Annotations](https://www.w3.org/TR/annotation-html/). No server, no accounts, nothing leaves anyone's machine. Current Chrome, Edge, Safari and Firefox.

Try it on this page: [readme-review.html](readme-review.html) is this README as a review edition.

## The switches

- `-V nofonts` leaves the four typefaces out; the reader's system fonts step in and the file drops from 1.1 MB to about 90 KB.
- `-V theme=archive` switches from Patina to Archive, smaller and with numbered sections.
- `-V nocolophon` removes the faint "Set with Satzspiegel" line at the foot.
- `-V measure=72ch` sets the column width for one document.
- `--embed-resources` makes the plain page self-contained too.
- A fenced `mermaid` block becomes a diagram in the theme's colours, drawn at render time and written into the file as an image. Needs `npm install -g @mermaid-js/mermaid-cli`; without it the block stays code.

They combine: `pandoc plan.md -d satzspiegel-review -V nofonts -V theme=archive -o plan.html`.

## Why it looks the way it does

*Satzspiegel* is the German word for the type area, the block of set text and its four margins, which book design juries judge before the typeface. The typography here is derived from what the 2025 and 2026 juries rewarded, at Stiftung Buchkunst, the Dutch and Swiss book competitions, AIGA, the Type Directors Club and D&AD. The [survey](docs/rationale.md) has the argument, the [plates](plates/plates.html) show every decision with its reason. Typefaces: Spectral, Schibsted Grotesk, Source Serif 4 and IBM Plex Mono, all under the SIL Open Font License, served from here.

## Before you send

Mail systems often quarantine HTML with a script in it, and the review edition has one. Zip it, or share a link, and test the route once with your own address. Merging is last writer wins: right for one author and a handful of reviewers, wrong for live co-editing.

## Everything else

The [usage guide](docs/usage.md): images and diagrams, the stylesheet without Pandoc, the code module, the opt-in classes, the typefaces and their licences, the command-line tool for returned files, the repository layout. MIT for the code; the typefaces keep their own licence.
