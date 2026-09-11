---
title: Type area before typeface
subtitle: Seven principles from the 2025 and 2026 book design juries
author: Satzspiegel, example 1
date: September 2026
lang: en-GB
---

A book jury does not open a book at the typeface. It opens it at the page, and it looks at the block of set text and the four margins around it before it reads a word. The German word for that block is *Satzspiegel*, and the criteria of Stiftung Buchkunst put it first, ahead of the typeface, ahead of legibility, ahead of the book as an object.[^criteria]

This essay is set in Pandoc Markdown and nothing else. Every device you see, the running head, the lead paragraph, the notes in the margin, the rule between sections, comes from the stylesheet reading the markup that Pandoc emits.

## The column comes first

The commonest failure in rendered Markdown is the reverse of the jury's order: a carefully chosen face poured into a column nobody considered. The column is too wide for the size, or too narrow for the leading, or it has a different left edge for every heading because each block was capped separately.

A column is a relationship, not a width. It is the measure against the size of the type, the leading against the measure, the margins against the column. Change one and the others want to move. That is why Satzspiegel sets the measure once, on the container, at text size, and lets every other space derive from a single unit of leading.[^rhythm]

> The design lets the boundary between content and form blur, folding the printed sheets so that colour fields migrate into the interior of the binding.
>
> <cite>Jury citation for the Goldene Letter 2026, paraphrased</cite>

#### Small is a register {.md-runin}

Nine of the fourteen prizewinners in Leipzig this year were under 230 millimetres on the long edge, and one was 50 by 68. Small format is not a constraint the winners work around. It is the register they work in, and in that register the margins do as much of the setting as the type does.

#### One colour, used for structure {.md-runin}

The winning books are printed in ink and one second forme, and the second colour is spent on structure: a numeral, a rule, a reference mark. It is never spent on decoration, and there is never a third.

---

## Depth by style, not size

Markdown offers six heading levels and most stylesheets answer with six sizes. Books answer with three sizes and then change the voice: weight for the fourth level, italic for the fifth, small capitals for the sixth. The reader can tell a subsection from a section without measuring anything.

The same economy applies to rules. Where a rule appears in a winning book it is a hairline, it is horizontal, and it does a job. Nobody on the juries rewarded a box drawn around a paragraph.

| Where the principle came from,
| and how far it travels:
| from a folded sheet in The Hague
| to a stylesheet on a screen.

## Legibility under load

The €10,000 prize of Stiftung Buchkunst went this year to a children's guide for catastrophes, a book whose whole job is to be understood by someone frightened. The Jan Tschichold Award went to two designers who treat typography as a cultural and political fact.[^tschichold] Both prizes reward type that has to work, which is exactly what a document rendered from Markdown has to do.

[^criteria]: The criteria name the type area, the typeface and typography, legibility, and the book as an object with a front, a spine and a back.
[^rhythm]: One unit of leading is the line height multiplied by the text size. Every vertical space in the stylesheet is a multiple of it.
[^tschichold]: Coline Sunier and Charles Mazé, Marseille and Paris. The award carries CHF 25,000.
