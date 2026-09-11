---
title: Tables
subtitle: Pipe, simple and grid tables; numeric columns; one table too wide for the page
author: Satzspiegel, example 3
date: September 2026
---

Tables follow editorial practice: no vertical rules, three horizontal hairlines at most, the caption above, tabular lining figures in every right-aligned column. Markdown marks a column as numeric with a colon on the right of its separator, and the stylesheet needs nothing more.

## A numeric pipe table

| Tier                 | Awarded | Share |
|:---------------------|--------:|------:|
| Gold                 |      13 |   8.2 |
| Silver               |      26 |  16.4 |
| Bronze               |      28 |  17.6 |
| Certificate of Merit |      92 |  57.9 |
| **Total**            | **159** | **100.0** |

: TDC72 Type-High medals and Certificates, all three disciplines. Share in per cent.

## A compact table

The compact variant halves the row height for tables read by lookup rather than in order. In Pandoc Markdown the class goes at the end of the caption.

| Token            | Patina | Archive |
|:-----------------|-------:|--------:|
| Text size (px)   |   19.0 |    15.5 |
| Leading          |   1.62 |    1.55 |
| Measure (ch)     |     93 |     106 |
| Notes column (ch)|     24 |       — |
| Spot contrast    |   7.11 |    9.37 |
| Faint contrast   |   4.71 |    4.59 |

: Theme tokens, as released. {.md-table--compact}

## A simple table

  Competition                     Entries   Selected
  ----------------------------  ---------  ---------
   Best Dutch Book Designs            281         33
   Most Beautiful Swiss Books         388         17
   AIGA 50 Books \| 50 Covers         536        100
   Best Book Design, Leipzig          570         14

: Written as a simple table. A heading flush left with its dashes aligns the column left; flush right aligns it right.

## A grid table with lists in its cells

+----------------------+--------------------------------+-------------------------------------+
| Principle            | What the juries rewarded       | What the stylesheet does            |
+:=====================+:===============================+:====================================+
| Type area first      | - a considered column          | Sets the measure once, on the       |
|                      | - margins doing the work       | container, at text size.            |
+----------------------+--------------------------------+-------------------------------------+
| One spot colour      | A second forme spent on a      | One `--md-spot` token per theme,    |
|                      | numeral, a rule, a mark.       | used for markers, notes and names.  |
+----------------------+--------------------------------+-------------------------------------+
| Hairlines only       | Horizontal rules, no boxes,    | Three rules in a table; code        |
|                      | no fills.                      | between two rules; no cards.        |
+----------------------+--------------------------------+-------------------------------------+

: Three of the seven principles, and their consequence in CSS.

## A table too wide for the page

When a table is wider than the column, it breaks into the margin first and then scrolls inside its own frame. The page itself never scrolls sideways.

| Award | Body | City | Month | Judges | Countries | Entries | Selected | Share | Top prize |
|:--|:--|:--|:--|--:|--:|--:|--:|--:|:--|
| Best Book Design from all over the World | Stiftung Buchkunst | Leipzig | March | 5 | 33 | 570 | 14 | 2.5 | Goldene Letter |
| Die Schönsten Deutschen Bücher | Stiftung Buchkunst | Frankfurt | June | 14 | — | 600 | 25 | 4.2 | Preis der Stiftung Buchkunst |
| The Best Dutch Book Designs | Best Verzorgde Boeken | Amsterdam | March | 11 | — | 281 | 33 | 11.7 | — |
| The Most Beautiful Swiss Books | Federal Office of Culture | Bern | March | 5 | — | 388 | 17 | 4.4 | Jan Tschichold Award |
| 50 Books \| 50 Covers | AIGA | New York | — | — | 29 | 536 | 100 | 18.7 | — |

: Book design competitions, 2025/2026 cycle. Entries as reported by each organiser; share is selections over entries, in per cent. The Dutch count combines the professional and student juries.
