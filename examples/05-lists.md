---
title: Lists, glossaries and notes
subtitle: Nesting, numbering past nine, definition lists, example lists, line blocks and fenced notes
author: Satzspiegel, example 5
date: September 2026
---

Lists are where default Markdown rendering fails most visibly: the markers take the text figures, so "9." and "10." do not stack; nesting changes only the indent; and a loose list looks the same as a tight one.

## Numbering past nine

The markers use tabular lining figures and hang outside the text, so every full stop lands in one column.

7. Legibility under load.
8. Small is the professional register.
9. Nine. This is where alignment usually breaks.
10. Ten. The full stops share a column.
11. Eleven, with a nested sequence that changes counter style:
    a. lower alpha at the second level
    b. and, nested again:
        i. lower roman at the third
        ii. depth is legible without counting indents
12. Twelve.

## Unordered, mixed and loose

- A disc at the first level.
  - An en dash at the second.
    - A middle dot at the third.
- Mixed nesting:
  1. an ordered list inside an unordered one
  2. keeps its own figures

A loose list, where the source leaves a blank line between items, opens up to half a line of space without any class:

- The first item is a paragraph.

- So is the second. It runs to two lines at this measure so that the space between items can be compared with the leading inside an item.

- The third.

## Tasks

- [x] Type area settled
- [x] Spot colour chosen
- [ ] Face licensed for print

## A glossary

Satzspiegel
:   The type area: the block of set text on the page, and its relationship to the four margins.

Measure
:   Line length, counted in characters. Satzspiegel sets 93 in Patina and 106 in Archive.

Second forme
:   In letterpress, the second colour printed from its own plate. Here, the one spot colour a theme may use.

Optical size
:   A variable-font axis that adjusts contrast and spacing to the size at which type is set.

## Example lists

Pandoc numbers example lists across the whole document, so the sequence survives paragraphs in between.

(@) The first rule: the column before the face.

A paragraph interrupts the sequence.

(@) The second rule continues the numbering.
(@) The third.

## A line block

| Caption above,
| hairlines three,
| figures tabular,
| no zebra, no box, no key.

## Notes set as fenced divs

::: note
A fenced `note` div takes the alert treatment with no label. Use GitHub's `> [!NOTE]` syntax when the label matters.
:::

> [!TIP]
> Alerts written in GitHub syntax also work in Pandoc Markdown, because the defaults file turns on the `alerts` extension.
