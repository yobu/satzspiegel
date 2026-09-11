---
title: Figures and mathematics
subtitle: Captioned figures, sized images, and equations rendered as MathML without JavaScript
author: Satzspiegel, example 6
date: September 2026
---

Figures break into the margin when there is margin to take, with their captions set a step smaller in the muted ink. Mathematics is rendered by the browser from MathML, so it needs no script and no network.

The defaults files render mathematics as MathML. Give Pandoc the folder as the resource path so the image is found:

```bash
pandoc examples/06-figures-math.md -d satzspiegel-local --resource-path=examples --embed-resources -o figures.html
```

## A captioned figure

![Three size steps. Below the third, depth is carried by weight, slope and small capitals instead of size.](../docs/scale.svg)

## A sized image

An image that should not fill the column takes a width attribute.

![The same scale at half the column.](../docs/scale.svg){width=50%}

## Rhythm as an equation

Every vertical space in the stylesheet is a multiple of one unit $r$, the leading $\ell$ multiplied by the text size $s$:

$$
r = \ell \cdot s, \qquad r_\text{Patina} = 1.62 \times 19\,\text{px} = 30.78\,\text{px}.
$$

Space after a heading is $0.5\,r$, between paragraphs $r$, before a section $2\,r$.

## Contrast as an equation

The contrast ratio between a text colour and its paper is

$$
C = \frac{L_1 + 0.05}{L_2 + 0.05}, \qquad L = 0.2126\,R + 0.7152\,G + 0.0722\,B,
$$

where $L_1$ is the relative luminance of the lighter colour, and each channel is linearised first:

$$
c_\text{linear} =
\begin{cases}
  c / 12.92 & \text{if } c \le 0.03928, \\
  \left( \dfrac{c + 0.055}{1.055} \right)^{2.4} & \text{otherwise.}
\end{cases}
$$

Every text colour in both themes satisfies $C \ge 4.5$.
