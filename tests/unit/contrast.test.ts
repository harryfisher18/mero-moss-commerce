import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * axe reports some text on semi-transparent backgrounds as "needs review" instead of a
 * violation, so the design tokens are checked directly against WCAG AA (4.5:1).
 */
const css = readFileSync("src/app/globals.css", "utf8");

type Rgb = readonly [number, number, number];

function token(name: string): Rgb {
  const match = new RegExp(`--mm-${name}:\\s*#([0-9a-f]{6})`, "i").exec(css);
  if (!match?.[1]) throw new Error(`Token ${name} not found`);
  const hex = match[1];
  return [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16)) as unknown as Rgb;
}

/** `color` at `alpha` opacity over `base`, as a Tailwind `bg-clay/15` is drawn. */
const over = (color: Rgb, alpha: number, base: Rgb): Rgb =>
  color.map((value, index) => value * alpha + (base[index] ?? 0) * (1 - alpha)) as unknown as Rgb;

function luminance(color: Rgb): number {
  const [r = 0, g = 0, b = 0] = color.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const WHITE: Rgb = [255, 255, 255];
const paper = token("paper");
const ink = token("ink");
const muted = token("muted");
const moss = token("moss");
const clay = token("clay");
const line = token("line");

describe("design token contrast meets WCAG AA", () => {
  it.each<[string, Rgb, Rgb]>([
    ["ink on paper", ink, paper],
    ["muted on paper", muted, paper],
    ["muted on white", muted, WHITE],
    ["moss on paper", moss, paper],
    ["moss on white", moss, WHITE],
    ["moss on a moss/15 tint", moss, over(moss, 0.15, paper)],
    ["clay on paper", clay, paper],
    ["clay on white", clay, WHITE],
    ["clay on a clay/5 tint", clay, over(clay, 0.05, paper)],
    ["clay on a clay/10 tint", clay, over(clay, 0.1, paper)],
    ["clay on a clay/15 tint", clay, over(clay, 0.15, paper)],
    ["paper on clay", paper, clay],
    ["paper on ink", paper, ink],
    ["paper on moss", paper, moss],
    ["ink on a line-colored badge", ink, line],
  ])("%s", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
