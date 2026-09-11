---
title: Type area before typeface
subtitle: What the 2026 juries rewarded
date: September 2026
---

A book jury does not open a book at the typeface. It opens it at the page, and it looks at the block of set text and the four margins around it before it reads a word.[^c] Nine of the fourteen prizewinners in Leipzig this year were under 230 mm on the long edge.

## Bronze Medals

| Work | Country | Height | Pages |
|:--|:--|--:|--:|
| *Heatwave* | Switzerland | 220 | 264 |
| *Collapsed Mythologies* | Netherlands | 225 | 344 |
| *Mountain 239* | South Korea | 68 | 288 |

: Formats as reported by Stiftung Buchkunst, in millimetres.

## Rhythm

```js
const rhythm = (leading, size) => leading * size;
// every vertical space is a multiple of one unit
export const space = { block: rhythm(1.62, 19) };
```

[^c]: The criteria name the type area first, then the typeface, then legibility.
